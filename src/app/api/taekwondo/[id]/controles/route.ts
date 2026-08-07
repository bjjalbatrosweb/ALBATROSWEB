import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  restante,
  serializarCombate,
  TECNICAS,
  tokenValido,
  umbral,
} from "@/lib/taekwondo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function controlToken(raw: unknown) {
  if (typeof raw !== "string") return null;
  const [id, secret] = raw.split(".");
  return id && secret ? { id, secret } : null;
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ref = adminDb.collection("CombatesTaekwondo").doc(id);
  const snap = await ref.get();
  if (!snap.exists)
    return NextResponse.json(
      { ok: false, mensaje: "Combate no encontrado." },
      { status: 404 },
    );
  const controls = await ref
    .collection("Controles")
    .where("activo", "==", true)
    .get();
  const validControls = controls.docs.filter(
    (d) =>
      d.data().expiraEn instanceof Timestamp &&
      d.data().expiraEn.toMillis() > Date.now(),
  );
  return NextResponse.json({
    ok: true,
    combate: {
      ...serializarCombate(
        { ...snap.data(), controlesActivos: validControls.length },
        snap.id,
      ),
      controles: validControls.map((d) => ({
        id: d.id,
        nombre: String(d.data().nombre || "Juez"),
        conectado:
          d.data().ultimoContacto instanceof Timestamp &&
          Date.now() - d.data().ultimoContacto.toMillis() < 10000,
      })),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = controlToken(body.controlToken);
    if (!parsed)
      return NextResponse.json(
        { ok: false, mensaje: "Control no autorizado." },
        { status: 403 },
      );
    const ref = adminDb.collection("CombatesTaekwondo").doc(id);
    const controlRef = ref.collection("Controles").doc(parsed.id);
    let resultado: Record<string, unknown> = {};
    await adminDb.runTransaction(async (tx) => {
      const [snap, controlSnap] = await Promise.all([
        tx.get(ref),
        tx.get(controlRef),
      ]);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const data = snap.data() || {};
      const expiraEn = controlSnap.data()?.expiraEn;
      if (
        !controlSnap.exists ||
        controlSnap.data()?.activo !== true ||
        !(expiraEn instanceof Timestamp) ||
        expiraEn.toMillis() < Date.now() ||
        !tokenValido(parsed.secret, controlSnap.data()?.tokenHash)
      )
        throw new Error("FORBIDDEN");
      const now = Date.now();
      const actual = restante(data, now);
      const common = { actualizadoEn: FieldValue.serverTimestamp() };
      if (body.accion === "heartbeat") {
        tx.update(controlRef, { ultimoContacto: FieldValue.serverTimestamp() });
        return;
      }

      if (body.accion === "puntos") {
        if (data.fase !== "combate" || data.corriendo !== true || actual <= 0)
          throw new Error("PAUSED");
        const lado =
          body.lado === "rojo" ? "rojo" : body.lado === "azul" ? "azul" : "";
        const tecnica =
          typeof body.tecnica === "string" && body.tecnica in TECNICAS
            ? (body.tecnica as keyof typeof TECNICAS)
            : null;
        if (!lado || !tecnica) throw new Error("BAD");
        const controlesSnap = await tx.get(
          ref.collection("Controles").where("activo", "==", true),
        );
        const controles = Math.max(
          1,
          Math.min(
            4,
            controlesSnap.docs.filter(
              (d) =>
                d.data().expiraEn instanceof Timestamp &&
                d.data().expiraEn.toMillis() > now,
            ).length,
          ),
        );
        tx.update(controlRef, { ultimoContacto: FieldValue.serverTimestamp() });
        const needed = umbral(controles);
        const clave = `${lado}:${tecnica}`;
        const recientes = (
          Array.isArray(data.votosPendientes) ? data.votosPendientes : []
        ).filter((v: { at?: number }) => now - Number(v.at || 0) <= 2000);
        const sinDuplicado = recientes.filter(
          (v: { controladorId?: string; clave?: string }) =>
            !(v.controladorId === parsed.id && v.clave === clave),
        );
        const yaVoto = recientes.some(
          (v: { controladorId?: string; clave?: string }) =>
            v.controladorId === parsed.id && v.clave === clave,
        );
        const votos = yaVoto
          ? recientes
          : [...sinDuplicado, { controladorId: parsed.id, clave, at: now }];
        const coincidencias = new Set(
          votos
            .filter((v: { clave?: string }) => v.clave === clave)
            .map((v: { controladorId?: string }) => v.controladorId),
        ).size;
        if (coincidencias < needed) {
          tx.update(ref, {
            votosPendientes: votos,
            controlesActivos: controles,
            ...common,
          });
          resultado = {
            pendiente: true,
            votos: coincidencias,
            necesarios: needed,
          };
          return;
        }
        const spec = TECNICAS[tecnica];
        const campo = lado === "rojo" ? "puntosRojo" : "puntosAzul";
        const antes = Number(data[campo] || 0);
        const despues = antes + spec.puntos;
        const eventoRef = ref.collection("Eventos").doc();
        const transcurridoMs = Math.max(
          0,
          Number(data.duracionRoundMs || 0) - actual,
        );
        tx.create(eventoRef, {
          tipo: "puntos",
          lado,
          tecnica,
          zona: spec.zona,
          descripcion: `${spec.nombre} · ${spec.puntos} punto${spec.puntos === 1 ? "" : "s"}`,
          puntos: spec.puntos,
          antes,
          despues,
          round: Number(data.round) || 1,
          restanteMs: actual,
          transcurridoMs,
          minuto: Math.floor(transcurridoMs / 60000) + 1,
          controladores: Array.from(
            new Set(
              votos
                .filter((v: { clave?: string }) => v.clave === clave)
                .map((v: { controladorId?: string }) => v.controladorId),
            ),
          ),
          consenso: `${coincidencias}/${controles}`,
          deshecho: false,
          at: FieldValue.serverTimestamp(),
        });
        tx.update(ref, {
          [campo]: despues,
          votosPendientes: votos.filter(
            (v: { clave?: string }) => v.clave !== clave,
          ),
          controlesActivos: controles,
          ultimoEventoId: eventoRef.id,
          ultimoEvento: {
            lado,
            tecnica,
            puntos: spec.puntos,
            descripcion: spec.nombre,
            at: now,
          },
          ...common,
        });
        resultado = {
          marcado: true,
          puntos: spec.puntos,
          consenso: `${coincidencias}/${controles}`,
        };
        return;
      }

      if (body.accion === "deshacer") {
        const lastId = String(data.ultimoEventoId || "");
        if (!lastId) throw new Error("NO_UNDO");
        const eventRef = ref.collection("Eventos").doc(lastId);
        const eventSnap = await tx.get(eventRef);
        const event = eventSnap.data() || {};
        if (!eventSnap.exists || event.deshecho || event.tipo !== "puntos")
          throw new Error("NO_UNDO");
        tx.update(controlRef, { ultimoContacto: FieldValue.serverTimestamp() });
        const campo = event.lado === "rojo" ? "puntosRojo" : "puntosAzul";
        tx.update(ref, {
          [campo]: Math.max(
            0,
            Number(data[campo] || 0) - Number(event.puntos || 0),
          ),
          ultimoEventoId: "",
          ultimoEvento: {
            descripcion: `Deshecho: ${event.descripcion}`,
            at: now,
          },
          ...common,
        });
        tx.update(eventRef, {
          deshecho: true,
          deshechoPor: parsed.id,
          deshechoEn: FieldValue.serverTimestamp(),
        });
        return;
      }

      tx.update(controlRef, { ultimoContacto: FieldValue.serverTimestamp() });
      if (body.accion === "iniciar")
        tx.update(ref, {
          fase: data.fase === "preparacion" ? "combate" : data.fase,
          corriendo: actual > 0,
          restanteMs: actual || Number(data.duracionRoundMs),
          iniciadoEn: Timestamp.fromMillis(now),
          votosPendientes: [],
          ...common,
        });
      else if (body.accion === "pausar")
        tx.update(ref, {
          corriendo: false,
          restanteMs: actual,
          iniciadoEn: null,
          ...common,
        });
      else if (body.accion === "avanzar") {
        if (data.fase === "combate" && Number(data.round) < Number(data.rounds))
          tx.update(ref, {
            fase: "descanso",
            corriendo: false,
            restanteMs: Number(data.descansoMs),
            iniciadoEn: null,
            votosPendientes: [],
            ...common,
          });
        else if (data.fase === "descanso")
          tx.update(ref, {
            fase: "combate",
            round: Number(data.round) + 1,
            corriendo: false,
            restanteMs: Number(data.duracionRoundMs),
            iniciadoEn: null,
            ...common,
          });
        else {
          const ganador =
            Number(data.puntosRojo) === Number(data.puntosAzul)
              ? "empate"
              : Number(data.puntosRojo) > Number(data.puntosAzul)
                ? "rojo"
                : "azul";
          tx.update(ref, {
            fase: "finalizado",
            corriendo: false,
            restanteMs: actual,
            iniciadoEn: null,
            ganador,
            finalizadoEn: FieldValue.serverTimestamp(),
            ...common,
          });
        }
      } else if (body.accion === "reiniciar")
        tx.update(ref, {
          puntosRojo: 0,
          puntosAzul: 0,
          round: 1,
          fase: "preparacion",
          restanteMs: Number(data.duracionRoundMs),
          corriendo: false,
          iniciadoEn: null,
          votosPendientes: [],
          ganador: "",
          ...common,
        });
      else if (body.accion === "terminar") {
        const ganador =
          Number(data.puntosRojo) === Number(data.puntosAzul)
            ? "empate"
            : Number(data.puntosRojo) > Number(data.puntosAzul)
              ? "rojo"
              : "azul";
        tx.update(ref, {
          fase: "finalizado",
          corriendo: false,
          restanteMs: actual,
          iniciadoEn: null,
          ganador,
          finalizadoEn: FieldValue.serverTimestamp(),
          ...common,
        });
      } else throw new Error("BAD");
    });
    const updated = await ref.get();
    return NextResponse.json({
      ok: true,
      ...resultado,
      combate: serializarCombate(updated.data() || {}, updated.id),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const map: Record<string, [number, string]> = {
      NOT_FOUND: [404, "Combate no encontrado."],
      FORBIDDEN: [403, "Control no autorizado o revocado."],
      BAD: [400, "Operación inválida."],
      PAUSED: [409, "El cronómetro debe estar corriendo para marcar."],
      NO_UNDO: [409, "No hay una puntuación disponible para deshacer."],
    };
    if (map[code])
      return NextResponse.json(
        { ok: false, mensaje: map[code][1] },
        { status: map[code][0] },
      );
    console.error("ERROR_CONTROL_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo actualizar el combate." },
      { status: 500 },
    );
  }
}
