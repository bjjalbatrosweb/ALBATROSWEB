import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * Endpoint POST /api/rfid
 * Optimizado para ESP32 y microcontroladores.
 * Siempre devuelve Content-Type: application/json
 */
export async function POST(req: Request) {
  try {
    // Validar que el body sea JSON
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

    // 1. Normalización agresiva: Eliminar TODO lo que no sea alfanumérico y pasar a MAYÚSCULAS
    // Esto previene errores por saltos de línea o espacios ocultos enviados por el ESP32
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Buscar en la colección "Alumnos"
    const alumnosRef = collection(db, 'Alumnos');
    const q = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const querySnapshot = await getDocs(q);

    // Escenario: Tarjeta no existe
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

    // 3. Validar estado de pago
    if (alumno.estadoPago !== 'Pagado') {
      return NextResponse.json({
        permitido: false,
        nombre: alumno.nombre,
        mensaje: "Pago pendiente"
      });
    }

    // 4. Registro de Asistencia exitosa
    await addDoc(collection(db, 'Asistencias'), {
      alumnoId,
      nombre: alumno.nombre,
      rfid: rfidNormalizado,
      dispositivo: dispositivo || 'ESP32_Access',
      fecha: serverTimestamp(),
      acceso: "permitido"
    });

    // 5. Respuesta de éxito
    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      mensaje: `Bienvenido ${alumno.nombre}`
    });

  } catch (error: any) {
    console.error('CRITICAL_API_ERROR:', error);
    return NextResponse.json(
      { permitido: false, mensaje: "Error interno del servidor", error: error.message },
      { status: 500 }
    );
  }
}

// Soporte para pre-flight (CORS) por si se usa desde simuladores web
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
