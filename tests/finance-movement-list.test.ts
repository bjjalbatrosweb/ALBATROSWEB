import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import type { ManualFinanceRecord } from "../src/lib/finance-manual-movements.ts";
import { EMPTY_MOVEMENT_FILTERS, activeMovementFilters, filterManualMovements, manualMovementsCsv, movementDate, movementExportFilename, movementFilterError } from "../src/lib/finance-movement-list.ts";

const row = (id: string, date: string, monto: number, categoria: string, concepto: string, tipo: "ingreso" | "egreso" = "egreso"): ManualFinanceRecord => ({ id, fecha: Timestamp.fromDate(new Date(`${date}T12:00:00`)), monto, categoria, concepto, tipo, sede: "MMA" });
const records = [
  row("1", "2026-08-01", 120.5, "Comida", "Café después de clase"),
  row("2", "2026-08-10", 700, "Casa", "Recibo de luz"),
  row("3", "2026-08-20", 450, "Clase privada", "Sesión especial", "ingreso"),
  row("4", "2026-07-31", 99, "Comida", "Cena del mes anterior"),
];
const defaults = { ...EMPTY_MOVEMENT_FILTERS };

test("la lista y descarga se limitan al mes actual y ordenan sin mutar el historial", () => {
  assert.deepEqual(filterManualMovements(records, defaults, "2026-08").map(row => row.id), ["3", "2", "1"]);
  assert.deepEqual(records.map(row => row.id), ["1", "2", "3", "4"]);
  assert.equal(movementDate(records[0]), "2026-08-01");
});
test("combina categoría, concepto sin acentos, tipo, fechas y montos inclusivos", () => {
  const filters = { ...defaults, type: "egreso" as const, category: "Comida", concept: " CAFE ", from: "2026-08-01", to: "2026-08-01", minAmount: "120.50", maxAmount: "120.50" };
  assert.deepEqual(filterManualMovements(records, filters, "2026-08").map(row => row.id), ["1"]);
  assert.equal(activeMovementFilters(filters), 7);
  assert.equal(activeMovementFilters(defaults), 0);
});
test("rechaza rangos invertidos y entradas inválidas sin exportar datos equivocados", () => {
  for (const change of [{ from: "2026-08-20", to: "2026-08-01" }, { from: "2026-02-30" }, { minAmount: "500", maxAmount: "10" }, { minAmount: "-1" }, { maxAmount: "Infinity" }, { minAmount: "12.345" }]) {
    assert.ok(movementFilterError({ ...defaults, ...change }));
    assert.deepEqual(filterManualMovements(records, { ...defaults, ...change }, "2026-08"), []);
  }
});
test("ordena por monto y distingue un filtro vacío de monto cero", () => {
  assert.deepEqual(filterManualMovements(records, { ...defaults, sort: "amount-asc" }, "2026-08").map(row => row.id), ["1", "3", "2"]);
  assert.deepEqual(filterManualMovements(records, { ...defaults, sort: "amount-desc" }, "2026-08").map(row => row.id), ["2", "3", "1"]);
  assert.deepEqual(filterManualMovements(records, { ...defaults, maxAmount: "0" }, "2026-08"), []);
});
test("CSV UTF-8 conserva acentos, comillas, saltos de línea y centavos", () => {
  const csv = manualMovementsCsv([row("5", "2026-08-27", 10.5, "Comida", 'Café, "grande"\ncon leche')], "MMA");
  assert.ok(csv.startsWith("\uFEFFFecha,Tipo,Categoría,Concepto,Monto (MXN),Sede\r\n"));
  assert.ok(csv.includes('"Café, ""grande""\ncon leche",10.50,"MMA"'));
});
test("neutraliza fórmulas en campos de texto del CSV", () => {
  for (const text of ["=1+1", "+CMD", "-1+2", "@SUM(A1)", "  =1", "\t=1", "\n=1"]) {
    assert.ok(manualMovementsCsv([row("6", "2026-08-27", 1, text, text)], text).includes(`"'${text}"`));
  }
});
test("exporta exactamente los resultados filtrados en el mismo orden", () => {
  const filtered = filterManualMovements(records, { ...defaults, category: "Casa" }, "2026-08");
  const csv = manualMovementsCsv(filtered, "MMA");
  assert.ok(csv.includes("Recibo de luz"));
  assert.ok(!csv.includes("Café"));
  assert.ok(!csv.includes("Sesión especial"));
  assert.equal(csv.split("\r\n").length, 3);
});
test("genera nombres de archivo seguros y marca filtros activos", () => {
  assert.equal(movementExportFilename("Sede Mérida / Centro", "2026-08", true), "movimientos-manuales-sede-merida-centro-2026-08-filtrados.csv");
});
