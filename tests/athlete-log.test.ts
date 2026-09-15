import assert from "node:assert/strict";
import test from "node:test";

import { athleteLogError, parseAthleteLog } from "../src/lib/athlete-log";

test("la bitácora normaliza comidas válidas sin cambiar sus métricas", () => {
  const input = {
    type: "meal",
    mealType: "Almuerzo",
    totalCalories: 640,
    totalProtein: 42,
    totalFat: 18,
    totalCarbohydrates: 73,
    notes: "  Después del entrenamiento  ",
  };
  assert.equal(athleteLogError(input), "");
  assert.deepEqual(parseAthleteLog(input), {
    ...input,
    notes: "Después del entrenamiento",
  });
});

test("la bitácora acepta entrenamiento y exige minutos enteros", () => {
  const valid = {
    type: "training",
    activityType: "Jiu-Jitsu",
    durationMinutes: 90,
    intensityLevel: "Alta",
    estimatedCaloriesBurned: 720,
    notes: "Sparring",
  };
  assert.equal(athleteLogError(valid), "");
  assert.equal(parseAthleteLog(valid).type, "training");
  assert.match(
    athleteLogError({ ...valid, durationMinutes: 12.5 }),
    /número entero/i,
  );
});

test("la bitácora rechaza métricas extremas y notas excesivas", () => {
  const meal = {
    type: "meal",
    mealType: "Cena",
    totalCalories: 500,
    totalProtein: 30,
    totalFat: 15,
    totalCarbohydrates: 60,
    notes: "",
  };
  assert.match(
    athleteLogError({ ...meal, totalCalories: -1 }),
    /calorías.*entre 0/i,
  );
  assert.match(
    athleteLogError({ ...meal, totalProtein: 1001 }),
    /proteína.*1000/i,
  );
  assert.match(
    athleteLogError({ ...meal, notes: "x".repeat(501) }),
    /500 caracteres/i,
  );
});
