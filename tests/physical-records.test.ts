import assert from "node:assert/strict";
import test from "node:test";
import { bloodPressureStatus, calculateWaistHeight, optionalSignedNumber, type PhysicalAssessment } from "../src/lib/athlete-progress.ts";
import { completedHealthEvaluations, latestPhysicalSnapshot } from "../src/lib/physical-records.ts";

const health = { id: "health", fecha: "2026-08-20", tipoRegistro: "salud" as const, pesoKg: 70, estaturaCm: 170, imc: 24.2, cinturaCm: 82, edad: 30, sexoCalculo: "femenino" as const };

test("combina el último valor de cada prueba sin perder la salud", () => {
  const records = [
    { id: "squat", fecha: "2026-08-22", tipoRegistro: "pruebas", sentadillas: 45 },
    { id: "push", fecha: "2026-08-21", tipoRegistro: "pruebas", lagartijas: 28 },
    health,
  ] as PhysicalAssessment[];
  const snapshot = latestPhysicalSnapshot(records);
  assert.equal(snapshot?.pesoKg, 70);
  assert.equal(snapshot?.lagartijas, 28);
  assert.equal(snapshot?.sentadillas, 45);
});

test("las pruebas parciales no cuentan como evaluaciones de salud", () => {
  const records = [{ id: "test", fecha: "2026-08-22", tipoRegistro: "pruebas" }, health] as PhysicalAssessment[];
  assert.equal(completedHealthEvaluations(records), 1);
});

test("sit and reach acepta valores negativos", () => {
  assert.equal(optionalSignedNumber("-8.5"), -8.5);
});

test("una diastólica alta prevalece sobre una sistólica baja", () => {
  assert.equal(bloodPressureStatus(85, 95), "high2");
});

test("cintura altura conserva precisión antes de clasificar", () => {
  assert.ok((calculateWaistHeight(85.7, 170) || 0) > 0.5);
});
