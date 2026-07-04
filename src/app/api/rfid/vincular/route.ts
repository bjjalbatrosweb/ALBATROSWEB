import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * POST /api/rfid/vincular
 * Pasos 9, 10 y 11: El ESP32 envía la nueva tarjeta leída.
 */
export async function POST(req: Request) {
  try {
    const { vinculacionId, rfid, dispositivo } = await req.json();

    if (!vinculacionId || !rfid) {
      return NextResponse.json({ ok: false, mensaje: "Datos incompletos" }, { status: 400 });
    }

    // 1. Normalización del RFID (Sin espacios, Mayúsculas)
    const rfidNormalizado = rfid.toString().replace(/\s+/g, '').toUpperCase();

    // 2. Verificar si el RFID ya existe en otro alumno
    const alumnosRef = collection(db, 'Alumnos');
    const qRfid = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const rfidSnapshot = await getDocs(qRfid);

    if (!rfidSnapshot.empty) {
      return NextResponse.json({ ok: false, mensaje: "Tarjeta ya registrada" });
    }

    // 3. Verificar que la vinculación existe y está pendiente
    const vincRef = doc(db, 'VinculacionesRFID', vinculacionId);
    const vincSnap = await getDoc(vincRef);

    if (!vincSnap.exists() || vincSnap.data().estado !== 'pendiente') {
      return NextResponse.json({ ok: false, mensaje: "Vinculación no encontrada o expirada" });
    }

    const { alumnoId } = vincSnap.data();

    // 4. Actualizar el alumno con el nuevo RFID
    const alumnoRef = doc(db, 'Alumnos', alumnoId);
    await updateDoc(alumnoRef, {
      rfid: rfidNormalizado
    });

    // 5. Marcar vinculación como completada
    await updateDoc(vincRef, {
      estado: 'completada',
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp()
    });

    return NextResponse.json({ ok: true, mensaje: "Tarjeta vinculada" });

  } catch (error: any) {
    console.error('[API_VINCULAR_FINAL] Error:', error);
    return NextResponse.json({ ok: false, mensaje: "Error interno del servidor", error: error.message }, { status: 500 });
  }
}