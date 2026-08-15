import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ACCIONES_IBJJF,
  resolverGanadorJiujitsu,
  serializarCombateJiujitsu,
  tiempoRestanteJiujitsu,
  tokenJiujitsuValido,
  type LadoJiujitsu,
} from "@/lib/jiujitsu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseControlToken(raw: unknown) {
  if (typeof raw !== "string") return null;
  const [id, secret] = raw.split(".");
  return id && secret ? { id, secret } : null;
}

function ladoValido(value: unknown): LadoJiujitsu | null {
  return value === "rojo" || value === "azul" ? value : null;
}

async function cerrarControles(ref: FirebaseFirestore.DocumentReference) {
  const controles = await ref
    .collection("Controles")
    .where("activo", "==", true)
    .get();
  if (!controles.empty) {
    const batch = adminDb.batch();
    controles.docs.forEach((control) =>
      batch.update(control.ref, {
        activo: false,
        revocadoEn: FieldValue.serverTimestamp(),
      }),
    );
    await batch.commit();
  }
  await ref.update({ controlesCerrados: true });
}

async function sincronizarReloj(ref: FirebaseFirestore.DocumentReference) {
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const data = snapshot.data() || {};
    if (
      data.corriendo !== true ||
      data.fase !== "combate" ||
      tiempoRestanteJiujitsu(data) > 0
    ) {
      return;
    }

    const ganador = resolverGanadorJiujitsu(data);
    const common = {
      corriendo: false,
      restanteMs: 0,
      iniciadoEn: null,
      actualizadoEn: FieldValue.serverTimestamp(),
    };
    if (ganador === "empate") {
      transaction.update(ref, {
        ...common,
        fase: "decision",
        ganador: "",
        resultadoTipo: "",
      });
    } else {
      transaction.update(ref, {
        ...common,
        fase: "finalizado",
        ganador,
        resultadoTipo: "puntos",
        finalizadoEn: FieldValue.serverTimestamp(),
        controlesCerrados: false,
      });
    }
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rate = await checkRateLimit(request, {
    scope: "jiujitsu-marcador",
    limit: 300,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, mensaje: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const { id } = await context.params;
  const ref = adminDb.collection("CombatesJiujitsu").doc(id);
  let snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json(
      { ok: false, mensaje: "Combate no encontrado." },
      { status: 404 },
    );
  }

  if (
    snapshot.data()?.corriendo === true &&
    tiempoRestanteJiujitsu(snapshot.data() || {}) <= 0
  ) {
    await sincronizarReloj(ref);
    snapshot = await ref.get();
  }
  if (
    snapshot.data()?.fase === "finalizado" &&
    snapshot.data()?.controlesCerrados !== true
  ) {
    await cerrarControles(ref);
  }

  return NextResponse.json({
    ok: true,
    combate: serializarCombateJiujitsu(snapshot.data() || {}, snapshot.id),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = parseControlToken(body.controlToken);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, mensaje: "Control no autorizado." },
        { status: 403 },
      );
    }

    const ref = adminDb.collection("CombatesJiujitsu").doc(id);
    const controlRef = ref.collection("Controles").doc(parsed.id);
    if (body.accion === "heartbeat") {
      const controlSnapshot = await controlRef.get();
      const expiraEn = controlSnapshot.data()?.expiraEn;
      if (
        !controlSnapshot.exists ||
        controlSnapshot.data()?.activo !== true ||
        !(expiraEn instanceof Timestamp) ||
        expiraEn.toMillis() < Date.now() ||
        !tokenJiujitsuValido(
          parsed.secret,
          controlSnapshot.data()?.tokenHash,
        )
      ) {
        return NextResponse.json(
          { ok: false, mensaje: "Control no autorizado o revocado." },
          { status: 403 },
        );
      }
      await controlRef.update({ ultimoContacto: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true });
    }

    let resultado: Record<string, unknown> = {};
    await adminDb.runTransaction(async (transaction) => {
      const [snapshot, controlSnapshot] = await Promise.all([
        transaction.get(ref),
        transaction.get(controlRef),
      ]);
      if (!snapshot.exists) throw new Error("NOT_FOUND");
      const data = snapshot.data() || {};
      const expiraEn = controlSnapshot.data()?.expiraEn;
      if (
        !controlSnapshot.exists ||
        controlSnapshot.data()?.activo !== true ||
        !(expiraEn instanceof Timestamp) ||
        expiraEn.toMillis() < Date.now() ||
        !tokenJiujitsuValido(parsed.secret, controlSnapshot.data()?.tokenHash)
      ) {
        throw new Error("FORBIDDEN");
      }

      const now = Date.now();
      const restante = tiempoRestanteJiujitsu(data, now);
      const common = { actualizadoEn: FieldValue.serverTimestamp() };
      transaction.update(controlRef, {
        ultimoContacto: FieldValue.serverTimestamp(),
      });

      if (
        body.accion === "puntos" ||
        body.accion === "ventaja" ||
        body.accion === "penalizacion"
      ) {
        if (data.fase !== "combate" || data.corriendo !== true || restante <= 0) {
          throw new Error("PAUSED");
        }
        const lado = ladoValido(body.lado);
        if (!lado) throw new Error("BAD");

        let campo = "";
        let incremento = 1;
        let descripcion = "";
        let tecnica = "";
        if (body.accion === "puntos") {
          tecnica =
            typeof body.tecnica === "string" &&
            body.tecnica in ACCIONES_IBJJF
              ? body.tecnica
              : "";
          if (!tecnica) throw new Error("BAD");
          const spec = ACCIONES_IBJJF[tecnica as keyof typeof ACCIONES_IBJJF];
          campo = lado === "rojo" ? "puntosRojo" : "puntosAzul";
          incremento = spec.puntos;
          descripcion = `${spec.nombre} · ${spec.puntos} puntos`;
        } else if (body.accion === "ventaja") {
          campo = lado === "rojo" ? "ventajasRojo" : "ventajasAzul";
          descripcion = "Ventaja";
        } else {
          campo =
            lado === "rojo" ? "penalizacionesRojo" : "penalizacionesAzul";
          descripcion = "Penalización";
        }

        const antes = Number(data[campo]) || 0;
        const despues = antes + incremento;
        const eventoRef = ref.collection("Eventos").doc();
        transaction.create(eventoRef, {
          tipo: body.accion,
          lado,
          tecnica,
          descripcion,
          campo,
          valor: incremento,
          antes,
          despues,
          restanteMs: restante,
          deshecho: false,
          controladorId: parsed.id,
          at: FieldValue.serverTimestamp(),
        });
        transaction.update(ref, {
          [campo]: despues,
          ultimoEventoId: eventoRef.id,
          ultimoEvento: {
            tipo: body.accion,
            lado,
            descripcion,
            valor: incremento,
            at: now,
          },
          ...common,
        });
        resultado = { marcado: true, tipo: body.accion, valor: incremento };
        return;
      }

      if (body.accion === "deshacer") {
        const lastId = String(data.ultimoEventoId || "");
        if (!lastId) throw new Error("NO_UNDO");
        const eventRef = ref.collection("Eventos").doc(lastId);
        const eventSnapshot = await transaction.get(eventRef);
        const event = eventSnapshot.data() || {};
        if (
          !eventSnapshot.exists ||
          event.deshecho === true ||
          !["puntos", "ventaja", "penalizacion"].includes(String(event.tipo))
        ) {
          throw new Error("NO_UNDO");
        }
        const campo = String(event.campo || "");
        if (
          ![
            "puntosRojo",
            "puntosAzul",
            "ventajasRojo",
            "ventajasAzul",
            "penalizacionesRojo",
            "penalizacionesAzul",
          ].includes(campo)
        ) {
          throw new Error("NO_UNDO");
        }
        transaction.update(ref, {
          [campo]: Math.max(
            0,
            (Number(data[campo]) || 0) - (Number(event.valor) || 0),
          ),
          ultimoEventoId: "",
          ultimoEvento: {
            descripcion: `Deshecho: ${String(event.descripcion || "acción")}`,
            at: now,
          },
          ...common,
        });
        transaction.update(eventRef, {
          deshecho: true,
          deshechoPor: parsed.id,
          deshechoEn: FieldValue.serverTimestamp(),
        });
        resultado = { deshecho: true };
        return;
      }

      if (body.accion === "iniciar") {
        if (data.fase === "finalizado" || data.fase === "decision") {
          throw new Error("BAD");
        }
        transaction.update(ref, {
          fase: "combate",
          corriendo: restante > 0,
          restanteMs: restante || Number(data.duracionMs),
          iniciadoEn: Timestamp.fromMillis(now),
          ...common,
        });
      } else if (body.accion === "pausar") {
        transaction.update(ref, {
          corriendo: false,
          restanteMs: restante,
          iniciadoEn: null,
          ...common,
        });
      } else if (body.accion === "reiniciar") {
        transaction.update(ref, {
          puntosRojo: 0,
          puntosAzul: 0,
          ventajasRojo: 0,
          ventajasAzul: 0,
          penalizacionesRojo: 0,
          penalizacionesAzul: 0,
          fase: "preparacion",
          restanteMs: Number(data.duracionMs),
          corriendo: false,
          iniciadoEn: null,
          ganador: "",
          resultadoTipo: "",
          ultimoEventoId: "",
          ultimoEvento: null,
          ...common,
        });
      } else if (
        body.accion === "sumision" ||
        body.accion === "decision" ||
        body.accion === "descalificar" ||
        body.accion === "abandono"
      ) {
        const seleccionado = ladoValido(body.lado);
        if (!seleccionado) throw new Error("BAD");
        const ganador =
          body.accion === "descalificar" || body.accion === "abandono"
            ? seleccionado === "rojo"
              ? "azul"
              : "rojo"
            : seleccionado;
        transaction.update(ref, {
          fase: "finalizado",
          corriendo: false,
          restanteMs: restante,
          iniciadoEn: null,
          ganador,
          resultadoTipo:
            body.accion === "sumision"
              ? "sumision"
              : body.accion === "decision"
                ? "decision"
                : body.accion === "descalificar"
                  ? "descalificacion"
                  : "abandono",
          finalizadoEn: FieldValue.serverTimestamp(),
          controlesCerrados: false,
          ultimoEvento: {
            descripcion:
              body.accion === "sumision"
                ? `Victoria por sumisión · ${ganador}`
                : body.accion === "decision"
                  ? `Decisión arbitral · ${ganador}`
                  : body.accion === "descalificar"
                    ? `Descalificación · ${seleccionado}`
                    : `Abandono · ${seleccionado}`,
            at: now,
          },
          ...common,
        });
      } else if (body.accion === "terminar") {
        const ganador = resolverGanadorJiujitsu(data);
        if (ganador === "empate") {
          transaction.update(ref, {
            fase: "decision",
            corriendo: false,
            restanteMs: restante,
            iniciadoEn: null,
            ganador: "",
            resultadoTipo: "",
            ...common,
          });
        } else {
          transaction.update(ref, {
            fase: "finalizado",
            corriendo: false,
            restanteMs: restante,
            iniciadoEn: null,
            ganador,
            resultadoTipo: "puntos",
            finalizadoEn: FieldValue.serverTimestamp(),
            controlesCerrados: false,
            ...common,
          });
        }
      } else {
        throw new Error("BAD");
      }
    });

    const updated = await ref.get();
    if (
      updated.data()?.fase === "finalizado" &&
      updated.data()?.controlesCerrados !== true
    ) {
      await cerrarControles(ref);
    }
    const finalSnapshot = await ref.get();
    return NextResponse.json({
      ok: true,
      ...resultado,
      combate: serializarCombateJiujitsu(
        finalSnapshot.data() || {},
        finalSnapshot.id,
      ),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, [number, string]> = {
      NOT_FOUND: [404, "Combate no encontrado."],
      FORBIDDEN: [403, "Control no autorizado o revocado."],
      BAD: [400, "Operación inválida."],
      PAUSED: [409, "El cronómetro debe estar corriendo para puntuar."],
      NO_UNDO: [409, "No hay una acción disponible para deshacer."],
    };
    if (messages[code]) {
      return NextResponse.json(
        { ok: false, mensaje: messages[code][1] },
        { status: messages[code][0] },
      );
    }
    console.error("ERROR_CONTROL_JIUJITSU:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo actualizar el combate." },
      { status: 500 },
    );
  }
}
