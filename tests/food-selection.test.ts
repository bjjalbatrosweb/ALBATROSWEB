import assert from "node:assert/strict";
import test from "node:test";

import {
  addFoodSelection,
  foodSearchKey,
  foodSelectionNote,
  foodSelectionTotals,
  normalizeFoodCatalogItem,
  normalizeFoodGrams,
} from "../src/lib/food-selection";

test("normaliza el catálogo sin inventar macronutrientes", () => {
  assert.deepEqual(
    normalizeFoodCatalogItem("arroz", { nombre: "Arroz", calorias: 130 }),
    {
      id: "arroz",
      name: "Arroz",
      caloriesPer100g: 130,
      proteinPer100g: 0,
      fatPer100g: 0,
      carbsPer100g: 0,
    },
  );
  assert.equal(normalizeFoodCatalogItem("", { nombre: "Arroz", calorias: 130 }), null);
  assert.equal(normalizeFoodCatalogItem("x", { nombre: "", calorias: 130 }), null);
  assert.equal(normalizeFoodCatalogItem("x", { nombre: "X", calorias: -1 }), null);
});

test("calcula cada porción proporcionalmente a sus gramos", () => {
  const totals = foodSelectionTotals([
    {
      id: "pollo",
      name: "Pollo",
      caloriesPer100g: 165,
      proteinPer100g: 31,
      fatPer100g: 3.6,
      carbsPer100g: 0,
      grams: 150,
    },
    {
      id: "arroz",
      name: "Arroz",
      caloriesPer100g: 130,
      proteinPer100g: 2.7,
      fatPer100g: 0.3,
      carbsPer100g: 28,
      grams: 200,
    },
  ]);
  assert.deepEqual(totals, {
    calories: 507.5,
    protein: 51.9,
    fat: 6,
    carbs: 56,
    grams: 350,
  });
});

test("un alimento repetido aumenta la porción y los límites son seguros", () => {
  const food = {
    id: "avena",
    name: "Avena",
    caloriesPer100g: 389,
    proteinPer100g: 16.9,
    fatPer100g: 6.9,
    carbsPer100g: 66.3,
  };
  const once = addFoodSelection([], food);
  const twice = addFoodSelection(once, food);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].grams, 200);
  assert.equal(normalizeFoodGrams(0), 10);
  assert.equal(normalizeFoodGrams(9000), 5000);
  assert.ok(foodSelectionNote(twice).length <= 500);
  assert.equal(foodSearchKey("  Proteína  "), "proteina");
});
