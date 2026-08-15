import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  nextTaekwondoGrade,
  normalizeExamId,
  normalizeExamText,
} from "@/lib/taekwondo-exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validToken(value: unknown) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : "";
}

async function findExam(token: string) {
  const snapshot = await adminDb
    .collection("ExamenesTaekwondo")
    .where("registroToken", "==", token)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

function currentTaekwondoGrade(data: FirebaseFirestore.DocumentData) {
  return String(
    data.gradosPorDisciplina?.taekwondo?.grado || data.grado || "",
  ).trim();
}

function timestampIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "registro-examen-taekwondo-listar",
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiados intentos. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const token = validToken(new URL(request.url).searchParams.get("token"));
    if (!token) {
      return NextResponse.json(
        { ok: false, mensaje: "El enlace de inscripción no es válido." },
        { status: 400 },
      );
    }
    const examDocument = await findExam(token);
    if (!examDocument) {
      return NextResponse.json(
        { ok: false, mensaje: "El examen no existe o el enlace expiró." },
        { status: 404 },
      );
    }
    const exam = examDocument.data();
    if (exam.estado !== "inscripciones") {
      return NextResponse.json(
        {
          ok: false,
          mensaje: "Las inscripciones de este examen están cerradas.",
        },
        { status: 409 },
      );
    }
    const sede = String(exam.sede || "");
    const studentsSnapshot = await adminDb
      .collection("Alumnos")
      .where("sede", "==", sede)
      .get();
    const students = studentsSnapshot.docs
      .map((document) => {
        const data = document.data();
        const currentGrade = currentTaekwondoGrade(data);
        const nextGrade = nextTaekwondoGrade(currentGrade);
        return {
          id: document.id,
          nombre: String(data.nombre || "Alumno"),
          fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
          gradoActual: currentGrade,
          gradoAscenso: nextGrade,
          bloqueado: !currentGrade || !nextGrade,
          activo: data.activo !== false,
        };
      })
      .filter((student) => student.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return NextResponse.json({
      ok: true,
      examen: {
        id: examDocument.id,
        nombre: String(exam.nombre || "Examen de Taekwondo"),
        fecha: String(exam.fecha || ""),
        sede,
        precio: Math.max(0, Number(exam.precio) || 0),
        grupos: Array.isArray(exam.grupos) ? exam.grupos : [],
        inscripcionesCierranEn: timestampIso(exam.inscripcionesCierranEn),
      },
      alumnos: students,
    });
  } catch (error) {
    console.error("ERROR_LISTAR_REGISTRO_EXAMEN_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo abrir la inscripción." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "registro-examen-taekwondo-crear",
      limit: 12,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiados intentos. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
      alumnoId?: unknown;
      grupo?: unknown;
      idExamen?: unknown;
    } | null;
    const token = validToken(body?.token);
    const studentId = normalizeExamText(body?.alumnoId, 120);
    const group = normalizeExamText(body?.grupo, 50);
    const manualId = normalizeExamId(body?.idExamen);
    if (!token || !studentId || !group || !manualId) {
      return NextResponse.json(
        { ok: false, mensaje: "Completa alumno, grupo e ID del examen." },
        { status: 400 },
      );
    }
    const examDocument = await findExam(token);
    if (!examDocument) {
      return NextResponse.json(
        { ok: false, mensaje: "El examen no existe o el enlace expiró." },
        { status: 404 },
      );
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const examRef = examDocument.ref;
      const studentRef = adminDb.collection("Alumnos").doc(studentId);
      const requestRef = examRef.collection("solicitudes").doc(manualId);
      const studentLockRef = examRef
        .collection("alumnosInscritos")
        .doc(studentId);
      const paymentRef = adminDb
        .collection("SolicitudesPago")
        .doc(`examen_${examDocument.id}_${studentId}`);
      const [freshExam, student, existingId, existingStudent, payment] =
        await Promise.all([
          transaction.get(examRef),
          transaction.get(studentRef),
          transaction.get(requestRef),
          transaction.get(studentLockRef),
          transaction.get(paymentRef),
        ]);
      if (!freshExam.exists || freshExam.data()?.estado !== "inscripciones") {
        return { status: "closed" as const };
      }
      if (!student.exists || student.data()?.activo === false) {
        return { status: "student" as const };
      }
      if (
        String(student.data()?.sede || "") !==
        String(freshExam.data()?.sede || "")
      ) {
        return { status: "student" as const };
      }
      if (existingId.exists) return { status: "id" as const };
      if (existingStudent.exists) return { status: "duplicate" as const };

      const studentData = student.data() || {};
      const currentGrade = currentTaekwondoGrade(studentData);
      const nextGrade = nextTaekwondoGrade(currentGrade);
      if (!currentGrade || !nextGrade) return { status: "grade" as const };
      const currentProgress = studentData.gradosPorDisciplina?.taekwondo || {};
      const currentBelt = studentData.cintaTaekwondo || {};
      const examData = freshExam.data() || {};
      const price = Math.max(0, Number(examData.precio) || 0);
      const requestData = {
        alumnoId: studentId,
        alumnoNombre: String(studentData.nombre || "Alumno"),
        fotoUrl: String(studentData.fotoUrl || studentData.imagenUrl || ""),
        sede: String(examData.sede || ""),
        grupo: group,
        idExamen: manualId,
        gradoActual: currentGrade,
        gradoAscenso: nextGrade,
        cintaNombre: String(
          currentProgress.rangoNombre || currentBelt.nombre || "",
        ),
        cintaColor: String(
          currentProgress.color || currentBelt.color || "#DC2626",
        ),
        cintaColorSecundario: String(
          currentProgress.colorSecundario || currentBelt.colorSecundario || "",
        ),
        precio: price,
        estado: "pago_solicitado",
        solicitudPagoId: paymentRef.id,
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      };
      transaction.create(requestRef, requestData);
      transaction.create(studentLockRef, {
        alumnoId: studentId,
        solicitudId: manualId,
        creadoEn: FieldValue.serverTimestamp(),
      });
      if (!payment.exists) {
        transaction.create(paymentRef, {
          alumnoId: studentId,
          nombre: String(studentData.nombre || "Alumno"),
          sede: String(examData.sede || ""),
          monto: price,
          periodo: String(examData.fecha || "").slice(0, 7),
          estado: "pendiente",
          origen: "examen_taekwondo",
          examenId: examDocument.id,
          examenNombre: String(examData.nombre || "Examen de Taekwondo"),
          idExamen: manualId,
          creadaEn: FieldValue.serverTimestamp(),
          actualizadaEn: FieldValue.serverTimestamp(),
        });
      }
      return {
        status: "created" as const,
        nombre: String(studentData.nombre || "Alumno"),
        currentGrade,
        nextGrade,
        price,
      };
    });

    const errors = {
      closed: ["Las inscripciones ya están cerradas.", 409],
      student: ["No fue posible validar al alumno.", 404],
      id: ["Ese ID de examen ya está ocupado.", 409],
      duplicate: ["El alumno ya está inscrito en este examen.", 409],
      grade: [
        "El alumno necesita un grado vigente en Atletas → Grados antes de inscribirse.",
        409,
      ],
    } as const;
    if (result.status !== "created") {
      const [message, status] = errors[result.status];
      return NextResponse.json({ ok: false, mensaje: message }, { status });
    }
    return NextResponse.json({
      ok: true,
      mensaje: "Inscripción y solicitud de pago generadas.",
      solicitud: {
        nombre: result.nombre,
        gradoActual: result.currentGrade,
        gradoAscenso: result.nextGrade,
        precio: result.price,
        idExamen: manualId,
      },
    });
  } catch (error) {
    console.error("ERROR_CREAR_REGISTRO_EXAMEN_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo completar la inscripción." },
      { status: 500 },
    );
  }
}
