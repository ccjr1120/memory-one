import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MemoryStore } from "./storage.js";

test("context combines the current project with global memories without leaking other projects", () => {
  const store = new MemoryStore(join(tmpdir(), `memory-one-${randomUUID()}.db`));
  store.create({ content: "shared formatter preference", project: null });
  store.create({ content: "shared formatter for project A", project: "/code/a" });
  store.create({ content: "shared formatter for project B", project: "/code/b" });

  const memories = store.context("shared formatter", "user", "/code/a", 10);

  assert.deepEqual(memories.map((memory) => memory.project), ["/code/a", null]);
});

test("context without a project retrieves global memories only", () => {
  const store = new MemoryStore(join(tmpdir(), `memory-one-${randomUUID()}.db`));
  store.create({ content: "global coding preference", project: null });
  store.create({ content: "project coding preference", project: "/code/a" });

  const memories = store.context("coding preference", "user", null, 10);

  assert.deepEqual(memories.map((memory) => memory.project), [null]);
});
