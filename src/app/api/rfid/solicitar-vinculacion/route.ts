import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * POST /api/rfid/solicitar-vinculacion
 * Paso 2 del flujo: Admin solicita vincular un alumno.
 */
export async function POST(req: Request) {
  try {
    const { alumnoId, dispositivo } = await req.json();

    if (!alumnoId || !dispositivo) {
      return NextResponse.json({ ok: false, mensaje: "alumnoId y dispositivo son obligatorios" }, { status: 400 });
    }

    // 1. Cancelamos vinculaciones pendientes previas de este dispositivo
    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    const q = query(
      vinculacionesRef, 
      where('dispositivo', '==', dispositivo), 
      where('estado', '==', 'pendiente')
    );
    
    const snapshot = await getDocs(q);
    const cancelPromises = snapshot.docs.map(d => 
      updateDoc(doc(db, 'VinculacionesRFID', d.id), { 
        estado: 'cancelada',
        canceladaEn: serverTimestamp() 
      })
    );
    await Promise.all(cancelPromises);

    // 2. Creamos la nueva solicitud de vinculación
    const newDoc = await addDoc(vinculacionesRef, {
      alumnoId,
      dispositivo,
      estado: 'pendiente',
      creadoEn: serverTimestamp(),
      rfidAsignado: null
    });

    return NextResponse.json({ 
      ok: true, 
      vinculacionId: newDoc.id,
      mensaje: "Vinculación solicitada. Esperando tarjeta maestra en el hardware."
    });

  } catch (error: any) {
    console.error('[API_SOLICITAR] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      mensaje: "Error al crear la solicitud", 
      error: error.message 
    }, { status: 500 });
  }
}