import type { FastifyInstance } from "fastify";
import type { MemoryStore } from "../storage.js";

export function registerDataRoutes(app: FastifyInstance, store: MemoryStore) {
  app.get("/api/data/export", async () => store.exportData());
  app.post("/api/data/import", async (request, reply) => {
    const body = request.body as { data?: unknown; mode?: "merge" | "replace" } | undefined;
    if (!body?.data) return reply.code(422).send({ detail: "backup_required" });
    const mode = body.mode === "replace" ? "replace" : "merge";
    try {
      return store.importData(body.data, mode);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_backup") return reply.code(422).send({ detail: error.message });
      throw error;
    }
  });
}
