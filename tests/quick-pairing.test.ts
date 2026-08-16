import assert from "node:assert/strict";
import test from "node:test";
import { forbiddenQuickPair, generateQuickPairs, type QuickProfile } from "../src/lib/quick-pairing.ts";

const athlete = (id: string, name: string): QuickProfile => ({ id, name, kind: "athlete" });

test("Andy y Lion jamás quedan emparejados sin importar mayúsculas", () => {
  const andy = athlete("a", "Andy"); const lion = athlete("l", "LION");
  assert.equal(forbiddenQuickPair(andy, lion), true);
  const result = generateQuickPairs([andy, lion], () => 0.2);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.resting.length, 2);
});

test("la preferencia ponderada une a Karla con COACH cuando se activa", () => {
  const profiles: QuickProfile[] = [athlete("k", "karla"), athlete("a", "Ana"), { id: "coach", name: "COACH", kind: "coach" }, athlete("m", "Mario")];
  const result = generateQuickPairs(profiles, () => 0.1);
  assert.ok(result.pairs.some((pair) => new Set([pair.left.name.toLowerCase(), pair.right.name.toLowerCase()]).has("karla") && (pair.left.kind === "coach" || pair.right.kind === "coach")));
});

test("Karla también puede pasar con otros perfiles", () => {
  const sequence = [0.95, 0.1, 0.8, 0.2, 0.6, 0.3]; let index = 0;
  const profiles: QuickProfile[] = [athlete("k", "Karla"), athlete("a", "Ana"), { id: "coach", name: "COACH", kind: "coach" }, athlete("m", "Mario")];
  const result = generateQuickPairs(profiles, () => sequence[index++ % sequence.length]);
  assert.equal(result.preferredCoachKarla, false);
  assert.equal(result.pairs.length, 2);
});
