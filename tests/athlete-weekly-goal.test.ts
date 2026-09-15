import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWeeklyGoal,
  parseWeeklyGoal,
  weeklyAttendanceProgress,
  weeklyGoalError,
  weeklyGoalWeekKey,
} from "../src/lib/athlete-weekly-goal";

test("la meta semanal usa el lunes local y no el día UTC", () => {
  assert.equal(weeklyGoalWeekKey(new Date("2026-09-14T03:30:00.000Z")), "2026-09-07");
  assert.equal(weeklyGoalWeekKey(new Date("2026-09-14T15:00:00.000Z")), "2026-09-14");
});

test("valida y normaliza una meta alcanzable", () => {
  const input = { focus: "tecnica", targetSessions: 4, note: "  Mejorar guardia  " };
  assert.equal(weeklyGoalError(input), "");
  assert.deepEqual(parseWeeklyGoal(input, "2026-09-14"), {
    weekKey: "2026-09-14",
    focus: "tecnica",
    targetSessions: 4,
    note: "Mejorar guardia",
  });
  assert.match(weeklyGoalError({ ...input, targetSessions: 15 }), /1 y 14/);
});

test("no arrastra una meta vencida a una semana nueva", () => {
  const previous = { weekKey: "2026-09-07", focus: "constancia", targetSessions: 3, note: "" };
  assert.equal(normalizeWeeklyGoal(previous, "2026-09-14"), null);
});

test("cuenta un máximo de una asistencia por día dentro de la semana", () => {
  const values = [
    Date.parse("2026-09-14T14:00:00Z"),
    Date.parse("2026-09-14T20:00:00Z"),
    Date.parse("2026-09-16T14:00:00Z"),
    Date.parse("2026-09-13T14:00:00Z"),
  ];
  assert.equal(
    weeklyAttendanceProgress(values, "2026-09-14", new Date("2026-09-17T14:00:00Z")),
    2,
  );
});
