
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';

/**
 * GET /api/rfid/vinculacion-pendiente?dispositivo=Recepcion
 * Endpoint para que el ESP32 consulte si hay algo que vincular.
 * Ahora solo devuelve registros creados en el último minuto.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dispositivo = searchParams.get('dispositivo');

    if (!dispositivo) {
      return NextResponse.json({ error: "Falta parámetro dispositivo" }, { status: 400 });
    }

    // Calculamos el tiempo de corte (hace 1 minuto)
    const unMinutoAtras = new Date(Date.now() - 60 * 1000);
    const timestampCorte = Timestamp.fromDate(unMinutoAtras);

    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    const q = query(
      vinculacionesRef, 
      where('dispositivo', '==', dispositivo), 
      where('estado', '==', 'pendiente'),
      where('creadoEn', '>=', timestampCorte),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ pendiente: false });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    return NextResponse.json({
      pendiente: true,
      vinculacionId: docSnap.id,
      alumnoId: data.alumnoId
    });

  } catch (error: any) {
    console.error('VINCULACION_PENDIENTE_ERROR:', error);
    return NextResponse.json({ error: "Error interno", mensaje: error.message }, { status: 500 });
  }
}
