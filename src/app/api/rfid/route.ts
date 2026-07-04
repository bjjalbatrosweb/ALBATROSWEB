
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, Timestamp } from 'firebase/firestore';

/**
 * Endpoint POST /api/rfid
 * Optimizado para ESP32 y microcontroladores.
 * Maneja lógica de pago automática y conteo de asistencia (ESTRICTAMENTE 1 por día).
 */
export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { permitido: false, mensaje: "Cuerpo de petición inválido (JSON esperado)" },
        { status: 400 }
      );
    }

    const { rfid, dispositivo } = body;

    if (!rfid) {
      return NextResponse.json(
        { permitido: false, mensaje: "RFID no proporcionado" },
        { status: 400 }
      );
    }

    // Normalización agresiva del RFID
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const alumnosRef = collection(db, 'Alumnos');
    const q = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({
        permitido: false,
        rfid_recibido: rfidNormalizado,
        mensaje: "Tarjeta no registrada"
      });
    }

    const docSnap = querySnapshot.docs[0];
    const alumno = docSnap.data();
    const alumnoId = docSnap.id;

    // Lógica Automática de Pago (Vencimiento y Gracia)
    const now = new Date();
    const todayDay = now.getDate();
    let estadoReal = alumno.estadoPago;

    if (estadoReal !== 'Pagado') {
      if (todayDay > alumno.diaPago + 5) {
        estadoReal = 'Retraso';
      } else if (todayDay > alumno.diaPago) {
        estadoReal = 'Falta de Pago';
      }
    }

    // Validar acceso por pago
    if (estadoReal !== 'Pagado') {
      return NextResponse.json({
        permitido: false,
        nombre: alumno.nombre,
        mensaje: estadoReal === 'Retraso' ? "Acceso Denegado: Pago con retraso" : "Acceso Denegado: Pago pendiente"
      });
    }

    // Lógica de Asistencia: ESTRICTAMENTE 1 punto por día
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const asistenciasRef = collection(db, 'Asistencias');
    const attendanceQuery = query(
      asistenciasRef,
      where('alumnoId', '==', alumnoId),
      where('fecha', '>=', Timestamp.fromDate(startOfToday)),
      where('fecha', '<=', Timestamp.fromDate(endOfToday)),
      limit(1)
    );
    
    const attendanceSnap = await getDocs(attendanceQuery);

    // Solo registramos si no hay registros previos para este alumno el día de hoy
    if (attendanceSnap.empty) {
      await addDoc(asistenciasRef, {
        alumnoId,
        nombre: alumno.nombre,
        rfid: rfidNormalizado,
        dispositivo: dispositivo || 'ESP32_Access',
        fecha: serverTimestamp(),
        acceso: "permitido"
      });
    }

    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      mensaje: `Bienvenido ${alumno.nombre}. Asistencia registrada.`
    });

  } catch (error: any) {
    console.error('CRITICAL_API_ERROR:', error);
    return NextResponse.json(
      { permitido: false, mensaje: "Error interno del servidor", error: error.message },
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
