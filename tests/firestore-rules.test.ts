import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('las colecciones exclusivamente servidor permanecen cerradas al cliente', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const collection of ['TarjetasRFID', 'DispositivosAcceso', 'RateLimits', 'ErroresWeb']) {
    const block = new RegExp(`match /${collection}/\\{[^}]+\\} \\{[\\s\\S]*?allow (?:read, write|write): if false;[\\s\\S]*?\\}`);
    assert.match(rules, block, `${collection} debe permanecer cerrada al cliente`);
  }
});

test('la auditoría y movimientos administrativos no pueden editarse o borrarse', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/MovimientosAdmin\/\{movimientoId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(rules, /match \/Auditoria\/\{sede\}\/movimientos\/\{movimientoId\}[\s\S]*?allow update, delete: if false;/);
});

test('incidencias y reservas validan sede, autoría y escrituras sensibles', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/IncidenciasOperativas\/\{incidenciaId\}/);
  assert.match(rules, /request\.resource\.data\.actorUid == request\.auth\.uid/);
  assert.match(rules, /match \/ReservasClases\/\{claseId\}/);
  assert.match(rules, /match \/inscripciones\/\{userId\}[\s\S]*?allow write: if false;/);
});

test('los movimientos financieros validan monto, autor y son inmutables', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/MovimientosFinancieros\/\{movimientoId\}/);
  assert.match(rules, /request\.resource\.data\.monto > 0/);
  assert.match(rules, /request\.resource\.data\.creadoPor == request\.auth\.uid/);
  assert.match(rules, /allow update: if false;/);
});
