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

type EstadoPago = 'Pagado' | 'Falta de Pago' | 'Retraso';

type AlumnoData = {
  nombre?: string;
  rfid?: string;
  diaPago?: number;
  estadoPago?: EstadoPago;
  fechaUltimoPago?: Timestamp | Date | string;
};

const TIME_ZONE = 'America/Merida';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/*
 * Ejemplo:
 * diaPago = 15
 *
 * Día 10: faltan 5 días  → verde
 * Día 11: faltan 4 días  → amarillo
 * Día 15: faltan 0 días  → amarillo
 * Día 16: vencido        → rojo
 */
const DIAS_AVISO_AMARILLO = 4;

type FechaLocal = {
  year: number;
  month: number; // 1 a 12
  day: number;
};

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

function fechaUTC(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function ultimoDiaDelMes(
  year: number,
  month: number
): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ajustarDiaDelMes(
  year: number,
  month: number,
  diaPago: number
): number {
  return Math.min(
    diaPago,
    ultimoDiaDelMes(year, month)
  );
}

function convertirFecha(
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

    return date;
  } catch {
    return null;
  }
}

/*
 * Cuando un alumno es marcado manualmente como Pagado,
 * su siguiente fecha de pago será el diaPago del mes
 * posterior a fechaUltimoPago.
 */
function calcularSiguienteVencimiento(
  fechaUltimoPago: Date,
  diaPago: number
): Date {
  const fechaPagoLocal = obtenerFechaLocal(
    fechaUltimoPago
  );

  let year = fechaPagoLocal.year;
  let month = fechaPagoLocal.month + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  const diaAjustado = ajustarDiaDelMes(
    year,
    month,
    diaPago
  );

  return fechaUTC(year, month, diaAjustado);
}

function diferenciaDias(
  fechaFinal: Date,
  fechaInicial: Date
): number {
  return Math.round(
    (fechaFinal.getTime() - fechaInicial.getTime()) /
      MS_POR_DIA
  );
}

