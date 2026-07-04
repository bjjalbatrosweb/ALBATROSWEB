import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dispositivo = searchParams.get('dispositivo');

    if (!dispositivo) {
      return NextResponse.json({ error: "Falta parámetro dispositivo" }, { status: 400 });
    }

    // Buscar la vinculación más reciente en estado pendiente para este dispositivo
    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    const q = query(
      vinculacionesRef, 
      where('dispositivo', '==', dispositivo), 
      where('estado', '==', 'pendiente'),
      orderBy('creadoEn', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Punto 6: No hay vinculación pendiente
      return NextResponse.json({ pendiente: false });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    // Punto 7: Hay vinculación pendiente, el ESP32 entra en modo vinculación
    return NextResponse.json({
      pendiente: true,
      vinculacionId: docSnap.id,
      alumnoId: data.alumnoId
    });
  } catch (error: any) {
    console.error("Error en vinculacion-pendiente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
