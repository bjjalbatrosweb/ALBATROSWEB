import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

/**
 * GET /api/rfid/vinculacion-pendiente?dispositivo=Recepcion
 * Punto 5, 6 y 7 del flujo táctico.
 * El ESP32 consulta tras leer la tarjeta maestra.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dispositivo = searchParams.get('dispositivo');

    if (!dispositivo) {
      return NextResponse.json({ error: "Falta parámetro dispositivo" }, { status: 400 });
    }

    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    
    // Buscamos la última vinculación pendiente para este dispositivo
    // Solo consideramos solicitudes de los últimos 2 minutos para evitar falsos positivos
    const dosMinutosAtras = new Date(Date.now() - 120000);

    const q = query(
      vinculacionesRef, 
      where('dispositivo', '==', dispositivo), 
      where('estado', '==', 'pendiente'),
      orderBy('creadoEn', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Punto 6: No hay nada pendiente
      return NextResponse.json({ pendiente: false });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    // Punto 7: Hay una vinculación esperando
    return NextResponse.json({
      pendiente: true,
      vinculacionId: docSnap.id,
      alumnoId: data.alumnoId
    });

  } catch (error: any) {
    console.error('[API_PENDIENTE] Error:', error);
    return NextResponse.json({ error: "Error interno", mensaje: error.message }, { status: 500 });
  }
}
