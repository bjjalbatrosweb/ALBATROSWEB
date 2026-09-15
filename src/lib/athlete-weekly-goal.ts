import { WELLNESS_TIME_ZONE, wellnessDateKey } from "@/lib/athlete-wellness";

export const WEEKLY_GOAL_FOCUSES = [
  "constancia",
  "tecnica",
  "acondicionamiento",
  "recuperacion",
] as const;

export type WeeklyGoalFocus = (typeof WEEKLY_GOAL_FOCUSES)[number];

export type AthleteWeeklyGoal = {
  weekKey: string;
  focus: WeeklyGoalFocus;
  targetSessions: number;
  note: string;
};

export function weeklyGoalWeekKey(
  date = new Date(),
  timeZone = WELLNESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  const localDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const day = localDate.getUTCDay();
  localDate.setUTCDate(localDate.getUTCDate() - (day === 0 ? 6 : day - 1));
  return localDate.toISOString().slice(0, 10);
}

export function weeklyGoalError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "La meta no tiene un formato válido.";
  }
  const input = value as Record<string, unknown>;
  if (!WEEKLY_GOAL_FOCUSES.includes(input.focus as WeeklyGoalFocus)) {
    return "Selecciona un enfoque válido.";
  }
  const target = Number(input.targetSessions);
  if (!Number.isInteger(target) || target < 1 || target > 14) {
    return "La meta debe estar entre 1 y 14 sesiones.";
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  return note.length > 160 ? "La nota no puede superar 160 caracteres." : "";
}

export function parseWeeklyGoal(
  value: unknown,
  weekKey = weeklyGoalWeekKey(),
): AthleteWeeklyGoal {
  const error = weeklyGoalError(value);
  if (error) throw new Error(error);
  const input = value as Record<string, unknown>;
  return {
    weekKey,
    focus: input.focus as WeeklyGoalFocus,
    targetSessions: Number(input.targetSessions),
    note: typeof input.note === "string" ? input.note.trim() : "",
  };
}

export function normalizeWeeklyGoal(
  value: unknown,
  currentWeek = weeklyGoalWeekKey(),
): AthleteWeeklyGoal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.weekKey !== currentWeek) return null;
  try {
    return parseWeeklyGoal(input, currentWeek);
  } catch {
    return null;
  }
}

export function weeklyAttendanceProgress(
  timestamps: number[],
  weekKey = weeklyGoalWeekKey(),
  now = new Date(),
): number {
  const today = wellnessDateKey(now);
  return new Set(
    timestamps
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => wellnessDateKey(new Date(value)))
      .filter((date) => date >= weekKey && date <= today),
  ).size;
}
