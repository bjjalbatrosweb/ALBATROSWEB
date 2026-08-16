import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dailyCashFlow, financeSummary, safeAmount, totalsByCategory, type FinanceMovement } from "../src/lib/finance-calculations.ts";

const movements: FinanceMovement[] = [
  { id: "1", type: "income", amount: 1000, category: "Mensualidades", date: new Date(2026, 7, 2) },
  { id: "2", type: "expense", amount: 250, category: "Servicios", date: new Date(2026, 7, 2) },
  { id: "3", type: "expense", amount: 100, category: "Limpieza", date: new Date(2026, 7, 3) },
];

test("calcula ingresos, egresos, utilidad y margen", () => {
  assert.deepEqual(financeSummary(movements), { income: 1000, expenses: 350, balance: 650, margin: 65 });
  assert.equal(safeAmount(-100), 0);
});

test("ordena categorías de mayor egreso y agrupa por día", () => {
  assert.equal(totalsByCategory(movements, "expense")[0].name, "Servicios");
  assert.deepEqual(dailyCashFlow(movements, 2026, 7)[1], { day: "2", ingresos: 1000, egresos: 250 });
});

test("el panel ordena por fecha igual que los índices desplegados", async () => {
  const page = await readFile(new URL("../src/app/admin/finanzas/page.tsx", import.meta.url), "utf8");
  assert.match(page, /orderBy\("fecha", "desc"\)/);
  assert.match(page, /El movimiento puede estar guardado/);
});
