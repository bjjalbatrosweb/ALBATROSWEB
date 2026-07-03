import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * Endpoint POST /api/rfid
 * Maneja el control de acceso mediante tarjetas RFID
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rfid, dispositivo } = body;

    if (!rfid) {
      return NextResponse.json(
        { permitido: false, mensaje: "RFID no proporcionado" },
        { status: 400 }
      );
    }

    // 1. Normalizar RFID: quitar espacios y pasar a mayúsculas
    const rfidNormalizado = rfid.replace(/\s+/g, '').toUpperCase();

    // 2. Buscar en la colección "Alumnos" el documento con ese RFID
    const alumnosRef = collection(db, 'Alumnos');
    const q = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const querySnapshot = await getDocs(q);

    // Si no se encuentra el alumno
    if (querySnapshot.empty) {
      return NextResponse.json({
        permitido: false,
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

    // 4. Registro exitoso: Guardar asistencia
    await addDoc(collection(db, 'Asistencias'), {
      alumnoId,
      nombre: alumno.nombre,
      rfid: rfidNormalizado,
      dispositivo: dispositivo || 'Recepcion',
      fecha: serverTimestamp(),
      acceso: "permitido"
    });

    // 5. Responder con éxito
    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      mensaje: `Bienvenido ${alumno.nombre}`
    });

  } catch (error: any) {
    console.error('Error en API RFID:', error);
    return NextResponse.json(
      { permitido: false, mensaje: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
