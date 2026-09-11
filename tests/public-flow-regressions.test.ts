import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("el registro crea una solicitud de vinculación y no inventa el sexo", async () => {
  const signup = await source("../src/app/signup/page.tsx");
  assert.match(signup, /SolicitudesAcceso/);
  assert.match(signup, /values\.gender/);
  assert.match(signup, /signOut\(auth\)/);
  assert.doesNotMatch(signup, /gender:\s*["']male["']/);
});

test("la compra pública usa precio e inventario de la sede dentro de una transacción", async () => {
  const route = await source("../src/app/api/compras/route.ts");
  assert.match(route, /storeInventoryId\(sede, productId\)/);
  assert.match(route, /transaction\.get\(entry\.reference\)/);
  assert.match(route, /reservadas: reserved \+ entry\.quantity/);
  assert.match(route, /saved\?\.activo === false/);
  assert.doesNotMatch(route, /const PRODUCTOS =/);
});

test("las clases de prueba públicas pasan por la API y no escriben directo", async () => {
  const [page, kiosk, rules, route] = await Promise.all([
    source("../src/app/clase-prueba/page.tsx"),
    source("../src/app/kiosco/page.tsx"),
    source("../firestore.rules"),
    source("../src/app/api/clase-prueba/route.ts"),
  ]);
  assert.match(page, /fetch\("\/api\/clase-prueba"/);
  assert.match(kiosk, /fetch\("\/api\/clase-prueba"/);
  assert.match(rules, /match \/SolicitudesClasePrueba\/\{solicitudId\}[\s\S]*?allow create: if false;/);
  assert.match(route, /prepareTrialClassRequest/);
  assert.match(route, /checkRateLimitForIdentifier/);
});

test("reservas consulta las inscripciones en bloque y cancela con contador acotado", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/(app)/reservas/page.tsx"),
    source("../src/app/api/reservas/route.ts"),
  ]);
  assert.match(page, /fetch\(`\/api\/reservas\?claseIds=/);
  assert.doesNotMatch(page, /items\.map\(\(item\) =>\s*onSnapshot/);
  assert.match(route, /adminDb\.getAll\(\.\.\.references\)/);
  assert.match(route, /Math\.max\(0, Number\(classData\.reservados\) \|\| 0\) - 1/);
});

test("acceso de atletas permite reemplazar UID y eliminar solicitudes obsoletas", async () => {
  const page = await source("../src/app/admin/accesos-atletas/page.tsx");
  assert.match(page, /for \(const perfilAnterior of otrosPerfiles\)/);
  assert.match(page, /alumnoId: deleteField\(\)/);
  assert.match(page, /reemplazadoPorUid: uidLimpio/);
  assert.match(page, /batch\.delete\(doc\(firestore, "SolicitudesAcceso", solicitud\.uid\)\)/);
  assert.match(page, /Solicitud eliminada/);
  assert.doesNotMatch(page, /Este alumno ya tiene otra cuenta asociada\. Desactiva o corrige/);
});
