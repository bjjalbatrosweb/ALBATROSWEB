import assert from "node:assert/strict";
import test from "node:test";

import { isStaleChunkError } from "../src/lib/chunk-recovery.ts";

test("reconoce fallos de chunks de Next sin confundir errores normales", () => {
  assert.equal(
    isStaleChunkError(
      "Loading chunk 5239 failed. (error: https://example.com/_next/static/chunks/5239-old.js)",
    ),
    true,
  );
  assert.equal(
    isStaleChunkError(new Error("Failed to fetch dynamically imported module")),
    true,
  );
  assert.equal(isStaleChunkError(new Error("Firebase permission denied")), false);
});
