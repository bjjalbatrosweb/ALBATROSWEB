
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * POST /api/rfid/solicitar-vinculacion
 * Inicia el proceso de vinculación para un alumno.
 * Optimizado para ignorar errores de limpieza y asegurar la creación del registro.
 */
export async function POST(req: Request) {
  try {
    const { alumnoId, dispositivo } = await req.json();

    if (!alumnoId || !dispositivo) {
      return NextResponse.json({ ok: false, mensaje: "alumnoId y dispositivo son obligatorios" }, { status: 400 });
    }

    console.log(`[VINCULACIÓN] Iniciando para alumno: ${alumnoId} en dispositivo: ${dispositivo}`);

    // 1. Limpieza de vinculaciones pendientes anteriores (Silenciosa)
    try {
      const vinculacionesRef = collection(db, 'VinculacionesRFID');
      const q = query(
        vinculacionesRef, 
        where('dispositivo', '==', dispositivo), 
        where('estado', '==', 'pendiente')
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const updatePromises = snapshot.docs.map(docSnap => 
          updateDoc(doc(db, 'VinculacionesRFID', docSnap.id), {
            estado: 'cancelada',
            canceladaEn: serverTimestamp()
          })
        );
        await Promise.all(updatePromises);
        console.log(`[VINCULACIÓN] Se cancelaron ${snapshot.size} solicitudes anteriores.`);
      }
    } catch (cleanupError: any) {
      // Si falla la limpieza (ej. por índices no creados aún), no detenemos el flujo principal
      console.warn('[VINCULACIÓN] Advertencia en limpieza previa:', cleanupError.message);
    }

    // 2. Crear nueva vinculación pendiente
    const vinculacionesRef = collection(db, 'VinculacionesRFID');
    const newDoc = await addDoc(vinculacionesRef, {
      alumnoId,
      dispositivo,
      estado: 'pendiente',
      creadoEn: serverTimestamp(),
      rfidAsignado: null
    });

    console.log(`[VINCULACIÓN] Nueva solicitud creada con ID: ${newDoc.id}`);

    return NextResponse.json({ 
      ok: true, 
      vinculacionId: newDoc.id,
      mensaje: "Protocolo de vinculación iniciado correctamente."
    });

  } catch (error: any) {
    console.error('[VINCULACIÓN] ERROR CRÍTICO:', error);
    return NextResponse.json({ 
      ok: false, 
      mensaje: "Error de permisos o comunicación con Firestore.",
      error: error.message 
    }, { status: 500 });
  }
}
