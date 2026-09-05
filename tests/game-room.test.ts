import assert from "node:assert/strict";
import test from "node:test";
import { buildGameSchedule } from "../src/lib/game-room";

test("prioriza desafíos mutuos y respeta las áreas", () => {
  const people = ["a", "b", "c", "d"].map((id) => ({ id, nombre: id.toUpperCase() }));
  const result = buildGameSchedule(people, [{ participantId: "a", objetivos: ["b"] }, { participantId: "b", objetivos: ["a"] }], 2, true);
  assert.equal(result[0].solicitudMutua, true);
  assert.ok(result.every((match) => match.area <= 2 && match.sumision && match.derribe));
  const firstRound = result.filter((match) => match.round === 1).flatMap((match) => [match.a.id, match.b.id]);
  assert.equal(new Set(firstRound).size, firstRound.length);
});
