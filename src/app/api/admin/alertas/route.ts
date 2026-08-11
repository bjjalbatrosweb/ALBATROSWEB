import { Timestamp } from "firebase-admin/firestore";
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
const CACHE_TTL_MS = 2 * 60_000;
const STUDENT_LIMIT = 1_000;
const ATTENDANCE_LIMIT = 3_000;
const SECONDARY_LIMIT = 150;

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

type AlertGroups = {
  purchases: AlertItem[];
  paymentRequests: AlertItem[];
  overdue: AlertItem[];
  rfid: AlertItem[];
  lowAttendance: AlertItem[];
  incomplete: AlertItem[];
  device: AlertItem[];
};

type CachedResponse = {
  alerts: AlertGroups;
  warnings: string[];
  generatedAt: string;
};

type CacheEntry = CachedResponse & { expiresAt: number };
const globalCache = globalThis as typeof globalThis & {
  __albatrosAdminAlertCache?: Map<Sede, CacheEntry>;
};
const alertCache =
  globalCache.__albatrosAdminAlertCache ??
  (globalCache.__albatrosAdminAlertCache = new Map());

type Student = {
  id: string;
  nombre?: unknown;
  telefono?: unknown;
  diaPago?: unknown;
  montoPago?: unknown;
  estadoPago?: unknown;
  periodoUltimoPago?: unknown;
  fechaUltimoPago?: unknown;
  activo?: unknown;
  rfid?: unknown;
  rfids?: unknown;
};

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(sede) ? sede : null;
}

