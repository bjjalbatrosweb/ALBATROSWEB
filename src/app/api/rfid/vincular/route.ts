import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * POST /api/rfid/vincular
 * Punto 9, 10 y 11 del flujo táctico.
 * El ESP32 envía la nueva tarjeta leída después de entrar en modo vinculación.
 */
export async function POST(req: Request) {
  try {
    const { vinculacionId, rfid, dispositivo } = await req.json();

    if (!vinculacionId || !rfid) {
      return NextResponse.json({ ok: false, mensaje: "Datos incompletos" }, { status: 400 });
    }

    // 1. Normalización del RFID (Mayúsculas, sin espacios)
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Verificar que el RFID NO exista en ningún otro alumno
    const alumnosRef = collection(db, 'Alumnos');
    const qRfid = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const rfidSnapshot = await getDocs(qRfid);

    if (!rfidSnapshot.empty) {
      return NextResponse.json({ ok: false, mensaje: "Tarjeta ya registrada" });
    }

    // 3. Buscar la vinculación pendiente
    const vincRef = doc(db, 'VinculacionesRFID', vinculacionId);
    const vincSnap = await getDoc(vincRef);

    if (!vincSnap.exists() || vincSnap.data().estado !== 'pendiente') {
      return NextResponse.json({ ok: false, mensaje: "Vinculación no válida o expirada" });
    }

    const { alumnoId } = vincSnap.data();

    // 4. Actualizar el alumno agregando el campo rfid
    const alumnoRef = doc(db, 'Alumnos', alumnoId);
    await updateDoc(alumnoRef, {
      rfid: rfidNormalizado
    });

    // 5. Actualizar el documento de vinculación a completada
    await updateDoc(vincRef, {
      estado: "completada",
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp()
    });

    // Punto 11: Respuesta de éxito
    return NextResponse.json({
      ok: true,
      mensaje: "Tarjeta vinculada"
    });

  } catch (error: any) {
    console.error('[API_VINCULAR] Error:', error);
    return NextResponse.json({ ok: false, mensaje: "Error interno del servidor", error: error.message }, { status: 500 });
  }
}
