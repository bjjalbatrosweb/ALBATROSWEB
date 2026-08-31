import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelOrDevice,
} from '@/lib/server-access';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@/lib/server-firestore';
import { isPaymentExempt, MEMBER_ROLE_LABELS, normalizeMemberRole } from '@/lib/member-role';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type EstadoLed = 'verde' | 'amarillo' | 'rojo';

export const runtime = 'nodejs';

const SEDES_VALIDAS: Sede[] = [
  'MMA',
  'CAUCEL',
  'JUAN_PABLO',
];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== 'string') throw new RequestAccessError('Sede requerida', 400);

  const sede = valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (!SEDES_VALIDAS.includes(sede as Sede)) {
    throw new RequestAccessError('Sede no válida', 400);
  }
  return sede as Sede;
}

function normalizarDispositivo(
  valor: unknown
): string {
  if (
    typeof valor !== 'string' ||
    !valor.trim()
  ) {
    return 'Recepcion';
  }

  const dispositivo = valor.trim();

  return dispositivo
    .toLowerCase()
    .startsWith('recepcion')
    ? 'Recepcion'
    : dispositivo;
}

function fechaMerida(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Merida',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function calendarioMerida(fecha = new Date()) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Merida', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((part) => part.type === type)?.value || '';
  return {
    day: Number(value('day')),
    period: `${value('year')}-${value('month')}`,
  };
}

