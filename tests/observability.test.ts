import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la captura web limita abuso y evita enviar trazas o identidad", async () => {
  const route = await readFile(new URL("../src/app/api/observabilidad/route.ts", import.meta.url), "utf8");
  assert.match(route, /scope: "client-errors"/);
  assert.match(route, /message.*digest.*path/);
  assert.doesNotMatch(route, /body\.(?:email|uid|stack)/);
  assert.match(route, /collection\("ErroresWeb"\)/);
});
