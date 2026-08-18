import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el Monitor está disponible en Sistema y consulta por intervalos", async () => {
  const [navigation, layout, page] = await Promise.all([
    readFile(new URL("../src/lib/admin-navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/monitor/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(navigation, /href: "\/admin\/monitor"/);
  assert.match(layout, /href: "\/admin\/monitor"/);
  assert.match(page, /setInterval[\s\S]*minutes \* 60_000/);
  assert.doesNotMatch(page, /onSnapshot/);
  assert.match(page, /\[5, 10\]/);
});

test("el heartbeat guarda bloques limitados y nunca telemetría arbitraria", async () => {
  const route = await readFile(
    new URL("../src/app/api/dispositivo/heartbeat/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /sanitizeDeviceMonitorEvents\(body\.monitor\)/);
  assert.match(route, /MONITOR_PERSIST_INTERVAL_MS = 5 \* 60_000/);
  assert.match(route, /collection\("MonitorDispositivos"\)/);
  assert.match(route, /expiresAt/);
  assert.doesNotMatch(route, /eventos: body\.monitor/);
});

test("el firmware agrupa diez minutos y conserva eventos hasta confirmación", async () => {
  const firmware = await readFile(
    new URL(
      "../firmware/Albatros_MMA_Caucel_v3_1_monitor/Albatros_MMA_Caucel_v3_1_monitor.ino",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(firmware, /INTERVALO_ENVIO_MONITOR = 600000/);
  assert.match(firmware, /MAX_EVENTOS_MONITOR = 10/);
  assert.match(
    firmware,
    /respuestaDoc\["monitorPersistido"\] == true[\s\S]*limpiarEventosMonitor\(\)/,
  );
  assert.doesNotMatch(firmware, /evento\["uid"\]|evento\["alumno"\]/);
});
