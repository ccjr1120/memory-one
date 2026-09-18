# Memory One 复刻设计规格

本文档是 Memory One 的产品与工程复刻说明，目标是让团队在本地优先、单用户场景下实现功能等价版本。

## 1. 产品定位

Memory One 是个人长期记忆工作台：浏览器管理偏好、事实、决策、流程和纠正意见；外部 Agent 通过 Streamable HTTP MCP 读写记忆。核心承诺是“每轮任务开始先检索相关经验”。数据默认仅保存于本机 SQLite。

范围是单机单用户，不含账号、云同步、多租户权限。`scope` 是分类字段而非安全隔离边界；省略表示全局记忆，项目值使用仓库根目录的绝对路径。

## 2. 总体架构

```text
React/Vite 工作台 (5173)
        | REST/JSON + SSE
Fastify 应用服务器 (8765)
        |-- routes/system.ts：静态文件、SPA 与版本检查
        |-- routes/mcp.ts：MCP Streamable HTTP /mcp/
        |-- routes/agent.ts：内置记忆管家 /api/agent/*
        |-- routes/{memories,data,settings,integrations}.ts
        `-- MemoryStore
              `-- better-sqlite3 + SQLite FTS5 (data/memory.db)
```

开发命令同时启动 API 与 Vite，并先清理 8765、5173 的监听进程。生产构建在临时目录完成，复制到仓库外的 `~/.local/share/memory-one`，数据库也位于该部署目录，不能直接从源码 `public/`、`dist/` 或 `data/` 启动。

## 3. 后端模块

### 3.1 MemoryStore

负责建表、schema v2 迁移、CRUD、内容完整性、全文检索、召回事件、导出导入、MCP Key、Agent 配置、对话持久化和 MCP 调用统计。SQLite 开启 WAL 与 5 秒 busy timeout。删除是软删除（写入 `deleted_at`），普通查询排除已删除行。

搜索优先使用 FTS5 `memories_fts`（字段 `content/kind/scope/project/source`），用触发器同步 INSERT/UPDATE/DELETE；非法 FTS 查询回退内容子串匹配。结果按 BM25 排序，读取、搜索、上下文召回增加 `recall_count` 并更新 `last_recalled_at`。

写入先做 NFKC、空白折叠和小写归一化后计算 SHA256；完全重复返回已有记录。字符 bigram Jaccard 相似度达到 0.62 时返回相似候选，但不自动覆盖。只有显式提供 `supersedes_id` 才创建替代关系，被替代记忆不进入固定上下文。

### 3.2 MCP 层

使用 MCP SDK 的 `McpServer` 与 `StreamableHTTPServerTransport`，端点 `/mcp/`。内置 Agent 使用 `x-memory-one-internal`；外部默认要求 `Authorization: Bearer <key>`，可在 MCP 设置关闭。

`memory-get-context` 只返回仍在使用的记忆，先当前项目后全局，按 importance × confidence、pinned、最近召回和时间加权排序，并以约 2400 token 为预算截断。MCP 层按客户端身份、scope、limit 建立上下文缓存；缓存版本只由记忆写入版本控制，因此召回观察不会导致缓存失效。所有调用统计和 `context/search/get/list` 召回事件都会写入 SQLite。

| 工具 | 输入 | 行为 |
| --- | --- | --- |
| `memory-get-context` | `scope?`, `limit` 默认 10 | 返回 token 预算内的 `metadata.always_include=true` 固定上下文；传入项目 scope 时优先返回项目固定记忆，再返回全局固定记忆；省略 scope 仅返回全局固定记忆；当前任务已有结果时不得重复调用 |
| `memory-search` | `query`, `scope?`, `limit` 默认 20 | 按需使用 FTS 搜索具体历史记忆并记录召回 |
| `memory_store` | `content`, `kind?`, `scope?`, `confidence?`, `importance?`, `metadata?`, `supersedes_id?` | 创建；默认 kind=`fact`、confidence=1、importance=.5；完全重复返回已有记录并标记 duplicate |
| `memory_get` | `memory_id` | 返回单项；不存在返回 `memory_not_found` |
| `memory_list` | `scope?`, `limit` 默认 50 | 按发生/创建时间倒序 |
| `memory_update` | `memory_id`, `patch` | 局部更新，必要时先读取 |
| `memory_delete` | `memory_id` | 仅明确要求时调用，软删除 |
| `memory_feedback` | `memory_id`, `useful` | importance 加减 0.05，限制 0..1 |

