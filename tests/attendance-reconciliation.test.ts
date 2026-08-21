import assert from "node:assert/strict";
import test from "node:test";

import { reconcileAttendance } from "../src/lib/attendance-reconciliation";

test("separa coincidencias y diferencias sin duplicar alumnos", () => {
  assert.deepEqual(
    reconcileAttendance(["a", "b", "b", "c"], ["b", "c", "d", "d"]),
    {
      matched: ["b", "c"],
      presentWithoutRecord: ["a"],
      recordedWithoutPresence: ["d"],
    },
  );
});

test("ignora identificadores vacíos", () => {
  assert.deepEqual(reconcileAttendance(["", " a "], [" ", "a"]), {
    matched: ["a"],
    presentWithoutRecord: [],
    recordedWithoutPresence: [],
  });
});
