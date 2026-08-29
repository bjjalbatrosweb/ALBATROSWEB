import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import type { ManualFinanceRecord } from "../src/lib/finance-manual-movements.ts";
import { EMPTY_MOVEMENT_FILTERS, activeMovementFilters, combineFinanceMovements, filterManualMovements, manualMovementsCsv, movementDate, movementExportFilename, movementFilterError } from "../src/lib/finance-movement-list.ts";

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
  assert.ok(csv.startsWith("\uFEFFFecha,Tipo,Categoría,Concepto,Monto (MXN),Sede,Origen\r\n"));
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

const payments = [{ id: "1", monto: 850, fecha: Timestamp.fromDate(new Date("2026-08-21T12:00:00")), nombre: "Atleta de prueba" }];
test("incluye pagos de alumnos solo al activar la opción, sin perder ingresos manuales", () => {
  assert.equal(combineFinanceMovements(records, payments, "MMA", false).length, records.length);
  const combined = combineFinanceMovements(records, payments, "MMA", true);
  assert.equal(combined.length, records.length + 1);
  const filtered = filterManualMovements(combined, defaults, "2026-08");
  assert.equal(filtered.filter(record => record.tipo === "ingreso").length, 2);
  assert.equal(filtered.filter(record => record.tipo === "egreso").length, 2);
  assert.equal(filtered.find(record => record.origen === "pago")?.monto, 850);
  // Collection IDs can coincide: origin keeps a payment separate from a manual record.
  assert.equal(new Set(combined.map(record => `${record.origen}-${record.id}`)).size, combined.length);
});
test("descarga ingresos aunque no existan movimientos manuales", () => {
  const result = filterManualMovements(combineFinanceMovements([], payments, "MMA", true), defaults, "2026-08");
  assert.equal(result.length, 1);
  const csv = manualMovementsCsv(result, "MMA");
  assert.ok(csv.includes('"Ingreso","Mensualidades","Pago de alumno · Atleta de prueba",850.00,"MMA","Pago de alumno"'));
});
test("aplica los mismos filtros a los pagos y mantiene su origen de solo lectura", () => {
  const combined = combineFinanceMovements(records, payments, "MMA", true);
  const result = filterManualMovements(combined, { ...defaults, category: "Mensualidades", concept: "atleta" }, "2026-08");
  assert.equal(result.length, 1);
  assert.equal(result[0].origen, "pago");
  assert.equal(filterManualMovements(combined, { ...defaults, type: "egreso" }, "2026-08").some(record => record.origen === "pago"), false);
  assert.equal(filterManualMovements(combined, defaults, "2026-09").length, 0);
});
test("identifica el archivo completo y distingue el origen manual", () => {
  assert.equal(movementExportFilename("MMA", "2026-08", false, true), "movimientos-completos-mma-2026-08.csv");
  assert.ok(manualMovementsCsv([records[0]], "MMA").includes('"Manual"'));
});
test("no asigna una fecha inventada a un pago sin fecha", () => {
  assert.equal(combineFinanceMovements([], [{ id: "sin-fecha", monto: 500 }], "MMA", true).length, 0);
});
test("ignora pagos inválidos o sin un monto positivo", () => {
  const invalidPayments = [
    { id: "zero", monto: 0, fecha: Timestamp.fromDate(new Date("2026-08-10T12:00:00")) },
    { id: "negative", monto: -500, fecha: Timestamp.fromDate(new Date("2026-08-10T12:00:00")) },
    { id: "nan", monto: Number.NaN, fecha: Timestamp.fromDate(new Date("2026-08-10T12:00:00")) },
  ];
  assert.deepEqual(combineFinanceMovements([], invalidPayments, "MMA", true), []);
});
