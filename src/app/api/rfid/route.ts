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
  updateDoc,
  doc,
} from 'firebase/firestore';

type FechaLocal = {
  year: number;
  month: number;
  day: number;
};

type AlumnoData = {
  nombre?: string;
  rfid?: string;
  diaPago?: number;
  estadoPago?: string;
  vigenciaHasta?: Timestamp | Date | string;
  fechaUltimoPago?: Timestamp | Date | string;
};

const TIME_ZONE = 'America/Merida';

// Según tu ejemplo:
// diaPago 10 → amarillo del 6 al 10.
// El día 5 todavía es verde.
const DIAS_AVISO = 4;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Obtiene año, mes y día en horario de Mérida,
 * independientemente de la zona horaria del servidor.
 */
function obtenerFechaLocal(date = new Date()): FechaLocal {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

/**
 * Crea una fecha UTC sin hora, útil para comparar días completos.
 */
function crearFechaUTC(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Devuelve el último día disponible de un mes.
 */
function ultimoDiaDelMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Ajusta días 29, 30 o 31 cuando el siguiente mes no los tiene.
 */
function ajustarDiaPago(
  year: number,
  month: number,
  diaPago: number
): number {
  return Math.min(diaPago, ultimoDiaDelMes(year, month));
}

/**
 * Calcula el vencimiento correspondiente al próximo mes.
 *
 * Ejemplos:
 * - Paga el 5 de julio, diaPago 9 → vence 9 de agosto.
 * - Paga el 10 de julio, diaPago 9 → vence 9 de agosto.
 */
function calcularVigenciaSiguiente(
  fechaActual: FechaLocal,
  diaPago: number
): Date {
  let nextYear = fechaActual.year;
  let nextMonth = fechaActual.month + 1;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const diaAjustado = ajustarDiaPago(
    nextYear,
    nextMonth,
    diaPago
  );

  // Mediodía UTC para evitar desplazamientos accidentales de fecha.
  return new Date(
    Date.UTC(nextYear, nextMonth - 1, diaAjustado, 12, 0, 0)
  );
}

/**
 * Convierte Timestamp, Date o string a una fecha comparable sin hora.
 */
function convertirVigenciaAFecha(
  value: unknown
): Date | null {
  try {
    let date: Date;

    if (value instanceof Timestamp) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      return null;
    }

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return crearFechaUTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  } catch {
    return null;
  }
}

function calcularDiferenciaDias(
  fechaFinal: Date,
  fechaInicial: Date
): number {
  return Math.round(
    (fechaFinal.getTime() - fechaInicial.getTime()) /
      MS_POR_DIA
  );
}

function crearMensajePago(diasParaPago: number): string {
  if (diasParaPago === 0) {
    return 'Pago hoy';
  }

  if (diasParaPago === 1) {
    return 'Pago manana';
  }

  if (diasParaPago > 1) {
    return `Pago en ${diasParaPago} dias`;
  }

  const diasVencidos = Math.abs(diasParaPago);

  if (diasVencidos === 1) {
    return 'Vencido hace 1 dia';
  }

  return `Vencido hace ${diasVencidos} dias`;
}

/**
 * POST /api/rfid
 *
 * - Busca al alumno mediante el RFID.
 * - Usa vigenciaHasta como fecha real de vencimiento.
 * - Renueva la vigencia si se marcó manualmente como Pagado.
 * - Maneja el semáforo verde, amarillo y rojo.
 * - Registra máximo una asistencia diaria.
 */
export async function POST(req: Request) {
  try {
    let body: {
      rfid?: string;
      dispositivo?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          permitido: false,
          estadoLed: 'rojo',
          mensaje: 'Cuerpo de petición inválido',
        },
        { status: 400 }
      );
    }

    const { rfid, dispositivo } = body;

    if (!rfid) {
      return NextResponse.json(
        {
          permitido: false,
          estadoLed: 'rojo',
          mensaje: 'RFID no proporcionado',
        },
        { status: 400 }
      );
    }

    const rfidNormalizado = rfid
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

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
        estadoLed: 'rojo',
        rfid_recibido: rfidNormalizado,
        mensajePago: 'Tarjeta no registrada',
        mensaje: 'Tarjeta no registrada',
      });
    }

    const alumnoDoc = alumnoSnapshot.docs[0];
    const alumno = alumnoDoc.data() as AlumnoData;
    const alumnoId = alumnoDoc.id;
    const alumnoRef = doc(db, 'Alumnos', alumnoId);

    const nombre =
      typeof alumno.nombre === 'string' &&
      alumno.nombre.trim()
        ? alumno.nombre.trim()
        : 'Alumno';

    const diaPago = Number(alumno.diaPago);

    if (
      !Number.isInteger(diaPago) ||
      diaPago < 1 ||
      diaPago > 31
    ) {
      return NextResponse.json(
        {
          permitido: false,
          nombre,
          estadoLed: 'rojo',
          mensajePago: 'Fecha de pago invalida',
          mensaje:
            'El día de pago del alumno no es válido',
        },
        { status: 500 }
      );
    }

    const fechaLocal = obtenerFechaLocal();
    const hoy = crearFechaUTC(
      fechaLocal.year,
      fechaLocal.month,
      fechaLocal.day
    );

    let vigenciaHasta = convertirVigenciaAFecha(
      alumno.vigenciaHasta
    );

    /*
     * Si no hay vigencia o ya venció, pero el administrador
     * cambió estadoPago a "Pagado", se interpreta como un
     * pago nuevo y se genera la vigencia del siguiente mes.
     */
    const vigenciaNoExiste = !vigenciaHasta;
    const vigenciaYaVencio =
      vigenciaHasta !== null &&
      vigenciaHasta.getTime() < hoy.getTime();

    if (
      alumno.estadoPago === 'Pagado' &&
      (vigenciaNoExiste || vigenciaYaVencio)
    ) {
      const nuevaVigencia = calcularVigenciaSiguiente(
        fechaLocal,
        diaPago
      );

      await updateDoc(alumnoRef, {
        estadoPago: 'Pagado',
        fechaUltimoPago: serverTimestamp(),
        vigenciaHasta: Timestamp.fromDate(nuevaVigencia),
      });

      vigenciaHasta = crearFechaUTC(
        nuevaVigencia.getUTCFullYear(),
        nuevaVigencia.getUTCMonth() + 1,
        nuevaVigencia.getUTCDate()
      );
    }

    /*
     * Si nunca se ha registrado una vigencia y tampoco está
     * marcado como pagado, el acceso se deniega.
     */
    if (!vigenciaHasta) {
      return NextResponse.json({
        permitido: false,
        nombre,
        estadoLed: 'rojo',
        diasParaPago: null,
        mensajePago: 'Pago pendiente',
        mensaje: 'Acceso Denegado: Pago pendiente',
      });
    }

    const diasParaPago = calcularDiferenciaDias(
      vigenciaHasta,
      hoy
    );

    let permitido: boolean;
    let estadoLed: 'verde' | 'amarillo' | 'rojo';

    if (diasParaPago < 0) {
      permitido = false;
      estadoLed = 'rojo';

      if (alumno.estadoPago !== 'Falta de Pago') {
        await updateDoc(alumnoRef, {
          estadoPago: 'Falta de Pago',
        });
      }
    } else if (diasParaPago <= DIAS_AVISO) {
      permitido = true;
      estadoLed = 'amarillo';

      if (alumno.estadoPago !== 'Pagado') {
        await updateDoc(alumnoRef, {
          estadoPago: 'Pagado',
        });
      }
    } else {
      permitido = true;
      estadoLed = 'verde';

      if (alumno.estadoPago !== 'Pagado') {
        await updateDoc(alumnoRef, {
          estadoPago: 'Pagado',
        });
      }
    }

    const mensajePago =
      crearMensajePago(diasParaPago);

    if (!permitido) {
      return NextResponse.json({
        permitido: false,
        nombre,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje: 'Acceso Denegado: Pago vencido',
      });
    }

    /*
     * ASISTENCIA:
     * Se registra máximo una asistencia por alumno cada día.
     *
     * Se utilizan los componentes de fecha de Mérida para
     * evitar errores por zona horaria.
     */
    const startOfToday = new Date(
      Date.UTC(
        fechaLocal.year,
        fechaLocal.month - 1,
        fechaLocal.day,
        0,
        0,
        0,
        0
      )
    );

    const endOfToday = new Date(
      Date.UTC(
        fechaLocal.year,
        fechaLocal.month - 1,
        fechaLocal.day,
        23,
        59,
        59,
        999
      )
    );

    const asistenciasRef = collection(
      db,
      'Asistencias'
    );

    const asistenciaQuery = query(
      asistenciasRef,
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

    const asistenciaSnapshot =
      await getDocs(asistenciaQuery);

    let asistenciaRegistrada = false;

    if (asistenciaSnapshot.empty) {
      await addDoc(asistenciasRef, {
        alumnoId,
        nombre,
        rfid: rfidNormalizado,
        dispositivo: dispositivo || 'Recepcion',
        fecha: serverTimestamp(),
        acceso: 'permitido',
      });

      asistenciaRegistrada = true;
    }

    return NextResponse.json({
      permitido: true,
      nombre,
      estadoLed,
      diasParaPago,
      mensajePago,
      asistenciaRegistrada,
      mensaje: asistenciaRegistrada
        ? `Bienvenido ${nombre}. Asistencia registrada.`
        : `Bienvenido ${nombre}. Asistencia ya marcada hoy.`,
    });
  } catch (error: unknown) {
    const mensajeError =
      error instanceof Error
        ? error.message
        : 'Error desconocido';

    console.error('CRITICAL_API_ERROR:', error);

    return NextResponse.json(
      {
        permitido: false,
        estadoLed: 'rojo',
        mensaje: 'Error interno del servidor',
        error: mensajeError,
      },
      { status: 500 }
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
