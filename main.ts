import { Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext, Notice } from "obsidian";

// 懒加载 wireloom，减少插件启动时间
let wireloomModule: any = null;

async function getWireloom() {
  if (!wireloomModule) {
    const mod = await import("wireloom");
    wireloomModule = mod.default || mod;
  }
  return wireloomModule;
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

    // 监听 Obsidian 主题切换（浅色/深色）
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.debouncedRefresh();
      })
    );

    console.log("Wireloom plugin loaded");
  }

  onunload() {
    console.log("Wireloom plugin unloaded");
  }

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
      const { svg } = await wireloom.render(id, source, { theme });

      el.innerHTML = svg;

      const svgEl = el.querySelector("svg");
      if (svgEl) {
        svgEl.style.maxWidth = this.settings.maxWidth;
        svgEl.style.height = "auto";
        svgEl.style.display = "block";
      }
    } catch (err: any) {
      el.addClass("wireloom-error");

      let msg = "Wireloom 渲染失败";
      if (err && typeof err === "object") {
        if ("line" in err && "column" in err) {
          msg = `第 ${err.line} 行，第 ${err.column} 列：${err.message || err}`;
        } else if ("message" in err) {
          msg = err.message;
        }
      }

      const pre = el.createEl("pre");
      pre.createEl("strong", { text: "Wireloom 错误：" });
      pre.createEl("span", { text: msg });
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

  constructor(app: any, plugin: WireloomPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Wireloom 设置" });
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

    containerEl.createEl("h3", { text: "语法示例", cls: "wireloom-help-header" });
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
}
