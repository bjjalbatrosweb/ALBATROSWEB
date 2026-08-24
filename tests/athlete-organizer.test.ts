import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrganizerAge, organizerPairKey, safetyWarnings } from "../src/lib/athlete-organizer.ts";

test("la clave de pareja no depende del orden", () => {
  assert.equal(organizerPairKey("karla", "coach"), organizerPairKey("coach", "karla"));
});

test("rechaza fechas de nacimiento inválidas", () => {
  assert.equal(calculateOrganizerAge("no-es-fecha"), null);
});

test("avisa diferencias configuradas de seguridad", () => {
  const warnings = safetyWarnings([
    { id: "a", nombre: "A", disciplina: "MMA", grado: "", peso: 45, edad: 15, nivel: 1 },
    { id: "b", nombre: "B", disciplina: "MMA", grado: "", peso: 85, edad: 28, nivel: 3 },
  ], { enabled: true, maxWeightDifference: 15, maxAgeDifference: 8, separateMinors: true });
  assert.ok(warnings.some((warning) => warning.includes("peso")));
  assert.ok(warnings.some((warning) => warning.includes("menor")));
});
