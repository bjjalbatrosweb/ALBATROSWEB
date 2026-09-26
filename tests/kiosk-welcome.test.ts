import assert from "node:assert/strict";
import test from "node:test";

import { buildKioskWelcome } from "../src/lib/kiosk-welcome";

test("resume la semana sin contar asistencias repetidas", () => {
  const welcome = buildKioskWelcome(
    ["2026-09-21", "2026-09-23", "2026-09-23", "2026-09-18"],
    "2026-09-26",
    { disciplina: "MMA", tema: "Derribos" },
  );

  assert.equal(welcome.asistenciasSemana, 3);
  assert.equal(welcome.totalAsistencias, 4);
  assert.deepEqual(welcome.claseActiva, {
    disciplina: "MMA",
    tema: "Derribos",
  });
  assert.deepEqual(welcome.siguienteLogro, {
    nombre: "Atleta constante",
    meta: 10,
    faltan: 6,
    completado: false,
  });
});

test("añade el día actual al saludo después de registrar", () => {
  const welcome = buildKioskWelcome([], "2026-09-26", null);
  assert.equal(welcome.asistenciasSemana, 1);
  assert.equal(welcome.totalAsistencias, 1);
  assert.equal(welcome.siguienteLogro.nombre, "Atleta constante");
  assert.equal(welcome.siguienteLogro.faltan, 9);
});

test("reconoce cuando completó todos los hitos", () => {
  const days = Array.from({ length: 100 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1));
    return date.toISOString().slice(0, 10);
  });
  const welcome = buildKioskWelcome(days, "2026-04-10", null);
  assert.equal(welcome.totalAsistencias, 100);
  assert.equal(welcome.siguienteLogro.completado, true);
  assert.equal(welcome.siguienteLogro.faltan, 0);
});
