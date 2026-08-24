import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAttendance } from "../src/lib/attendance-reconciliation.ts";

test("concilia presentes, omisiones y registros sin presencia", () => {
  assert.deepEqual(reconcileAttendance(["a", "b", "b", " c "], ["b", "c", "d"]), {
    matched: ["b", "c"],
    presentWithoutRecord: ["a"],
    recordedWithoutPresence: ["d"],
  });
});

test("ignora identificadores vacíos", () => {
  assert.deepEqual(reconcileAttendance(["", "  "], []), {
    matched: [], presentWithoutRecord: [], recordedWithoutPresence: [],
  });
});
