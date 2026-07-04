
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * POST /api/rfid/solicitar-vinculacion
 * Inicia el proceso de vinculación para un alumno.
 */
export async function POST(req: Request) {
  try {
    const { alumnoId, dispositivo } = await req.json();

    if (!alumnoId || !dispositivo) {
      return NextResponse.json({ ok: false, mensaje: "alumnoId y dispositivo son obligatorios" }, { status: 400 });
    }

    console.log(`Iniciando vinculación para alumno ${alumnoId} en dispositivo ${dispositivo}`);

    // 1. Cancelar vinculaciones pendientes anteriores para el mismo dispositivo
    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    const q = query(vinculacionesRef, where('dispositivo', '==', dispositivo), where('estado', '==', 'pendiente'));
    
    try {
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        await updateDoc(doc(db, 'VinculacionesRFID', docSnap.id), {
          estado: 'cancelada',
          canceladaEn: serverTimestamp()
        });
      }
    } catch (dbError) {
      console.error('Error al limpiar vinculaciones previas:', dbError);
      // Continuamos aunque falle la limpieza previa
    }

    // 2. Crear nueva vinculación pendiente
    const newDoc = await addDoc(vinculacionesRef, {
      alumnoId,
      dispositivo,
      estado: 'pendiente',
      creadoEn: serverTimestamp(),
      rfidAsignado: null
    });

    console.log(`Vinculación creada con ID: ${newDoc.id}`);

    return NextResponse.json({ ok: true, vinculacionId: newDoc.id });

  } catch (error: any) {
    console.error('SOLICITAR_VINCULACION_CRITICAL_ERROR:', error);
    return NextResponse.json({ 
      ok: false, 
      mensaje: "Error interno del servidor al procesar la vinculación.",
      error: error.message 
    }, { status: 500 });
  }
}