function obtenerPeriodoFecha(
  valor: unknown
): string | null {
  try {
    const fecha =
      valor &&
      typeof valor === 'object' &&
      'toDate' in valor &&
      typeof (valor as { toDate?: unknown })
        .toDate === 'function'
        ? (
            valor as {
              toDate: () => Date;
            }
          ).toDate()
        : valor instanceof Date
          ? valor
          : typeof valor === 'string' ||
              typeof valor === 'number'
            ? new Date(valor)
            : null;

    if (
      !fecha ||
      Number.isNaN(fecha.getTime())
    ) {
      return null;
    }

    return `${fecha.getFullYear()}-${String(
      fecha.getMonth() + 1
    ).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

async function actualizarPantalla(datos: {
  alumnoId?: string;
  nombre?: string;
  sede: Sede;
  rfid?: string;
  permitido: boolean;
  estadoLed: EstadoLed;
  mensaje: string;
  mensajePago?: string;
  fotoUrl?: string;
}) {
  try {
    await setDoc(
      doc(db, 'Pantallas', datos.sede),
      {
        ...datos,
        fecha: serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  } catch (error) {
    /*
     * La pantalla es complementaria.
     * Si falla, no debe impedir el acceso ni la asistencia.
     */
    console.error(
      'ERROR_ACTUALIZAR_PANTALLA:',
      error
    );
  }
}

async function obtenerClaseActiva(sede: Sede) {
  const snapshot = await db.collection('ClasesActivas').doc(sede).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  const claseId = typeof data.claseId === 'string' ? data.claseId : '';
  if (!claseId) return null;
  return {
    claseId,
    disciplina: typeof data.disciplina === 'string' ? data.disciplina : '',
    tema: typeof data.tema === 'string' ? data.tema : '',
  };
}

async function obtenerControlTatami(sede: Sede) {
  const snapshot = await db.collection('ControlesAcceso').doc(sede).get();
  return snapshot.exists && snapshot.data()?.tatamiBloqueado === true;
}

async function registrarAsistenciaClase(datos: {
  claseId: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  dispositivo: string;
  rfid: string;
  disciplina: string;
  fecha: Date;
}) {
  const reference = db
    .collection('AsistenciasClase')
    .doc(`${datos.claseId}_${datos.alumnoId}`);

  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (current.exists) return false;
    transaction.create(reference, {
      ...datos,
      fecha: datos.fecha,
      metodo: 'RFID',
    });
    return true;
  });
}

export async function POST(req: Request) {
  try {
    let body: {
      rfid?: string;
      dispositivo?: string;
      sede?: string;
      deviceId?: string;
      fecha?: string;
      offline?: boolean;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          permitido: false,
          mensaje:
            'Cuerpo de petición inválido (JSON esperado)',
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
      deviceId,
    } = body;
    const sedeAutorizada = normalizarSede(sedeRecibida);

    await requirePanelOrDevice(req, sedeAutorizada);

    const sincronizacionOffline = body.offline === true && !deviceId;
    const fechaEvento = body.fecha ? new Date(body.fecha) : new Date();
    const diferenciaFecha = Date.now() - fechaEvento.getTime();
    if (
      Number.isNaN(fechaEvento.getTime()) ||
      diferenciaFecha < -5 * 60_000 ||
      diferenciaFecha > 7 * 24 * 60 * 60_000
    ) {
      return NextResponse.json(
        {
          permitido: false,
          mensaje: 'La lectura offline debe pertenecer a los últimos 7 días.',
        },
        { status: 400 },
      );
    }
    const actualizarPantallaSiCorresponde = async (
      datos: Parameters<typeof actualizarPantalla>[0]
    ) => {
      if (!sincronizacionOffline) await actualizarPantalla(datos);
    };

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

    const alumnosRef = collection(db, 'Alumnos');

/*
 * Primero buscamos dentro del arreglo nuevo "rfids".
 * Esto permite reconocer cualquier tarjeta adicional.
 */
const alumnoRfidsQuery = query(
  alumnosRef,
  where('rfids', 'array-contains', rfidNormalizado),
  limit(1)
);

let alumnoSnapshot = await getDocs(alumnoRfidsQuery);

/*
 * Compatibilidad con alumnos antiguos:
 * si no aparece en "rfids", buscamos en el campo viejo "rfid".
 */
if (alumnoSnapshot.empty) {
  const alumnoRfidAntiguoQuery = query(
    alumnosRef,
    where('rfid', '==', rfidNormalizado),
    limit(1)
  );

  alumnoSnapshot = await getDocs(alumnoRfidAntiguoQuery);
}

    if (alumnoSnapshot.empty) {
      const sede = sedeAutorizada;
      const mensaje = 'Tarjeta no registrada';

      await actualizarPantallaSiCorresponde({
        sede,
        rfid: rfidNormalizado,
        permitido: false,
        estadoLed: 'rojo',
        mensaje,
      });

      return NextResponse.json({
        permitido: false,
        rfid_recibido: rfidNormalizado,
        sede,
        estadoLed: 'rojo',
        mensaje,
      });
    }

    const alumnoDocumento =
      alumnoSnapshot.docs[0];

    const alumno = alumnoDocumento.data();
    const alumnoId = alumnoDocumento.id;

    const sedeAlumno = normalizarSede(alumno.sede || sedeRecibida);

    if (typeof deviceId === 'string' && deviceId.startsWith('ESP32-')) {
      /*
       * El heartbeat mantiene la identidad real de cada controlador en
       * DispositivosAcceso/{sede}. Esa colección es también la que usan el
       * panel, reinicio remoto y OTA; por tanto debe ser la única fuente de
       * verdad para validar a qué sede pertenece un ESP32.
       *
       * El código anterior consultaba DispositivosRegistrados/{deviceId}, una
       * colección que el heartbeat no crea ni actualiza. Eso podía rechazar
       * tarjetas válidas aun cuando el ESP32 apareciera conectado en el panel.
       */
      // En este punto ya conocemos la sede del alumno. Consultar únicamente
      // ese documento evita hacer tres lecturas Firestore por cada tarjeta.
      const registroDispositivo = await db
        .collection('DispositivosAcceso')
        .doc(sedeAlumno)
        .get();

      if (!registroDispositivo.exists) {
        return NextResponse.json({
          permitido: false,
          abrirPuerta: false,
          estadoLed: 'rojo',
          mensaje: 'Dispositivo sin registro de sedes. Espere el próximo heartbeat.',
        }, { status: 409 });
      }

      if (registroDispositivo.data()?.deviceId !== deviceId) {
        return NextResponse.json({
          permitido: false,
          abrirPuerta: false,
          nombre: alumno.nombre,
          sede: sedeAlumno,
          estadoLed: 'rojo',
          mensaje: 'Acceso denegado: este dispositivo no pertenece a la sede del alumno.',
        }, { status: 403 });
      }
    }

    const fotoUrl =
      typeof alumno.fotoUrl === 'string'
        ? alumno.fotoUrl
        : typeof alumno.foto === 'string'
          ? alumno.foto
          : typeof alumno.imagenUrl === 'string'
            ? alumno.imagenUrl
            : '';

    if (alumno.activo === false) {
      const mensaje =
        'Acceso denegado: alumno con baja temporal.';

      await actualizarPantallaSiCorresponde({
        alumnoId,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        rfid: rfidNormalizado,
        permitido: false,
        estadoLed: 'rojo',
        mensaje,
        mensajePago: 'Alumno inactivo',
        fotoUrl,
      });

      return NextResponse.json(
        {
          permitido: false,
          nombre: alumno.nombre,
          sede: sedeAlumno,
          estadoLed: 'rojo',
          mensajePago: 'Alumno inactivo',
          mensaje,
        },
        {
          status: 403,
        }
      );
    }

    if (
      sedeRecibida &&
      !deviceId &&
      normalizarSede(sedeRecibida) !==
        sedeAlumno
    ) {
      const mensaje =
        'Acceso denegado: el alumno pertenece a otra sede.';

      await actualizarPantallaSiCorresponde({
        alumnoId,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        rfid: rfidNormalizado,
        permitido: false,
        estadoLed: 'rojo',
        mensaje,
        fotoUrl,
      });

      return NextResponse.json(
        {
          permitido: false,
          nombre: alumno.nombre,
          sede: sedeAlumno,
          estadoLed: 'rojo',
          mensaje,
        },
        {
          status: 403,
        }
      );
    }

    const now = fechaEvento;
    const merida = calendarioMerida(now);
    const todayDay = merida.day;
    const periodoActual = merida.period;
    const diaPago =
      Number(alumno.diaPago) || 1;
    const rol = normalizeMemberRole(alumno.rol);
    const exentoPago = isPaymentExempt(rol);

    let estadoLed: EstadoLed = 'verde';
    let permitido = true;
    let mensajePago = '';

    const diasParaPago =
      diaPago - todayDay;

    const periodoFechaUltimoPago =
      obtenerPeriodoFecha(
        alumno.fechaUltimoPago
      );
    const pagoAntiguoSinPeriodo =
      alumno.estadoPago === 'Pagado' &&
      !alumno.periodoUltimoPago &&
      !periodoFechaUltimoPago;
    const pagoVigente =
      alumno.estadoPago === 'Pagado' &&
      (
        alumno.periodoUltimoPago ===
          periodoActual ||
        periodoFechaUltimoPago ===
          periodoActual ||
        pagoAntiguoSinPeriodo
      );

    if (exentoPago) {
      estadoLed = 'verde';
      permitido = true;
      mensajePago = `${MEMBER_ROLE_LABELS[rol]} · acceso exento`;
    } else if (pagoVigente) {
      estadoLed = 'verde';
      permitido = true;
      mensajePago = 'Pago al corriente';
    } else if (todayDay > diaPago) {
      estadoLed = 'rojo';
      permitido = false;
      mensajePago = 'Pago vencido';
    } else if (
      todayDay >= diaPago - 4
    ) {
      estadoLed = 'amarillo';
      permitido = true;

      if (diasParaPago === 0) {
        mensajePago = 'Pago hoy';
      } else if (diasParaPago === 1) {
        mensajePago = 'Pago mañana';
      } else {
        mensajePago =
          `Pago en ${diasParaPago} días`;
      }
    } else {
      estadoLed = 'verde';
      permitido = true;
      mensajePago =
        `Pago en ${diasParaPago} días`;
    }

    if (!permitido) {
      const mensaje =
        `Acceso denegado: ${mensajePago}`;

      await actualizarPantallaSiCorresponde({
        alumnoId,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        rfid: rfidNormalizado,
        permitido: false,
        estadoLed,
        mensaje,
        mensajePago,
        fotoUrl,
      });

      return NextResponse.json({
        permitido: false,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje,
      });
    }

    const dia = fechaMerida(now);
    const [claseActiva, tatamiBloqueado] = await Promise.all([
      sincronizacionOffline ? Promise.resolve(null) : obtenerClaseActiva(sedeAlumno),
      obtenerControlTatami(sedeAlumno),
    ]);
    const sedeConPuerta = sedeAlumno === 'MMA' || sedeAlumno === 'CAUCEL';
    const abrirPuerta =
      sedeConPuerta && !sincronizacionOffline && !tatamiBloqueado;
    const asistenciaId =
      `${alumnoId}_${dia.replaceAll('-', '')}`;
    const asistenciaRef = db
      .collection('Asistencias')
      .doc(asistenciaId);

    /*
     * Detecta registros antiguos con ID automático. Los registros nuevos de
     * NFC, RFID y recepción comparten el mismo ID diario, por lo que una
     * transacción impide duplicados incluso si dos dispositivos leen a la vez.
     */
    const creada = await db.runTransaction(async (transaction) => {
          const existente = await transaction.get(asistenciaRef);
          if (existente.exists) return false;

          transaction.create(asistenciaRef, {
            alumnoId,
            nombre: alumno.nombre,
            rfid: rfidNormalizado,
            sede: sedeAlumno,
            dispositivo: normalizarDispositivo(dispositivo),
            fecha: fechaEvento,
            acceso: 'permitido',
            registroOffline: sincronizacionOffline,
          });
          return true;
        });

    if (claseActiva) {
      await registrarAsistenciaClase({
        claseId: claseActiva.claseId,
        alumnoId,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        dispositivo: normalizarDispositivo(dispositivo),
        rfid: rfidNormalizado,
        disciplina: claseActiva.disciplina,
        fecha: fechaEvento,
      });
    }

    if (creada) {

      const mensaje = tatamiBloqueado
        ? `Asistencia registrada. Acceso al tatami bloqueado.`
        : `Bienvenido ${alumno.nombre}. Asistencia registrada.`;

      await actualizarPantallaSiCorresponde({
        alumnoId,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        rfid: rfidNormalizado,
        permitido: true,
        estadoLed,
        mensaje,
        mensajePago,
        fotoUrl,
      });

      return NextResponse.json({
        permitido: true,
        nombre: alumno.nombre,
        sede: sedeAlumno,
        estadoLed,
        diasParaPago,
        mensajePago,
        mensaje,
        abrirPuerta,
        tatamiBloqueado,
        claseActivaId: claseActiva?.claseId || null,
        registroOffline: sincronizacionOffline,
      });
    }

    const mensaje = tatamiBloqueado
      ? `Asistencia de clase registrada. Acceso al tatami bloqueado.`
      : `Bienvenido ${alumno.nombre}. Asistencia ya marcada hoy.`;

    await actualizarPantallaSiCorresponde({
      alumnoId,
      nombre: alumno.nombre,
      sede: sedeAlumno,
      rfid: rfidNormalizado,
      permitido: true,
      estadoLed,
      mensaje,
      mensajePago,
      fotoUrl,
    });

    return NextResponse.json({
      permitido: true,
      nombre: alumno.nombre,
      sede: sedeAlumno,
      estadoLed,
      diasParaPago,
      mensajePago,
      mensaje,
      abrirPuerta,
      tatamiBloqueado,
      claseActivaId: claseActiva?.claseId || null,
      registroOffline: sincronizacionOffline,
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        {
          permitido: false,
          estadoLed: 'rojo',
          mensaje: error.message,
        },
        { status: error.status },
      );
    }

    console.error(
      'CRITICAL_API_ERROR:',
      error
    );

    return NextResponse.json(
      {
        permitido: false,
        mensaje: 'Error interno del servidor',
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
      'Access-Control-Allow-Origin':
        '*',
      'Access-Control-Allow-Methods':
        'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Device-Key, X-Device-Group',
    },
  });
}