function fecha(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function periodoActual() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function claveDia(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function descripcionError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Error desconocido");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizarSede(url.searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);

    const force = url.searchParams.get("force") === "1";
    const cached = alertCache.get(sede);
    if (!force && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        ok: true,
        cached: true,
        cacheTtlMs: Math.max(0, cached.expiresAt - Date.now()),
        alerts: cached.alerts,
        warnings: cached.warnings,
        generatedAt: cached.generatedAt,
      });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const operations = await Promise.allSettled([
      adminDb
        .collection("Alumnos")
        .where("sede", "==", sede)
        .limit(STUDENT_LIMIT)
        .get(),
      adminDb
        .collection("Asistencias")
        .where("sede", "==", sede)
        .where("fecha", ">=", Timestamp.fromDate(startOfMonth))
        .limit(ATTENDANCE_LIMIT)
        .get(),
      adminDb
        .collection("VinculacionesRFID")
        .where("sede", "==", sede)
        .limit(SECONDARY_LIMIT)
        .get(),
      adminDb
        .collection("SolicitudesCompra")
        .where("sede", "==", sede)
        .limit(SECONDARY_LIMIT)
        .get(),
      adminDb
        .collection("SolicitudesPago")
        .where("sede", "==", sede)
        .limit(SECONDARY_LIMIT)
        .get(),
      adminDb.collection("DispositivosAcceso").doc(sede).get(),
    ] as const);

    const labels = [
      "alumnos",
      "asistencias",
      "vinculaciones RFID",
      "compras",
      "solicitudes de pago",
      "ESP32",
    ];
    const warnings: string[] = [];
    operations.forEach((result, index) => {
      if (result.status === "rejected") {
        warnings.push(`No se pudo actualizar: ${labels[index]}.`);
        console.error(
          `ADMIN_ALERTS_${labels[index].toUpperCase().replace(/\s+/g, "_")}:`,
          descripcionError(result.reason),
        );
      }
    });

    const studentsSnapshot = operations[0].status === "fulfilled" ? operations[0].value : null;
    const attendanceSnapshot = operations[1].status === "fulfilled" ? operations[1].value : null;
    const linkingSnapshot = operations[2].status === "fulfilled" ? operations[2].value : null;
    const purchasesSnapshot = operations[3].status === "fulfilled" ? operations[3].value : null;
    const paymentsSnapshot = operations[4].status === "fulfilled" ? operations[4].value : null;
    const deviceSnapshot = operations[5].status === "fulfilled" ? operations[5].value : null;

    if (studentsSnapshot?.size === STUDENT_LIMIT)
      warnings.push("La lista de alumnos alcanzó el límite de seguridad.");
    if (attendanceSnapshot?.size === ATTENDANCE_LIMIT)
      warnings.push("Las asistencias del mes alcanzaron el límite de seguridad.");

    const students: Student[] =
      studentsSnapshot?.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) ?? [];
    const activeStudents = students.filter((student) => student.activo !== false);
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const attendanceDays = new Map<string, Set<string>>();

    attendanceSnapshot?.docs.forEach((document) => {
      const data = document.data();
      const studentId = String(data.alumnoId || "");
      const attendanceDate = fecha(data.fecha);
      if (!studentId || !attendanceDate) return;
      const days = attendanceDays.get(studentId) ?? new Set<string>();
      days.add(claveDia(attendanceDate));
      attendanceDays.set(studentId, days);
    });

    const period = periodoActual();
    const today = new Date().getDate();
    const minimumAttendance = today <= 7 ? 1 : today <= 15 ? 2 : today <= 23 ? 4 : 6;

    const overdue = studentsSnapshot
      ? activeStudents
          .filter((student) => {
            const lastPaymentDate = fecha(student.fechaUltimoPago);
            const lastPeriod = lastPaymentDate
              ? `${lastPaymentDate.getFullYear()}-${String(lastPaymentDate.getMonth() + 1).padStart(2, "0")}`
              : "";
            const oldPaidRecord =
              student.estadoPago === "Pagado" &&
              !student.periodoUltimoPago &&
              !lastPeriod;
            const paidCurrentMonth =
              student.estadoPago === "Pagado" &&
              (student.periodoUltimoPago === period ||
                lastPeriod === period ||
                oldPaidRecord);
            return !paidCurrentMonth && today > Math.max(1, Number(student.diaPago || 1));
          })
          .map((student) => ({
            id: student.id,
            title: String(student.nombre || "Alumno sin nombre"),
            detail: `Venció el día ${Number(student.diaPago) || 1} · $${Number(student.montoPago || 0).toLocaleString("es-MX")}`,
          }))
      : [];

    const studentsWithoutRfid = studentsSnapshot
      ? activeStudents
          .filter((student) => {
            const rfids = Array.isArray(student.rfids) ? student.rfids : [];
            return !String(student.rfid || "").trim() && rfids.filter(Boolean).length === 0;
          })
          .map((student) => ({
            id: `student-${student.id}`,
            title: String(student.nombre || "Alumno sin nombre"),
            detail: "No tiene tarjeta RFID/NFC vinculada",
          }))
      : [];

    const pendingLinks =
      linkingSnapshot?.docs
        .filter((document) => {
          const status = String(document.data().estado || "").toLowerCase();
          return !["completada", "completado", "vinculada", "vinculado"].includes(status);
        })
        .map((document) => {
          const data = document.data();
          const student = studentsById.get(String(data.alumnoId || ""));
          return {
            id: `link-${document.id}`,
            title: String(student?.nombre || "Vinculación pendiente"),
            detail: `Solicitud ${String(data.estado || "pendiente")}`,
          };
        }) ?? [];

    const lowAttendance = studentsSnapshot && attendanceSnapshot
      ? activeStudents
          .filter((student) => (attendanceDays.get(student.id)?.size || 0) < minimumAttendance)
          .map((student) => {
            const count = attendanceDays.get(student.id)?.size || 0;
            return {
              id: student.id,
              title: String(student.nombre || "Alumno sin nombre"),
              detail: `${count} ${count === 1 ? "día registrado" : "días registrados"} este mes · mínimo sugerido ${minimumAttendance}`,
            };
          })
      : [];

    const incomplete = studentsSnapshot
      ? activeStudents
          .map((student) => {
            const missing = [
              !String(student.nombre || "").trim() ? "nombre" : "",
              !String(student.telefono || "").replace(/\D/g, "") ? "teléfono" : "",
              !Number.isInteger(Number(student.diaPago)) || Number(student.diaPago) < 1 || Number(student.diaPago) > 31
                ? "día de pago"
                : "",
              !Number.isFinite(Number(student.montoPago)) || Number(student.montoPago) <= 0 ? "monto" : "",
            ].filter(Boolean);
            return missing.length
              ? {
                  id: student.id,
                  title: String(student.nombre || "Alumno sin nombre"),
                  detail: `Falta: ${missing.join(", ")}`,
                }
              : null;
          })
          .filter((item): item is AlertItem => item !== null)
      : [];

    const purchases =
      purchasesSnapshot?.docs
        .filter((document) =>
          !["entregada", "cobrada", "cancelada"].includes(
            String(document.data().estado || "pendiente_cobro"),
          ),
        )
        .slice(0, 50)
        .map((document) => {
          const data = document.data();
          const folio = String(data.folio || document.id.slice(-8).toUpperCase());
          return {
            id: document.id,
            title: folio,
            detail: `${String(data.nombre || "Alumno")} · ${String(data.estado || "pendiente_cobro").replace(/_/g, " ")}`,
            href: `/admin/compras?buscar=${encodeURIComponent(folio)}`,
          };
        }) ?? [];

    const paymentRequests =
      paymentsSnapshot?.docs
        .filter((document) => String(document.data().estado || "pendiente") === "pendiente")
        .slice(0, 50)
        .map((document) => {
          const data = document.data();
          const name = String(data.nombre || "Alumno");
          return {
            id: document.id,
            title: name,
            detail: `Periodo ${String(data.periodo || "sin periodo")} · $${Number(data.monto || 0).toLocaleString("es-MX")}`,
            href: `/admin/pagar?buscar=${encodeURIComponent(name)}`,
          };
        }) ?? [];

    const deviceData = deviceSnapshot?.exists ? deviceSnapshot.data() : null;
    const lastDeviceContact = fecha(deviceData?.ultimoContacto) ?? fecha(deviceData?.ultimoContactoMs);
    const deviceAge = lastDeviceContact ? Date.now() - lastDeviceContact.getTime() : Number.POSITIVE_INFINITY;
    const device: AlertItem[] = deviceAge <= 8 * 60_000
      ? []
      : [{
          id: `device-${sede}`,
          title: "ESP32 sin conexión",
          detail: lastDeviceContact
            ? `Última señal: ${lastDeviceContact.toLocaleString("es-MX")}`
            : "No hay señales registradas para esta sede",
          href: "/admin/firmware",
        }];

    const alerts: AlertGroups = {
      purchases,
      paymentRequests,
      overdue,
      rfid: [...studentsWithoutRfid, ...pendingLinks],
      lowAttendance,
      incomplete,
      device,
    };
    const generatedAt = new Date().toISOString();
    alertCache.set(sede, {
      alerts,
      warnings,
      generatedAt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      ok: true,
      cached: false,
      cacheTtlMs: CACHE_TTL_MS,
      alerts,
      warnings,
      generatedAt,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ADMIN_ALERTS_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron preparar las alertas." },
      { status: 500 },
    );
  }
}
