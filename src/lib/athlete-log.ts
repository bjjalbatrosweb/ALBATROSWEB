export const MEAL_TYPES = ["Desayuno", "Almuerzo", "Cena", "Snack"] as const;
export const INTENSITY_LEVELS = ["Baja", "Moderada", "Alta"] as const;

export type MealLogInput = {
  type: "meal";
  mealType: (typeof MEAL_TYPES)[number];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbohydrates: number;
  notes: string;
};

export type TrainingLogInput = {
  type: "training";
  activityType: string;
  durationMinutes: number;
  intensityLevel: (typeof INTENSITY_LEVELS)[number];
  estimatedCaloriesBurned: number;
  notes: string;
};

export type AthleteLogInput = MealLogInput | TrainingLogInput;

function numberValue(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanNotes(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function metricError(
  value: unknown,
  label: string,
  maximum: number,
): string {
  const number = numberValue(value);
  return number === null || number < 0 || number > maximum
    ? `${label} debe estar entre 0 y ${maximum}.`
    : "";
}

export function athleteLogError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "El registro no tiene un formato válido.";
  }

  const input = value as Record<string, unknown>;
  const notes = cleanNotes(input.notes);
  if (notes.length > 500) return "Las notas no pueden superar 500 caracteres.";

  if (input.type === "meal") {
    if (!MEAL_TYPES.includes(input.mealType as MealLogInput["mealType"])) {
      return "Selecciona un tipo de comida válido.";
    }
    return (
      metricError(input.totalCalories, "Las calorías", 10_000) ||
      metricError(input.totalProtein, "La proteína", 1_000) ||
      metricError(input.totalFat, "La grasa", 1_000) ||
      metricError(input.totalCarbohydrates, "Los carbohidratos", 1_000)
    );
  }

  if (input.type === "training") {
    const activity =
      typeof input.activityType === "string" ? input.activityType.trim() : "";
    if (activity.length < 2 || activity.length > 80) {
      return "La actividad debe tener entre 2 y 80 caracteres.";
    }
    const duration = numberValue(input.durationMinutes);
    if (
      duration === null ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 1_440
    ) {
      return "La duración debe ser un número entero entre 1 y 1440 minutos.";
    }
    if (
      !INTENSITY_LEVELS.includes(
        input.intensityLevel as TrainingLogInput["intensityLevel"],
      )
    ) {
      return "Selecciona una intensidad válida.";
    }
    return metricError(
      input.estimatedCaloriesBurned,
      "Las calorías quemadas",
      10_000,
    );
  }

  return "Selecciona si registrarás comida o entrenamiento.";
}

export function parseAthleteLog(value: unknown): AthleteLogInput {
  const error = athleteLogError(value);
  if (error) throw new Error(error);

  const input = value as Record<string, unknown>;
  if (input.type === "meal") {
    return {
      type: "meal",
      mealType: input.mealType as MealLogInput["mealType"],
      totalCalories: Number(input.totalCalories),
      totalProtein: Number(input.totalProtein),
      totalFat: Number(input.totalFat),
      totalCarbohydrates: Number(input.totalCarbohydrates),
      notes: cleanNotes(input.notes),
    };
  }

  return {
    type: "training",
    activityType: String(input.activityType).trim(),
    durationMinutes: Number(input.durationMinutes),
    intensityLevel: input.intensityLevel as TrainingLogInput["intensityLevel"],
    estimatedCaloriesBurned: Number(input.estimatedCaloriesBurned),
    notes: cleanNotes(input.notes),
  };
}
