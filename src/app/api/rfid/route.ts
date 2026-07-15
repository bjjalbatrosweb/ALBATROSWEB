import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== 'string') return 'MMA';
  const sede = valor.trim().toUpperCase().replace(/\s+/g, '_');
  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : 'MMA';
}

function normalizarDispositivo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) return 'Recepcion';
  const dispositivo = valor.trim();
  return dispositivo.toLowerCase().startsWith('recepcion')
    ? 'Recepcion'
    : dispositivo;
}

export async function POST(req: Request) {
  try {
    let body: { rfid?: string; dispositivo?: string; sede?: string };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { permitido: false, mensaje: 'Cuerpo de petición inválido (JSON esperado)' },
        { status: 400 }
      );
    }

    const { rfid, dispositivo, sede: sedeRecibida } = body;

    if (!rfid) {
      return NextResponse.json(
        { permitido: false, mensaje: 'RFID no proporcionado' },
        { status: 400 }
      );
    }

    const rfidNormalizado = rfid
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    if (!rfidNormalizado) {
      return NextResponse.json(
        { permitido: false, mensaje: 'RFID inválido' },
        { status: 400 }
      );
    }

    const alumnoQuery = query(
      collection(db, 'Alumnos'),
      where('rfid', '==', rfidNormalizado),
      limit(1)
    );

    const alumnoSnapshot = await getDocs(alumnoQuery);

    if (alumnoSnapshot.empty) {
      return NextResponse.json({
        permitido: false,
        rfid_recibido: rfidNormalizado,
        mensaje: 'Tarjeta no registrada',
      });
    }

    const alumnoDocumento = alumnoSnapshot.docs[0];
    const alumno = alumnoDocumento.data();
    const alumnoId = alumnoDocumento.id;
    const sedeAlumno = normalizarSede(alumno.sede || sedeRecibida || 'MMA');

    if (sedeRecibida && normalizarSede(sedeRecibida) !== sedeAlumno) {
      return NextResponse.json(
        {
          permitido: false,
          nombre: alumno.nombre,
          sede: sedeAlumno,
          estadoLed: 'rojo',
          mensaje: 'Acceso denegado: el alumno pertenece a otra sede.',
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const todayDay = now.getDate();
    const diaPago = Number(alumno.diaPago) || 1;
    
    let estadoLed: 'verde' | 'amarillo' | 'rojo' = 'verde';
    let permitido = true;
    let mensajePago = '';
    
    const diasParaPago = diaPago - todayDay;
    
    if (alumno.estadoPago === 'Pagado') {
      estadoLed = 'verde';
      permitido = true;
      mensajePago = 'Pago al corriente';
    } else if (todayDay > diaPago) {
      estadoLed = 'rojo';
      permitido = false;
      mensajePago = 'Pago vencido';
    } else if (todayDay >= diaPago - 4) {
      estadoLed = 'amarillo';
      permitido = true;
    
      if (diasParaPago === 0) {
        mensajePago = 'Pago hoy';
      } else if (diasParaPago === 1) {
        mensajePago = 'Pago mañana';
      } else {
        mensajePago = `Pago en ${diasParaPago} días`;
      }
    } else {
      estadoLed = 'verde';
      permitido = true;
      mensajePago = `Pago en ${diasParaPago} días`;
    }
    
    if (!permitido) {
      return NextResponse.json({
        permitido: false,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje: `Acceso denegado: ${mensajePago}`,
      });
    }

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );

    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );

    const asistenciasRef = collection(db, 'Asistencias');
    const attendanceQuery = query(
      asistenciasRef,
      where('sede', '==', sedeAlumno),
      where('alumnoId', '==', alumnoId),
      where('fecha', '>=', Timestamp.fromDate(startOfToday)),
      where('fecha', '<=', Timestamp.fromDate(endOfToday)),
      limit(1)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);

    if (attendanceSnapshot.empty) {
      await addDoc(asistenciasRef, {
        alumnoId,
        nombre: alumno.nombre,
        rfid: rfidNormalizado,
        sede: sedeAlumno,
        dispositivo: normalizarDispositivo(dispositivo),
        fecha: serverTimestamp(),
        acceso: 'permitido',
      });

      return NextResponse.json({
        permitido: true,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje: `Bienvenido ${alumno.nombre}. Asistencia registrada.`,
      });
    }

    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      sede: sedeAlumno,
      estadoLed,
      diasParaPago,
      mensajePago,
      mensaje: `Bienvenido ${alumno.nombre}. Asistencia ya marcada hoy.`,
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('CRITICAL_API_ERROR:', error);

    return NextResponse.json(
      { permitido: false, mensaje: 'Error interno del servidor', error: mensaje },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
