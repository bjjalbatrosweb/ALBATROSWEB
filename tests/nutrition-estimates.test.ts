import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateNutritionEstimate,
  nutritionBiometricsError,
  nutritionTargetsError,
  parseNutritionTargets,
} from "../src/lib/nutrition-estimates";

const adult = {
  gender: "male" as const,
  weight: 80,
  height: 180,
  age: 30,
  activityLevel: 1.55,
};

test("calcula una estimación adulta con metas coherentes", () => {
  const result = calculateNutritionEstimate(adult, "maintain");
  assert.equal(result.bmr, 1780);
  assert.equal(result.targets.calories, 2759);
  assert.equal(result.targets.protein, 176);
  assert.equal(result.targets.fats, 72);
  assert.equal(result.targets.carbs, 352);
});

test("no aplica la ecuación adulta a menores ni perfiles incompletos", () => {
  assert.match(
    nutritionBiometricsError({ ...adult, age: 16 }),
    /únicamente para adultos/i,
  );
  assert.match(
    nutritionBiometricsError({ ...adult, weight: 0 }),
    /peso debe estar entre 30 y 250/i,
  );
  assert.throws(
    () => calculateNutritionEstimate({ ...adult, height: 0 }, "maintain"),
    /estatura debe estar entre 120 y 230/i,
  );
});

test("valida las metas antes de almacenarlas", () => {
  const targets = { calories: 2500, protein: 170, carbs: 300, fats: 80 };
  assert.equal(nutritionTargetsError(targets), "");
  assert.deepEqual(parseNutritionTargets(targets), targets);
  assert.match(
    nutritionTargetsError({ ...targets, calories: 100 }),
    /calorías.*800.*10000/i,
  );
});
