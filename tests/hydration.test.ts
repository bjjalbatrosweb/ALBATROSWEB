import assert from "node:assert/strict";
import test from "node:test";
import { calculateHydration } from "../src/lib/hydration.ts";

test("calcula el balance completo y la tasa de sudor", () => {
  const value = calculateHydration({ durationMin: 60, preKg: 70, postKg: 69.2, intakeMl: 500, urineMl: 0 });
  assert.equal(value.sweatLossL, 1.3);
  assert.equal(value.sweatRateLh, 1.3);
  assert.equal(value.intakeRateLh, 0.5);
  assert.equal(value.massChangePct, 1.14);
  assert.equal(value.replacementPct, 38);
  assert.equal(value.recoveryMinMl, 1000);
  assert.equal(value.recoveryMaxMl, 1200);
  assert.equal(value.projected90MinL, 1.95);
});

test("advierte pérdida de masa igual o mayor a dos por ciento", () => {
  const value = calculateHydration({ durationMin: 60, preKg: 70, postKg: 68.5, intakeMl: 0 });
  assert.equal(value.status, "high");
  assert.ok(value.warnings.some((item) => item.includes("2%")));
});

test("detecta ganancia de masa y limita la puntuación de control", () => {
  const value = calculateHydration({ durationMin: 60, preKg: 70, postKg: 70.4, intakeMl: 1000 });
  assert.equal(value.status, "gain");
  assert.ok(value.controlScore <= 60);
  assert.ok(value.warnings.some((item) => item.includes("mayor masa")));
});

test("rechaza unidades, valores no numéricos o duraciones imposibles", () => {
  assert.throws(() => calculateHydration({ durationMin: 60, preKg: 700, postKg: 69, intakeMl: 500 }), /kilogramos/);
  assert.throws(() => calculateHydration({ durationMin: 5, preKg: 70, postKg: 69, intakeMl: 500 }), /duración/);
  assert.throws(() => calculateHydration({ durationMin: Number.NaN, preKg: 70, postKg: 69, intakeMl: 500 }), /numéricos/);
});
