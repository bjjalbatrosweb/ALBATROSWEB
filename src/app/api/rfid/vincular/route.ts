import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { vinculacionId, rfid } = await req.json();

    if (!vinculacionId || !rfid) {
      return NextResponse.json({ ok: false, mensaje: "Datos incompletos" }, { status: 400 });
    }

    // 1. Normalización
    const rfidNormalizado = rfid.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Verificar duplicados
    const alumnosRef = collection(db, 'Alumnos');
    const qRfid = query(alumnosRef, where('rfid', '==', rfidNormalizado), limit(1));
    const rfidSnapshot = await getDocs(qRfid);

    if (!rfidSnapshot.empty) {
      return NextResponse.json({ ok: false, mensaje: "Tarjeta ya registrada" });
    }

    // 3. Buscar vinculación
    const vincRef = doc(db, 'VinculacionesRFID', vinculacionId);
    const vincSnap = await getDoc(vincRef);

    if (!vincSnap.exists() || vincSnap.data().estado !== 'pendiente') {
      return NextResponse.json({ ok: false, mensaje: "Vinculación inválida" });
    }

    const { alumnoId } = vincSnap.data();

    // 4. Actualizaciones (Punto 10)
    await updateDoc(doc(db, 'Alumnos', alumnoId), { rfid: rfidNormalizado });
    await updateDoc(vincRef, {
      estado: "completada",
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp()
    });

    return NextResponse.json({ ok: true, mensaje: "Tarjeta vinculada" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 });
  }
}
