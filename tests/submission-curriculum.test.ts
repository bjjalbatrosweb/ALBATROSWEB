import assert from "node:assert/strict";
import test from "node:test";

import { SUBMISSION_MODULES, SUBMISSION_REPERTOIRE } from "../src/lib/submission-curriculum";

test("el repertorio contiene las 24 sumisiones solicitadas sin duplicados", () => {
  assert.equal(SUBMISSION_REPERTOIRE.length, 24);
  assert.equal(new Set(SUBMISSION_REPERTOIRE.map((name) => name.toLocaleLowerCase("es"))).size, 24);
  ["Mataleón", "Anaconda / Anakonda", "Armbar / Juji-gatame", "Toe hold", "Karikoplata", "Aoki lock"].forEach((name) => {
    assert.ok(SUBMISSION_REPERTOIRE.includes(name));
  });
});

test("el foro divide el repertorio completo en tres módulos progresivos", () => {
  assert.deepEqual(SUBMISSION_MODULES.map((module) => module.id), ["fundamentos", "intermedio", "avanzado"]);
  assert.deepEqual(SUBMISSION_MODULES.map((module) => module.techniques.length), [6, 8, 10]);
  assert.ok(SUBMISSION_MODULES.every((module) => module.description && module.safety));
});
