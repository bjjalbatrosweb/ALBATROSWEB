import assert from "node:assert/strict";
import test from "node:test";
import { buildFitnessRanking, buildFitnessScoreReport, fitnessScoreSnapshot } from "../src/lib/fitness-scoring.ts";

const record = (id: string, values: Record<string, number>, sex: "masculino" | "femenino" = "masculino") => ({
  id,
  fecha: "2026-08-25",
  tipoRegistro: "pruebas" as const,
  pesoKg: 70,
  estaturaCm: 175,
  imc: 22.9,
  edad: 25,
  sexoCalculo: sex,
  ...values,
});

test("calcula el puntaje como la suma de las cuatro pruebas dividida entre cuatro", () => {
  const report = buildFitnessScoreReport({
    values: { lagartijas: 100, sentadillas: 100, abdominales: 100, burpees: 100 },
    age: 25,
    sex: "masculino",
  });
  assert.equal(report.baseAverage, 100);
  assert.equal(report.sexBonus, 0);
  assert.equal(report.overall, 100);
  assert.equal(report.rankingEligible, true);
});

test("conserva cuartos de punto para que el promedio sea preciso", () => {
  const report = buildFitnessScoreReport({
    values: { lagartijas: 99, sentadillas: 100, abdominales: 101, burpees: 103 },
    sex: "masculino",
  });
  assert.equal(report.baseAverage, 100.75);
  assert.equal(report.overall, 100.75);
});

test("añade exactamente tres puntos a las mujeres después de calcular el promedio", () => {
  const report = buildFitnessScoreReport({
    values: { lagartijas: 40, sentadillas: 60, abdominales: 50, burpees: 30 },
    sex: "femenino",
  });
  assert.equal(report.baseAverage, 45);
  assert.equal(report.sexBonus, 3);
  assert.equal(report.overall, 48);
});

test("no publica puntaje oficial ni ranking con una batería incompleta", () => {
  const report = buildFitnessScoreReport({ values: { lagartijas: 29 }, age: 25, sex: "masculino" });
  assert.equal(report.completed, 1);
  assert.equal(report.overall, undefined);
  assert.equal(report.baseAverage, undefined);
  assert.equal(report.sexBonus, 0);
  assert.equal(report.rankingEligible, false);
  assert.equal(report.provisional, true);
});

test("conserva metas personales como orientación sin alterar la fórmula oficial", () => {
  const history = [record("old", { burpees: 20 })];
  const report = buildFitnessScoreReport({ values: { burpees: 22 }, age: 25, sex: "masculino", history });
  const burpees = report.exercises[0];
  assert.equal(burpees.referenceKind, "personal");
  assert.equal(burpees.target, 21);
  assert.equal(burpees.change, 2);
  assert.equal(report.overall, undefined);
});

test("el ranking exige las cuatro pruebas y ordena por el nuevo puntaje", () => {
  const athletes = [
    { id: "a", nombre: "A", historialFisico: [record("a1", { lagartijas: 40, abdominales: 40, sentadillas: 40, burpees: 40 })] },
    { id: "b", nombre: "B", historialFisico: [record("b1", { lagartijas: 39, abdominales: 39, sentadillas: 39, burpees: 39 }, "femenino")] },
    { id: "c", nombre: "C", historialFisico: [record("c1", { lagartijas: 100 })] },
  ];
  const ranking = buildFitnessRanking(athletes);
  assert.equal(ranking.length, 2);
  assert.equal(ranking[0].athleteId, "b");
  assert.equal(ranking[0].report.overall, 42);
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[1].report.overall, 40);
});

test("guarda el promedio base y el bono aplicado en el snapshot", () => {
  const report = buildFitnessScoreReport({
    values: { lagartijas: 20, sentadillas: 30, abdominales: 40, burpees: 50 },
    sex: "femenino",
  });
  const snapshot = fitnessScoreSnapshot(report);
  assert.equal(snapshot.promedioBase, 35);
  assert.equal(snapshot.bonoSexo, 3);
  assert.equal(snapshot.general, 38);
  assert.equal(snapshot.version, "bateria-repeticiones-v2");
});
