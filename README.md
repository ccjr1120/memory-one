# Memory One

让 Agent 在开始工作前，先记住你的项目约定、个人偏好和已经验证过的经验。

Memory One 是一个运行在本机的长期记忆服务。你可以通过可视化工作台管理记忆，并通过 MCP 将这些记忆提供给 Codex、Claude Code、Cursor 或自建 Agent。所有数据默认保存在本机 SQLite 数据库中。

GitHub：https://github.com/ccjr1120/memory-one

## 主要能力

- **长期保存经验**：记录偏好、事实、项目决策、工作流程和纠正意见。
- **任务前自动召回**：通过 `memory_get_context` 在 Agent 开始工作前读取相关经验。
- **区分项目与通用记忆**：使用可选的 `scope` 对记忆分类，同时支持项目记忆与全局记忆联合召回。
- **可视化管理**：搜索、筛选、新建、编辑和删除记忆，并查看召回次数与置信度。
- **本地存储**：默认仅监听本机地址，数据保存在本地 SQLite 数据库中。
- **调用可观察**：查看 MCP 调用次数、成功率、平均耗时和各工具使用情况。

## 界面预览

记忆总览：

![记忆总览](./docs/screenshots/memory-overview.png)

MCP 服务与 Codex 增强：

![MCP 与 Codex 增强](./docs/screenshots/mcp-codex.png)

## 安装与启动

### 环境要求

- Node.js 20 或更高版本
- npm

### 安装

```bash
npm install --global @ccjr1120/memory-one
```

### 启动

```bash
memoryone start
```

启动后：

- 工作台：<http://127.0.0.1:23888/>
- MCP 地址：<http://127.0.0.1:23888/mcp/>

也可以直接打开工作台：

```bash
memoryone open
```

如果端口 `23888` 已被占用，启动命令会询问是否终止占用进程。

## 快速上手

第一次使用时，建议按以下顺序操作：

1. 打开工作台，点击右上角 **新建记忆**。
2. 保存一条希望 Agent 长期遵守的偏好或项目约定。
3. 进入左侧 **MCP 服务** 页面。
4. 在 **MCP Key 管理** 中创建 Key，并选择该客户端可以使用的工具。
5. 复制 MCP 配置并添加到 Codex、Claude Code、Cursor 或其他 MCP 客户端。
6. 重启客户端或新建会话，然后开始使用。

## 接入 MCP 客户端

Memory One 默认要求客户端通过 Bearer Key 访问 MCP 服务。请先在 **MCP 服务 → MCP Key 管理** 中创建 Key，再复制对应配置。

配置格式如下：

```json
{
  "mcpServers": {
    "memory-one": {
      "type": "http",
      "url": "http://127.0.0.1:23888/mcp/",
      "headers": {
        "Authorization": "Bearer <你的 Key>"
      }
    }
  }
}
```

将配置添加到客户端的 MCP 设置后，重启客户端或开启新会话。

建议为不同客户端分别创建 Key，并只授予所需工具权限。Key 保存在本机数据库中，可以随时回到管理页面复制或撤销。Memory One 默认仅监听本机；如需从其他设备访问，还需要自行配置网络访问方式。

## 为 Codex 启用任务前记忆

仅将 MCP 服务添加到 Codex，不能保证 Codex 在每项任务开始前主动读取记忆。Memory One 可以向 Codex 的全局 `AGENTS.md` 写入一段受管理的任务前置指令。

### 启用方法

1. 在 **MCP Key 管理** 中创建 Codex 专用 Key，至少授权 `memory_get_context`；需要自动保存和修正记忆时，再授权写入工具。
2. 将带有 Authorization Header 的 MCP 配置添加到 Codex。
3. 在工作台中进入 **MCP 服务** 页面。
4. 找到 **Codex增强 / 全局任务前置记忆**。
5. 点击 **启用全局记忆**；已有旧版指令时，点击 **更新全局指令**。
6. 重启 Codex 或开启新会话。

启用后，Codex 会被要求：

- 每项任务开始前调用一次 `memory_get_context`。
- 在 Git 项目中使用仓库根目录的绝对路径作为 `scope`。
- 将用户表达的长期偏好、决定、纠正和项目约定及时写入或更新到 Memory One。

