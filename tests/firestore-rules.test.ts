import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('las colecciones exclusivamente servidor permanecen cerradas al cliente', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const collection of ['TarjetasRFID', 'DispositivosAcceso', 'RateLimits']) {
    const block = new RegExp(`match /${collection}/\\{[^}]+\\} \\{[\\s\\S]*?allow (?:read, write|write): if false;[\\s\\S]*?\\}`);
    assert.match(rules, block, `${collection} debe permanecer cerrada al cliente`);
  }
});

test('la auditoría y movimientos administrativos no pueden editarse o borrarse', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/MovimientosAdmin\/\{movimientoId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(rules, /match \/Auditoria\/\{sede\}\/movimientos\/\{movimientoId\}[\s\S]*?allow update, delete: if false;/);
});
