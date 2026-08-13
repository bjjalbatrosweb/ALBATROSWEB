import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";

import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requireDeviceAccess } from "@/lib/server-access";

const SEDES = ["MMA", "CAUCEL", "JUAN_PABLO"] as const;
type Sede = (typeof SEDES)[number];
type HeartbeatCacheEntry = { persistedAt: number; signature: string };
type HeartbeatReadCacheEntry = {
  checkedAt: number;
  controlesPuerta: Partial<Record<Sede, boolean>>;
  commandData: FirebaseFirestore.DocumentData;
};
type DeviceSedesCacheEntry = { expiresAt: number; sedes: Sede[] };

const globalHeartbeatCache = globalThis as typeof globalThis & {
  __albatrosHeartbeatCache?: Map<string, HeartbeatCacheEntry>;
};
const heartbeatCache =
  globalHeartbeatCache.__albatrosHeartbeatCache ??
  (globalHeartbeatCache.__albatrosHeartbeatCache = new Map());
const HEARTBEAT_PERSIST_INTERVAL_MS = 60_000;

const globalHeartbeatReadCache = globalThis as typeof globalThis & {
  __albatrosHeartbeatReadCache?: Map<string, HeartbeatReadCacheEntry>;
  __albatrosDeviceSedesCache?: Map<string, DeviceSedesCacheEntry>;
};
const heartbeatReadCache =
  globalHeartbeatReadCache.__albatrosHeartbeatReadCache ??
  (globalHeartbeatReadCache.__albatrosHeartbeatReadCache = new Map());
const deviceSedesCache =
  globalHeartbeatReadCache.__albatrosDeviceSedesCache ??
  (globalHeartbeatReadCache.__albatrosDeviceSedesCache = new Map());
const HEARTBEAT_READ_INTERVAL_MS = 15_000;
// La asociación física cambia rara vez. Mantenerla quince minutos evita que
// un firmware antiguo, que todavía no envía `sede`, lea las tres sedes en cada
// heartbeat. Un despliegue nuevo puede seguir declarando la sede en el body.
const DEVICE_SEDES_CACHE_MS = 15 * 60_000;

function normalizarSede(value: unknown): Sede | null {
  const sede =
    typeof value === "string"
      ? value.trim().toUpperCase().replace(/\s+/g, "_")
      : "";
  return SEDES.includes(sede as Sede) ? (sede as Sede) : null;
}

function textoSeguro(valor: unknown, respaldo: string, maximo = 60) {
  return typeof valor === "string" && valor.trim()
    ? valor.trim().slice(0, maximo)
    : respaldo;
}

