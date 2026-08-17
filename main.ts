import { Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext, Notice, Menu, TFile, TAbstractFile, TFolder, FuzzySuggestModal, App } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type { RenderOptions, RenderResult } from "wireloom";

interface WireloomModule {
  render(id: string, source: string, options?: RenderOptions): Promise<RenderResult>;
}

// 懒加载 wireloom，减少插件启动时间
let wireloomModule: WireloomModule | null = null;

async function getWireloom(): Promise<WireloomModule> {
  if (!wireloomModule) {
    const mod = await import("wireloom");
    wireloomModule = (mod.default ?? mod) as WireloomModule;
  }
  return wireloomModule;
}

/**
 * 防御性清洗 SVG：移除 <script>、内联事件处理器（on*）以及 javascript: 链接。
 * Wireloom 官方保证其输出不含脚本与外部引用，这里再做一层过滤，
 * 以满足 Obsidian 社区插件审核对 innerHTML 注入的要求。
 */
function sanitizeSvg(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) {
      return svg;
    }
    doc.querySelectorAll("script").forEach((node) => node.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        } else if (
          (name === "href" || name === "xlink:href") &&
          /^\s*javascript:/i.test(attr.value)
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svg;
  }
}

/**
 * 将未知类型的错误统一转换为可展示的消息。
 * Wireloom 的解析错误带有 line / column 信息，这里优先提取。
 */
function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.line === "number" && typeof obj.column === "number") {
      return `第 ${obj.line} 行，第 ${obj.column} 列：${String(obj.message ?? err)}`;
    }
    if (typeof obj.message === "string") {
      return obj.message;
    }
  }
  return String(err);
}

interface WireloomSettings {
  theme: "auto" | "light" | "dark";
  maxWidth: string;
}

const DEFAULT_SETTINGS: WireloomSettings = {
  theme: "auto",
  maxWidth: "100%",
};

export default class WireloomPlugin extends Plugin {
  settings: WireloomSettings;

  async onload() {
    await this.loadSettings();

    // 注册 wireloom 代码块处理器
    this.registerMarkdownCodeBlockProcessor(
      "wireloom",
      async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        await this.renderBlock(source, el, ctx);
      }
    );

    // 添加设置面板
    this.addSettingTab(new WireloomSettingTab(this.app, this));

