import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  criterionScore,
  normalizeExamText,
  type ExamCriterion,
} from "@/lib/taekwondo-exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validToken(value: unknown) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : "";
}

function validIdentifier(value: unknown, max = 120) {
  const id = String(value || "").trim();
  return new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(id) ? id : "";
}

function validDataImage(value: unknown, maxLength: number) {
  const image = String(value || "");
  return image.length <= maxLength &&
    /^data:image\/(png|jpeg|webp);base64,/.test(image)
    ? image
    : "";
}

function judgeId(examId: string, deviceId: string) {
  return createHash("sha256")
    .update(`${examId}:${deviceId}`)
    .digest("hex")
    .slice(0, 24);
}

function score(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 5 ? number : null;
}

async function publicSession(token: string) {
  const ref = adminDb.collection("ExamenEvaluacionPublica").doc(token);
  const snapshot = await ref.get();
  return snapshot.exists
    ? { ref, snapshot, data: snapshot.data() || {} }
    : null;
}

function allowedCriteria(
  session: FirebaseFirestore.DocumentData,
  participant: Record<string, unknown>,
) {
  const all = Array.isArray(session.criterios)
    ? (session.criterios as ExamCriterion[])
    : [];
  const group = String(participant.grupo || "");
  const selected = Array.isArray(session.criteriosPorGrupo?.[group])
    ? (session.criteriosPorGrupo[group] as string[])
    : all.map((criterion) => criterion.id);
  const ids = new Set(selected);
  return all.filter((criterion) => ids.has(criterion.id));
}

