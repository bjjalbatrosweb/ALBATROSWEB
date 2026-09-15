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
  assert.match(page, /value=\{TRIAL_CLASS_SITE\}[\s\S]*?readOnly/);
  assert.doesNotMatch(page, /<select id="trial-site"/);
  assert.match(route, /sede: TRIAL_CLASS_SITE/);
  assert.doesNotMatch(route, /safeChoice\(body\.sede/);
});

test("reservas integra agenda, asistencia y calendario sin lecturas directas del navegador", async () => {
  const [page, route, calendarExport] = await Promise.all([
    source("../src/app/(app)/reservas/page.tsx"),
    source("../src/app/api/reservas/route.ts"),
    source("../src/lib/calendar-export.ts"),
  ]);
  assert.match(page, /apiRequest<ReservationsResponse>\("\/api\/reservas"/);
  assert.match(page, /reservationCalendarFile/);
  assert.doesNotMatch(page, /collection\([^\n]*"ReservasClases"/);
  assert.match(route, /adminDb\.getAll\(\.\.\.references\)/);
  assert.match(route, /\.collection\("Asistencias"\)/);
  assert.match(route, /ultimos30Dias/);
  assert.match(route, /limit\(300\)/);
  assert.match(route, /La clase ya comenzó y la reserva ya no puede cancelarse/);
  assert.match(route, /Math\.max\(0, Number\(classData\.reservados\) \|\| 0\) - 1/);
  assert.match(calendarExport, /BEGIN:VCALENDAR/);
});

test("acceso de atletas permite reemplazar UID y eliminar solicitudes obsoletas", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/admin/accesos-atletas/page.tsx"),
    source("../src/app/api/admin/accesos-atletas/route.ts"),
  ]);
  assert.match(page, /for \(const perfilAnterior of otrosPerfiles\)/);
  assert.match(page, /alumnoId: deleteField\(\)/);
  assert.match(page, /reemplazadoPorUid: uidLimpio/);
  assert.match(page, /apiRequest<[\s\S]*?>\("\/api\/admin\/accesos-atletas"/);
  assert.match(page, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(
    page,
    /batch\.delete\(doc\(firestore, "SolicitudesAcceso", solicitud\.uid\)\)/,
  );
  assert.match(page, /Solicitud eliminada/);
  assert.doesNotMatch(page, /Este alumno ya tiene otra cuenta asociada\. Desactiva o corrige/);
  assert.match(route, /requireAdminActorAccess\(request\)/);
  assert.match(route, /requestData\.estado !== "pendiente"/);
  assert.match(route, /if \(userSnapshot\.exists\)/);
  assert.match(route, /adminAuth\.deleteUser\(uid\)/);
  assert.match(route, /if \(!isMissingAuthUser\(error\)\) throw error/);
  assert.match(route, /batch\.delete\(requestRef\)/);
  assert.match(route, /batch\.delete\(profileRef\)/);
});

test("administración crea cuentas vinculadas sin guardar contraseñas", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/admin/accesos-atletas/page.tsx"),
    source("../src/app/api/admin/accesos-atletas/route.ts"),
  ]);
  assert.match(page, />\s*Crear cuenta\s*</);
  assert.match(page, /method: "POST"/);
  assert.match(route, /requireAdminActorAccess\(request\)/);
  assert.match(route, /adminAuth\.createUser\(\{/);
  assert.match(route, /alumnoId,/);
  assert.match(route, /rol: "atleta"/);
  assert.match(route, /batch\.set\(adminDb\.collection\("perfiles"\)/);
  assert.doesNotMatch(route, /batch\.set\([\s\S]{0,300}password/);
  assert.match(route, /ADMIN_ATHLETE_ACCOUNT_ROLLBACK_ERROR/);
});

test("administración gestiona la misma foto compacta que Mi Academia", async () => {
  const [page, route, athletePhoto] = await Promise.all([
    source("../src/app/admin/accesos-atletas/page.tsx"),
    source("../src/app/api/admin/accesos-atletas/foto/route.ts"),
    source("../src/lib/athlete-photo.ts"),
  ]);
  assert.match(page, /prepareAthletePhoto\(file\)/);
  assert.match(page, /\/api\/admin\/accesos-atletas\/foto/);
  assert.match(route, /requireAdminActorAccess\(request\)/);
  assert.match(route, /MAX_PHOTO_BYTES = 180 \* 1024/);
  assert.match(route, /collection\("FotosAtletas"\)\.doc\(alumnoId\)/);
  assert.match(route, /usuarioId: linkedAthlete\?\.id \|\| ""/);
  assert.match(athletePhoto, /ATHLETE_PHOTO_MAX_STORED_BYTES = 180 \* 1024/);
});

test("el expediente central reúne actividad y protege el acceso administrativo", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/admin/accesos-atletas/page.tsx"),
    source("../src/app/api/admin/accesos-atletas/route.ts"),
  ]);
  assert.match(page, />\s*Expediente\s*</);
  assert.match(page, /Expediente central/);
  assert.match(page, /sendPasswordResetEmail\(auth, email\)/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /requireAdminActorAccess\(request\)/);
  assert.match(route, /collection\("Pagos"\)\.where\("alumnoId"/);
  assert.match(route, /collection\("Asistencias"\)\.where\("alumnoId"/);
  assert.match(route, /historialFisico/);
  assert.match(route, /adminAuth\.getUser\(accessProfile\.id\)/);
  assert.doesNotMatch(route, /passwordHash|passwordSalt/);
});

test("el centro del atleta reúne notificaciones sin abrir nuevas escrituras", async () => {
  const [page, route, sidebar, layout] = await Promise.all([
    source("../src/app/(app)/notificaciones/page.tsx"),
    source("../src/app/api/notificaciones/route.ts"),
    source("../src/components/layout/sidebar.tsx"),
    source("../src/app/(app)/layout.tsx"),
  ]);
  assert.match(route, /requireActiveActorAccess\(request\)/);
  assert.match(route, /actor\.profile\.rol !== "atleta"/);
  assert.match(route, /collection\("Anuncios"\)/);
  assert.match(route, /collection\("ReservasClases"\)/);
  assert.match(route, /collection\("SalasJuego"\)/);
  assert.match(route, /estadoPago/);
  assert.doesNotMatch(route, /\.set\(|\.update\(|\.delete\(/);
  assert.match(page, /albatrosNotificacionesLeidas/);
  assert.match(page, /Marcar todas como leídas/);
  assert.match(sidebar, /href: "\/notificaciones"/);
  assert.match(layout, /href="\/notificaciones"/);
});

test("el perfil usa el expediente vinculado y confirma únicamente escrituras reales", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/(app)/perfil/page.tsx"),
    source("../src/app/api/perfil/route.ts"),
  ]);
  assert.match(route, /requireActiveActorAccess\(request\)/);
  assert.match(route, /actor\.profile\.rol !== "atleta"/);
  assert.match(route, /collection\("Alumnos"\)\.doc\(athleteId\)/);
  assert.match(route, /collection\("FotosAtletas"\)\.doc\(athleteId\)/);
  assert.match(route, /parseAthletePersonalProfile\(body\)/);
  assert.match(route, /collection\("perfiles"\)\.doc\(actor\.uid\)\.set/);
  assert.match(page, /await apiRequest<ProfileResponse>/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /await sendPasswordResetEmail\(auth, email\)/);
  assert.match(page, /No sustituyen ni modifican tu evaluación oficial/);
  assert.doesNotMatch(page, /setDocumentNonBlocking/);
});

test("la bitácora espera al servidor y conserva las colecciones existentes", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/(app)/bitacora/page.tsx"),
    source("../src/app/api/bitacora/route.ts"),
  ]);
  assert.match(route, /requireActiveActorAccess\(request\)/);
  assert.match(route, /actor\.profile\.rol !== "atleta"/);
  assert.match(route, /collection\("mealLogs"\)/);
  assert.match(route, /collection\("trainingSessions"\)/);
  assert.match(route, /parseAthleteLog\(body\)/);
  assert.match(route, /export async function DELETE/);
  assert.match(page, /await apiRequest<LogResponse>/);
  assert.match(page, /method: target \? "PATCH" : "POST"/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /window\.confirm/);
  assert.doesNotMatch(page, /addDocumentNonBlocking|deleteDocumentNonBlocking/);
});

