import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function registerSystemRoutes(app: FastifyInstance, packageVersion: string) {
  const publicDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public");
  app.register(fastifyStatic, { root: publicDir, prefix: "/" });
  for (const frontendRoute of ["/", "/timeline", "/preferences", "/scopes", "/tags", "/settings", "/mcp-service"]) {
    app.get(frontendRoute, async (_, reply) => reply.sendFile("index.html"));
  }
  app.get("/api/version", async () => {
    try {
      const response = await fetch("https://registry.npmjs.org/@ccjr1120%2Fmemory-one/latest", { signal: AbortSignal.timeout(2000), headers: { accept: "application/json" } });
      if (!response.ok) return { current: packageVersion, latest: null, updateAvailable: false };
      const latest = String(((await response.json()) as { version?: unknown }).version ?? "");
      return { current: packageVersion, latest: latest || null, updateAvailable: Boolean(latest && latest !== packageVersion) };
    } catch {
      return { current: packageVersion, latest: null, updateAvailable: false };
    }
  });
}

export const packageVersion = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version as string;
