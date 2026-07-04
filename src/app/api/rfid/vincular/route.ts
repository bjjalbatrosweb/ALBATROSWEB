
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * POST /api/rfid/vincular
 * Finaliza el proceso asignando el RFID al alumno y cerrando la solicitud.
 */
export async function POST(req: Request) {
  try {
    const { vinculacionId, rfid, dispositivo } = await req.json();

    if (!vinculacionId || !rfid) {
      return NextResponse.json({ ok: false, mensaje: "Datos incompletos" }, { status: 400 });
    }

    // 1. Normalizar RFID
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Verificar si el RFID ya existe en otro alumno
    const alumnosRef = collection(db, 'Alumnos');
    const qRfid = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const rfidSnapshot = await getDocs(qRfid);

    if (!rfidSnapshot.empty) {
      return NextResponse.json({ ok: false, mensaje: "Tarjeta ya registrada" });
    }

    // 3. Verificar vinculación
    const vincRef = doc(db, 'VinculacionesRFID', vinculacionId);
    const vincSnap = await getDoc(vincRef);

    if (!vincSnap.exists() || vincSnap.data().estado !== 'pendiente') {
      return NextResponse.json({ ok: false, mensaje: "Vinculación no encontrada o no pendiente" });
    }

    const { alumnoId } = vincSnap.data();

    // 4. Actualizar Alumno
    const alumnoRef = doc(db, 'Alumnos', alumnoId);
    await updateDoc(alumnoRef, {
      rfid: rfidNormalizado
    });

    // 5. Completar Vinculación
    await updateDoc(vincRef, {
      estado: 'completada',
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp()
    });

    return NextResponse.json({ ok: true, mensaje: "Tarjeta vinculada" });

  } catch (error: any) {
    console.error('VINCULAR_FINAL_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: "Error interno", error: error.message }, { status: 500 });
  }
}
