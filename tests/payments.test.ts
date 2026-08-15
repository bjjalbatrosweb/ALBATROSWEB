import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarRfidPago, normalizarSedePago, periodoPagoValido } from '../src/lib/payment-validation.ts';

test('normaliza sedes y RFID sin cambiar identificadores válidos', () => {
  assert.equal(normalizarSedePago('juan pablo'), 'JUAN_PABLO');
  assert.equal(normalizarRfidPago('11-13:b9 64'), '1113B964');
});

test('rechaza sedes y periodos inválidos', () => {
  assert.equal(normalizarSedePago('OTRA'), null);
  assert.equal(periodoPagoValido('2026-00'), false);
  assert.equal(periodoPagoValido('2026-13'), false);
  assert.equal(periodoPagoValido('2026-08'), true);
});
