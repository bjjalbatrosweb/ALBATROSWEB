export type FoodCatalogItem = {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
};

export type SelectedFood = FoodCatalogItem & { grams: number };

function boundedNumber(value: unknown, maximum: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= maximum
    ? number
    : 0;
}

export function normalizeFoodCatalogItem(
  id: string,
  value: Record<string, unknown>,
): FoodCatalogItem | null {
  const name = String(value.nombre || value.name || "").trim().slice(0, 100);
  const calories = boundedNumber(value.calorias ?? value.calories, 2_000);
  if (!id || !name || calories <= 0) return null;

  return {
    id,
    name,
    caloriesPer100g: calories,
    proteinPer100g: boundedNumber(
      value.proteina ?? value.protein ?? value.proteinG,
      500,
    ),
    fatPer100g: boundedNumber(value.grasa ?? value.grasas ?? value.fat ?? value.fatG, 500),
    carbsPer100g: boundedNumber(
      value.carbohidratos ?? value.carbs ?? value.carbsG,
      500,
    ),
  };
}

export function normalizeFoodGrams(value: unknown): number {
  const grams = Number(value);
  if (!Number.isFinite(grams)) return 100;
  return Math.min(5_000, Math.max(10, Math.round(grams)));
}

export function addFoodSelection(
  current: SelectedFood[],
  food: FoodCatalogItem,
): SelectedFood[] {
  const existing = current.find((item) => item.id === food.id);
  if (!existing) return [...current, { ...food, grams: 100 }];
  return current.map((item) =>
    item.id === food.id
      ? { ...item, grams: normalizeFoodGrams(item.grams + 100) }
      : item,
  );
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function foodSelectionTotals(items: SelectedFood[]) {
  const totals = items.reduce(
    (result, item) => {
      const factor = normalizeFoodGrams(item.grams) / 100;
      result.calories += item.caloriesPer100g * factor;
      result.protein += item.proteinPer100g * factor;
      result.fat += item.fatPer100g * factor;
      result.carbs += item.carbsPer100g * factor;
      result.grams += normalizeFoodGrams(item.grams);
      return result;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0, grams: 0 },
  );
  return {
    calories: rounded(totals.calories),
    protein: rounded(totals.protein),
    fat: rounded(totals.fat),
    carbs: rounded(totals.carbs),
    grams: totals.grams,
  };
}

export function foodSelectionNote(items: SelectedFood[]): string {
  const content = items
    .map((item) => `${item.name} (${normalizeFoodGrams(item.grams)} g)`)
    .join(", ");
  return `Registrado desde Alimentos: ${content}`.slice(0, 500);
}

export function foodSearchKey(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
