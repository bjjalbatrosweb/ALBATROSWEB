import assert from "node:assert/strict";
import test from "node:test";
import { addBackupIntegrity, verifyBackupIntegrity } from "../src/lib/backup-integrity.ts";

test("firma y verifica un respaldo sin depender del orden de propiedades", async () => {
  const signed = await addBackupIntegrity({ sistema: "ALBATROS", sede: "MMA", alumnos: [{ id: "1", nombre: "Ana" }] });
  assert.equal((await verifyBackupIntegrity(signed)).valid, true);
});

test("detecta un respaldo modificado", async () => {
  const signed = await addBackupIntegrity({ sistema: "ALBATROS", sede: "MMA", pagos: [{ total: 100 }] });
  const modified = { ...signed, pagos: [{ total: 900 }] };
  assert.equal((await verifyBackupIntegrity(modified)).valid, false);
});

test("acepta respaldos antiguos como legado", async () => {
  assert.deepEqual(await verifyBackupIntegrity({ sistema: "ALBATROS" }), { valid: true, legacy: true });
});
