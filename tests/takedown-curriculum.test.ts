import assert from "node:assert/strict";
import test from "node:test";

import { TAKEDOWN_MODULES, TAKEDOWN_REPERTOIRE } from "../src/lib/takedown-curriculum";
import { GAME_TAKEDOWNS } from "../src/lib/game-room";

test("el repertorio contiene los 26 derribes solicitados sin duplicados", () => {
  assert.equal(TAKEDOWN_REPERTOIRE.length, 26);
  assert.equal(new Set(TAKEDOWN_REPERTOIRE.map((name) => name.toLocaleLowerCase("es"))).size, 26);
  ["Harai goshi", "Sode tsurikomi", "Single leg", "Double leg", "Duck under", "Suplex", "Kani basami"].forEach((name) => {
    assert.ok(TAKEDOWN_REPERTOIRE.includes(name));
  });
});

test("el foro divide todos los derribes en tres módulos progresivos", () => {
  assert.deepEqual(TAKEDOWN_MODULES.map((module) => module.id), ["fundamentos", "intermedio", "avanzado"]);
  assert.deepEqual(TAKEDOWN_MODULES.map((module) => module.techniques.length), [9, 15, 2]);
  assert.ok(TAKEDOWN_MODULES.every((module) => module.description && module.safety));
  assert.deepEqual(GAME_TAKEDOWNS, TAKEDOWN_REPERTOIRE);
});
