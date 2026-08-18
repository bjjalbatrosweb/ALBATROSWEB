import assert from "node:assert/strict";
import test from "node:test";

import { buildRfidRepairPlan } from "../src/lib/rfid-repair.ts";

test("crea índices faltantes, corrige propietarios y normaliza alumnos", () => {
  const plan = buildRfidRepairPlan(
    [
      { id: "a1", sede: "MMA", rfid: "aa-11", rfids: ["aa-11", "BB22"] },
      { id: "a2", sede: "MMA", rfid: "CC33" },
    ],
    [
      { id: "AA11", alumnoId: "anterior", sede: "CAUCEL" },
      { id: "cc-33", alumnoId: "a2", sede: "MMA" },
    ],
    "MMA",
  );

  assert.deepEqual(plan.studentUpdates, [
    { studentId: "a1", rfids: ["AA11", "BB22"], rfid: "AA11" },
    { studentId: "a2", rfids: ["CC33"], rfid: "CC33" },
  ]);
  assert.deepEqual(
    plan.indexUpserts.map((item) => [item.rfid, item.mode]),
    [
      ["AA11", "correct"],
      ["BB22", "create"],
      ["CC33", "create"],
    ],
  );
  assert.deepEqual(plan.indexDeletes, [
    { indexId: "cc-33", reason: "noncanonical" },
  ]);
});

test("elimina huérfanos pero nunca repara automáticamente duplicados", () => {
  const plan = buildRfidRepairPlan(
    [
      { id: "a1", sede: "MMA", rfid: "DUP1" },
      { id: "a2", sede: "CAUCEL", rfid: "DUP1" },
    ],
    [
      { id: "DUP1", alumnoId: "a1", sede: "MMA" },
      { id: "LIBRE1", alumnoId: "borrado", sede: "MMA" },
      { id: "LIBRE2" },
      { id: "OTRA1", alumnoId: "borrado", sede: "CAUCEL" },
    ],
    "MMA",
  );

  assert.deepEqual(plan.blockedDuplicates, [
    { rfid: "DUP1", studentIds: ["a1", "a2"] },
  ]);
  assert.equal(plan.indexUpserts.length, 0);
  assert.deepEqual(plan.indexDeletes, [
    { indexId: "LIBRE1", reason: "orphan" },
    { indexId: "LIBRE2", reason: "orphan" },
  ]);
});