    // 在笔记右上角「更多」菜单里加入导出入口
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        this.addExportMenuItem(menu, file);
      })
    );

    // 监听 Obsidian 主题切换（浅色/深色）
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.debouncedRefresh();
      })
    );

  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * 获取当前生效的主题
   */
  getEffectiveTheme(): "light" | "dark" {
    if (this.settings.theme === "auto") {
      return document.body.classList.contains("theme-dark") ? "dark" : "light";
    }
    return this.settings.theme;
  }

  /**
   * 渲染单个 wireloom 代码块
   */
  async renderBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    el.empty();
    el.addClass("wireloom-block");
    el.style.setProperty("--wireloom-max-width", this.settings.maxWidth);

    if (!source || source.trim().length === 0) {
      el.createEl("div", {
        text: "（空 Wireloom 代码块）",
        cls: "wireloom-empty",
      });
      return;
    }

    try {
      const wireloom = await getWireloom();
      const theme = this.getEffectiveTheme();
      const id = `wireloom-${ctx.docId}-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await wireloom.render(id, source, {
        theme: theme === "dark" ? "dark" : "default",
      });

      // 用 DOMParser 解析清洗后的 SVG，再以节点方式插入，避免 innerHTML 注入
      const doc = new DOMParser().parseFromString(sanitizeSvg(svg), "image/svg+xml");
      const svgNode = doc.documentElement;
      if (svgNode && svgNode.nodeName.toLowerCase() === "svg") {
        el.appendChild(svgNode);
      } else {
        throw new Error("无法解析 Wireloom 输出的 SVG");
      }
    } catch (err: unknown) {
      el.addClass("wireloom-error");

      const pre = el.createEl("pre");
      pre.createEl("strong", { text: "Wireloom 错误：" });
      pre.createEl("span", { text: errorMessage(err) });
    }
  }

  /**
   * 在笔记右上角「更多」菜单里加入导出项（仅对 .md 文件显示）
   */
  addExportMenuItem(menu: Menu, file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }
    menu.addItem((item) => {
      item
        .setTitle("导出 Wireloom SVG")
        .setIcon("download")
        .onClick(async () => {
          await this.exportSvgFromFile(file);
        });
    });
  }

  /**
   * 读取笔记里所有 ```wireloom 代码块，弹出文件夹选择器后逐个导出 SVG
   */
  async exportSvgFromFile(file: TFile) {
    const source = await this.app.vault.read(file);
    const blocks = this.extractWireloomBlocks(source);

    if (blocks.length === 0) {
      new Notice("当前笔记没有 wireloom 代码块");
      return;
    }

    const safeBase = file.basename.replace(/[\\/:*?"<>|]/g, "-");
    new ExportFolderModal(this.app, async (folder) => {
      await this.saveBlocksToFolder(blocks, folder, safeBase);
    }).open();
  }

  /**
   * 从 Markdown 文本中提取所有 ```wireloom 代码块内容
   */
  extractWireloomBlocks(source: string): string[] {
    const blocks: string[] = [];
    const re = /```wireloom\b[^\n]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  }

  /**
   * 把若干 wireloom 源码块渲染并保存到指定文件夹
   */
  async saveBlocksToFolder(blocks: string[], folder: TFolder, safeBase: string) {
    const wireloom = await getWireloom();
    const theme = this.getEffectiveTheme();
    const folderPath = folder.path === "/" ? "" : folder.path;

    let count = 0;
    const errors: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const filename = blocks.length === 1 ? safeBase + ".svg" : safeBase + "-" + (i + 1) + ".svg";
      const path = folderPath ? folderPath + "/" + filename : filename;
      try {
        const result = await wireloom.render("wireloom-export-" + (i + 1), blocks[i], {
          theme: theme === "dark" ? "dark" : "default",
        });
        const svg = result.svg;
        const target = this.app.vault.getAbstractFileByPath(path);
        if (target instanceof TFile) {
          await this.app.vault.modify(target, svg);
        } else {
          await this.app.vault.create(path, svg);
        }
        count++;
      } catch (err: unknown) {
        errors.push(filename + ": " + errorMessage(err));
      }
    }

    if (count > 0) {
      new Notice("已导出 " + count + " 个 SVG 到「" + (folderPath || "vault 根目录") + "」");
    }
    if (errors.length > 0) {
      new Notice("部分导出失败：\n" + errors.join("\n"), 8000);
    }
  }

  private refreshTimer: number | null = null;

  debouncedRefresh() {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.showRefreshNotice();
    }, 300);
  }

  showRefreshNotice() {
    new Notice("Wireloom：主题已切换，请重新打开文件或切换编辑/预览模式以刷新线框图", 4000);
  }
}

class WireloomSettingTab extends PluginSettingTab {
  plugin: WireloomPlugin;

  constructor(app: App, plugin: WireloomPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Wireloom 设置").setHeading();
    containerEl.createEl("p", {
      text: "Wireloom 是一个文本到线框图的渲染工具。在代码块中编写 wireloom 语法即可渲染 SVG 线框图。",
    });

    new Setting(containerEl)
      .setName("渲染主题")
      .setDesc("选择 Wireloom 线框图的主题模式。'自动'会跟随 Obsidian 当前的浅色/深色主题。")
      .addDropdown((dropdown) => {
        dropdown.addOption("auto", "自动（跟随 Obsidian）");
        dropdown.addOption("light", "浅色");
        dropdown.addOption("dark", "深色");
        dropdown.setValue(this.plugin.settings.theme);
        dropdown.onChange(async (value) => {
          this.plugin.settings.theme = value as "auto" | "light" | "dark";
          await this.plugin.saveSettings();
          this.plugin.showRefreshNotice();
        });
      });

    new Setting(containerEl)
      .setName("最大宽度")
      .setDesc("SVG 线框图在预览中的最大宽度，例如 100%、800px。")
      .addText((text) => {
        text.setPlaceholder("100%");
        text.setValue(this.plugin.settings.maxWidth);
        text.onChange(async (value) => {
          this.plugin.settings.maxWidth = value || "100%";
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName("语法示例").setHeading();
    const example = `\`\`\`wireloom
window "登录页面":
  header:
    text "欢迎回来" bold id="title"
  panel:
    input placeholder="邮箱" id="email"
    input placeholder="密码" type=password id="pwd"
    button "登录" primary id="login"
  footer:
    text "忘记密码？"

annotation "主标题" target="title" position=top
annotation "主操作按钮" target="login" position=right
\`\`\``;
    containerEl.createEl("pre", { text: example, cls: "wireloom-example" });
  }

  /**
   * 提供设置项的声明式定义，供 Obsidian 1.13.0+ 的设置搜索与渲染使用。
   * 旧版本 Obsidian 仍会回退到上面的 display() 方法。
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "渲染主题",
        desc: "选择 Wireloom 线框图的主题模式。'自动'会跟随 Obsidian 当前的浅色/深色主题。",
        control: {
          key: "theme",
          type: "dropdown",
          options: {
            auto: "自动（跟随 Obsidian）",
            light: "浅色",
            dark: "深色",
          },
        },
      },
      {
        name: "最大宽度",
        desc: "SVG 线框图在预览中的最大宽度，例如 100%、800px。",
        control: {
          key: "maxWidth",
          type: "text",
          placeholder: "100%",
        },
      },
    ];
  }
}

class ExportFolderModal extends FuzzySuggestModal<TFolder> {
  private onPick: (folder: TFolder) => void;

  constructor(app: App, onPick: (folder: TFolder) => void) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("选择导出文件夹");
  }

  getItems(): TFolder[] {
    const folders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
    return [this.app.vault.getRoot(), ...folders];
  }

  getItemText(folder: TFolder): string {
    return folder.path === "/" ? "/（vault 根目录）" : folder.path;
  }

  onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
    this.onPick(folder);
  }
}
