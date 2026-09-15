export const ATHLETE_ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

export type AthleteGoal = "maintain" | "lose" | "gain";
export type AthleteGender = "male" | "female";

export type AthletePersonalProfile = {
  gender: AthleteGender;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: (typeof ATHLETE_ACTIVITY_LEVELS)[number];
  goal: AthleteGoal;
};

type ProfileFallback = {
  gender?: unknown;
  weightKg?: unknown;
  heightCm?: unknown;
  age?: unknown;
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= minimum && number <= maximum
    ? number
    : null;
}

function normalizedGender(value: unknown): AthleteGender | null {
  if (value === "male" || value === "masculino" || value === "hombre") {
    return "male";
  }
  if (value === "female" || value === "femenino" || value === "mujer") {
    return "female";
  }
  return null;
}

export function normalizeAthletePersonalProfile(
  saved: Record<string, unknown>,
  fallback: ProfileFallback = {},
): AthletePersonalProfile {
  const activity = finiteNumber(saved.activityLevel);
  const activityLevel = ATHLETE_ACTIVITY_LEVELS.includes(
    activity as (typeof ATHLETE_ACTIVITY_LEVELS)[number],
  )
    ? (activity as (typeof ATHLETE_ACTIVITY_LEVELS)[number])
    : 1.55;

  return {
    gender:
      normalizedGender(saved.gender) ||
      normalizedGender(fallback.gender) ||
      "male",
    weightKg:
      numberInRange(saved.weightKg, 15, 250) ??
      numberInRange(fallback.weightKg, 15, 250) ??
      0,
    heightCm:
      numberInRange(saved.heightCm, 80, 230) ??
      numberInRange(fallback.heightCm, 80, 230) ??
      0,
    age:
      numberInRange(saved.age, 5, 100) ??
      numberInRange(fallback.age, 5, 100) ??
      0,
    activityLevel,
    goal:
      saved.goal === "lose" || saved.goal === "gain"
        ? saved.goal
        : "maintain",
  };
}

export function athletePersonalProfileError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Los datos del perfil no son válidos.";
  }

  const profile = value as Record<string, unknown>;
  if (!normalizedGender(profile.gender)) {
    return "Selecciona un sexo válido para los cálculos personales.";
  }

  const weight = finiteNumber(profile.weightKg);
  if (weight === null || weight < 15 || weight > 250) {
    return "El peso debe estar entre 15 y 250 kg.";
  }

  const height = finiteNumber(profile.heightCm);
  if (height === null || height < 80 || height > 230) {
    return "La estatura debe estar entre 80 y 230 cm.";
  }

  const age = finiteNumber(profile.age);
  if (age === null || !Number.isInteger(age) || age < 5 || age > 100) {
    return "La edad debe ser un número entero entre 5 y 100 años.";
  }

  const activity = finiteNumber(profile.activityLevel);
  if (
    !ATHLETE_ACTIVITY_LEVELS.includes(
      activity as (typeof ATHLETE_ACTIVITY_LEVELS)[number],
    )
  ) {
    return "Selecciona un nivel de actividad válido.";
  }

  if (!(["maintain", "lose", "gain"] as unknown[]).includes(profile.goal)) {
    return "Selecciona un objetivo personal válido.";
  }

  return "";
}

export function parseAthletePersonalProfile(
  value: unknown,
): AthletePersonalProfile {
  const error = athletePersonalProfileError(value);
  if (error) throw new Error(error);

  const profile = value as Record<string, unknown>;
  return {
    gender: normalizedGender(profile.gender) as AthleteGender,
    weightKg: Number(profile.weightKg),
    heightCm: Number(profile.heightCm),
    age: Number(profile.age),
    activityLevel: Number(
      profile.activityLevel,
    ) as AthletePersonalProfile["activityLevel"],
    goal: profile.goal as AthleteGoal,
  };
}
