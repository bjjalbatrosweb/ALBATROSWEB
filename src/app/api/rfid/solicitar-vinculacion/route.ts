import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { alumnoId, dispositivo } = await req.json();

    if (!alumnoId || !dispositivo) {
      return NextResponse.json({ ok: false, mensaje: "alumnoId y dispositivo son obligatorios" }, { status: 400 });
    }

    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    
    // Limpieza: Cancelar cualquier vinculación pendiente previa para este dispositivo
    const q = query(vinculacionesRef, where('dispositivo', '==', dispositivo), where('estado', '==', 'pendiente'));
    const snapshot = await getDocs(q);
    const cancelPromises = snapshot.docs.map(d => updateDoc(doc(db, 'VinculacionesRFID', d.id), { estado: 'cancelada' }));
    await Promise.all(cancelPromises);

    // Crear nueva solicitud de vinculación (Punto 2 del flujo)
    const newDoc = await addDoc(vinculacionesRef, {
      alumnoId,
      dispositivo,
      estado: 'pendiente',
      creadoEn: serverTimestamp()
    });

    return NextResponse.json({ 
      ok: true, 
      vinculacionId: newDoc.id,
      mensaje: "Vinculación solicitada. El ESP32 detectará esto al pasar la tarjeta maestra."
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 });
  }
}
