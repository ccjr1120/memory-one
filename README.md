# Memory One

让 Agent 在开始工作前，先记住你的项目约定、个人偏好和已经验证过的经验。

Memory One 是一个运行在本机的长期记忆服务：用 React 工作台管理记忆，用 SQLite 保存数据，并通过 Streamable HTTP MCP 接入 Codex、Claude Code、Cursor 或自建 Agent。

GitHub：https://github.com/ccjr1120/memory-one

## 先看实际界面

记忆总览：搜索、按 Scope 筛选，并查看每条记忆的召回次数和置信度。

![记忆总览](./docs/screenshots/memory-overview.png)

MCP 服务页：复制客户端配置、查看服务端点、启用 Codex 全局记忆指令，并查看工具调用统计。

![MCP 与 Codex 增强](./docs/screenshots/mcp-codex.png)

### 更新截图

截图由 `scripts/capture-screens.mjs` 生成。启动本地服务后，第一次使用需要下载 Chromium：

```bash
npx --yes playwright@1.55.0 install chromium
npm run screenshots
```

脚本默认访问 `http://127.0.0.1:8765`，覆盖 `docs/screenshots/` 下的两张图片。也可以按需调整地址、输出目录、视口和等待时间：

```bash
npm run screenshots -- \
  --base-url http://localhost:5173 \
  --output-dir docs/screenshots \
  --viewport 1280,900 \
  --wait-ms 2000 \
  --no-full-page
```

对应的环境变量是 `SCREENSHOT_BASE_URL`、`SCREENSHOT_OUTPUT_DIR`、`SCREENSHOT_VIEWPORT` 和 `SCREENSHOT_WAIT_MS`。

## 它解决什么问题

- **把经验保存下来**：偏好、项目决策、工作流程和重要事实都可以保存为长期记忆。
- **让 Agent 先查再做**：每轮任务开始时调用 `memory_get_context`，把相关经验带入当前任务。
- **按项目隔离查看**：用可选的 `scope` 分类项目记忆；不传 `scope` 时仍可搜索全局记忆。
- **本地可控**：默认使用本机 SQLite，不需要云端账号或额外数据库。
- **可观察**：MCP 页面展示总调用次数、成功率、平均耗时和每个工具的使用情况。

## 3 分钟启动

### 1. 准备环境

- Node.js 20 或更高版本
- npm

### 2. 安装并启动

```bash
git clone https://github.com/ccjr1120/memory-one.git
cd memory-one
npm install
npm run dev
```

`npm run dev` 会先清理开发端口 `8765` 和 `5173`，然后同时启动 API 服务与 Vite 前端。

### 3. 打开工作台

访问 <http://127.0.0.1:5173/>。

建议第一次按这个顺序体验：

1. 点击右上角 **新建记忆**，保存一条你希望 Agent 长期遵守的偏好。
2. 在左侧进入 **全部记忆**，搜索刚刚保存的内容，并点击卡片查看详情。
3. 进入 **MCP 服务**，复制配置并接入你的 Agent。
4. 如果你使用 Codex，继续完成下面的“Codex 增强”步骤。

## 接入 MCP 客户端

本地开发时的 MCP 地址是：

```text
http://127.0.0.1:8765/mcp/
```

MCP 服务默认要求 Bearer Key。进入 **MCP 服务 → MCP Key 管理** 创建 Key 后，使用页面的一次性配置复制按钮。配置格式如下：

```json
{
  "mcpServers": {
    "memory-one": {
      "type": "http",
      "url": "http://127.0.0.1:8765/mcp/",
      "headers": {
        "Authorization": "Bearer <你的 Key>"
      }
    }
  }
}
```

把这段配置放进客户端的 MCP 设置后，重启客户端或新开一个会话。平台 Agent、Codex 和其他客户端建议分别创建独立 Key，并按最小权限选择工具。新建 Key 的明文会保存在本地数据库中，之后可以再次复制。Memory One 默认只监听本机；如果要暴露到其他设备，请同时配置网络层和 Key 管理。

## Codex 增强：在哪里、为什么、怎么用

### 在哪里用

打开 Memory One 工作台，进入左侧 **MCP 服务** 页面，在 **Codex增强 / 全局任务前置记忆** 区域操作。

### 为什么要用

仅仅把 MCP 服务配置给 Codex，并不能保证每个任务都会先读取记忆。Codex 增强会把一小段全局工作指令写入 `~/.codex/AGENTS.md`，明确要求 Codex：

> 开始任何任务前，先调用一次 `memory_get_context`；在 Git 项目中使用仓库根目录的绝对路径作为 `scope`。

这样做的价值是把“先查记忆”变成稳定的任务前动作，而不是依赖你每次手动提醒。它适合经常在多个仓库之间切换、需要持续遵守项目约定，或希望 Agent 记住修正意见的场景。

### 怎么用

1. 在 **MCP Key 管理** 创建一个给 Codex 使用的 Key，至少勾选 `memory_get_context`；需要读写时再勾选对应工具。
2. 把带 `Authorization` Header 的 MCP 配置放进 Codex。
3. 打开 **MCP 服务**，找到 **Codex增强** 区域。
4. 点击 **启用全局记忆**；如果已有旧版本指令，按钮会显示 **更新全局指令**。
5. 重新启动 Codex，或开启一个新会话。
6. 在 Codex 中直接提出任务，例如“检查这个项目的部署配置”。正常情况下，任务开始阶段会先出现 `memory_get_context` 调用。

Memory One 只会替换自己管理的 `memory-one:codex` 标记区块，保留 `~/.codex/AGENTS.md` 中其他内容。写入动作必须由你在网页中主动点击完成，不会在安装或启动时自动修改 Codex 配置。

## 内置记忆管家

