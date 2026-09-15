import type {
  AthleteGender,
  AthleteGoal,
  AthletePersonalProfile,
} from "@/lib/athlete-personal-profile";

export type NutritionBiometrics = {
  gender: AthleteGender;
  weight: number;
  height: number;
  age: number;
  activityLevel: number;
};

export type NutritionTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export function nutritionBiometricsError(
  biometrics: NutritionBiometrics,
): string {
  if (biometrics.age < 18) {
    return "La estimación automática está disponible únicamente para adultos. En menores debe calcularla un profesional con ecuaciones por edad y crecimiento.";
  }
  if (!Number.isFinite(biometrics.weight) || biometrics.weight < 30 || biometrics.weight > 250) {
    return "El peso debe estar entre 30 y 250 kg para realizar esta estimación.";
  }
  if (!Number.isFinite(biometrics.height) || biometrics.height < 120 || biometrics.height > 230) {
    return "La estatura debe estar entre 120 y 230 cm para realizar esta estimación.";
  }
  if (!Number.isInteger(biometrics.age) || biometrics.age > 100) {
    return "La edad debe ser un número entero entre 18 y 100 años.";
  }
  if (![1.2, 1.375, 1.55, 1.725, 1.9].includes(biometrics.activityLevel)) {
    return "Selecciona un nivel de actividad válido.";
  }
  return "";
}

export function calculateNutritionEstimate(
  biometrics: NutritionBiometrics,
  goal: AthleteGoal,
): { bmr: number; targets: NutritionTargets } {
  const error = nutritionBiometricsError(biometrics);
  if (error) throw new Error(error);

  const sexConstant = biometrics.gender === "male" ? 5 : -161;
  const bmr = Math.round(
    10 * biometrics.weight +
      6.25 * biometrics.height -
      5 * biometrics.age +
      sexConstant,
  );
  const goalFactor = goal === "lose" ? 0.85 : goal === "gain" ? 1.15 : 1;
  const calories = Math.round(bmr * biometrics.activityLevel * goalFactor);
  const protein = Math.round(biometrics.weight * 2.2);
  const fats = Math.round(biometrics.weight * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  return { bmr, targets: { calories, protein, carbs, fats } };
}

export function nutritionTargetsError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Las metas nutricionales no tienen un formato válido.";
  }
  const data = value as Record<string, unknown>;
  const limits: Array<[string, string, number, number]> = [
    ["calories", "Las calorías", 800, 10_000],
    ["protein", "La proteína", 0, 1_000],
    ["carbs", "Los carbohidratos", 0, 2_000],
    ["fats", "Las grasas", 0, 1_000],
  ];
  for (const [key, label, minimum, maximum] of limits) {
    const number = Number(data[key]);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      return `${label} deben estar entre ${minimum} y ${maximum}.`;
    }
  }
  return "";
}

export function parseNutritionTargets(value: unknown): NutritionTargets {
  const error = nutritionTargetsError(value);
  if (error) throw new Error(error);
  const data = value as Record<string, unknown>;
  return {
    calories: Math.round(Number(data.calories)),
    protein: Math.round(Number(data.protein)),
    carbs: Math.round(Number(data.carbs)),
    fats: Math.round(Number(data.fats)),
  };
}

export function personalProfileToBiometrics(
  personal: AthletePersonalProfile,
): NutritionBiometrics {
  return {
    gender: personal.gender,
    weight: personal.weightKg,
    height: personal.heightCm,
    age: personal.age,
    activityLevel: personal.activityLevel,
  };
}