Memory One 只会替换 `~/.codex/AGENTS.md` 中由自己管理的 `memory-one:codex` 标记区块，不会覆盖其他内容。该操作只会在你主动点击按钮后执行。

## 使用内置记忆管家

点击工作台右下角的悬浮按钮可以打开记忆管家。它能够搜索、保存、更新和软删除记忆，也可以根据已有记忆总结你的偏好与特点。

首次使用需要完成模型配置：

1. 打开右下角的 Agent 面板并进入 **配置**。
2. 填写模型服务的 Base URL。
3. 选择请求格式并选择或填写模型。
4. 非本地模型服务需要填写 API Key。
5. 按需设置默认 Scope，以及是否在每轮对话前自动读取上下文。
6. 保存配置后开始对话。

模型配置保存在本机 SQLite 数据库中；记忆操作仍通过 Memory One 的 MCP 工具完成。

## MCP 工具

| 工具 | 用途 |
| --- | --- |
| `memory_get_context` | 在任务开始时检索相关经验 |
| `memory_search` | 按关键词搜索记忆，可选 `scope` |
| `memory_store` | 保存偏好、事实、决策、流程或纠正意见 |
| `memory_get` | 按 ID 读取单条完整记忆 |
| `memory_list` | 列出记忆，可选 `scope` |
| `memory_update` | 更新指定记忆的内容或元数据 |
| `memory_delete` | 软删除指定记忆，仅在用户明确要求时使用 |
| `memory_feedback` | 记录记忆是否有帮助，以改善后续召回 |

## Scope 使用建议

`scope` 是可选的分类字段，不是安全隔离边界。

- **项目记忆**：使用 Git 仓库根目录的绝对路径，例如 `/Users/name/code/my-project`。
- **通用记忆**：省略 `scope`。
- **其他分类**：也可以使用 `work`、`personal` 等自定义值。

`memory_get_context` 传入项目 `scope` 时，会联合召回该项目和全局记忆；省略 `scope` 时，只召回全局记忆。`memory_search` 省略 `scope` 时，可以跨分类搜索。

## CLI 命令

```bash
memoryone start   # 启动本地服务
memoryone stop    # 停止本地服务
memoryone status  # 查看运行状态
memoryone open    # 在浏览器中打开工作台
memoryone update  # 更新到最新版本
```

执行 `memoryone update` 时，如果服务正在运行，Memory One 会先停止服务，更新完成后再自动启动。

## 数据与备份

运行数据默认保存在：

```text
~/.local/share/memory-one/
```

其中：

- 数据库：`~/.local/share/memory-one/data/memory.db`
- PID：`~/.local/share/memory-one/memory-one.pid`
- 日志：`~/.local/share/memory-one/memory-one.log`

备份记忆时，建议先执行：

```bash
memoryone stop
```

然后复制 `memory.db` 文件。恢复时，在服务停止状态下用备份文件替换原数据库，再重新启动服务。

## 更新与卸载

更新到最新版本：

```bash
memoryone update
```

卸载程序：

```bash
memoryone stop
npm uninstall --global @ccjr1120/memory-one
```

卸载 npm 包不会自动删除 `~/.local/share/memory-one/` 中的数据库和配置。

## 常见问题

### 页面打不开

运行 `memoryone status` 检查服务状态；如果服务未运行，执行 `memoryone start`。启动失败时，查看：

```text
~/.local/share/memory-one/memory-one.log
```

### Codex 没有在任务开始前读取记忆

确认以下事项：

1. Codex 已配置 Memory One MCP 地址和 Bearer Key。
2. Key 已授权 `memory_get_context`。
3. 工作台中的 Codex 增强显示为已启用。
4. 启用后已经重启 Codex 或开启新会话。

### 记忆管家提示配置不完整

打开右下角 Agent 面板，在 **配置** 中检查 Base URL、请求格式、模型和 API Key。使用不需要鉴权的本地模型时，可以不填写 API Key。

### 如何确认 MCP 已连接

在客户端中调用一次 `memory_get_context`，然后打开工作台的 **MCP 服务** 页面查看调用统计。也可以让 Agent 保存一条测试记忆，再到 **全部记忆** 中搜索确认。
