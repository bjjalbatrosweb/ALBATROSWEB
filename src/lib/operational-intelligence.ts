export type DeviceTelemetry = {
  lastContactMs?: number;
  rssi?: number | null;
  freeHeap?: number | null;
  brownouts?: number | null;
  readerAvailable?: boolean | null;
  doorClosed?: boolean | null;
  alarmActive?: boolean | null;
  uptimeSeconds?: number | null;
  firmware?: string | null;
  bootId?: string | null;
};

export type OperationalSeverity = "ok" | "info" | "warning" | "critical";

export type OperationalSignal = {
  id: string;
  severity: OperationalSeverity;
  title: string;
  detail: string;
};

export function deviceConnectionState(lastContactMs: number | undefined, now = Date.now()) {
  if (!lastContactMs) return "unknown" as const;
  const age = Math.max(0, now - lastContactMs);
  if (age <= 5 * 60_000) return "online" as const;
  if (age <= 8 * 60_000) return "delayed" as const;
  return "offline" as const;
}

export function wifiQuality(rssi: number | null | undefined) {
  if (typeof rssi !== "number") return "unknown" as const;
  if (rssi >= -60) return "excellent" as const;
  if (rssi >= -70) return "good" as const;
  if (rssi >= -80) return "weak" as const;
  return "critical" as const;
}

export function analyzeDevice(telemetry: DeviceTelemetry, now = Date.now()): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  const connection = deviceConnectionState(telemetry.lastContactMs, now);
  if (connection === "unknown") signals.push({ id: "no-contact", severity: "warning", title: "Sin telemetría", detail: "El dispositivo aún no ha enviado una señal verificable." });
  if (connection === "delayed") signals.push({ id: "delayed", severity: "warning", title: "Señal atrasada", detail: "El último heartbeat supera cinco minutos." });
  if (connection === "offline") signals.push({ id: "offline", severity: "critical", title: "ESP32 sin conexión", detail: "No se recibe telemetría desde hace más de ocho minutos." });
  if (telemetry.readerAvailable === false) signals.push({ id: "reader", severity: "critical", title: "Lector RFID no disponible", detail: "El ESP32 reportó que el lector no está listo." });
  if (telemetry.alarmActive === true) signals.push({ id: "alarm", severity: "critical", title: "Alarma activa", detail: "Revisa físicamente el acceso y la puerta." });
  const wifi = wifiQuality(telemetry.rssi);
  if (wifi === "weak") signals.push({ id: "wifi-weak", severity: "warning", title: "WiFi débil", detail: `Señal de ${telemetry.rssi} dBm; puede retrasar lecturas.` });
  if (wifi === "critical") signals.push({ id: "wifi-critical", severity: "critical", title: "WiFi crítico", detail: `Señal de ${telemetry.rssi} dBm; riesgo alto de desconexión.` });
  if (typeof telemetry.freeHeap === "number" && telemetry.freeHeap < 35_000) signals.push({ id: "heap", severity: "warning", title: "Memoria baja", detail: `El ESP32 reporta ${Math.round(telemetry.freeHeap / 1024)} KB libres.` });
  if (typeof telemetry.brownouts === "number" && telemetry.brownouts > 0) signals.push({ id: "brownout", severity: "warning", title: "Reinicios eléctricos detectados", detail: `${telemetry.brownouts} evento(s) de alimentación registrados.` });
  if (signals.length === 0) signals.push({ id: "healthy", severity: "ok", title: "Sistema estable", detail: "Conexión, lector y telemetría sin anomalías detectadas." });
  return signals;
}

export function occupancyLevel(current: number, capacity: number) {
  if (capacity <= 0) return { percent: 0, level: "unknown" as const };
  const percent = Math.min(100, Math.max(0, Math.round((current / capacity) * 100)));
  if (percent >= 100) return { percent, level: "full" as const };
  if (percent >= 85) return { percent, level: "high" as const };
  return { percent, level: "normal" as const };
}
