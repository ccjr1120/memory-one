import type { FastifyInstance } from "fastify";
import { mcpToolNames } from "../mcp/server.js";
import type { AppLanguage, MemoryStore } from "../storage.js";

export function registerSettingsRoutes(app: FastifyInstance, store: MemoryStore) {
  app.get("/api/app-config", async () => store.getAppConfig());
  app.put("/api/app-config", async (request, reply) => {
    const language = (request.body as { language?: string } | undefined)?.language;
    if (language !== "zh" && language !== "en") return reply.code(422).send({ detail: "language_required" });
    return store.saveAppConfig(language as AppLanguage);
  });
  app.get("/api/mcp/stats", async () => store.getToolStats());
  app.get("/api/mcp/config", async () => store.getMcpConfig());
  app.put("/api/mcp/config", async (request) => store.saveMcpConfig(Boolean((request.body as { use_bearer_key?: boolean } | undefined)?.use_bearer_key)));
  app.get("/api/mcp/keys", async () => store.listMcpKeys());
  app.post("/api/mcp/keys", async (request, reply) => {
    const body = (request.body as { name?: string; allowed_tools?: string[] } | undefined) ?? {};
    const name = body.name?.trim() || "未命名 Key";
    const allowedTools = [...new Set((body.allowed_tools ?? []).filter((tool) => (mcpToolNames as readonly string[]).includes(tool)))];
    const created = store.createMcpKey(name, allowedTools);
    return reply.code(201).send({ key: created.key, key_record: created.keyRecord });
  });
  app.patch("/api/mcp/keys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { name?: string; allowed_tools?: string[] } | undefined) ?? {};
    const patch = {
      ...(body.name === undefined ? {} : { name: body.name.trim() || "未命名 Key" }),
      ...(body.allowed_tools === undefined ? {} : { allowed_tools: [...new Set(body.allowed_tools.filter((tool) => (mcpToolNames as readonly string[]).includes(tool)))] }),
    };
    const key = store.updateMcpKey(id, patch);
    return key ? key : reply.code(404).send({ detail: "mcp_key_not_found" });
  });
  app.delete("/api/mcp/keys/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { revoked: store.revokeMcpKey(id) };
  });
}