test("la bitácora corrige registros propios sin moverlos ni alterar su fecha", async () => {
  const [page, route] = await Promise.all([
    source("../src/app/(app)/bitacora/page.tsx"),
    source("../src/app/api/bitacora/route.ts"),
  ]);
  assert.match(page, /method: target \? "PATCH" : "POST"/);
  assert.match(page, /openEditDialog/);
  assert.match(page, /Guardar corrección/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /input\.type !== type/);
  assert.match(route, /collection\(collectionName\)\s*\.doc\(id\)/);
  assert.match(route, /await reference\.update\(\{/);
  assert.match(route, /updatedAt: FieldValue\.serverTimestamp\(\)/);
  const patchBlock = route.slice(route.indexOf("export async function PATCH"), route.indexOf("export async function DELETE"));
  assert.doesNotMatch(patchBlock, /logDate,\s*updatedAt/);
  assert.doesNotMatch(patchBlock, /userId:|alumnoId:/);
});

test("nutrición no inventa un perfil y guarda metas confirmadas", async () => {
  const [provider, laboratory, profileRoute, chef, performance] = await Promise.all([
    source("../src/context/DailyDataProvider.tsx"),
    source("../src/app/(app)/laboratorio/page.tsx"),
    source("../src/app/api/perfil/route.ts"),
    source("../src/app/(app)/chef-ia/page.tsx"),
    source("../src/components/dashboard/performance-dashboard.tsx"),
  ]);
  assert.match(provider, /weight: 0/);
  assert.match(provider, /height: 0/);
  assert.match(provider, /calories: 0/);
  assert.match(provider, /await apiRequest<[\s\S]*?>\("\/api\/perfil"/);
  assert.doesNotMatch(provider, /setDocumentNonBlocking/);
  assert.match(laboratory, /nutritionBiometricsError\(biometrics\)/);
  assert.match(laboratory, /await saveData/);
  assert.match(laboratory, /"\/api\/bitacora"/);
  assert.match(profileRoute, /parseNutritionTargets\(body\.dailyTargets\)/);
  assert.match(chef, /Así evitamos generar un plan usando valores inventados/);
  assert.match(chef, /await addDoc\(collection\(firestore/);
  assert.doesNotMatch(chef, /addDocumentNonBlocking/);
  assert.match(performance, /no mostramos objetivos genéricos/);
});

test("alimentos usa gramos y guarda una comida real en la bitácora", async () => {
  const page = await source("../src/app/(app)/alimentos/page.tsx");
  assert.match(page, /foodSelectionTotals\(selectedFoods\)/);
  assert.match(page, /normalizeFoodGrams\(value\)/);
  assert.match(page, /caloriesPer100g/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /"\/api\/bitacora"/);
  assert.match(page, /Guardar en mi bitácora/);
  assert.match(page, /No incluye macronutrientes|no incluye macronutrientes/i);
  assert.doesNotMatch(page, /sum \+ food\.calorias/);
});

test("el bienestar diario usa una API validada y conserva el historial anterior", async () => {
  const [center, route, validator] = await Promise.all([
    source("../src/components/athlete/athlete-command-center.tsx"),
    source("../src/app/api/bienestar/route.ts"),
    source("../src/lib/athlete-wellness.ts"),
  ]);
  assert.match(center, /apiRequest<WellnessResponse>\("\/api\/bienestar"/);
  assert.match(center, /method:"PUT"/);
  assert.match(center, /aguaLitros/);
  assert.doesNotMatch(center, /setDoc\(doc\(db,"BienestarAtletas"/);
  assert.match(route, /requireActiveActorAccess\(request\)/);
  assert.match(route, /actor\.profile\.rol !== "atleta"/);
  assert.match(route, /parseWellnessCheckin\(body, today\)/);
  assert.match(route, /doc\(`\$\{actor\.uid\}_\$\{today\}`\)/);
  assert.match(route, /usuarioId: actor\.uid/);
  assert.match(validator, /WELLNESS_TIME_ZONE = "America\/Mexico_City"/);
  assert.match(validator, /Las notas no pueden superar 300 caracteres/);
});

test("la mejora integral conecta calendario, meta semanal y progreso protegido", async () => {
  const [calendar, calendarPage, goalCard, goalRoute, progress] = await Promise.all([
    source("../src/components/calendar/calendar-viewer.tsx"),
    source("../src/app/(app)/calendario/page.tsx"),
    source("../src/components/athlete/weekly-goal-card.tsx"),
    source("../src/app/api/meta-semanal/route.ts"),
    source("../src/components/progress/athlete-progress-page.tsx"),
  ]);
  assert.doesNotMatch(calendar, /calendario-agosto-2026\.webp/);
  assert.match(calendar, /allowedSites/);
  assert.match(calendarPage, /href="\/reservas"/);
  assert.match(goalCard, /apiRequest<GoalResponse>\("\/api\/meta-semanal"/);
  assert.match(goalCard, /role="progressbar"/);
  assert.match(goalRoute, /requireActiveActorAccess\(request\)/);
  assert.match(goalRoute, /weeklyAttendanceProgress/);
  assert.match(progress, /apiRequest<WellnessResponse>\("\/api\/bienestar\?limit=45"/);
  assert.doesNotMatch(progress, /collection\([^\n]*"BienestarAtletas"/);
});

test("la navegación protegida ofrece recuperación, salto de contenido y mejor uso móvil", async () => {
  const [layout, errorPage, loadingPage, mobileNavigation] = await Promise.all([
    source("../src/app/(app)/layout.tsx"),
    source("../src/app/(app)/error.tsx"),
    source("../src/app/(app)/loading.tsx"),
    source("../src/components/athlete/athlete-mobile-nav.tsx"),
  ]);
  assert.match(layout, /href="#contenido-principal"/);
  assert.match(layout, /id="contenido-principal"/);
  assert.match(errorPage, /onClick=\{reset\}/);
  assert.match(errorPage, /No pudimos abrir esta sección/);
  assert.match(loadingPage, /role="status"/);
  assert.match(mobileNavigation, /pathname\.startsWith/);
  assert.match(mobileNavigation, /env\(safe-area-inset-bottom\)/);
});