对外把存储层 `project` 映射为 `scope`，内部固定 `scope="user"`，保持分类语义。

### 3.3 内置记忆管家

`/api/agent/stream` 接收消息、历史、provider、model、base_url、api_key、scope、auto_context，以 SSE 返回 `delta`、`tool`、`done`。支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages；系统提示要求中文、涉及记忆优先调用工具、删除前确认唯一目标；只有用户明确要求记住、保存、修改或删除时才写入，未明确要求但可能值得保存时先询问确认。每个新任务的首次消息默认先调 `memory-get-context`，同一任务后续具体历史信息使用 `memory-search`；“有哪些记忆/总结特点”等概览问题改用 `memory_list`（最多 50 条）。Agent 消息与工具调用写入 `agent_messages`。

## 4. 数据模型

### memories

`id TEXT PK`、`content TEXT NOT NULL`、`kind TEXT`、`scope TEXT`、`project TEXT NULL`、`session_id TEXT NULL`、`source TEXT NULL`、`occurred_at TEXT NULL`、`confidence REAL`、`importance REAL`、`metadata_json TEXT`、`embedding BLOB NULL`、`created_at`、`updated_at`、`deleted_at NULL`、`recall_count INTEGER`、`last_recalled_at NULL`、`content_hash TEXT NULL`、`supersedes_id TEXT NULL`、`superseded_by TEXT NULL`。索引覆盖 scope/project、session、occurred_at、content_hash 和替代关系；embedding 目前预留，检索使用 FTS。

### memory_recall_events

自增 id、memory_id、source（`context/search/get/list`）、query、created_at，用于单项和全局召回诊断。

### mcp_tool_calls

自增 id、tool_name、success、duration_ms、called_at，用于总调用次数、成功率、平均耗时、最近调用和按工具拆分统计。

### mcp_keys

id、name、prefix、key_hash（唯一）、allowed_tools JSON、is_default、created_at、last_used_at、revoked_at、secret（本地可再次复制）。认证使用 hash；撤销写入 revoked_at。

### agent_config / agent_messages / mcp_config

三张单行配置/消息表：Agent 配置保存名称、默认 scope、provider、model、base_url、api_key、auto_context；消息保存 user/assistant 内容和工具调用 JSON；MCP 配置保存 `use_bearer_key`。

