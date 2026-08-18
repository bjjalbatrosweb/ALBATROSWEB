import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeDeviceMonitorEvents } from "../src/lib/device-monitor.ts";

test("el monitor valida, limita y normaliza eventos del dispositivo", () => {
  const events = sanitizeDeviceMonitorEvents([
    { level: "ERROR", code: "wifi-fail", message: "no válido" },
    { level: "warning", code: "WIFI_FAIL", message: "  WiFi sin conexión\n", count: 2.8, uptimeMs: 30 },
    { level: "recovery", code: "WIFI_RECOVERED", message: "Conexión recuperada", count: 5000 },
  ]);
  assert.deepEqual(events, [
    { level: "warning", code: "WIFI_FAIL", message: "WiFi sin conexión", count: 2, uptimeMs: 30 },
    { level: "recovery", code: "WIFI_RECOVERED", message: "Conexión recuperada", count: 999, uptimeMs: null },
  ]);
});

test("el monitor nunca acepta más de doce eventos por heartbeat", () => {
  const input = Array.from({ length: 20 }, (_, index) => ({
    level: "info",
    code: `EVENT_${index}`,
    message: "Evento seguro",
  }));
  assert.equal(sanitizeDeviceMonitorEvents(input).length, 12);
});
