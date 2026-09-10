## Minimal Implementation Policy

Implement only the smallest direct change required by the confirmed request. Do not proactively add validation, limits, compatibility layers, abstractions, fallback behavior, security hardening, or adjacent UX changes unless they are explicitly requested or required by an existing project rule.

When an out-of-scope concern is discovered, mention it briefly instead of expanding the implementation.

## README Policy

`README.md` is end-user usage documentation only. Keep development setup, release procedures, screenshot-generation instructions, and implementation details out of the README; place them in dedicated contributor documentation when needed.

Present the primary onboarding flow near the top in this order: install and start Memory One, then open **MCP 服务** and configure MCP. Codex connection setup and Codex-specific enhancement both belong in the Codex section; do not add a separate Agent enhancement entry point.

Do not show a generic client configuration card on the MCP connection page. Detect and configure the `memory-one` connection in Codex's `config.toml` without replacing unrelated Codex settings.

When Bearer Key authentication is disabled, the entire MCP service must accept requests without a Key. Generated and Codex configurations must omit Authorization headers, and Codex setup must not require selecting a Key.

## Runtime Preference

This repository uses Node.js/TypeScript. Do not introduce Python runtime code or Python package configuration.

## Frontend Preference

Use a frontend framework for the web UI rather than plain HTML/JavaScript. Visual quality and polish are first-class requirements for this project; choose a component and styling approach that supports a polished, coherent interface.

The current frontend release uses Chinese UI copy. User-authored memory content is displayed as entered.

Keep the MCP service endpoint card compact. The Codex card should retain the small “Codex” eyebrow label and show only the necessary connection and task-memory status/actions; omit the redundant “Codex 配置” heading, authentication-state labels such as “无需 Key”, configuration paths, and implementation explanations.

## Development Command

`npm run dev` must start the backend and frontend together. Before starting, clear the development ports used by the project (currently `8765` and `5173`) so stale processes do not cause port conflicts.

## Test Execution

Do not run tests unless the user explicitly asks for them.

## Memory Classification

`scope` is an optional classification field, not a required isolation boundary. Use the repository root's absolute directory path as the scope for project-specific preferences and knowledge; if the project moves or is synchronized to another computer, update the stored path through the synchronization workflow. Values such as `work` or `personal` may still be used for non-project categories. MCP calls may omit `scope` for general-purpose searches or pass it as a category filter; do not require every memory or Agent call to include a scope.

## Memory Retrieval Intent

Memory One primarily exists so agents retrieve and apply relevant prior experience before starting any task. Design MCP instructions and tool descriptions around universal pre-task context retrieval, not around enumerating specific memory-related user questions as trigger phrases.

Codex global guidance must only be installed through an explicit user action in the frontend. That action may replace the instruction block managed by Memory One, but it must preserve all unrelated content in the user's global `AGENTS.md`.

## Durable Corrections

When the user corrects agent behavior or states a durable repository-specific working preference, update this `AGENTS.md` in the same change so future work follows that correction.

## Product Independence

Memory One product and runtime capabilities must be implemented entirely within Memory One. Do not use `AGENTS.md` as part of preference recall, persistent preferences, or any other product behavior. `AGENTS.md` only guides agents contributing to this repository.

## Scope UI

Show global memories as an option in the Scope filter rather than as a trailing group in the all-memories list. The workspace does not provide a memory archive feature.

## Git Worktree Directory Rule

Place additional worktrees in the parent directory of the primary checkout. Name each worktree as `../<repository-name>-<purpose>`.

## GitHub Research Rule

Use the authenticated `gh` CLI for GitHub repository searches, metadata inspection, and source browsing instead of direct web requests or browser search.

## Local Deployment Rule

The production deployment must be built in a temporary directory and copied to a directory outside the repository. Its database must also live in that deployment directory. The development service continues to use the source checkout's `data/` directory. Do not run the production service directly from the source checkout's `public/`, `dist/`, or database directories.

## Defaults Before Environment Variables

When the project already has a suitable default value, use that default directly instead of adding or requiring a new environment variable.

## Agent Provider Protocols

The `openai` provider uses the OpenAI Responses API; `openai-compatible` uses Chat Completions.

## Production CLI Convention

The globally installed CLI command is `memoryone` without a hyphen. When `memoryone start` finds port `23888` occupied, ask the user whether to terminate the occupying process instead of failing immediately.

## npm Release Propagation

After publishing a concrete version, wait until `npm view @ccjr1120/memory-one@<version> dist.tarball` succeeds before committing the bumped version that makes clients detect and announce the update.

## Interface Language and Copy

- The user-facing web UI supports Chinese and English. On first install or first start, let the user choose a language; the choice can be changed from Web settings.
- Keep buttons, labels, and explanatory copy restrained. Do not expose unrelated internal implementation details in user-facing messages.
- Display user-authored memory content exactly as entered; do not translate it.
- In the memory manager Agent, configuration auto-saves. Do not show footer Chat or Save Configuration buttons; while configuration is open, the header configuration icon becomes a Chat icon that returns to the conversation.
- Agent configuration selects render in a portal and must not trigger outside-click collapse. When the Agent is expanded, the composer keeps its border but has no rounded top corners so it visually joins the chat panel.
- Agent chat must follow the latest message while sending, show the context-loading row only until response content starts, render streaming Markdown in streaming mode, and stop provider SSE reads on terminal events instead of waiting indefinitely for the connection to close.
- The Agent may use `memory_get_context` internally, but the automatic context retrieval must not be rendered as a persistent tool-call chip in the conversation.
- The workspace must not expose manual memory creation or deletion controls; memory CRUD is handled through the Agent and MCP tools. Compact metadata such as Scope paths should stay on one line and use an ellipsis instead of wrapping when space is limited.
- The memory manager Agent answers questions by default and may automatically read relevant context. It must only create, update, or delete memories when the user explicitly asks it to remember, change, forget, or delete something; ordinary conversation and incidental details are not memory-write instructions.
- When collapsed, the memory manager Agent is a floating robot icon on the right side of every page. Clicking the icon expands the existing bottom chat panel; the collapsed state must not show the composer input.
