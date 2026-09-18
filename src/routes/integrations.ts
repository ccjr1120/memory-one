import type { FastifyInstance } from "fastify";
import type { ClaudeIntegrationService } from "../integrations/claude.js";
import type { CodexIntegrationService } from "../integrations/codex.js";

export function registerIntegrationRoutes(app: FastifyInstance, codex: CodexIntegrationService, claude: ClaudeIntegrationService) {
  app.get("/api/integrations/codex", async () => codex.getCodexIntegration());
  app.post("/api/integrations/codex/install", async () => codex.installCodexIntegration());
  app.get("/api/integrations/codex/mcp", async (request) => {
    const { endpoint = "" } = request.query as { endpoint?: string };
    return codex.getCodexMcpIntegration(endpoint);
  });
  app.post("/api/integrations/codex/mcp/install", async (request, reply) => {
    const body = (request.body as { endpoint?: string; key_id?: string } | undefined) ?? {};
    if (!body.endpoint) return reply.code(422).send({ detail: "codex_mcp_config_required" });
    try {
      return await codex.installCodexMcpIntegration(body.endpoint, body.key_id);
    } catch (error) {
      if (error instanceof Error && error.message === "mcp_key_not_found") return reply.code(404).send({ detail: error.message });
      throw error;
    }
  });

  app.get("/api/integrations/claude", async () => claude.getClaudeIntegration());
  app.post("/api/integrations/claude/install", async () => claude.installClaudeIntegration());
  app.get("/api/integrations/claude/mcp", async (request) => {
    const { endpoint = "" } = request.query as { endpoint?: string };
    return claude.getClaudeMcpIntegration(endpoint);
  });
  app.post("/api/integrations/claude/mcp/install", async (request, reply) => {
    const body = (request.body as { endpoint?: string; key_id?: string } | undefined) ?? {};
    if (!body.endpoint) return reply.code(422).send({ detail: "claude_mcp_config_required" });
    try {
      return await claude.installClaudeMcpIntegration(body.endpoint, body.key_id);
    } catch (error) {
      if (error instanceof Error && error.message === "mcp_key_not_found") return reply.code(404).send({ detail: error.message });
      throw error;
    }
  });
}
