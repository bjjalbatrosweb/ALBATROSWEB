import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStoredWellness,
  parseWellnessCheckin,
  wellnessCheckinError,
  wellnessDateKey,
} from "../src/lib/athlete-wellness";

const valid = {
  energia: 4,
  sueno: 3,
  dolor: 1,
  animo: 5,
  horasSueno: 7.25,
  aguaLitros: 1.84,
  zonaDolor: "Rodilla",
  notas: "  Sesión ligera  ",
};

test("el bienestar normaliza métricas y limita su precisión", () => {
  assert.equal(wellnessCheckinError(valid), "");
  assert.deepEqual(parseWellnessCheckin(valid, "2026-09-13"), {
    fecha: "2026-09-13",
    energia: 4,
    sueno: 3,
    dolor: 1,
    animo: 5,
    horasSueno: 7.3,
    aguaLitros: 1.8,
    zonaDolor: "Rodilla",
    notas: "Sesión ligera",
  });
});

test("el bienestar rechaza escalas, mediciones y texto fuera de rango", () => {
  assert.match(wellnessCheckinError({ ...valid, energia: 6 }), /energía.*1.*5/i);
  assert.match(wellnessCheckinError({ ...valid, aguaLitros: 11 }), /agua.*0.*10/i);
  assert.match(wellnessCheckinError({ ...valid, zonaDolor: "Inventada" }), /ubicación/i);
  assert.match(wellnessCheckinError({ ...valid, notas: "x".repeat(301) }), /300 caracteres/i);
});

test("los registros anteriores sin hidratación siguen siendo compatibles", () => {
  const stored = normalizeStoredWellness({
    fecha: "2026-09-12",
    energia: 3,
    sueno: 3,
    dolor: 0,
    animo: 4,
  });
  assert.equal(stored?.fecha, "2026-09-12");
  assert.equal(stored?.aguaLitros, undefined);
});

test("la fecha diaria usa la zona de la academia y no el día UTC", () => {
  const instant = new Date("2026-09-14T03:30:00.000Z");
  assert.equal(wellnessDateKey(instant), "2026-09-13");
});