右下角的悬浮按钮会打开记忆管家。它可以搜索、保存、更新、软删除记忆，也可以总结你的偏好和特点。

如果要使用它：

1. 点击右下角的 Agent 按钮；首次打开会进入配置页。
2. 填写 Base URL，选择请求格式、获取模型列表并填写 API Key。
3. 可选填写默认 Scope，并决定每轮对话是否自动读取上下文。
4. 点击 **保存配置**，再从右下角打开记忆管家。

模型配置保存在本地 SQLite 数据库；记忆的读写仍通过 Memory One MCP 工具完成。

## MCP 工具

| 工具 | 用途 |
| --- | --- |
| `memory_get_context` | 每项任务开始时检索相关经验 |
| `memory_search` | 按关键词搜索记忆，可选 `scope` |
| `memory_store` | 保存偏好、事实、决策、流程或纠正意见 |
| `memory_get` | 按 ID 读取单条记忆 |
| `memory_list` | 列出记忆，可选 `scope` |
| `memory_update` | 更新记忆内容或元数据 |
| `memory_delete` | 软删除指定记忆，仅在用户明确要求时使用 |
| `memory_feedback` | 记录某条记忆是否有帮助，改善后续召回 |

### Scope 怎么填

`scope` 是分类字段，不是安全隔离边界。项目记忆使用仓库根目录的绝对路径，例如 `/Users/name/code/memory-one`；通用偏好省略 `scope`。`memory_get_context` 传入项目 `scope` 时联合召回当前项目与全局记忆，不传时只召回全局记忆；`memory_search` 不传 `scope` 时仍可跨分类搜索。

## 数据与配置

- 开发数据库：`data/memory.db`
- 修改数据库路径：设置 `MEMORY_DB_PATH`
- 修改服务端口：设置 `MEMORY_PORT`
- 前端开发地址：<http://127.0.0.1:5173/>
- 后端 API 地址：<http://127.0.0.1:8765/>
- MCP 地址：<http://127.0.0.1:8765/mcp/>

## 本地生产模式

通过 npm 全局安装后，可以使用 CLI 管理本地服务：

```bash
npm install -g @ccjr1120/memory-one
memory-one start
  memory-one status
  memory-one open
  memory-one update
  memory-one stop
```

服务默认运行在 <http://127.0.0.1:23888/>，MCP 地址为 <http://127.0.0.1:23888/mcp/>。数据库、PID 和日志保存在 `~/.local/share/memory-one`，不会写入 npm 包目录。执行 `memory-one update` 会更新全局 CLI，并在服务运行时自动重启服务。

从源码 checkout 安装并启动：

```bash
npm run install:local
```

该命令会安装依赖、构建前端和后端，清理端口 `23888`，并在后台启动服务。

- 工作台：<http://127.0.0.1:23888/>
- MCP：<http://127.0.0.1:23888/mcp/>
- 部署目录：`~/.local/share/memory-one`
- 部署数据库：`~/.local/share/memory-one/data/memory.db`
- PID：`data/memory-one.pid`
- 日志：`data/memory-one.log`

生产服务请使用 `npm run install:local`，它会在临时目录构建并把版本复制到上面的部署目录后启动。

## 发布到 npm

仓库已经包含 GitHub Actions 发布流程：每次推送 `main` 时，工作流会自动递增一个 patch 版本，npm 发布前会运行测试和构建，发布成功后再提交新的 `package.json` 与 `package-lock.json`。自动生成的版本提交不会再次触发发布循环。

首次配置需要完成两件事：

1. 在 npm 登录 `ccjr1120` 账号，进入 **Access Tokens** 创建一个具备发布权限的 token；包名是 scoped 包 `@ccjr1120/memory-one`。
2. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions → New repository secret** 中添加：

   - Name：`NPM_TOKEN`
   - Secret：刚才复制的 npm token

这个 workflow 当前读取的就是 GitHub Actions 的 **Repository secret**，不会把 token 写入代码。若 npm 账号并不是 `ccjr1120`，则不能发布这个 scope，需要先使用自己账号对应的 scope。

首次配置完成后，日常发布不需要手动切换分支或运行版本脚本，直接推送 `main` 即可：

```bash
git push origin main
```

例如当前版本为 `0.1.0` 时，推送一次 `main` 会自动发布 `@ccjr1120/memory-one@0.1.1`。`npm run v` 仍保留给需要手动发布 minor、major 或特殊 release 分支的场景。

本地全局安装后，使用下面的命令检查并更新到 npm 上的最新版本；如果服务正在运行，更新完成后会自动重启：

```bash
memory-one update
```

打开记忆工作台时，前端会检查当前版本和 npm 最新版本；发现新版本时会在顶部显示 3 秒通知条。

## 常见问题

**页面打不开？** 确认 `npm run dev` 仍在运行，并检查 `8765`、`5173` 是否被其他程序占用。开发脚本会自动清理这两个端口。

**Codex 没有读取记忆？** 确认 MCP 地址已配置，Codex 增强按钮已显示“已启用”，然后重启 Codex 或新开会话。

**记忆管家提示配置不完整？** 打开右下角 Agent 面板，在 **配置** Tab 填写 Base URL、请求格式和模型；非本地模型还需要填写 API Key。

**想备份记忆？** 开发版备份 `data/memory.db`，生产版备份 `~/.local/share/memory-one/data/memory.db`；服务停止后操作最稳妥。

## 开发

```bash
npm run dev       # API + Vite 前端
npm run install:local # 构建、复制并启动本地生产服务
```

前端使用 React、Vite 和 `lucide-react`，后端使用 Fastify、MCP SDK 和 better-sqlite3。界面约定记录在 [DESIGN.md](./DESIGN.md)。
