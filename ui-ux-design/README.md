# UI/UX Design

Memory One uses a polished React workspace with Chinese and English copy, light/dark themes and a compact local-first information architecture.

## Primary flow

1. Install and start Memory One.
2. Open **MCP 服务** and configure the MCP connection.
3. Codex setup and Codex-specific enhancement remain in the Codex card; no separate Agent enhancement entry point is shown.

## Workspace

- Memory browsing keeps search, scope filtering, timeline, detail metadata and recall signal together.
- Memory detail shows the current record and its five most recent recall events, including source, query and time.
- Scope metadata remains compact and single-line; long paths truncate with an ellipsis.
- The floating memory-manager launcher stays available on every page. Its automatic context read is not rendered as a tool-call chip.

## Settings

Settings contains interface language, data backup, appearance and local storage status:

- **Export JSON** downloads a safe local backup.
- **Merge import** adds non-duplicate memories from a backup.
- **Replace import** asks for explicit browser confirmation before replacing current memories.
- Backup results use concise status copy and do not expose implementation details.

## MCP service

The MCP page keeps the endpoint card compact, presents scoped keys and tool statistics, and communicates the task-start context rule without turning it into a generic client configuration card.
