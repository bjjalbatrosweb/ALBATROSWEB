import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDevice, deviceConnectionState, occupancyLevel, wifiQuality } from "../src/lib/operational-intelligence.ts";

test("clasifica la conexión con la tolerancia real del heartbeat", () => {
  const now = 1_000_000;
  assert.equal(deviceConnectionState(now - 4 * 60_000, now), "online");
  assert.equal(deviceConnectionState(now - 6 * 60_000, now), "delayed");
  assert.equal(deviceConnectionState(now - 9 * 60_000, now), "offline");
});

test("detecta señales críticas sin inventar lecturas RFID", () => {
  const signals = analyzeDevice({ lastContactMs: 1, readerAvailable: false, alarmActive: true, rssi: -90 }, 10 * 60_000);
  assert.ok(signals.some((signal) => signal.id === "reader" && signal.severity === "critical"));
  assert.ok(signals.some((signal) => signal.id === "alarm" && signal.severity === "critical"));
  assert.equal(wifiQuality(-90), "critical");
});

test("calcula ocupación y limita el porcentaje visual", () => {
  assert.deepEqual(occupancyLevel(17, 20), { percent: 85, level: "high" });
  assert.deepEqual(occupancyLevel(30, 20), { percent: 100, level: "full" });
});
