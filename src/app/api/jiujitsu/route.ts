import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import {
  hashTokenJiujitsu,
  serializarCombateJiujitsu,
} from "@/lib/jiujitsu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES = ["MMA", "CAUCEL", "JUAN_PABLO"] as const;
type Sede = (typeof SEDES)[number];

function sedeValida(value: unknown): Sede | null {
  const sede = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return SEDES.includes(sede as Sede) ? (sede as Sede) : null;
}

export async function GET(request: Request) {
  try {
    const sede = sedeValida(new URL(request.url).searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "Sede inválida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);
    const [alumnosSnap, combatesSnap] = await Promise.all([
      adminDb.collection("Alumnos").where("sede", "==", sede).get(),
      adminDb
        .collection("CombatesJiujitsu")
        .where("sede", "==", sede)
        .limit(100)
        .get(),
    ]);

    const alumnos = alumnosSnap.docs
      .map((documento) => {
        const data = documento.data();
        return {
          id: documento.id,
          nombre: String(data.nombre || "Alumno"),
          fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
          disciplina: String(data.disciplina || ""),
          grado: String(data.grado || ""),
          activo: data.activo !== false,
        };
      })
      .filter((atleta) => atleta.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    const combates = combatesSnap.docs
      .map((documento) =>
        serializarCombateJiujitsu(documento.data(), documento.id),
      )
      .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));

    return NextResponse.json({ ok: true, alumnos, combates });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_LISTAR_JIUJITSU:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo cargar Jiu-Jitsu Live." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sede = sedeValida(body.sede);
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "Sede inválida." },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    const rojoId = String(body.rojoId || "");
    const azulId = String(body.azulId || "");
    const rojoInvitado = String(body.rojoInvitado || "").trim().slice(0, 60);
    const azulInvitado = String(body.azulInvitado || "").trim().slice(0, 60);
    if (
      (!rojoId && !rojoInvitado) ||
      (!azulId && !azulInvitado) ||
      (rojoId && azulId && rojoId === azulId) ||
      (!rojoId &&
        !azulId &&
        rojoInvitado.toLowerCase() === azulInvitado.toLowerCase())
    ) {
      return NextResponse.json(
        { ok: false, mensaje: "Selecciona dos competidores distintos." },
        { status: 400 },
      );
    }

    const [rojoSnap, azulSnap] = await Promise.all([
      rojoId ? adminDb.collection("Alumnos").doc(rojoId).get() : null,
      azulId ? adminDb.collection("Alumnos").doc(azulId).get() : null,
    ]);
    if (
      (rojoSnap && (!rojoSnap.exists || rojoSnap.data()?.sede !== sede)) ||
      (azulSnap && (!azulSnap.exists || azulSnap.data()?.sede !== sede))
    ) {
      return NextResponse.json(
        { ok: false, mensaje: "Algún competidor ya no está disponible." },
        { status: 404 },
      );
    }

    const atleta = (snap: FirebaseFirestore.DocumentSnapshot) => ({
      id: snap.id,
      nombre: String(snap.data()?.nombre || "Atleta"),
      fotoUrl: String(snap.data()?.fotoUrl || snap.data()?.imagenUrl || ""),
    });
    const invitado = (nombre: string) => ({
      id: `invitado:${nombre.toLowerCase().replace(/\s+/g, "-")}`,
      nombre,
      fotoUrl: "",
      invitado: true,
    });

    const minutos = Math.max(1, Math.min(10, Number(body.minutos) || 5));
    const pin = String(body.pin || "").trim();
    if (pin && !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, mensaje: "El PIN debe tener entre 4 y 6 números." },
        { status: 400 },
      );
    }

    const secreto = randomBytes(24).toString("base64url");
    const ref = adminDb.collection("CombatesJiujitsu").doc();
    const controlRef = ref.collection("Controles").doc();
    const batch = adminDb.batch();
    batch.create(ref, {
      rojo: rojoSnap ? atleta(rojoSnap) : invitado(rojoInvitado),
      azul: azulSnap ? atleta(azulSnap) : invitado(azulInvitado),
      puntosRojo: 0,
      puntosAzul: 0,
      ventajasRojo: 0,
      ventajasAzul: 0,
      penalizacionesRojo: 0,
      penalizacionesAzul: 0,
      fase: "preparacion",
      duracionMs: minutos * 60000,
      restanteMs: minutos * 60000,
      corriendo: false,
      iniciadoEn: null,
      controlesActivos: 1,
      ganador: "",
      resultadoTipo: "",
      categoria: String(body.categoria || "Adulto").trim().slice(0, 50),
      cinturon: String(body.cinturon || "Libre").trim().slice(0, 30),
      modalidad: body.modalidad === "nogi" ? "nogi" : "gi",
      pinHash: pin ? hashTokenJiujitsu(pin) : "",
      protegida: Boolean(pin),
      sede,
      creadoPor: actor.uid,
      creadoPorEmail: actor.email || "",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    batch.create(controlRef, {
      nombre: "Mesa principal",
      tokenHash: hashTokenJiujitsu(secreto),
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
      ultimoContacto: null,
    });
    batch.create(ref.collection("Eventos").doc(), {
      tipo: "combate_creado",
      descripcion: "Combate IBJJF creado",
      at: FieldValue.serverTimestamp(),
      actor: actor.email || actor.uid,
    });
    await batch.commit();

    return NextResponse.json({
      ok: true,
      combateId: ref.id,
      controlToken: `${controlRef.id}.${secreto}`,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_CREAR_JIUJITSU:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo crear el combate." },
      { status: 500 },
    );
  }
}
