# Memory One

Personal agent memory for a single machine. The service exposes a Streamable HTTP MCP endpoint and a React workbench backed by SQLite.

## Run

```bash
npm install
npm run build
npm start
```

For local development, one command starts both the API and Vite frontend. It first clears ports `8765` and `5173`:

```bash
npm run dev
```

The Vite development UI is available at <http://127.0.0.1:5173/> and proxies API requests to the Node service at <http://127.0.0.1:8765/>. Press `Ctrl-C` to stop both processes.

To install and run the local production service in the background, use:

```bash
npm run install:local
```

This command installs dependencies, builds the app, clears only port `23888`, and starts the service at <http://127.0.0.1:23888/>. The MCP endpoint is <http://127.0.0.1:23888/mcp/>. Its PID is stored in `data/memory-one.pid` and logs are written to `data/memory-one.log`.

For the background service, use `http://127.0.0.1:23888/mcp/` as the MCP URL in your client configuration.

Open <http://127.0.0.1:8765/> for the memory viewer. Configure an MCP client with:

```json
{
  "mcpServers": {
    "memory-one": {
      "type": "http",
      "url": "http://127.0.0.1:8765/mcp/"
    }
  }
}
```

The database is stored at `data/memory.db` by default. Set `MEMORY_DB_PATH` to use another path and `MEMORY_PORT` to change the port.

MCP tool calls are recorded locally with the tool name, success status, duration, and call time. Aggregated totals and per-tool usage are shown on the MCP page and available from `GET /api/mcp/stats`. Call arguments and memory content are not included in the usage log.

Memory supports an optional `scope` classification. Prefer a stable project directory or repository name as the `scope` value for project-specific preferences and knowledge, but omit it for general-purpose memories. MCP calls without `scope` search all memories; when `scope` is provided, it acts as a category filter.

The first search implementation uses SQLite FTS5, with a substring fallback for Chinese text. The schema already reserves an embedding column for a later sqlite-vec integration.

The web UI uses React, Vite, and `lucide-react`. Its visual rules are documented in [DESIGN.md](./DESIGN.md).
