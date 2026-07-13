import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';

const SEDES_VALIDAS: Sede[] = [
  'MMA',
  'CAUCEL',
  'JUAN_PABLO',
];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== 'string') {
    return 'MMA';
  }

  const sedeNormalizada = valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (SEDES_VALIDAS.includes(sedeNormalizada as Sede)) {
    return sedeNormalizada as Sede;
  }

  // Compatibilidad con registros antiguos.
  return 'MMA';
}

/**
 * Endpoint POST /api/rfid
 *
 * Maneja:
 * - Lectura RFID.
 * - Semáforo de pago.
 * - Registro de asistencia.
 * - Separación de datos por sede.
 */
export async function POST(req: Request) {
  try {
    let body: {
      rfid?: string;
      dispositivo?: string;
      sede?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          permitido: false,
          mensaje: 'Cuerpo de petición inválido (JSON esperado)',
        },
        {
          status: 400,
        }
      );
    }

    const {
      rfid,
      dispositivo,
      sede: sedeRecibida,
    } = body;

    if (!rfid) {
      return NextResponse.json(
        {
          permitido: false,
          mensaje: 'RFID no proporcionado',
        },
        {
          status: 400,
        }
      );
    }

    // Normalización del UID RFID.
    const rfidNormalizado = rfid
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    if (!rfidNormalizado) {
      return NextResponse.json(
        {
          permitido: false,
          mensaje: 'RFID inválido',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Busca al alumno mediante el RFID.
     *
     * La sede definitiva se obtiene del documento del alumno,
     * no únicamente de lo enviado por el ESP32.
     */
    const alumnosRef = collection(db, 'Alumnos');

    const alumnoQuery = query(
      alumnosRef,
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

    /*
     * Prioridad para determinar la sede:
     *
     * 1. Sede guardada en el alumno.
     * 2. Sede enviada por el dispositivo.
     * 3. MMA como compatibilidad con registros antiguos.
     */
    const sedeAlumno = normalizarSede(
      alumno.sede || sedeRecibida || 'MMA'
    );

    /*
     * Protección opcional:
     * si el dispositivo envía una sede, comprobamos que corresponda
     * con la sede guardada en el alumno.
     */
    if (sedeRecibida) {
      const sedeDispositivo = normalizarSede(sedeRecibida);

      if (sedeDispositivo !== sedeAlumno) {
        return NextResponse.json(
          {
            permitido: false,
            nombre: alumno.nombre,
            estadoLed: 'rojo',
            sede: sedeAlumno,
            mensaje:
              'Acceso denegado: el alumno pertenece a otra sede.',
          },
          {
            status: 403,
          }
        );
      }
    }

    // ---------------------------------------------------------
    // LÓGICA DEL SEMÁFORO DE PAGO
    // ---------------------------------------------------------

    const today = new Date().getDate();
    const diaPago = Number(alumno.diaPago) || 1;

    let estadoLed = 'verde';
    let permitido = true;
    let mensajePago = '';
    const diasParaPago = diaPago - today;

    /*
     * Se conserva tu lógica actual:
     *
     * - Después del día de pago: rojo y acceso denegado.
     * - Durante los cuatro días anteriores y el día de pago:
     *   amarillo.
     * - Antes de ese periodo: verde.
     */

    if (today > diaPago) {
      estadoLed = 'rojo';
      permitido = false;
      mensajePago = 'Pago vencido';

      if (alumno.estadoPago !== 'Falta de Pago') {
        await updateDoc(
          doc(db, 'Alumnos', alumnoId),
          {
            estadoPago: 'Falta de Pago',
          }
        );
      }
    } else if (today >= diaPago - 4) {
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

    /*
     * Si está rojo, se niega el acceso y no se registra asistencia.
     */
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

    // ---------------------------------------------------------
    // ASISTENCIA: UN REGISTRO POR ALUMNO, POR DÍA Y POR SEDE
    // ---------------------------------------------------------

    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const asistenciasRef = collection(db, 'Asistencias');

    const attendanceQuery = query(
      asistenciasRef,

      // Evita mezclar asistencias de distintas sedes.
      where('sede', '==', sedeAlumno),

      where('alumnoId', '==', alumnoId),

      where(
        'fecha',
        '>=',
        Timestamp.fromDate(startOfToday)
      ),

      where(
        'fecha',
        '<=',
        Timestamp.fromDate(endOfToday)
      ),

      limit(1)
    );

    const attendanceSnapshot = await getDocs(
      attendanceQuery
    );

    if (attendanceSnapshot.empty) {
      await addDoc(asistenciasRef, {
        alumnoId,
        nombre: alumno.nombre,
        rfid: rfidNormalizado,

        // Este campo es indispensable para las nuevas reglas.
        sede: sedeAlumno,

        dispositivo:
          dispositivo || `Recepcion_${sedeAlumno}`,

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
        mensaje:
          `Bienvenido ${alumno.nombre}. ` +
          'Asistencia registrada.',
      });
    }

    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      sede: sedeAlumno,
      estadoLed,
      diasParaPago,
      mensajePago,
      mensaje:
        `Bienvenido ${alumno.nombre}. ` +
        'Asistencia ya marcada hoy.',
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error desconocido';

    console.error(
      'CRITICAL_API_ERROR:',
      error
    );

    return NextResponse.json(
      {
        permitido: false,
        mensaje: 'Error interno del servidor',
        error: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':
        'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type',
    },
  });
}
