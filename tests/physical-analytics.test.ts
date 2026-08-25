import assert from "node:assert/strict";
import test from "node:test";
import { buildAthleteAnalytics } from "../src/lib/physical-analytics.ts";

const record = (id: string, lagartijas: number) => ({
  id,
  fecha: "2026-08-24",
  tipoRegistro: "completo" as const,
  pesoKg: 70,
  estaturaCm: 175,
  imc: 22.9,
  edad: 25,
  sexoCalculo: "masculino" as const,
  cinturaEstatura: 0.46,
  lagartijas,
  burpees: Math.round(lagartijas / 2),
  navetteNivel: Math.round(lagartijas / 5),
  calidadMedicion: 90,
});

test("ordena solo cuando existe una cohorte y tres capacidades comparables", () => {
  const athletes = [20, 40, 30, 25, 35].map((value, index) => ({ id: String(index), nombre: String(index), historialFisico: [record(String(index), value)] }));
  const result = buildAthleteAnalytics(athletes);
  assert.equal(result.find((item) => item.id === "1")?.performanceRank, 1);
  assert.equal(result.find((item) => item.id === "0")?.performanceRank, 5);
});

test("no inventa puntuaciones cuando no existen evaluaciones", () => {
  const [result] = buildAthleteAnalytics([{ id: "a", nombre: "Sin datos", historialFisico: [] }]);
  assert.equal(result.healthScore, undefined);
  assert.equal(result.performanceScore, undefined);
  assert.equal(result.dataQuality, 0);
});

test("la calidad de medición no se convierte en salud", () => {
  const [result] = buildAthleteAnalytics([{ id: "a", nombre: "Solo calidad", historialFisico: [{ id: "q", fecha: "2026-08-24", tipoRegistro: "salud", calidadMedicion: 100 }] }]);
  assert.equal(result.healthScore, undefined);
  assert.equal(result.healthIndicatorCount, 0);
});

test("reconstruye pruebas guardadas por separado", () => {
  const history = [
    { ...record("latest", 0), tipoRegistro: "pruebas" as const, fecha: "2026-08-25", lagartijas: undefined, burpees: 24, navetteNivel: undefined },
    { ...record("push", 35), tipoRegistro: "pruebas" as const, fecha: "2026-08-24", burpees: undefined, navetteNivel: undefined },
    record("health", 0),
  ];
  const [result] = buildAthleteAnalytics([{ id: "a", nombre: "A", historialFisico: history }]);
  assert.equal(result.latest?.lagartijas, 35);
  assert.equal(result.latest?.burpees, 24);
});

test("sin cinco pares no publica un ranking general", () => {
  const result = buildAthleteAnalytics([{ id: "a", nombre: "A", historialFisico: [record("1", 50)] }, { id: "b", nombre: "B", historialFisico: [record("2", 20)] }]);
  assert.ok(result.every((item) => item.performanceRank === undefined));
  assert.ok(result.every((item) => item.performanceScore === undefined));
});
