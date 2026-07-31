'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  Smartphone,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/firebase';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type EstadoLed = 'verde' | 'amarillo' | 'rojo';
type EstadoLector =
  | 'inactivo'
  | 'iniciando'
  | 'escaneando'
  | 'procesando'
  | 'error';

type RespuestaRfid = {
  ok?: boolean;
  permitido?: boolean;
  nombre?: string;
  sede?: Sede;
  estadoLed?: EstadoLed;
  mensaje?: string;
  mensajePago?: string;
  rfid_recibido?: string;
  rfid?: string;
};

type EventoLecturaNfc = Event & {
  serialNumber?: string;
};

type LectorNfc = EventTarget & {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
};

type ConstructorNfc = new () => LectorNfc;

const SEDES_VALIDAS: Sede[] = [
  'MMA',
  'CAUCEL',
  'JUAN_PABLO',
];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== 'string') return 'MMA';

  const sede = valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  return SEDES_VALIDAS.includes(sede as Sede)
    ? (sede as Sede)
    : 'MMA';
}

function normalizarUid(valor: unknown): string {
  return String(valor || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function mensajeErrorNfc(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'No fue posible iniciar el lector NFC.';
  }

  switch (error.name) {
    case 'NotAllowedError':
      return 'Permiso NFC rechazado. Recarga la página y permite el acceso.';
    case 'NotSupportedError':
      return 'Este teléfono o navegador no admite Web NFC.';
    case 'NotReadableError':
      return 'El NFC está ocupado o apagado. Actívalo e inténtalo otra vez.';
    case 'AbortError':
      return 'La lectura NFC fue detenida.';
    default:
      return error.message || 'No fue posible iniciar el lector NFC.';
  }
}

export default function AsistenciaNfcPage() {
  const router = useRouter();
  const auth = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const limpiarResultadoTimerRef = useRef<number | null>(null);
  const ultimaLecturaRef = useRef<{
    uid: string;
    momento: number;
  } | null>(null);

  const [sede, setSede] = useState<Sede | null>(null);
  const [estado, setEstado] =
    useState<EstadoLector>('inactivo');
  const [compatible, setCompatible] =
    useState<boolean | null>(null);
  const [resultado, setResultado] =
    useState<RespuestaRfid | null>(null);
  const [ultimoUid, setUltimoUid] = useState('');
  const [error, setError] = useState('');
  const [vinculacionId, setVinculacionId] = useState('');
  const [alumnoVinculacion, setAlumnoVinculacion] =
    useState('');

  const cerrarSesionInvalida = async (mensaje?: string) => {
    abortControllerRef.current?.abort();
    localStorage.removeItem('userSede');
    localStorage.removeItem('userRole');
    setEstado('error');
    setResultado(null);
    setError(
      mensaje ||
        'La cuenta activa ya no pertenece al panel. Inicia sesión nuevamente como profesor o administrador.'
    );

    try {
      await signOut(auth);
    } finally {
      window.setTimeout(() => {
        router.replace('/login-profesor');
      }, 1400);
    }
  };

  useEffect(() => {
    const sedeGuardada = localStorage.getItem('userSede');

    if (!sedeGuardada) {
      router.push('/login-profesor');
      return;
    }

    setSede(normalizarSede(sedeGuardada));
    const parametros = new URLSearchParams(
      window.location.search
    );
    setVinculacionId(
      parametros.get('vinculacionId') || ''
    );
    setAlumnoVinculacion(
      parametros.get('alumno') || ''
    );
    setCompatible(
      'NDEFReader' in window && window.isSecureContext
    );

    return () => {
      abortControllerRef.current?.abort();
      if (limpiarResultadoTimerRef.current) {
        window.clearTimeout(limpiarResultadoTimerRef.current);
      }
    };
  }, [router]);

  useEffect(() => {
    if (!resultado && !error) return;

    if (limpiarResultadoTimerRef.current) {
      window.clearTimeout(limpiarResultadoTimerRef.current);
    }

    limpiarResultadoTimerRef.current = window.setTimeout(() => {
      setResultado(null);
      setUltimoUid('');
      setError('');
      limpiarResultadoTimerRef.current = null;
    }, 3000);

    return () => {
      if (limpiarResultadoTimerRef.current) {
        window.clearTimeout(limpiarResultadoTimerRef.current);
        limpiarResultadoTimerRef.current = null;
      }
    };
  }, [error, resultado]);

  const registrarAsistencia = async (uid: string) => {
    if (!sede) return;

    setEstado('procesando');
    setError('');
    setResultado(null);
    setUltimoUid(uid);

    try {
      /*
       * Se fuerza la renovación para evitar reutilizar en Android/PWA un token
       * anterior después de haber iniciado o creado la cuenta de un atleta.
       */
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicia sesión de nuevo.');

      const response = await fetch('/api/rfid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rfid: uid,
          sede,
          dispositivo: 'Recepcion',
        }),
      });

      const datos =
        (await response.json()) as RespuestaRfid;

      if (
        response.status === 401 ||
        (response.status === 403 &&
          datos.mensaje === 'Cuenta sin permisos administrativos')
      ) {
        await cerrarSesionInvalida(
          response.status === 401
            ? 'La sesión del panel cambió o expiró. Vuelve a entrar con la cuenta del profesor.'
            : 'La cuenta activa es de un atleta y no puede tomar asistencia. Entra con la cuenta del profesor.'
        );
        return;
      }

      setResultado({
        ...datos,
        estadoLed:
          datos.estadoLed ||
          (datos.permitido ? 'verde' : 'rojo'),
      });

      if (!response.ok && !datos.mensaje) {
        throw new Error(
          'No se pudo consultar la tarjeta.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con el servidor.'
      );
    } finally {
      setEstado('escaneando');
    }
  };

  const vincularTarjeta = async (uid: string) => {
    if (!sede || !vinculacionId) return;

    setEstado('procesando');
    setError('');
    setResultado(null);
    setUltimoUid(uid);

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicia sesión de nuevo.');

      const response = await fetch('/api/rfid/vincular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vinculacionId,
          rfid: uid,
          sede,
          dispositivo: 'Recepcion',
        }),
      });

      const datos =
        (await response.json()) as RespuestaRfid;

      if (
        response.status === 401 ||
        (response.status === 403 &&
          datos.mensaje === 'Cuenta sin permisos administrativos')
      ) {
        await cerrarSesionInvalida(
          response.status === 401
            ? 'La sesión del panel cambió o expiró. Vuelve a entrar con la cuenta del profesor.'
            : 'La cuenta activa es de un atleta y no puede vincular tarjetas. Entra con la cuenta del profesor.'
        );
        return;
      }

      if (!response.ok || !datos.ok) {
        setResultado({
          ...datos,
          permitido: false,
          estadoLed: 'rojo',
        });
        return;
      }

      abortControllerRef.current?.abort();
      setResultado({
        ...datos,
        permitido: true,
        nombre: alumnoVinculacion,
        estadoLed: 'verde',
        mensaje:
          datos.mensaje ||
          'Tarjeta vinculada correctamente',
      });
      setVinculacionId('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con el servidor.'
      );
    } finally {
      setEstado('inactivo');
    }
  };

  const iniciarLector = async () => {
    setError('');
    setResultado(null);

    if (!window.isSecureContext) {
      setEstado('error');
      setError(
        'El lector NFC necesita abrirse desde la dirección HTTPS de tu página.'
      );
      return;
    }

    const NDEFReader = (
      window as Window & {
        NDEFReader?: ConstructorNfc;
      }
    ).NDEFReader;

    if (!NDEFReader) {
      setCompatible(false);
      setEstado('error');
      setError(
        'Web NFC no está disponible. Abre esta página en Chrome para Android y activa el NFC.'
      );
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setEstado('iniciando');

    try {
      const lector = new NDEFReader();

      lector.addEventListener(
        'readingerror',
        () => {
          setError(
            'No se pudo leer la tarjeta. Mantenla junto al teléfono e inténtalo otra vez.'
          );
          setEstado('escaneando');
        }
      );

      lector.addEventListener(
        'reading',
        (event: Event) => {
          const uid = normalizarUid(
            (event as EventoLecturaNfc).serialNumber
          );

          if (!uid) {
            setError(
              'El teléfono detectó la tarjeta, pero no entregó su UID. Prueba con una tag NDEF compatible.'
            );
            return;
          }

          const ahora = Date.now();
          const ultima = ultimaLecturaRef.current;

          if (
            ultima?.uid === uid &&
            ahora - ultima.momento < 3200
          ) {
            return;
          }

          ultimaLecturaRef.current = {
            uid,
            momento: ahora,
          };
          if (vinculacionId) {
            void vincularTarjeta(uid);
          } else {
            void registrarAsistencia(uid);
          }
        }
      );

      await lector.scan({
        signal: controller.signal,
      });

      setCompatible(true);
      setEstado('escaneando');
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === 'AbortError'
      ) {
        return;
      }

      setEstado('error');
      setError(mensajeErrorNfc(err));
    }
  };

  const reiniciarResultado = () => {
    if (limpiarResultadoTimerRef.current) {
      window.clearTimeout(limpiarResultadoTimerRef.current);
      limpiarResultadoTimerRef.current = null;
    }
    setResultado(null);
    setUltimoUid('');
    setError('');
  };

  const configuracionResultado =
    resultado?.estadoLed === 'verde'
      ? {
          titulo: 'ACCESO AUTORIZADO',
          etiqueta: 'BIENVENIDO',
          borde: 'border-emerald-500/55',
          fondo:
            'from-emerald-950/95 via-zinc-950 to-black',
          texto: 'text-emerald-400',
          brillo:
            'shadow-[0_0_90px_rgba(16,185,129,0.30)]',
          icono:
            'border-emerald-400/40 bg-emerald-500/20 text-emerald-400',
        }
      : resultado?.estadoLed === 'amarillo'
        ? {
            titulo: 'ACCESO AUTORIZADO',
            etiqueta: 'AVISO DE PAGO',
            borde: 'border-amber-400/55',
            fondo:
              'from-amber-950/95 via-zinc-950 to-black',
            texto: 'text-amber-300',
            brillo:
              'shadow-[0_0_90px_rgba(251,191,36,0.28)]',
            icono:
              'border-amber-300/40 bg-amber-500/20 text-amber-300',
          }
        : {
            titulo: 'ACCESO DENEGADO',
            etiqueta: 'REVISAR ESTADO',
            borde: 'border-red-500/60',
            fondo:
              'from-red-950/95 via-zinc-950 to-black',
            texto: 'text-red-500',
            brillo:
              'shadow-[0_0_100px_rgba(239,68,68,0.34)]',
            icono:
              'border-red-400/40 bg-red-500/20 text-red-500',
          };

  const IconoResultado =
    resultado?.estadoLed === 'verde'
      ? CheckCircle2
      : resultado?.estadoLed === 'amarillo'
        ? AlertCircle
        : XCircle;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <style jsx global>{`
        @keyframes nfc-result-timer {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        @keyframes nfc-scan-ring {
          0% {
            opacity: 0.65;
            transform: scale(0.85);
          }
          75%,
          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }

        @keyframes nfc-result-enter {
          0% {
            opacity: 0;
            transform: translateY(22px) scale(0.94);
            filter: blur(8px);
          }
          65% {
            opacity: 1;
            transform: translateY(-3px) scale(1.015);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes nfc-result-icon {
          0% {
            opacity: 0;
            transform: scale(0.35) rotate(-12deg);
          }
          60% {
            opacity: 1;
            transform: scale(1.12) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }

        @keyframes nfc-result-glow {
          0%,
          100% {
            opacity: 0.18;
            transform: scale(0.88);
          }
          50% {
            opacity: 0.38;
            transform: scale(1.08);
          }
        }
      `}</style>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-primary/30 text-primary"
          >
            <MapPin className="mr-1 h-3 w-3" />
            SEDE: {sede?.replace('_', ' ') || '...'}
          </Badge>
          <Badge variant="secondary">
            <Smartphone className="mr-1 h-3 w-3" />
            Android
          </Badge>
        </div>
        <h1 className="text-3xl font-black uppercase italic tracking-tight">
          {vinculacionId
            ? 'Vincular tarjeta NFC'
            : 'Asistencia NFC'}
        </h1>
        <p className="text-muted-foreground">
          {vinculacionId
            ? `La siguiente tarjeta se asignará a ${
                alumnoVinculacion || 'este alumno'
              }.`
            : 'Usa este teléfono como lector de tarjetas de asistencia.'}
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardHeader className="text-center">
          <div
            className={`relative mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full border-4 transition-all duration-500 ${
              estado === 'escaneando'
                ? 'border-primary bg-primary/10 shadow-[0_0_38px_-12px_hsl(var(--primary))]'
                : 'border-muted bg-muted/30'
            }`}
          >
            {estado === 'escaneando' && (
              <span className="absolute inset-0 rounded-full border-2 border-primary [animation:nfc-scan-ring_1.8s_ease-out_infinite]" />
            )}
            {estado === 'iniciando' ||
            estado === 'procesando' ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : (
              <Smartphone className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle>
            {estado === 'escaneando'
              ? vinculacionId
                ? 'Acerca la tarjeta que deseas vincular'
                : 'Acerca una tarjeta'
              : estado === 'procesando'
                ? vinculacionId
                  ? 'Vinculando tarjeta'
                  : 'Consultando tarjeta'
                : 'Lector detenido'}
          </CardTitle>
          <CardDescription>
            {estado === 'escaneando'
              ? 'Mantén la tag junto a la parte posterior del teléfono.'
              : 'Presiona el botón para solicitar permiso y activar el NFC.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {estado !== 'escaneando' &&
            estado !== 'procesando' && (
              <Button
                className="h-14 w-full text-base font-black uppercase"
                onClick={iniciarLector}
                disabled={!sede || estado === 'iniciando'}
              >
                {estado === 'iniciando' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Smartphone className="mr-2 h-5 w-5" />
                )}
                {vinculacionId
                  ? 'Iniciar vinculación NFC'
                  : 'Iniciar lector NFC'}
              </Button>
            )}

          {compatible === false && (
            <p className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
              Necesitas un Android con NFC y Chrome. Esta
              función no está disponible desde computadora o
              iPhone.
            </p>
          )}

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card
          key={`${ultimoUid}-${resultado.estadoLed}-${resultado.mensaje}`}
          className={`relative isolate overflow-hidden border-2 bg-gradient-to-br text-white [animation:nfc-result-enter_520ms_cubic-bezier(.2,.9,.2,1)_both] ${configuracionResultado.borde} ${configuracionResultado.fondo} ${configuracionResultado.brillo}`}
        >
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl [animation:nfc-result-glow_1.4s_ease-in-out_infinite] ${
              resultado.estadoLed === 'verde'
                ? 'bg-emerald-500'
                : resultado.estadoLed === 'amarillo'
                  ? 'bg-amber-400'
                  : 'bg-red-500'
            }`}
          />
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:30px_30px]" />
          <div
            className={`absolute inset-x-0 top-0 h-1.5 origin-left [animation:nfc-result-timer_3s_linear_forwards] ${
              resultado.estadoLed === 'verde'
                ? 'bg-emerald-400'
                : resultado.estadoLed === 'amarillo'
                  ? 'bg-amber-300'
                  : 'bg-red-500'
            }`}
            aria-hidden="true"
          />
          <CardContent className="space-y-5 px-6 pb-6 pt-8 text-center sm:px-8">
            <Badge
              variant="outline"
              className={`border-current/30 bg-black/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] ${configuracionResultado.texto}`}
            >
              {configuracionResultado.etiqueta}
            </Badge>
            <div
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border shadow-inner [animation:nfc-result-icon_600ms_cubic-bezier(.2,.9,.2,1)_120ms_both] ${configuracionResultado.icono}`}
            >
              <IconoResultado className="h-16 w-16" />
            </div>
            <div>
              <p
                className={`text-sm font-black uppercase tracking-[0.18em] ${configuracionResultado.texto}`}
              >
                {configuracionResultado.titulo}
              </p>
              {resultado.nombre && (
                <h2 className="mt-1 text-3xl font-black uppercase italic tracking-tight">
                  {resultado.nombre}
                </h2>
              )}
              <p className="mt-2 text-base font-bold text-white/85">
                {resultado.mensaje ||
                  'Lectura procesada'}
              </p>
              {resultado.mensajePago && (
                <p
                  className={`mt-2 text-sm font-black uppercase tracking-wide ${configuracionResultado.texto}`}
                >
                  {resultado.mensajePago}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-2 font-mono text-xs text-white/55 backdrop-blur">
              UID: {ultimoUid}
            </div>
            <Button
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={reiniciarResultado}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar ahora
            </Button>
            <p className="text-[11px] font-medium text-white/45">
              Preparando la siguiente lectura en 3 segundos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
