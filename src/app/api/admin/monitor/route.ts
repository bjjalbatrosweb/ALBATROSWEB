import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const CACHE_MS = 4 * 60_000;
const MIN_FORCE_INTERVAL_MS = 30_000;
const DEVICE_PACKET_LIMIT = 12;
const WEB_ERROR_LIMIT = 12;

type CachedResponse = { expiresAt: number; payload: Record<string, unknown> };
type MonitorApiEvent = {
  id: string;
  source: "esp32" | "web";
  level: string;
  code: string;
  message: string;
  count: number;
  occurredAt: number;
  deviceId?: string;
  firmware?: string;
  path?: string;
  digest?: string;
};
const globalMonitorCache = globalThis as typeof globalThis & {
  __albatrosMonitorCache?: Map<Sede, CachedResponse>;
};
const monitorCache =
  globalMonitorCache.__albatrosMonitorCache ??
  (globalMonitorCache.__albatrosMonitorCache = new Map());

function normalizeSite(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const site = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(site) ? site : null;
}

function millis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const timestamp = value as { toMillis?: () => number } | null;
  return timestamp?.toMillis?.() || 0;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizeSite(url.searchParams.get("sede"));
    if (!sede)
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );

    await requirePanelActorAccess(request, sede);

    const force = url.searchParams.get("force") === "1";
    const cached = monitorCache.get(sede);
    const cachedAge = cached
      ? Date.now() - Number(cached.payload.generatedAt || 0)
      : Number.POSITIVE_INFINITY;
    if (
      cached &&
      cached.expiresAt > Date.now() &&
      (!force || cachedAge < MIN_FORCE_INTERVAL_MS)
    ) {
      return NextResponse.json({ ...cached.payload, cached: true });
    }

    const [devicePackets, webErrors, device] = await Promise.all([
      adminDb
        .collection("MonitorDispositivos")
        .doc(sede)
        .collection("registrosMonitor")
        .orderBy("recibidoEn", "desc")
        .limit(DEVICE_PACKET_LIMIT)
        .get(),
      adminDb
        .collection("ErroresWeb")
        .orderBy("creadoEn", "desc")
        .limit(WEB_ERROR_LIMIT)
        .get(),
      adminDb.collection("DispositivosAcceso").doc(sede).get(),
    ]);

    const deviceEvents: MonitorApiEvent[] = devicePackets.docs
      .flatMap((packet) => {
        const data = packet.data();
        const receivedAt = millis(data.recibidoEn) || Number(data.recibidoEnMs) || 0;
        const deviceUptime = Number(data.uptimeMs);
        return Array.isArray(data.eventos)
          ? data.eventos.map((candidate: unknown, index: number) => {
              const event = candidate as Record<string, unknown>;
              const eventUptime = Number(event.uptimeMs);
              const occurredAt =
                receivedAt && Number.isFinite(deviceUptime) && Number.isFinite(eventUptime)
                  ? receivedAt - Math.max(0, deviceUptime - eventUptime)
                  : receivedAt;
              return {
                id: `${packet.id}:${index}`,
                source: "esp32" as const,
                level: String(event.level || "info"),
                code: String(event.code || "DEVICE_EVENT"),
                message: String(event.message || "Evento del dispositivo"),
                count: Number(event.count) || 1,
                occurredAt,
                deviceId: data.deviceId,
                firmware: data.firmware,
              };
            })
          : [];
      });
    const webEvents: MonitorApiEvent[] = webErrors.docs.map((item) => {
          const data = item.data();
          return {
            id: `web:${item.id}`,
            source: "web" as const,
            level: "error",
            code: "WEB_CLIENT_ERROR",
            message: String(data.message || "Error de interfaz").slice(0, 300),
            path: String(data.path || "/").slice(0, 180),
            digest: String(data.digest || "").slice(0, 100),
            count: 1,
            occurredAt: millis(data.creadoEn),
          };
        });
    const events = deviceEvents
      .concat(webEvents)
      .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt))
      .slice(0, 180);

    const deviceData = device.data() || {};
    const payload = {
      ok: true,
      cached: false,
      generatedAt: Date.now(),
      nextRecommendedReadAt: Date.now() + 10 * 60_000,
      events,
      device: device.exists
        ? {
            deviceId: deviceData.deviceId || "",
            firmware: deviceData.firmware || "",
            estadoSistema: deviceData.estadoSistema || "",
            rfidDisponible: deviceData.rfidDisponible !== false,
            ultimoContactoMs:
              millis(deviceData.ultimoContacto) ||
              Number(deviceData.ultimoContactoMs) ||
              0,
          }
        : null,
    };
    monitorCache.set(sede, { expiresAt: Date.now() + CACHE_MS, payload });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    console.error("ADMIN_MONITOR_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo consultar el monitor." },
      { status: 500 },
    );
  }
}
