# Wireloom for Obsidian

> 在 Obsidian 中将文本直接渲染为 UI 线框图 —— 让 AI 生成的界面原型一键可视化。

---

## 目录

- [项目简介](#项目简介)
- [设计目标](#设计目标)
- [功能特性](#功能特性)
- [系统要求](#系统要求)
- [编译构建](#编译构建)
- [部署安装](#部署安装)
- [使用指南](#使用指南)
- [配置说明](#配置说明)
- [故障排查](#故障排查)
- [技术架构](#技术架构)
- [相关资源](#相关资源)
- [许可证](#许可证)

---

## 项目简介

**Wireloom for Obsidian** 是一个 Obsidian 社区插件，它将 [Wireloom](https://github.com/stardock/wireloom) —— 一种专为 AI 代理设计的文本化线框图语言 —— 无缝集成到 Obsidian 的 Markdown 渲染流水线中。

在 Obsidian 笔记中编写 ` ```wireloom ` 代码块，插件会自动将其渲染为自包含的 SVG 线框图。无需切换工具、无需截图粘贴、无需维护外部文件，线框图与文档同源同生，实现真正的"文档即设计"。

### 为什么需要这个插件？

在 AI 时代，LLM 可以基于自然语言描述直接生成 Wireloom 代码。这意味着：

- **产品经理** 可以让 AI 根据 PRD 生成界面线框，直接嵌入需求文档
- **开发者** 可以在技术文档中维护实时更新的系统界面原型
- **设计师** 可以用文本快速迭代低保真方案，与团队共享
- **AI 工作流** 可以将"自然语言 → Wireloom → SVG"嵌入自动化文档生成管道

---

## 设计目标

本项目遵循以下核心设计原则：

| 原则 | 说明 |
|------|------|
| **AI 原生** | 插件架构支持 LLM 直接生成和修改线框图代码，无需人工操作 GUI |
| **文本优先** | 所有线框信息以纯文本形式存储，天然支持 Git 版本控制、diff 审查 |
| **零运行时依赖** | 渲染后的 SVG 自包含，无需外部字体、脚本或网络请求 |
| **Obsidian 原生体验** | 深度集成 Obsidian 的主题系统、设置面板和 Markdown 渲染管道 |
| **懒加载性能** | Wireloom 引擎按需加载，不影响 Obsidian 启动速度 |
| **错误友好** | 语法错误精确定位到行号和列号，附带智能修正提示 |

---

## 功能特性

- ✅ **Markdown 代码块渲染**：自动识别 ` ```wireloom ` 围栏代码块并渲染为 SVG
- ✅ **主题自适应**：支持浅色/深色主题，可自动跟随 Obsidian 当前主题
- ✅ **注释标注**：支持 `annotation` 节点，在 SVG 边缘绘制带引线的说明标签
- ✅ **错误精确定位**：解析失败时显示行号、列号和人类可读的错误消息
- ✅ **设置面板**：在 Obsidian 设置中配置主题模式和最大显示宽度
- ✅ **安全输出**：Wireloom 生成的 SVG 无脚本、无外部引用，可直接安全注入 DOM
- ✅ **全平台支持**：兼容 Windows、macOS、Linux 及 Obsidian 移动端
- ✅ **SSR 友好**：支持在构建时预渲染，适用于静态站点生成场景

---

## 系统要求

| 项目 | 最低版本 | 说明 |
|------|---------|------|
| Obsidian | v0.15.0+ | 需要支持 `registerMarkdownCodeBlockProcessor` API |
| Node.js | v18.0+ | 仅编译时需要 |
| npm | v8.0+ | 仅编译时需要 |
| Wireloom | v0.4.1+ | 运行时依赖，通过 npm 安装 |

---

## 编译构建

### 1. 获取源码

```bash
cd /path/to/your/vault/.obsidian/plugins/
git clone https://github.com/your-repo/wireloom-obsidian.git wireloom
cd wireloom
```

或下载本项目的 ZIP 包并解压到 `wireloom` 目录。

### 2. 安装依赖

```bash
npm install
```

> 如果安装缓慢，可使用国内镜像源：
> ```bash
> npm install --registry=https://registry.npmmirror.com
> ```

### 3. 执行构建

**生产构建**（推荐）：

```bash
npm run build
```

构建成功后，目录下会生成 `main.js` 文件（约 120KB+，包含 Wireloom 引擎）。

**开发构建**（带文件监视，修改源码后自动重新构建）：

```bash
npm run dev
```

### 4. 验证构建产物

```bash
ls -la main.js manifest.json styles.css
```

确认三个文件均存在且 `main.js` 大小大于 50KB（说明 Wireloom 引擎已正确打包）。

---

## 部署安装

### 方式一：手动安装（推荐）

1. 按上述步骤完成编译，确保 `main.js`、`manifest.json`、`styles.css` 三个文件已生成
2. 将这三个文件复制到你的 Obsidian Vault 的插件目录：
   ```
   .obsidian/plugins/wireloom/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
3. 重启 Obsidian
4. 进入 **设置 → 社区插件 → 已安装插件**
5. 找到 **Wireloom**，点击右侧开关启用
6. （首次启用可能需要关闭并重新打开安全模式确认）

### 方式二：BRAT 安装（测试版）

如果你使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件管理测试版插件：

1. 安装并启用 BRAT 插件
2. 打开命令面板，运行 **BRAT: Add a beta plugin for testing**
3. 输入本项目的 GitHub 仓库地址
4. BRAT 会自动下载最新构建并安装

### 方式三：Obsidian 社区插件市场（未来）

待本项目通过 Obsidian 社区插件审核后，可直接在 **设置 → 社区插件 → 浏览** 中搜索 "Wireloom" 一键安装。

---

## 使用指南

### 基础语法

在 Obsidian 笔记中插入 ` ```wireloom ` 代码块：

````markdown
## 登录页面线框

```wireloom
window "用户登录":
  header:
    text "欢迎回来" bold id="title"
  panel:
    input placeholder="请输入邮箱" id="email"
    input placeholder="请输入密码" type=password id="password"
    row:
      checkbox "记住我" id="remember"
      text "忘记密码？" id="forgot"
    button "立即登录" primary id="submit"
  footer:
    text "还没有账号？立即注册"

annotation "页面标题" target="title" position=top
annotation "主要操作按钮" target="submit" position=right
```
````

切换到**预览模式**或**阅读模式**，即可看到渲染的 SVG 线框图。

### 支持的组件

| 类别 | 组件 |
|------|------|
| 容器 | `window`, `header`, `footer`, `panel`, `section`, `tabs`, `row`, `col`, `list`, `grid`, `navbar`, `tabbar` |
| 输入 | `input`, `combo`, `slider`, `checkbox`, `radio`, `toggle` |
| 按钮 | `button` |
| 内容 | `text`, `kv`, `image`, `icon`, `chip`, `avatar`, `spinner` |
| 其他 | `tree`, `breadcrumb`, `divider` |
| 标注 | `annotation` |

### 完整语法参考

详见 Wireloom 官方文档：[design/grammar.md](https://github.com/stardock/wireloom/blob/main/design/grammar.md)

---

## 配置说明

在 **Obsidian 设置 → 社区插件 → Wireloom** 中可配置以下选项：

| 设置项 | 选项 | 默认值 | 说明 |
|--------|------|--------|------|
| **渲染主题** | 自动 / 浅色 / 深色 | 自动 | "自动"会实时跟随 Obsidian 的当前主题 |
| **最大宽度** | 任意 CSS 宽度值 | 100% | 控制 SVG 在预览中的最大显示宽度 |

### 主题切换行为

- 当 Obsidian 从浅色切换到深色主题时，插件会检测 `body.theme-dark` 类变化
- 由于 Obsidian 限制，已渲染的线框图不会自动刷新，插件会弹出提示建议重新打开文件或切换编辑/预览模式
- 新打开的文件会自动应用当前主题

---

## 故障排查

### 插件显示但启动失败，报错 `ENOENT: main.js`

**原因**：缺少构建产物。ZIP 源码包不包含 `main.js`，必须先运行 `npm run build`。

**解决**：
```bash
cd .obsidian/plugins/wireloom
npm install
npm run build
```

### 构建报错 `Cannot find package 'builtin-modules'`

**原因**：`esbuild.config.mjs` 依赖 `builtin-modules` 包，但 `package.json` 未声明。

**解决**：
```bash
npm install builtin-modules
npm run build
```

### 代码块渲染为普通文本，没有变成线框图

**原因**：当前处于**编辑模式**（Edit Mode）或**实时预览**（Live Preview）的编辑状态。

**解决**：切换到**阅读模式**（Reading Mode）或**预览模式**（Preview Mode）。Obsidian 的 `registerMarkdownCodeBlockProcessor` 仅在非编辑状态下生效。

### 报错 "Wireloom 引擎加载失败"

**原因**：`wireloom` npm 包未正确安装，或构建时未被打包进 `main.js`。

**解决**：
1. 确认 `node_modules/wireloom` 存在
2. 重新运行 `npm install && npm run build`
3. 检查 `main.js` 文件大小是否大于 50KB

### 中文显示异常或乱码

**原因**：Wireloom 使用内联 SVG 渲染，默认字体依赖系统字体栈。

**解决**：在 Obsidian 的自定义 CSS 中为 `.wireloom-block svg` 添加 `font-family` 覆盖，或确保系统安装了支持中文的字体。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian 编辑器                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ Markdown    │───→│ Wireloom    │───→│ SVG 线框图       │  │
│  │ 源码        │    │ 代码块处理器  │    │ (自包含, 无脚本)  │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────┘  │
│                            │                                 │
│                     ┌──────┴──────┐                         │
│                     │ 懒加载引擎   │                         │
│                     │ wireloom    │                         │
│                     │ (ESM/CJS)   │                         │
│                     └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

| 决策 | 理由 |
|------|------|
| **懒加载** | `import("wireloom")` 延迟到首次遇到代码块时才执行，避免拖慢 Obsidian 启动 |
| **动态导入桥接** | Wireloom 是 ESM 包，Obsidian 插件是 CJS，通过 `await import()` 实现兼容 |
| **innerHTML 注入** | Wireloom 官方保证返回 SVG 无 `<script>`、无外部引用，可直接安全注入 |
| **防抖刷新** | 主题切换时 300ms 防抖，避免频繁重渲染 |
| **错误降级** | 引擎加载失败或语法错误时显示友好提示，不阻断整个文档渲染 |

---

## 相关资源

- **Wireloom 官方仓库**：https://github.com/stardock/wireloom
- **Wireloom 在线编辑器**：https://wireloom.dev（如有）
- **Obsidian 插件开发文档**：https://docs.obsidian.md/Plugins/Getting+started
- **Mermaid**（同类文本图表工具）：https://mermaid.js.org
- **json-render**（AI 生成真实 UI 的框架）：https://github.com/vercel-labs/json-render

---

## 许可证

MIT License

---

> **注意**：本项目为社区驱动，非 Wireloom 官方出品。Wireloom 商标和核心引擎版权归 Stardock 所有。
