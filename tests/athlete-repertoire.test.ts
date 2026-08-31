import assert from "node:assert/strict";
import test from "node:test";

import { REPERTOIRE_BRANCHES, REPERTOIRE_TECHNIQUES, normalizeRepertoireProgress, repertoireSummary } from "../src/lib/athlete-repertoire";

test("el repertorio conserva las dos ramas del documento", () => {
  assert.deepEqual(REPERTOIRE_BRANCHES.map((branch) => branch.label), ["Derribes", "Sumisiones"]);
  assert.equal(REPERTOIRE_BRANCHES[0].techniques.length, 20);
  assert.equal(REPERTOIRE_BRANCHES[1].techniques.length, 20);
});

test("incluye técnicas representativas sin claves duplicadas", () => {
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Harai goshi"));
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Arm triangle / kata gatame"));
  assert.equal(new Set(REPERTOIRE_TECHNIQUES).size, REPERTOIRE_TECHNIQUES.length);
});

test("resume el avance del repertorio", () => {
  assert.deepEqual(repertoireSummary({ "Harai goshi": "dominada", Guillotina: "practicando" }), {
    total: 40,
    mastered: 1,
    training: 1,
    pending: 38,
  });
});

test("separa el derribe combinado sin perder su progreso anterior", () => {
  assert.deepEqual(normalizeRepertoireProgress({ "Hip toss / head and arm (O-goshi)": "practicando" }), {
    "Hip toss": "practicando",
    "Head and arm (O-goshi)": "practicando",
  });
});
