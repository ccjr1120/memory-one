import type { FastifyInstance } from "fastify";
import type { MemoryInput, MemoryStore } from "../storage.js";

export function registerMemoryRoutes(app: FastifyInstance, store: MemoryStore) {
  app.get("/api/memories", async (request) => {
    const q = request.query as { scope?: string; project?: string; limit?: string };
    return store.list(q.scope ?? "user", q.project ?? null, Number(q.limit ?? 50));
  });
  app.get("/api/search", async (request) => {
    const q = request.query as { query: string; scope?: string; project?: string; limit?: string };
    return store.recordRecalls(store.search(q.query, q.scope ?? "user", q.project ?? null, Number(q.limit ?? 20)), "search", q.query);
  });
  app.get("/api/memories/most-recalled", async (request) => {
    const q = request.query as { scope?: string; project?: string; limit?: string };
    return store.mostRecalled(q.scope ?? "user", q.project ?? null, Number(q.limit ?? 5));
  });
  app.get("/api/diagnostics/recalls", async (request) => {
    const q = request.query as { limit?: string };
    return store.listRecentRecalls(Number(q.limit ?? 50));
  });
  app.get("/api/memories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = store.get(id);
    return item ? item : reply.code(404).send({ detail: "memory_not_found" });
  });
  app.get("/api/memories/:id/recalls", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!store.get(id)) return reply.code(404).send({ detail: "memory_not_found" });
    const q = request.query as { limit?: string };
    return store.listMemoryRecalls(id, Number(q.limit ?? 10));
  });
  app.post("/api/memories", async (request, reply) => {
    const payload = request.body as MemoryInput;
    if (!payload?.content) return reply.code(422).send({ detail: "content_required" });
    return store.createWithIntegrity(payload).memory;
  });
  app.patch("/api/memories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = store.update(id, request.body as Partial<MemoryInput>);
    return item ? item : reply.code(404).send({ detail: "memory_not_found" });
  });
  app.delete("/api/memories/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { deleted: store.delete(id) };
  });
}
