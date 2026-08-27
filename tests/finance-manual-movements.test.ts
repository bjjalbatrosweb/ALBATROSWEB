import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, canManageManualMovement, sameManualExpenseVersion, validateMovementDraft, type ManualFinanceRecord } from "../src/lib/finance-manual-movements.ts";
import { financeSummary, totalsByCategory, dailyCashFlow, type FinanceMovement } from "../src/lib/finance-calculations.ts";

const draft = { amount: "120.50", category: "Comida", concept: "Comida después de clase", date: "2026-08-26" };
const record: ManualFinanceRecord = {
  id: "manual-1", sede: "MMA", tipo: "egreso", monto: 120.5,
  categoria: "Otros", concepto: "Compra", fecha: Timestamp.fromDate(new Date("2026-08-26T12:00:00")), creadoPor: "profesor-1",
};

test("ofrece Comida, Casa y Gastos personales entre los egresos sin quitar categorías existentes", () => {
  for (const category of ["Comida", "Casa", "Gastos personales", "Renta", "Otros"]) assert.ok(EXPENSE_CATEGORIES.includes(category));
  assert.equal(new Set(EXPENSE_CATEGORIES).size, EXPENSE_CATEGORIES.length);
  assert.ok(INCOME_CATEGORIES.includes("Otros ingresos"));
});

test("valida las tres nuevas categorías y conserva los centavos", () => {
  for (const category of ["Comida", "Casa", "Gastos personales"]) {
    const result = validateMovementDraft({ ...draft, category }, "egreso");
    assert.equal(result.monto, 120.5);
    assert.equal(result.categoria, category);
    assert.equal(result.date.getDate(), 26);
  }
});

test("rechaza importes negativos, vacíos, demasiado altos o con decimales excesivos", () => {
  for (const amount of ["", "0", "-1", "Infinity", "NaN", "10000000.01", "0.001", "12.345", "1e3"]) {
    assert.throws(() => validateMovementDraft({ ...draft, amount }, "egreso"));
  }
  assert.equal(validateMovementDraft({ ...draft, amount: "0.01" }, "egreso").monto, 0.01);
  assert.equal(validateMovementDraft({ ...draft, amount: "10000000.00" }, "egreso").monto, 10000000);
});

test("rechaza fechas imposibles y conceptos fuera de rango", () => {
  for (const date of ["", "2026-02-30", "2026-13-01", "2026-8-1", "0000-01-01"]) assert.throws(() => validateMovementDraft({ ...draft, date }, "egreso"));
  for (const concept of [" ", "a", "a".repeat(141)]) assert.throws(() => validateMovementDraft({ ...draft, concept }, "egreso"));
  assert.equal(validateMovementDraft({ ...draft, date: "2024-02-29", concept: "  Cena  " }, "egreso").concepto, "Cena");
});

test("permite conservar una categoría antigua pero no inventar categorías al crear", () => {
  assert.throws(() => validateMovementDraft({ ...draft, category: "Categoría antigua" }, "egreso"));
  assert.equal(validateMovementDraft({ ...draft, category: "Categoría antigua" }, "egreso", "Categoría antigua").categoria, "Categoría antigua");
  assert.throws(() => validateMovementDraft(draft, "ingreso"));
});

test("la edición es para el autor o administrador autenticado", () => {
  assert.equal(canManageManualMovement(record, "profesor-1", false), true);
  assert.equal(canManageManualMovement(record, "admin-1", true), true);
  assert.equal(canManageManualMovement(record, "profesor-2", false), false);
  assert.equal(canManageManualMovement(record, undefined, true), false);
});

test("detecta ediciones simultáneas y no admite convertir ingresos ni cambiar origen", () => {
  assert.equal(sameManualExpenseVersion(record, { ...record }), true);
  const modifications: Partial<ManualFinanceRecord>[] = [
    { monto: 999 }, { categoria: "Casa" }, { concepto: "Otro concepto" },
    { fecha: Timestamp.fromMillis(record.fecha.toMillis() + 86400000) },
    { tipo: "ingreso" }, { sede: "Otra sede" }, { creadoPor: "otro" }, { id: "otro" },
    { revision: 1 }, { actualizadoEn: Timestamp.now() },
  ];
  for (const modification of modifications) assert.equal(sameManualExpenseVersion(record, { ...record, ...modification }), false);
  assert.equal(sameManualExpenseVersion({ ...record, tipo: "ingreso" }, { ...record, tipo: "ingreso" }), false);
});

test("editar un egreso recalcula monto, categoría y día sin duplicar ni alterar pagos", () => {
  const payment: FinanceMovement = { id: "pago-1", type: "income", amount: 500, category: "Mensualidades", date: new Date(2026, 7, 1), source: "payment" };
  const before: FinanceMovement[] = [payment, { id: record.id, type: "expense", amount: 100, category: "Otros", date: new Date(2026, 7, 2), source: "manual" }];
  const after = before.map(item => item.id === record.id ? { ...item, amount: 150, category: "Casa", date: new Date(2026, 7, 3) } : item);
  assert.equal(after.length, 2);
  assert.equal(after[0], payment);
  assert.equal(financeSummary(after).balance, 350);
  assert.deepEqual(totalsByCategory(after, "expense"), [{ name: "Casa", value: 150 }]);
  assert.equal(dailyCashFlow(after, 2026, 7)[1].egresos, 0);
  assert.equal(dailyCashFlow(after, 2026, 7)[2].egresos, 150);
});
