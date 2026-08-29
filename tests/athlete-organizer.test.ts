import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrganizerAge, clampOrganizerActivitySeconds, normalizeOrganizerGuestName, organizerExerciseRepetitions, organizerPairKey, pickOrganizerExercise, safetyWarnings } from "../src/lib/athlete-organizer.ts";

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

test("la actividad nunca supera 30 segundos", () => {
  assert.equal(clampOrganizerActivitySeconds(90), 30);
  assert.equal(clampOrganizerActivitySeconds(2), 5);
});

test("las repeticiones se ajustan a la duración y al ejercicio", () => {
  assert.equal(organizerExerciseRepetitions("jumping-jacks", 30), 30);
  assert.equal(organizerExerciseRepetitions("burpees", 30), 8);
  assert.ok(organizerExerciseRepetitions("squats", 20) > organizerExerciseRepetitions("squats", 10));
});

test("el ejercicio aleatorio evita repetir el anterior", () => {
  const result = pickOrganizerExercise(15, () => 0, "squats");
  assert.notEqual(result.id, "squats");
  assert.equal(result.seconds, 15);
});

test("normaliza invitados sin aceptar nombres vacíos", () => {
  assert.equal(normalizeOrganizerGuestName("  Ana   invitada  "), "Ana invitada");
  assert.equal(normalizeOrganizerGuestName(" "), null);
  assert.equal(normalizeOrganizerGuestName("A"), null);
});
