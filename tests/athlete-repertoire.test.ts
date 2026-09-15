import assert from "node:assert/strict";
import test from "node:test";

import { REPERTOIRE_BRANCHES, REPERTOIRE_TECHNIQUES, normalizeRepertoireProgress, repertoireSummary } from "../src/lib/athlete-repertoire";

test("el repertorio conserva las dos ramas del documento", () => {
  assert.deepEqual(REPERTOIRE_BRANCHES.map((branch) => branch.label), ["Derribes", "Sumisiones"]);
  assert.equal(REPERTOIRE_BRANCHES[0].techniques.length, 26);
  assert.equal(REPERTOIRE_BRANCHES[1].techniques.length, 24);
});

test("incluye técnicas representativas sin claves duplicadas", () => {
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Harai goshi"));
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Kata-gatame"));
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Aoki lock"));
  assert.ok(REPERTOIRE_TECHNIQUES.includes("Kani basami"));
  assert.equal(new Set(REPERTOIRE_TECHNIQUES).size, REPERTOIRE_TECHNIQUES.length);
});

test("resume el avance del repertorio", () => {
  assert.deepEqual(repertoireSummary({ "Harai goshi": "dominada", Guillotina: "practicando" }), {
    total: 50,
    mastered: 1,
    training: 1,
    pending: 48,
  });
});

test("migra nombres anteriores de sumisiones sin perder el avance", () => {
  assert.deepEqual(normalizeRepertoireProgress({
    "Mata león": "dominada",
    Armbar: "practicando",
    "Knee bar": "dominada",
  }), {
    Mataleón: "dominada",
    "Armbar / Juji-gatame": "practicando",
    Kneebar: "dominada",
  });
});

test("separa el derribe combinado sin perder su progreso anterior", () => {
  assert.deepEqual(normalizeRepertoireProgress({ "Hip toss / head and arm (O-goshi)": "practicando" }), {
    "Hip toss": "practicando",
    "Head and arm / O-goshi": "practicando",
  });
});

test("migra nombres anteriores y errores tipográficos de derribes", () => {
  assert.deepEqual(normalizeRepertoireProgress({
    "Sode tsurikomi goshi": "dominada",
    "Sasae tsurikomi ashi": "practicando",
    "Kani basani": "dominada",
    Ducks: "practicando",
  }), {
    "Sode tsurikomi": "dominada",
    "Sasae tsurikomi": "practicando",
    "Kani basami": "dominada",
    "Duck under": "practicando",
  });
});