export async function GET(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "evaluacion-examen-taekwondo-leer",
      limit: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }
    const url = new URL(request.url);
    const token = validToken(url.searchParams.get("token"));
    const evaluatorId = validIdentifier(url.searchParams.get("sinodalId"));
    const studentId = validIdentifier(url.searchParams.get("alumnoId"));
    if (!token) {
      return NextResponse.json(
        { ok: false, mensaje: "El enlace de evaluación no es válido." },
        { status: 400 },
      );
    }
    const session = await publicSession(token);
    if (!session) {
      return NextResponse.json(
        { ok: false, mensaje: "La sesión no existe o ya no está disponible." },
        { status: 404 },
      );
    }
    if (!evaluatorId || !studentId) {
      return NextResponse.json({ ok: true, sesion: session.data });
    }
    if (!session.data.sinodales?.[evaluatorId]) {
      return NextResponse.json(
        { ok: false, mensaje: "El sinodal no pertenece a esta sesión." },
        { status: 403 },
      );
    }
    const evaluation = await adminDb
      .collection("ExamenesTaekwondo")
      .doc(String(session.data.examenId || ""))
      .collection("evaluaciones")
      .doc(`${evaluatorId}_${studentId}`)
      .get();
    return NextResponse.json({
      ok: true,
      evaluacion: evaluation.exists ? evaluation.data() : null,
    });
  } catch (error) {
    console.error("ERROR_LEER_EVALUACION_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo cargar la evaluación." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "evaluacion-examen-taekwondo-escribir",
      limit: 180,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const action = String(body?.accion || "");
    const token = validToken(body?.token);
    if (!token) {
      return NextResponse.json(
        { ok: false, mensaje: "El enlace de evaluación no es válido." },
        { status: 400 },
      );
    }
    const session = await publicSession(token);
    if (!session) {
      return NextResponse.json(
        { ok: false, mensaje: "La sesión no existe o ya no está disponible." },
        { status: 404 },
      );
    }
    const examId = String(session.data.examenId || "");
    const examRef = adminDb.collection("ExamenesTaekwondo").doc(examId);

    if (action === "unirse") {
      if (session.data.estado !== "registro_sinodales") {
        return NextResponse.json(
          { ok: false, mensaje: "El registro de sinodales está cerrado." },
          { status: 409 },
        );
      }
      const deviceId = validIdentifier(body?.dispositivoId);
      const name = normalizeExamText(body?.nombre, 80);
      const dan = normalizeExamText(body?.grado, 20);
      const photo = validDataImage(body?.foto, 320_000);
      const signature = validDataImage(body?.firma, 220_000);
      if (!deviceId || !name || !/^([1-9]|10)° Dan$/.test(dan) || !signature) {
        return NextResponse.json(
          {
            ok: false,
            mensaje: "Completa nombre, grado Dan y firma del sinodal.",
          },
          { status: 400 },
        );
      }
      const id = judgeId(examId, deviceId);
      const privateRef = examRef.collection("sinodales").doc(id);
      await privateRef.set(
        {
          id,
          nombre: name,
          grado: dan,
          foto: photo,
          firma: signature,
          dispositivoId: deviceId,
          finalizado: false,
          unidoEn: FieldValue.serverTimestamp(),
          actualizadoEn: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await adminDb.runTransaction(async (transaction) => {
        const fresh = await transaction.get(session.ref);
        if (!fresh.exists || fresh.data()?.estado !== "registro_sinodales") {
          throw new Error("REGISTRO_CERRADO");
        }
        transaction.update(session.ref, {
          [`sinodales.${id}`]: {
            id,
            nombre: name,
            grado: dan,
            foto: photo,
            finalizado: false,
            conectadoEn: new Date().toISOString(),
          },
          actualizadoEn: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({
        ok: true,
        sinodal: { id, nombre: name, grado: dan, foto: photo },
      });
    }

    const evaluatorId = validIdentifier(body?.sinodalId);
    if (!evaluatorId || !session.data.sinodales?.[evaluatorId]) {
      return NextResponse.json(
        { ok: false, mensaje: "El sinodal no pertenece a esta sesión." },
        { status: 403 },
      );
    }

    if (action === "guardar_hoja" || action === "finalizar_hoja") {
      if (session.data.estado !== "evaluacion") {
        return NextResponse.json(
          { ok: false, mensaje: "La evaluación todavía no está activa." },
          { status: 409 },
        );
      }
      const studentId = validIdentifier(body?.alumnoId);
      const participants = Array.isArray(session.data.participantes)
        ? (session.data.participantes as Array<Record<string, unknown>>)
        : [];
      const participant = participants.find(
        (item) => String(item.id || "") === studentId,
      );
      if (!participant) {
        return NextResponse.json(
          { ok: false, mensaje: "El alumno no pertenece a este examen." },
          { status: 404 },
        );
      }
      const criteria = allowedCriteria(session.data, participant);
      const rawRatings =
        body?.calificaciones && typeof body.calificaciones === "object"
          ? (body.calificaciones as Record<string, unknown>)
          : {};
      const ratings = Object.fromEntries(
        criteria.flatMap((criterion) => {
          const value = score(rawRatings[criterion.id]);
          return value === null ? [] : [[criterion.id, value]];
        }),
      ) as Record<string, number>;
      const complete =
        criteria.length > 0 && criteria.every((item) => item.id in ratings);
      if (action === "finalizar_hoja" && !complete) {
        return NextResponse.json(
          {
            ok: false,
            mensaje: "Califica todos los criterios antes de finalizar la hoja.",
          },
          { status: 409 },
        );
      }
      const best = body?.mejorExamen === true;
      const observations = normalizeExamText(body?.observaciones, 1000);
      const status =
        complete && action === "finalizar_hoja" ? "completo" : "iniciado";
      const evaluationRef = examRef
        .collection("evaluaciones")
        .doc(`${evaluatorId}_${studentId}`);
      const evaluationData = {
        examenId: examId,
        sinodalId: evaluatorId,
        sinodalNombre: String(
          session.data.sinodales[evaluatorId]?.nombre || "Sinodal",
        ),
        alumnoId: studentId,
        alumnoNombre: String(participant.nombre || "Alumno"),
        grupo: String(participant.grupo || ""),
        idExamen: String(participant.idExamen || ""),
        gradoActual: String(participant.gradoActual || ""),
        gradoAscenso: String(participant.gradoAscenso || ""),
        calificaciones: ratings,
        promedio: criterionScore(ratings),
        observaciones: observations,
        mejorExamen: best,
        completa: status === "completo",
        actualizadoEn: FieldValue.serverTimestamp(),
        ...(status === "completo"
          ? { finalizadoEn: FieldValue.serverTimestamp() }
          : {}),
      };
      await evaluationRef.set(evaluationData, { merge: true });
      await session.ref.update({
        [`estadoHojas.${evaluatorId}.${studentId}`]: {
          estado: status,
          mejorExamen: best,
          promedio: criterionScore(ratings),
          actualizadoEn: new Date().toISOString(),
        },
        actualizadoEn: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        ok: true,
        estado: status,
        promedio: criterionScore(ratings),
      });
    }

    if (action === "finalizar_sinodal") {
      if (session.data.estado !== "evaluacion") {
        return NextResponse.json(
          { ok: false, mensaje: "La evaluación no está activa." },
          { status: 409 },
        );
      }
      const general = score(body?.calificacionGeneral);
      const academy = score(body?.calificacionAcademia);
      if (general === null || academy === null) {
        return NextResponse.json(
          { ok: false, mensaje: "Califica el examen y la academia de 0 a 5." },
          { status: 400 },
        );
      }
      const participants = Array.isArray(session.data.participantes)
        ? (session.data.participantes as Array<Record<string, unknown>>)
        : [];
      const evaluations = await examRef
        .collection("evaluaciones")
        .where("sinodalId", "==", evaluatorId)
        .get();
      const completed = new Set(
        evaluations.docs
          .filter((document) => document.data().completa === true)
          .map((document) => String(document.data().alumnoId || "")),
      );
      const missing = participants
        .map((participant) => String(participant.id || ""))
        .filter((id) => id && !completed.has(id));
      if (missing.length) {
        await session.ref.update({
          [`mostrarFaltantes.${evaluatorId}`]: true,
          actualizadoEn: FieldValue.serverTimestamp(),
        });
        return NextResponse.json(
          {
            ok: false,
            mensaje: `Faltan ${missing.length} hojas por finalizar.`,
            faltantes: missing,
          },
          { status: 409 },
        );
      }

      const judgeRef = examRef.collection("sinodales").doc(evaluatorId);
      const transactionResult = await adminDb.runTransaction(
        async (transaction) => {
          const fresh = await transaction.get(session.ref);
          const judges = { ...(fresh.data()?.sinodales || {}) } as Record<
            string,
            Record<string, unknown>
          >;
          judges[evaluatorId] = {
            ...(judges[evaluatorId] || {}),
            finalizado: true,
            calificacionGeneral: general,
            calificacionAcademia: academy,
            finalizadoEn: new Date().toISOString(),
          };
          const judgeValues = Object.values(judges);
          const allFinished =
            judgeValues.length > 0 &&
            judgeValues.every((judge) => judge.finalizado === true);
          const average = (field: string) =>
            Math.round(
              (judgeValues.reduce(
                (sum, judge) => sum + Number(judge[field] || 0),
                0,
              ) /
                judgeValues.length) *
                100,
            ) / 100;
          transaction.set(
            judgeRef,
            {
              finalizado: true,
              calificacionGeneral: general,
              calificacionAcademia: academy,
              finalizadoEn: FieldValue.serverTimestamp(),
              actualizadoEn: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          transaction.update(session.ref, {
            sinodales: judges,
            [`mostrarFaltantes.${evaluatorId}`]: false,
            ...(allFinished
              ? {
                  estado: "finalizado",
                  promedioGeneral: average("calificacionGeneral"),
                  promedioAcademia: average("calificacionAcademia"),
                  finalizadoEn: FieldValue.serverTimestamp(),
                }
              : {}),
            actualizadoEn: FieldValue.serverTimestamp(),
          });
          if (allFinished) {
            transaction.update(examRef, {
              estado: "finalizado",
              promedioGeneral: average("calificacionGeneral"),
              promedioAcademia: average("calificacionAcademia"),
              finalizadoEn: FieldValue.serverTimestamp(),
              actualizadoEn: FieldValue.serverTimestamp(),
            });
          }
          return { allFinished };
        },
      );
      return NextResponse.json({
        ok: true,
        examenFinalizado: transactionResult.allFinished,
        mensaje: transactionResult.allFinished
          ? "Todos los sinodales terminaron. El examen fue archivado."
          : "Tu evaluación terminó. Esperando a los demás sinodales.",
      });
    }

    return NextResponse.json(
      { ok: false, mensaje: "La acción solicitada no existe." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTRO_CERRADO") {
      return NextResponse.json(
        { ok: false, mensaje: "El registro de sinodales ya cerró." },
        { status: 409 },
      );
    }
    console.error("ERROR_EVALUACION_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo guardar la evaluación." },
      { status: 500 },
    );
  }
}