## 5. REST 接口契约

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/memories?scope=&project=&limit=` | 列表 |
| GET | `/api/search?query=&scope=&project=&limit=` | 搜索并增加召回 |
| GET | `/api/memories/most-recalled` | 召回排行 |
| GET/POST/PATCH/DELETE | `/api/memories[/:id]` | CRUD；POST 缺 content 返回 422 |
| GET | `/api/memories/:id/recalls` | 单项最近召回事件 |
| GET | `/api/diagnostics/recalls` | 全局最近召回诊断 |
| GET | `/api/data/export` | 安全 JSON 导出 |
| POST | `/api/data/import` | merge/replace 导入 |
| GET | `/api/mcp/stats` | 调用统计 |
| GET/PUT | `/api/mcp/config` | Bearer 开关 |
| GET/POST/DELETE | `/api/mcp/keys[/:id]` | Key 列表、创建、撤销 |
| POST | `/api/agent/models` | 获取模型列表 |
| POST | `/api/agent/stream` | Agent SSE 对话 |
| GET | `/api/integrations/codex` | 检查 Codex 指令状态 |
| POST | `/api/integrations/codex/install` | 写入 Codex 指令 |
| GET | `/api/integrations/codex/mcp` | 检查 Codex MCP 配置 |
| POST | `/api/integrations/codex/mcp/install` | 写入 Codex MCP 配置 |
| GET | `/api/integrations/claude` | 检查 Claude Code 全局增强状态 |
| POST | `/api/integrations/claude/install` | 写入 Claude Code 全局增强 |
| GET | `/api/integrations/claude/mcp` | 检查 Claude Code MCP 配置 |
| POST | `/api/integrations/claude/mcp/install` | 写入 Claude Code MCP 配置 |

错误使用 `{detail: string}`；前端将配置缺失、供应商失败、加载失败映射为中文提示。

## 6. 前端信息架构

桌面为三栏：左侧导航约 244px、中间内容、右侧详情检查器；低于 1120px 详情变底部抽屉，低于 760px 导航变抽屉，Agent 面板全宽浮层。

导航：全部记忆、时间线、归档、偏好与习惯、Scope 分类、标签、MCP 服务、设置。工具栏提供搜索、scope 选择、新建记忆、主题切换。卡片显示类型、时间、正文、scope、置信度、召回次数；点击打开详情，可编辑或软删除。

MCP 页面有“配置/调用统计”标签：endpoint、JSON 配置、工具清单、Bearer 开关、Key 管理、复制反馈；Codex 和 Claude Code 区域显示 MCP 连接与任务前置记忆状态、启用/更新按钮，并保留紧凑的客户端 eyebrow。设置页新增数据备份：导出 JSON、合并导入和需要确认的替换导入。记忆详情显示最近召回来源、查询和时间。右下角 Agent 按钮打开记忆管家；首次进入配置 Tab，填写 Base URL、协议、模型、Key 后进入对话 Tab。Agent 配置模式只显示配置表单并自动保存，不显示对话输入框；顶部模式按钮提供明确的“返回对话”操作。

Composer 模态用于新建/编辑：正文为主输入，kind、scope、source、confidence、importance、occurred_at、metadata 为辅助字段。保存后刷新并选中新项。按钮用 lucide 图标并提供 tooltip，搜索支持 Cmd/Ctrl+K。

## 7. 视觉与交互规范

- 轻色为冷白，暗色为蓝黑；唯一高饱和色 Prompt Blue（light `oklch(55% .18 255)`、dark `oklch(71% .16 255)`）。
- 默认扁平表面与 1px 边框，阴影仅用于 hover、选中、弹窗；禁止渐变、玻璃拟态、装饰 blob、营销 hero。
- 正文用系统无衬线；日期、ID、计数、状态用等宽字体。半径：控件 6px、卡片 10px、模态 14px、分类徽章可 pill。
- 使用 8px 间距节奏和克制标题层级；页面标题可较大，面板标题紧凑。
- 每个交互提供 hover、focus、disabled、loading、error、empty，支持 `prefers-reduced-motion`。
- 文案为中文，用户记忆正文原样显示。

## 8. 关键流程

### 首次使用

启动 -> 打开工作台 -> 新建记忆 -> 搜索/查看详情 -> MCP 页面创建按工具授权的 Key -> 复制 JSON 到客户端 -> 可选启用 Codex 或 Claude Code 全局指令 -> 重启客户端或新会话。

### Agent 一轮

新任务首次提交消息 -> 校验配置 -> 自动 `memory-get-context`；同一任务后续提交消息跳过固定上下文读取 -> 注入 provider 请求 -> provider 可能发起 `memory-search` 等 MCP 调用 -> 执行并回传 -> SSE 展示文本/工具状态 -> 保存消息 -> 发生写入/删除时刷新工作台。

### Codex / Claude Code 集成

读取对应客户端的全局指令文件 -> 只替换 `memory-one:codex` 或 `memory-one:claude` 标记区块 -> 保留其他内容 -> 写入“新任务开始前调用 memory-get-context，后续按需使用 memory-search”。MCP 配置也只替换 `memory-one` 条目。所有写入只能由用户在页面点击触发。

## 9. 复刻验收清单

- `npm run dev` 清理端口并同时启动前后端；生产构建不使用源码数据库。
- 八个 MCP 工具的 schema、软删除、scope、召回和 feedback 行为一致。
- FTS 搜索、空结果、非法查询回退、上限与错误码可用。
- 三栏/响应式抽屉、Composer、详情编辑、主题、Key、统计和 Agent SSE 可操作。
- Bearer Key 可创建、复制、撤销；未授权请求拒绝；Codex 与 Claude Code 标记更新不破坏其他全局指令内容。
- SQLite 重启后数据、Agent 历史和配置仍存在。

## 10. 运行参数

Node.js >=20。开发数据库默认 `data/memory.db`，可用 `MEMORY_DB_PATH` 覆盖；API 默认 `MEMORY_PORT=8765`，前端默认 5173。生产入口 `npm run install:local`，部署目录 `~/.local/share/memory-one`，日志与 PID 位于部署运行目录。
