import assert from "node:assert/strict";
import test from "node:test";

import { buildRfidDiagnosticReport } from "../src/lib/rfid-diagnostics.ts";

test("clasifica RFID correctos, huérfanos, sin índice y con conflicto", () => {
  const report = buildRfidDiagnosticReport(
    [
      { id: "a1", nombre: "Ana", sede: "MMA", rfids: ["AA-11", "BB22", "CC33"] },
      { id: "a2", nombre: "Beto", sede: "MMA", rfid: "DD44" },
      { id: "a3", nombre: "Caro", sede: "CAUCEL", rfid: "EE55" },
    ],
    [
      { id: "AA11", alumnoId: "a1", sede: "MMA" },
      { id: "CC33", alumnoId: "otro", sede: "MMA" },
      { id: "DD44", alumnoId: "a2", sede: "MMA" },
      { id: "LIBRE99", alumnoId: "borrado", sede: "MMA" },
      { id: "EE55", alumnoId: "a3", sede: "CAUCEL" },
    ],
    "MMA",
  );

  assert.deepEqual(report.resumen, {
    rfidsActivos: 4,
    indicesSede: 4,
    vinculadosCorrectos: 2,
    huerfanos: 1,
    sinIndice: 1,
    conflictos: 1,
    duplicados: 0,
    totalProblemas: 3,
  });
  assert.deepEqual(report.problemas.huerfanos.map((item) => item.rfid), ["LIBRE99"]);
  assert.deepEqual(report.problemas.sinIndice.map((item) => item.rfid), ["BB22"]);
  assert.deepEqual(report.problemas.conflictos.map((item) => item.rfid), ["CC33"]);
});

test("detecta duplicados entre sedes sin confundirlos con RFID libres", () => {
  const report = buildRfidDiagnosticReport(
    [
      { id: "a1", nombre: "Ana", sede: "MMA", rfid: "ABC123" },
      { id: "a2", nombre: "Beto", sede: "CAUCEL", rfids: ["abc-123"] },
    ],
    [{ id: "ABC123", alumnoId: "a1", sede: "MMA" }],
    "MMA",
  );

  assert.equal(report.resumen.vinculadosCorrectos, 1);
  assert.equal(report.resumen.duplicados, 1);
  assert.equal(report.resumen.huerfanos, 0);
  assert.deepEqual(report.problemas.duplicados[0].alumnos, ["Ana", "Beto"]);
});

test("marca índices con UID no normalizado y detecta huérfanos sin sede", () => {
  const report = buildRfidDiagnosticReport(
    [{ id: "a1", nombre: "Ana", sede: "MMA", rfid: "AA11" }],
    [
      { id: "aa-11", alumnoId: "a1", sede: "MMA" },
      { id: "LIBRE77" },
    ],
    "MMA",
  );

  assert.equal(report.resumen.vinculadosCorrectos, 0);
  assert.equal(report.resumen.conflictos, 1);
  assert.equal(report.resumen.huerfanos, 1);
  assert.deepEqual(report.problemas.huerfanos.map((item) => item.rfid), ["LIBRE77"]);
});
