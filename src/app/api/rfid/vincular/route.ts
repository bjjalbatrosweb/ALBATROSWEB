import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * Punto 10: Endpoint para finalizar la vinculación RFID.
 * Llamado por el ESP32 tras leer la nueva tarjeta en modo vinculación.
 */
export async function POST(req: Request) {
  try {
    const { vinculacionId, rfid, dispositivo } = await req.json();

    if (!vinculacionId || !rfid) {
      return NextResponse.json({ ok: false, mensaje: "Datos incompletos" }, { status: 400 });
    }

    // 1. Normalización del RFID (Mayúsculas y sin caracteres no alfanuméricos)
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Verificar que el RFID no exista en ningún otro alumno
    const alumnosRef = collection(db, 'Alumnos');
    const qRfid = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const rfidSnapshot = await getDocs(qRfid);

    if (!rfidSnapshot.empty) {
      return NextResponse.json({ ok: false, mensaje: "Tarjeta ya registrada" });
    }

    // 3. Buscar y validar la vinculación pendiente
    const vincRef = doc(db, 'VinculacionesRFID', vinculacionId);
    const vincSnap = await getDoc(vincRef);

    if (!vincSnap.exists() || vincSnap.data().estado !== 'pendiente') {
      return NextResponse.json({ ok: false, mensaje: "El proceso de vinculación ya no es válido o ha expirado" });
    }

    const { alumnoId } = vincSnap.data();

    // 4. Actualización del Alumno y de la Vinculación (Punto 10)
    await updateDoc(doc(db, 'Alumnos', alumnoId), { 
        rfid: rfidNormalizado 
    });

    await updateDoc(vincRef, {
      estado: "completada",
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp()
    });

    // Punto 11: Responder éxito
    return NextResponse.json({ 
        ok: true, 
        mensaje: "Tarjeta vinculada" 
    });

  } catch (error: any) {
    console.error("Error en endpoint vincular:", error);
    return NextResponse.json({ ok: false, mensaje: "Error interno: " + error.message }, { status: 500 });
  }
}