export async function POST(request: Request) {
  try {
    const heartbeatReceivedAt = Date.now();
    const body = await request.json().catch(() => ({}));
    const deviceId =
      typeof body.deviceId === "string"
        ? body.deviceId
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "")
            .slice(0, 40)
        : "";

    await requireDeviceAccess(request);

    if (!deviceId || !deviceId.startsWith("ESP32-")) {
      return NextResponse.json(
        {
          ok: false,
          mensaje: "El dispositivo no tiene un identificador válido",
        },
        { status: 400 },
      );
    }

    // Firmware nuevo declara sus sedes. Un firmware anterior conserva la
    // asociación que ya exista para su deviceId; nunca se reasigna por defecto.
    const sedesDeclaradas: Sede[] = [];
    if (Array.isArray(body.sedes)) {
      for (const valor of body.sedes) {
        const sedeNormalizada = normalizarSede(valor);
        if (sedeNormalizada && !sedesDeclaradas.includes(sedeNormalizada)) {
          sedesDeclaradas.push(sedeNormalizada);
        }
      }
    }
    const sedeUnica = normalizarSede(body.sede || body.sedePrincipal);
    let sedesDispositivo: Sede[] = sedesDeclaradas.length
      ? sedesDeclaradas
      : sedeUnica
        ? [sedeUnica]
        : [];

    // Topología física real: MMA y Caucel son una sola controladora; Juan
    // Pablo tiene otra. Rechazamos combinaciones parciales o cruzadas para no
    // sobrescribir telemetría de una puerta con la del otro ESP32.
    if (sedesDispositivo.includes('JUAN_PABLO') && sedesDispositivo.length !== 1) {
      return NextResponse.json(
        { ok: false, mensaje: 'Juan Pablo debe usar un controlador exclusivo' },
        { status: 409 },
      );
    }
    if (
      (sedesDispositivo.includes('MMA') || sedesDispositivo.includes('CAUCEL')) &&
      !(sedesDispositivo.includes('MMA') && sedesDispositivo.includes('CAUCEL'))
    ) {
      return NextResponse.json(
        { ok: false, mensaje: 'El controlador compartido debe declarar MMA y CAUCEL' },
        { status: 409 },
      );
    }

    if (sedesDispositivo.length > 0) {
      deviceSedesCache.set(deviceId, {
        sedes: sedesDispositivo,
        expiresAt: heartbeatReceivedAt + DEVICE_SEDES_CACHE_MS,
      });
    }

    if (sedesDispositivo.length === 0) {
      const cachedSedes = deviceSedesCache.get(deviceId);
      if (cachedSedes && cachedSedes.expiresAt > Date.now()) {
        sedesDispositivo = cachedSedes.sedes;
      } else {
        const existentes = await Promise.all(
          SEDES.map(async (sede) => ({
            sede,
            snapshot: await adminDb
              .collection("DispositivosAcceso")
              .doc(sede)
              .get(),
          })),
        );
        sedesDispositivo = existentes
          .filter(
            ({ snapshot }) =>
              snapshot.exists && snapshot.data()?.deviceId === deviceId,
          )
          .map(({ sede }) => sede);
        if (sedesDispositivo.length > 0)
          deviceSedesCache.set(deviceId, {
            sedes: sedesDispositivo,
            expiresAt: Date.now() + DEVICE_SEDES_CACHE_MS,
          });
      }
    }

    if (
      sedesDispositivo.includes('JUAN_PABLO') && sedesDispositivo.length !== 1 ||
      ((sedesDispositivo.includes('MMA') || sedesDispositivo.includes('CAUCEL')) &&
        !(sedesDispositivo.includes('MMA') && sedesDispositivo.includes('CAUCEL')))
    ) {
      return NextResponse.json(
        { ok: false, mensaje: 'La asociación de sedes no coincide con la topología física' },
        { status: 409 },
      );
    }

    const grupoDeclarado = (request.headers.get('x-device-group') || '').toUpperCase();
    const grupoEsperado = sedesDispositivo.includes('JUAN_PABLO')
      ? 'JUAN_PABLO'
      : 'MMA_CAUCEL';
    if (grupoDeclarado && grupoDeclarado !== grupoEsperado) {
      return NextResponse.json(
        { ok: false, mensaje: 'La identidad del controlador no coincide con sus sedes' },
        { status: 403 },
      );
    }

    if (sedesDispositivo.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          mensaje: "Este dispositivo todavía no tiene una sede asociada",
        },
        { status: 409 },
      );
    }

    const commandRef = adminDb.collection("ComandosDispositivo").doc(deviceId);
    const readCacheKey = `${deviceId}:${[...sedesDispositivo].sort().join(",")}`;
    const cachedReads = heartbeatReadCache.get(readCacheKey);
    let controlesPuerta: Partial<Record<Sede, boolean>>;
    let commandData: FirebaseFirestore.DocumentData;

    if (
      cachedReads &&
      Date.now() - cachedReads.checkedAt < HEARTBEAT_READ_INTERVAL_MS
    ) {
      controlesPuerta = cachedReads.controlesPuerta;
      commandData = cachedReads.commandData;
    } else {
      const [controlEntries, commandSnapshot] = await Promise.all([
        Promise.all(
          sedesDispositivo.map(async (sede) => {
            const snapshot = await adminDb
              .collection("ControlesAcceso")
              .doc(sede)
              .get();
            return [
              sede,
              snapshot.exists && snapshot.data()?.puertaLiberada === true,
            ] as const;
          }),
        ),
        commandRef.get(),
      ]);
      controlesPuerta = Object.fromEntries(controlEntries) as Partial<
        Record<Sede, boolean>
      >;
      commandData = commandSnapshot.data() || {};
      heartbeatReadCache.set(readCacheKey, {
        checkedAt: Date.now(),
        controlesPuerta,
        commandData,
      });
    }
    const puertaLiberada = sedesDispositivo.some(
      (sede) => controlesPuerta[sede] === true,
    );

    const telemetry = {
      deviceId,
      dispositivo: textoSeguro(body.dispositivo, "ESP32 acceso"),
      firmware: textoSeguro(body.firmware, "Sin identificar", 30),
      puertaCerrada: body.puertaCerrada === true,
      puertaBloqueada: body.puertaBloqueada === true,
      alarmaActiva: body.alarmaActiva === true,
      rssi: Number.isFinite(Number(body.rssi)) ? Number(body.rssi) : null,
      ip: textoSeguro(body.ip, "Sin IP", 45),
      estadoSistema: textoSeguro(body.estadoSistema, "OPERATIVO", 30),
      bootId: textoSeguro(body.bootId, "Sin identificar", 50),
      uptimeMs: Number.isFinite(Number(body.uptimeMs))
        ? Math.max(0, Number(body.uptimeMs))
        : null,
      heapLibre: Number.isFinite(Number(body.heapLibre))
        ? Math.max(0, Number(body.heapLibre))
        : null,
      otaRemota: body.otaRemota === true,
      puertaLiberadaSolicitada: puertaLiberada,
      // Campo numérico de respaldo para clientes que reciban una fecha
      // serializada en lugar de un Timestamp de Firestore.
      ultimoContactoMs: heartbeatReceivedAt,
      presenciaVersion: 2,
      ultimoContacto: FieldValue.serverTimestamp(),
    };

    const telemetrySignature = JSON.stringify({
      firmware: telemetry.firmware,
      puertaCerrada: telemetry.puertaCerrada,
      puertaBloqueada: telemetry.puertaBloqueada,
      alarmaActiva: telemetry.alarmaActiva,
      estadoSistema: telemetry.estadoSistema,
      bootId: telemetry.bootId,
      otaRemota: telemetry.otaRemota,
      puertaLiberadaSolicitada: telemetry.puertaLiberadaSolicitada,
    });

    const lastCommandId = textoSeguro(body.ultimoComandoId, "", 80);
    const commandId = String(commandData.commandId || "");
    const expiresAt = commandData.expiraEn?.toMillis?.() || 0;
    let command:
      | { id: string; tipo: "REINICIAR" }
      | {
          id: string;
          tipo: "ACTUALIZAR_FIRMWARE";
          version: string;
          sha256: string;
          tamano: number;
          url: string;
        }
      | null = null;

    if (
      commandId &&
      lastCommandId === commandId &&
      commandData.estado !== "confirmado" &&
      commandData.estado !== "error_version"
    ) {
      const registroId = String(commandData.firmwareRegistroId || "");
      const esFirmware = commandData.tipo === "ACTUALIZAR_FIRMWARE";
      const versionObjetivo = esFirmware
        ? textoSeguro(commandData.firmware?.version, "", 40)
        : "";
      const versionCoincide =
        !esFirmware ||
        (Boolean(versionObjetivo) && telemetry.firmware === versionObjetivo);
      const estadoFinal = versionCoincide ? "confirmado" : "error_version";

      await commandRef.set(
        {
          estado: estadoFinal,
          confirmadoEn: FieldValue.serverTimestamp(),
          ...(esFirmware ? { firmwareReportado: telemetry.firmware } : {}),
        },
        { merge: true },
      );
      heartbeatReadCache.delete(readCacheKey);

      if (registroId && esFirmware) {
        await adminDb.collection("ActualizacionesFirmware").doc(registroId).set(
          {
            estado: estadoFinal,
            confirmadoEn: FieldValue.serverTimestamp(),
            firmwareReportado: telemetry.firmware,
            bootIdReportado: telemetry.bootId,
          },
          { merge: true },
        );
      }
    } else if (
      commandData.estado === "pendiente" &&
      commandData.tipo === "REINICIAR" &&
      expiresAt > Date.now()
    ) {
      command = { id: commandId, tipo: "REINICIAR" };
    } else if (
      commandData.estado === "pendiente" &&
      commandData.tipo === "ACTUALIZAR_FIRMWARE" &&
      expiresAt > Date.now()
    ) {
      const firmware = commandData.firmware || {};
      const pathname =
        typeof firmware.pathname === "string" ? firmware.pathname : "";
      const version = textoSeguro(firmware.version, "", 40);
      const sha256 =
        typeof firmware.sha256 === "string"
          ? firmware.sha256.toLowerCase()
          : "";
      const tamano = Number(firmware.tamano);

      if (
        pathname.startsWith("firmware/") &&
        version &&
        /^[a-f0-9]{64}$/.test(sha256) &&
        Number.isInteger(tamano) &&
        tamano > 0 &&
        tamano <= 1_300_000
      ) {
        // La URL firmada dura poco y solo permite leer este blob privado.
        const validUntil = Date.now() + 5 * 60_000;
        const signedToken = await issueSignedToken({
          pathname,
          operations: ["get"],
          validUntil,
        });
        const { presignedUrl } = await presignUrl(signedToken, {
          operation: "get",
          pathname,
          access: "private",
          validUntil,
          useCache: false,
        });

        command = {
          id: commandId,
          tipo: "ACTUALIZAR_FIRMWARE",
          version,
          sha256,
          tamano,
          url: presignedUrl,
        };

        await commandRef.set(
          {
            ultimoEntregadoEn: FieldValue.serverTimestamp(),
            entregas: FieldValue.increment(1),
          },
          { merge: true },
        );
      }
    }

    const now = Date.now();
    const sedesAPersistir = sedesDispositivo.filter((sede) => {
      const previous = heartbeatCache.get(`${deviceId}:${sede}`);
      return (
        !previous ||
        previous.signature !== telemetrySignature ||
        now - previous.persistedAt >= HEARTBEAT_PERSIST_INTERVAL_MS
      );
    });

    const batch = adminDb.batch();
    sedesAPersistir.forEach((sede) => {
      batch.set(
        adminDb.collection("DispositivosAcceso").doc(sede),
        { ...telemetry, sede },
        { merge: true },
      );
    });
    if (sedesAPersistir.length > 0) {
      await batch.commit();
      sedesAPersistir.forEach((sede) => {
        heartbeatCache.set(`${deviceId}:${sede}`, {
          persistedAt: now,
          signature: telemetrySignature,
        });
      });
    }

    return NextResponse.json({
      ok: true,
      deviceId,
      sedes: sedesDispositivo,
      persistido: sedesAPersistir.length > 0,
      servidorAhoraMs: Date.now(),
      puertaLiberada,
      controlesPuerta,
      comando: command,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error("DEVICE_HEARTBEAT_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar el estado del dispositivo" },
      { status: 500 },
    );
  }
}
