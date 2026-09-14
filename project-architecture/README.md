# Project Architecture

Memory One is a local-first Node.js/TypeScript service with a React workspace.

## Runtime layout

```text
src/
  server.ts            # process entry point
  app.ts               # Fastify assembly and internal MCP connector
  storage.ts           # SQLite schema, migration, integrity, recall, export/import
  mcp/
    server.ts          # external MCP tool contract
    context-cache.ts   # per-client context cache
  routes/
    memories.ts        # memory CRUD, search, recall diagnostics
    data.ts            # JSON export and merge/replace import
    settings.ts        # app config, MCP auth config, keys and stats
    integrations.ts    # Codex instruction and connection setup
    agent.ts           # built-in memory manager HTTP/SSE routes
    mcp.ts             # authenticated /mcp/ transport
    system.ts          # static hosting, SPA fallback and version check
  agent/
    run.ts             # provider/tool loop
    providers.ts       # OpenAI Chat/Responses and Anthropic adapters
    types.ts           # shared agent contracts
  integrations/
    codex.ts           # managed global instruction and config.toml integration
  main.tsx             # React bootstrap, routing and workspace shell
  api/client.ts        # browser API helpers
  types.ts             # shared browser models
  lib/
    copy.ts            # Chinese/English UI copy
    format.ts          # locale-aware date and time formatting
    kinds.ts           # memory kind labels
    views.ts           # workspace route/view definitions
  components/
    agent-chat.tsx     # built-in memory manager agent and configuration
    memory.tsx         # memory cards and detail drawer
    settings.tsx       # language setup and settings page
    stat.tsx           # compact statistic display
  pages/
    mcp-page.tsx       # MCP service and client connection page
```

## Data and MCP behavior

- SQLite uses schema version 2. Version 1 databases receive an automatic pre-migration `VACUUM INTO` backup before columns, indexes and recall-event tables are added.
- Writes normalize content for exact duplicate detection and return similar candidates. Replacement is explicit through `supersedes_id`; superseded memories do not enter task context.
- `memory-get-context` selects always-include project memories first, then global memories, weights importance/confidence and pinning, prefers recently useful memories, and applies a token budget.
- Context cache keys are MCP identity, scope and limit. Cache version is memory write version only; recall observation does not invalidate cache.
- Recall events record `context`, `search`, `get` and `list`, enabling per-memory and global diagnostics.
- Export excludes Agent API keys and MCP key secrets/hashes. Merge skips exact duplicates; replace atomically replaces memories and safe configuration.

## Validation

The allowed routine verification is `npm run typecheck`, which checks server and browser TypeScript separately.
