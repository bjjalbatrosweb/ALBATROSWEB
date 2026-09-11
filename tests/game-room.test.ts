import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameSchedule, buildPvpGameSchedule, buildWeeklyGameLeaderboards,
  calculatePvpStandings, createGameChallenge, getGameWeekKey,
  finalizeGameSchedule, isGameScheduleComplete,
  type GameMatch, type GameParticipant, type GamePvpChallenge,
} from "../src/lib/game-room";

const people: GameParticipant[] = ["a", "b", "c", "d"].map((id) => ({ id, nombre: id.toUpperCase() }));

test("prioriza desafíos mutuos, asigna cartas técnicas y respeta las áreas", () => {
  const result = buildGameSchedule(people, [{ participantId: "a", objetivos: ["b"] }, { participantId: "b", objetivos: ["a"] }], 2, true);
  assert.equal(result[0].solicitudMutua, true);
  assert.ok(result.every((match) => match.area <= 2 && match.sumision && match.derribe));
  const firstRound = result.filter((match) => match.round === 1).flatMap((match) => [match.a.id, match.b.id]);
  assert.equal(new Set(firstRound).size, firstRound.length);
});

test("un reto nace pendiente y usa una semana que comienza en lunes", () => {
  const invitation = createGameChallenge("torneo-1", "MMA", people[0], people[1], new Date(2026, 8, 10, 12));
  assert.equal(invitation.status, "pendiente");
  assert.equal(invitation.weekKey, "2026-09-07");
  assert.equal(getGameWeekKey(new Date(2026, 8, 13)), "2026-09-07");
  assert.notEqual(invitation.challengerId, invitation.challengedId);
});

test("sólo los retos aceptados generan combate y cada pareja aparece una vez", () => {
  const base = createGameChallenge("torneo-1", "MMA", people[0], people[1]);
  const challenges: GamePvpChallenge[] = [
    { ...base, status: "aceptado" },
    { ...createGameChallenge("torneo-1", "MMA", people[1], people[0]), status: "aceptado" },
    { ...createGameChallenge("torneo-1", "MMA", people[2], people[3]), status: "rechazado" },
  ];
  const schedule = buildPvpGameSchedule(people, challenges, 2);
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].solicitudMutua, true);
  assert.equal(schedule[0].acceptedChallengeIds?.length, 2);
});

test("el marcador suma retos, aceptación, combate y victoria, y resta rechazo", () => {
  const weekKey = getGameWeekKey();
  const challenges: GamePvpChallenge[] = [
    { ...createGameChallenge("t", "MMA", people[0], people[1]), weekKey, status: "aceptado" },
    { ...createGameChallenge("t", "MMA", people[2], people[1]), weekKey, status: "rechazado" },
  ];
  const match: GameMatch = { id: "m1", round: 1, area: 1, a: people[0], b: people[1], solicitada: true, solicitudMutua: false, estado: "completado", winnerId: "b" };
  const standings = calculatePvpStandings(people, challenges, [[match]]);
  const a = standings.find((item) => item.id === "a")!;
  const b = standings.find((item) => item.id === "b")!;
  assert.equal(a.points, 2); // +1 reto +1 combate
  assert.equal(b.points, 7); // +2 acepta -1 rechaza +1 combate +5 victoria
  assert.equal(b.declined, 1);
});

test("genera las cuatro tablas semanales y el MVP usa el puntaje completo", () => {
  const weekKey = getGameWeekKey();
  const challenges: GamePvpChallenge[] = [
    { ...createGameChallenge("t", "MMA", people[0], people[1]), weekKey, status: "aceptado" },
    { ...createGameChallenge("t", "MMA", people[0], people[2]), weekKey, status: "aceptado" },
  ];
  const match: GameMatch = { id: "mvp", round: 1, area: 1, a: people[0], b: people[1], solicitada: true, solicitudMutua: false, estado: "completado", winnerId: "b" };
  const boards = buildWeeklyGameLeaderboards(people, challenges, [[match]], weekKey);
  assert.equal(boards.challengers[0].id, "a");
  assert.equal(boards.bravest[0].id, "b");
  assert.equal(boards.victorious[0].id, "b");
  assert.equal(boards.mvp[0].id, "b");
});

test("finalizar no convierte combates pendientes en combates realizados", () => {
  const pending: GameMatch = { id: "pendiente", round: 2, area: 1, a: people[0], b: people[1], solicitada: true, solicitudMutua: false, estado: "pendiente" };
  const completed: GameMatch = { ...pending, id: "completo", round: 1, estado: "completado" };
  const result = finalizeGameSchedule([completed, pending]);
  assert.equal(result[1].estado, "pendiente");
  assert.equal(isGameScheduleComplete(result), false);
  assert.equal(isGameScheduleComplete([{ ...pending, estado: "completado" }]), true);
});