function mensajeDiasPago(
  diasParaPago: number
): string {
  if (diasParaPago === 0) {
    return 'Pago hoy';
  }

  if (diasParaPago === 1) {
    return 'Pago manana';
  }

  if (diasParaPago > 1) {
    return `Pago en ${diasParaPago} dias`;
  }

  const vencidos = Math.abs(diasParaPago);

  if (vencidos === 1) {
    return 'Vencido hace 1 dia';
  }

  return `Vencido hace ${vencidos} dias`;
}

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
          mensaje: 'JSON inválido',
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

    const alumnoSnapshot =
      await getDocs(alumnoQuery);

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

    const alumnoRef = doc(
      db,
      'Alumnos',
      alumnoId
    );

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
          mensajePago: 'Dia de pago invalido',
          mensaje: 'El día de pago no es válido',
        },
        { status: 500 }
      );
    }

    const fechaLocal = obtenerFechaLocal();

    const hoy = fechaUTC(
      fechaLocal.year,
      fechaLocal.month,
      fechaLocal.day
    );

    const estadoPago: EstadoPago =
      alumno.estadoPago || 'Falta de Pago';

    let permitido = false;
    let estadoLed:
      | 'verde'
      | 'amarillo'
      | 'rojo' = 'rojo';

    let diasParaPago = 0;
    let mensajePago = '';

    /*
     * CASO 1: PAGADO
     *
     * Se usa fechaUltimoPago para saber hasta cuándo
     * está cubierto el siguiente periodo.
     */
    if (estadoPago === 'Pagado') {
      const fechaUltimoPago =
        convertirFecha(alumno.fechaUltimoPago);

      /*
       * Un estado Pagado debe tener fechaUltimoPago.
       * Esta fecha debe guardarse cuando tú cambies
       * manualmente el estado en el panel.
       */
      if (!fechaUltimoPago) {
        return NextResponse.json(
          {
            permitido: false,
            nombre,
            estadoLed: 'rojo',
            mensajePago: 'Pago sin fecha registrada',
            mensaje:
              'Vuelve a marcar al alumno como Pagado',
          },
          { status: 409 }
        );
      }

      const siguienteVencimiento =
        calcularSiguienteVencimiento(
          fechaUltimoPago,
          diaPago
        );

      diasParaPago = diferenciaDias(
        siguienteVencimiento,
        hoy
      );

      mensajePago =
        mensajeDiasPago(diasParaPago);

      if (diasParaPago < 0) {
        /*
         * Ya terminó el mes cubierto.
         * Único cambio automático permitido:
         * Pagado/Falta de Pago → Retraso.
         */
        await updateDoc(alumnoRef, {
          estadoPago: 'Retraso',
        });

        permitido = false;
        estadoLed = 'rojo';
      } else {
        /*
         * Si fue marcado como Pagado, permanece verde
         * durante todo el periodo cubierto.
         *
         * Incluso si faltan pocos días, tú pediste
         * que un pago manual dé verde.
         */
        permitido = true;
        estadoLed = 'verde';
      }
    }

    /*
     * CASO 2: RETRASO
     *
     * Siempre rojo hasta que tú lo marques como Pagado.
     */
    else if (estadoPago === 'Retraso') {
      permitido = false;
      estadoLed = 'rojo';

      /*
       * Para informar cuántos días lleva vencido,
       * usamos el vencimiento más reciente.
       */
      const diaAjustado = ajustarDiaDelMes(
        fechaLocal.year,
        fechaLocal.month,
        diaPago
      );

      let vencimiento = fechaUTC(
        fechaLocal.year,
        fechaLocal.month,
        diaAjustado
      );

      /*
       * Si todavía no llega el día de pago de este mes,
       * el retraso corresponde al mes anterior.
       */
      if (hoy.getTime() <= vencimiento.getTime()) {
        let previousMonth =
          fechaLocal.month - 1;
        let previousYear =
          fechaLocal.year;

        if (previousMonth < 1) {
          previousMonth = 12;
          previousYear -= 1;
        }

        const diaAnterior = ajustarDiaDelMes(
          previousYear,
          previousMonth,
          diaPago
        );

        vencimiento = fechaUTC(
          previousYear,
          previousMonth,
          diaAnterior
        );
      }

      diasParaPago = diferenciaDias(
        vencimiento,
        hoy
      );

      mensajePago =
        mensajeDiasPago(diasParaPago);
    }

    /*
     * CASO 3: FALTA DE PAGO / PENDIENTE
     *
     * Antes del vencimiento:
     * - faltan 5 días o más → verde
     * - faltan 0 a 4 días → amarillo
     *
     * Después del vencimiento:
     * - rojo
     * - cambia automáticamente a Retraso
     */
    else {
      const diaAjustado = ajustarDiaDelMes(
        fechaLocal.year,
        fechaLocal.month,
        diaPago
      );

      const vencimientoActual = fechaUTC(
        fechaLocal.year,
        fechaLocal.month,
        diaAjustado
      );

      diasParaPago = diferenciaDias(
        vencimientoActual,
        hoy
      );

      mensajePago =
        mensajeDiasPago(diasParaPago);

      if (diasParaPago < 0) {
        permitido = false;
        estadoLed = 'rojo';

        await updateDoc(alumnoRef, {
          estadoPago: 'Retraso',
        });
      } else if (
        diasParaPago <= DIAS_AVISO_AMARILLO
      ) {
        permitido = true;
        estadoLed = 'amarillo';
      } else {
        permitido = true;
        estadoLed = 'verde';
      }
    }

    if (!permitido) {
      return NextResponse.json({
        permitido: false,
        nombre,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje:
          estadoPago === 'Retraso'
            ? 'Acceso Denegado: Pago con retraso'
            : 'Acceso Denegado: Pago vencido',
      });
    }

    /*
     * Una asistencia por día.
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
