import assert from "node:assert/strict";
import test from "node:test";
import { physicalDataErrorMessage, validatePhysicalData } from "../src/lib/physical-data-validation.ts";

test("acepta una medición físicamente plausible", () => {
  assert.equal(validatePhysicalData({ edad: 25, pesoKg: 72, estaturaCm: 175, cinturaCm: 82 }).length, 0);
});

test("bloquea unidades o valores imposibles", () => {
  const issues = validatePhysicalData({ edad: 25, pesoKg: 720, estaturaCm: 1.75, cinturaCm: 8 });
  assert.ok(issues.filter((issue) => issue.level === "error").length >= 3);
  assert.match(physicalDataErrorMessage(issues), /confirma la unidad/i);
});

test("advierte una relación interna inusual sin diagnosticar", () => {
  const issues = validatePhysicalData({ estaturaCm: 170, cinturaCm: 180, caderaCm: 80 });
  assert.ok(issues.some((issue) => issue.level === "warning"));
});

test("valida las nuevas pruebas de burpees y suicidios", () => {
  assert.equal(validatePhysicalData({ burpees: 24, suicidios: 12 }).length, 0);
  assert.ok(validatePhysicalData({ burpees: 999, suicidios: -1 }).every((issue) => issue.level === "error"));
});
