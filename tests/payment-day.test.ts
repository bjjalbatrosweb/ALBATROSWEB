import assert from "node:assert/strict";
import test from "node:test";

import { calculatePaymentDay, parseLocalDate, toDateInputValue } from "../src/lib/payment-day.ts";

test("cobra la mensualidad completa cuando el alta es el día primero", () => {
  const result = calculatePaymentDay(parseLocalDate("2026-08-01"), 1, "monday");
  assert.equal(result.amountDue, 600);
  assert.equal(result.remainingClasses, result.totalClasses);
});

test("prorratea únicamente las clases restantes del horario", () => {
  const result = calculatePaymentDay(parseLocalDate("2026-08-17"), 2, "monday");
  assert.equal(result.totalClasses, 13);
  assert.equal(result.remainingClasses, 7);
  assert.equal(result.amountDue, 484.62);
});

test("establece el siguiente pago el día primero del mes siguiente", () => {
  const result = calculatePaymentDay(parseLocalDate("2026-12-20"), 1, "tuesday");
  assert.equal(toDateInputValue(result.nextPaymentDate), "2027-01-01");
});
