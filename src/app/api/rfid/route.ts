import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  Timestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';

/**
 * POST /api/rfid
 *
 * - Busca al alumno por RFID.
 * - Calcula el semáforo de pago.
 * - Permite una sola asistencia por día.
 * - Devuelve el color que debe usar el ESP32.
 */
export async function POST(req: Request) {
  try {
    let body: {
      rfid?: string;
      dispositivo?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          permitido: false,
          estadoLed: 'rojo',
          mensaje: 'Cuerpo de petición inválido',
        },
        { status: 400 }
      );
    }

    const { rfid, dispositivo } = body;

    if (!rfid) {
      return NextResponse.json(
        {
          permitido: false,
          estadoLed: 'rojo',
          mensaje: 'RFID no proporcionado',
        },
        { status: 400 }
      );
    }

    // Quita espacios, guiones y caracteres especiales.
    const rfidNormalizado = rfid
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    // Buscar alumno.
    const alumnosRef = collection(db, 'Alumnos');

    const alumnoQuery = query(
      alumnosRef,
      where('rfid', '==', rfidNormalizado),
      limit(1)
    );

    const alumnoSnapshot = await getDocs(alumnoQuery);

    if (alumnoSnapshot.empty) {
      return NextResponse.json({
        permitido: false,
        estadoLed: 'rojo',
        rfid_recibido: rfidNormalizado,
        mensajePago: 'Tarjeta no registrada',
        mensaje: 'Tarjeta no registrada',
      });
    }

    const alumnoDoc = alumnoSnapshot.docs[0];
    const alumno = alumnoDoc.data();
    const alumnoId = alumnoDoc.id;

    const nombre =
      typeof alumno.nombre === 'string' && alumno.nombre.trim()
        ? alumno.nombre.trim()
        : 'Alumno';

    const now = new Date();
    const todayDay = now.getDate();

    const diaPago = Number(alumno.diaPago);

    if (
      !Number.isInteger(diaPago) ||
      diaPago < 1 ||
      diaPago > 31
    ) {
      return NextResponse.json(
        {
          permitido: false,
          nombre,
          estadoLed: 'rojo',
          mensajePago: 'Fecha de pago inválida',
          mensaje: 'El día de pago del alumno no es válido',
        },
        { status: 500 }
      );
    }

    /*
     * SEMÁFORO DE PAGO
     *
     * Ejemplo diaPago = 10:
     * 1–5  = verde
     * 6–10 = amarillo
     * 11+  = rojo
     */
    let permitido = true;
    let estadoLed: 'verde' | 'amarillo' | 'rojo' = 'verde';
    let diasParaPago = diaPago - todayDay;
    let mensajePago = '';

    if (todayDay > diaPago) {
      permitido = false;
      estadoLed = 'rojo';

      const diasVencidos = todayDay - diaPago;
      diasParaPago = -diasVencidos;

      mensajePago =
        diasVencidos === 1
          ? 'Vencido hace 1 dia'
          : `Vencido hace ${diasVencidos} dias`;

      // Cambiar automáticamente el estado del alumno.
      if (alumno.estadoPago !== 'Falta de Pago') {
        await updateDoc(doc(db, 'Alumnos', alumnoId), {
          estadoPago: 'Falta de Pago',
        });
      }
    } else if (todayDay >= diaPago - 4) {
      permitido = true;
      estadoLed = 'amarillo';
      diasParaPago = diaPago - todayDay;

      if (diasParaPago === 0) {
        mensajePago = 'Pago hoy';
      } else if (diasParaPago === 1) {
        mensajePago = 'Pago manana';
      } else {
        mensajePago = `Pago en ${diasParaPago} dias`;
      }
    } else {
      permitido = true;
      estadoLed = 'verde';
      diasParaPago = diaPago - todayDay;
      mensajePago = `Pago en ${diasParaPago} dias`;
    }

    // Acceso denegado por pago vencido.
    if (!permitido) {
      return NextResponse.json({
        permitido: false,
        nombre,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje: 'Acceso Denegado: Pago vencido',
      });
    }

    /*
     * ASISTENCIA:
     * Solo se registra un documento por alumno cada día.
     */
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const asistenciasRef = collection(db, 'Asistencias');

    const asistenciaQuery = query(
      asistenciasRef,
      where('alumnoId', '==', alumnoId),
      where('fecha', '>=', Timestamp.fromDate(startOfToday)),
      where('fecha', '<=', Timestamp.fromDate(endOfToday)),
      limit(1)
    );

    const asistenciaSnapshot = await getDocs(asistenciaQuery);

    let asistenciaRegistrada = false;

    if (asistenciaSnapshot.empty) {
      await addDoc(asistenciasRef, {
        alumnoId,
        nombre,
        rfid: rfidNormalizado,
        dispositivo: dispositivo || 'Recepcion',
        fecha: serverTimestamp(),
        acceso: 'permitido',
      });

      asistenciaRegistrada = true;
    }

    return NextResponse.json({
      permitido: true,
      nombre,
      estadoLed,
      diasParaPago,
      mensajePago,
      asistenciaRegistrada,
      mensaje: asistenciaRegistrada
        ? `Bienvenido ${nombre}. Asistencia registrada.`
        : `Bienvenido ${nombre}. Asistencia ya marcada hoy.`,
    });
  } catch (error: unknown) {
    const mensajeError =
      error instanceof Error ? error.message : 'Error desconocido';

    console.error('CRITICAL_API_ERROR:', error);

    return NextResponse.json(
      {
        permitido: false,
        estadoLed: 'rojo',
        mensaje: 'Error interno del servidor',
        error: mensajeError,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
