'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  ShieldX,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';

type EstadoPantalla =
  | 'espera'
  | 'verde'
  | 'amarillo'
  | 'rojo';

type EventoPantalla = {
  alumnoId?: string;
  nombre?: string;
  sede?: string;
  permitido?: boolean;
  estadoLed?: 'verde' | 'amarillo' | 'rojo';
  mensaje?: string;
  mensajePago?: string;
  rfid?: string;
  fotoUrl?: string;
  fecha?: Timestamp | Date | string | null;
};

type AlumnoPantalla = {
  nombre?: string;
  fotoUrl?: string;
  foto?: string;
  imagenUrl?: string;
  sede?: string;
};

const DURACION_EVENTO_MS = 7000;
const DURACION_ICONO_MS = 1500;

function normalizarSede(
  valor: unknown
): string {
  if (typeof valor !== 'string') {
    return 'MMA';
  }

  const sede = valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  return [
    'MMA',
    'CAUCEL',
    'JUAN_PABLO',
  ].includes(sede)
    ? sede
    : 'MMA';
}

function nombreSede(
  sede: string
): string {
  switch (sede) {
    case 'CAUCEL':
      return 'Caucel';

    case 'JUAN_PABLO':
      return 'Juan Pablo';

    default:
      return 'MMA';
  }
}

function obtenerIniciales(
  nombre: string
): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) =>
      parte
        .charAt(0)
        .toUpperCase()
    )
    .join('');
}

function convertirFecha(
  valor: EventoPantalla['fecha']
): Date | null {
  if (!valor) {
    return null;
  }

  if (valor instanceof Timestamp) {
    return valor.toDate();
  }

  const fecha =
    valor instanceof Date
      ? valor
      : new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}

function normalizarFotoUrl(
  url?: string
): string {
  if (!url) {
    return '';
  }

  const valor = url.trim();

  const coincidenciaDrive =
    valor.match(
      /drive\.google\.com\/file\/d\/([^/?]+)/
    );

  if (coincidenciaDrive?.[1]) {
    return `https://drive.google.com/thumbnail?id=${coincidenciaDrive[1]}&sz=w1000`;
  }

  return valor;
}

export default function PantallaTV() {
  const firestore =
    useFirestore();

  const [
    sede,
    setSede,
  ] = useState('MMA');

  const [
    estado,
    setEstado,
  ] =
    useState<EstadoPantalla>(
      'espera'
    );

  const [
    evento,
    setEvento,
  ] =
    useState<EventoPantalla | null>(
      null
    );

  const [
    fotoUrl,
    setFotoUrl,
  ] = useState('');

  const [
    imagenConError,
    setImagenConError,
  ] = useState(false);

  const [
    conectado,
    setConectado,
  ] = useState(false);

  const [
    mostrarIconoEstado,
    setMostrarIconoEstado,
  ] = useState(false);

  const ultimoEventoRef =
    useRef('');

  const timeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const iconoTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(() => {
    const sedeGuardada =
      localStorage.getItem(
        'userSede'
      );

    setSede(
      normalizarSede(
        sedeGuardada
      )
    );
  }, []);

  const limpiarTemporizadores =
    useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }

      if (
        iconoTimeoutRef.current
      ) {
        clearTimeout(
          iconoTimeoutRef.current
        );
      }
    }, []);

  const volverAEspera = useCallback(() => {
    setEstado('espera');
    setEvento(null);
    setFotoUrl('');
    setImagenConError(false);
    setMostrarIconoEstado(false);
  }, []);

  const iniciarEventoVisual =
    useCallback((
      nuevoEstado:
        EstadoPantalla
    ) => {
      limpiarTemporizadores();

      setEstado(nuevoEstado);
      setMostrarIconoEstado(true);

      iconoTimeoutRef.current =
        setTimeout(() => {
          setMostrarIconoEstado(
            false
          );
        }, DURACION_ICONO_MS);

      timeoutRef.current =
        setTimeout(() => {
          volverAEspera();
      }, DURACION_EVENTO_MS);
    }, [limpiarTemporizadores, volverAEspera]);

  const probarPantalla = (
    nuevoEstado: EstadoPantalla
  ) => {
    if (
      nuevoEstado === 'espera'
    ) {
      volverAEspera();
      return;
    }

    setImagenConError(false);
    setFotoUrl('');

    setEvento({
      nombre: 'Jorge Vega',
      sede,
      rfid: '1113B964',

      mensaje:
        nuevoEstado === 'verde'
          ? 'Asistencia registrada'
          : nuevoEstado ===
              'amarillo'
            ? 'Acceso autorizado'
            : 'Acceso denegado',

      mensajePago:
        nuevoEstado === 'amarillo'
          ? 'Pago en 2 días'
          : nuevoEstado ===
              'rojo'
            ? 'Pago vencido'
            : 'Pago al corriente',

      estadoLed:
        nuevoEstado,

      permitido:
        nuevoEstado !== 'rojo',

      fecha: new Date(),
    });

    iniciarEventoVisual(
      nuevoEstado
    );
  };

  useEffect(() => {
    if (!firestore || !sede) {
      return;
    }

    const pantallaRef = doc(
      firestore,
      'Pantallas',
      sede
    );

    const unsubscribe =
      onSnapshot(
        pantallaRef,

        async (snapshot) => {
          setConectado(true);

          if (
            !snapshot.exists()
          ) {
            volverAEspera();
            return;
          }

          const data =
            snapshot.data() as EventoPantalla;

          const fechaEvento =
            convertirFecha(
              data.fecha
            );

          const llaveEvento = [
            data.alumnoId || '',
            data.rfid || '',
            fechaEvento?.getTime() ||
              '',
            data.mensaje || '',
          ].join('|');

          if (
            llaveEvento &&
            llaveEvento ===
              ultimoEventoRef.current
          ) {
            return;
          }

          ultimoEventoRef.current =
            llaveEvento;

          let foto =
            data.fotoUrl || '';

          if (
            data.alumnoId &&
            !foto
          ) {
            try {
              const alumnoSnapshot =
                await getDoc(
                  doc(
                    firestore,
                    'Alumnos',
                    data.alumnoId
                  )
                );

              if (
                alumnoSnapshot.exists()
              ) {
                const alumno =
                  alumnoSnapshot.data() as AlumnoPantalla;

                foto =
                  alumno.fotoUrl ||
                  alumno.foto ||
                  alumno.imagenUrl ||
                  '';
              }
            } catch (error) {
              console.error(
                'No se pudo cargar la foto:',
                error
              );
            }
          }

          const estadoRecibido =
            data.estadoLed ||
            (data.permitido
              ? 'verde'
              : 'rojo');

          setImagenConError(false);

          setFotoUrl(
            normalizarFotoUrl(
              foto
            )
          );

          setEvento(data);

          iniciarEventoVisual(
            estadoRecibido
          );
        },

        (error) => {
          console.error(
            'Error escuchando la pantalla:',
            error
          );

          setConectado(false);
        }
      );

    return () => {
      unsubscribe();
      limpiarTemporizadores();
    };
  }, [firestore, iniciarEventoVisual, limpiarTemporizadores, sede, volverAEspera]);

  const configuracion =
    useMemo(() => {
      switch (estado) {
        case 'verde':
          return {
            titulo:
              'ACCESO AUTORIZADO',

            etiqueta:
              'BIENVENIDO',

            subtitulo:
              evento?.mensaje ||
              'Asistencia registrada correctamente',

            colorTexto:
              'text-emerald-400',

            colorFondo:
              'from-emerald-950/90 via-black to-black',

            colorBorde:
              'border-emerald-500/50',

            colorGlow:
              'shadow-[0_0_110px_rgba(16,185,129,0.36)]',

            colorIcono:
              'bg-emerald-500/20 text-emerald-400 border-emerald-400/40',

            colorSolido:
              '#10b981',

            Icono:
              CheckCircle2,
          };

        case 'amarillo':
          return {
            titulo:
              'ACCESO AUTORIZADO',

            etiqueta:
              'AVISO DE PAGO',

            subtitulo:
              evento?.mensajePago ||
              evento?.mensaje ||
              'Pago próximo',

            colorTexto:
              'text-amber-300',

            colorFondo:
              'from-amber-950/90 via-black to-black',

            colorBorde:
              'border-amber-400/50',

            colorGlow:
              'shadow-[0_0_110px_rgba(251,191,36,0.34)]',

            colorIcono:
              'bg-amber-500/20 text-amber-300 border-amber-300/40',

            colorSolido:
              '#fbbf24',

            Icono:
              AlertTriangle,
          };

        case 'rojo':
          return {
            titulo:
              'ACCESO DENEGADO',

            etiqueta:
              'REVISAR ESTADO',

            subtitulo:
              evento?.mensajePago ||
              evento?.mensaje ||
              'Acceso no autorizado',

            colorTexto:
              'text-red-500',

            colorFondo:
              'from-red-950/95 via-black to-black',

            colorBorde:
              'border-red-500/55',

            colorGlow:
              'shadow-[0_0_120px_rgba(239,68,68,0.40)]',

            colorIcono:
              'bg-red-500/20 text-red-500 border-red-400/40',

            colorSolido:
              '#ef4444',

            Icono:
              ShieldX,
          };

        default:
          return {
            titulo:
              'ALBATROS',

            etiqueta:
              'CONTROL DE ACCESO',

            subtitulo:
              'Acerque su tarjeta al lector',

            colorTexto:
              'text-red-500',

            colorFondo:
              'from-zinc-950 via-black to-black',

            colorBorde:
              'border-white/10',

            colorGlow:
              'shadow-[0_0_90px_rgba(239,68,68,0.16)]',

            colorIcono:
              'bg-white/5 text-white/70 border-white/10',

            colorSolido:
              '#dc2626',

            Icono:
              CreditCard,
          };
      }
    }, [estado, evento]);

  const nombreAlumno =
    evento?.nombre?.trim() ||
    'Esperando acceso';

  const horaEvento =
    convertirFecha(
      evento?.fecha
    );

  const {
    Icono,
  } = configuracion;

  return (
    <main
      className={cn(
        'relative min-h-screen overflow-hidden',
        'bg-gradient-to-br text-white',
        configuracion.colorFondo
      )}
    >
      {/* Fondo animado */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            'absolute left-1/2 top-1/2',
            'h-[70vw] w-[70vw]',
            '-translate-x-1/2 -translate-y-1/2',
            'rounded-full blur-3xl opacity-20',
            estado === 'verde' &&
              'bg-emerald-500',
            estado ===
              'amarillo' &&
              'bg-amber-400',
            estado === 'rojo' &&
              'bg-red-500',
            estado === 'espera' &&
              'bg-red-900'
          )}
        />

        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      {/* Encabezado */}
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="flex items-center gap-5">
          <Logo />

          <div className="hidden border-l border-white/15 pl-5 sm:block">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">
              Centro de Alto
              Rendimiento
            </p>

            <p className="mt-1 text-sm font-black uppercase italic tracking-widest text-white/90">
              Sede{' '}
              {nombreSede(sede)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Badge
            variant="outline"
            className={cn(
              'gap-2 border-white/10 bg-black/30',
              'px-3 py-2 text-[9px] font-black',
              'uppercase tracking-[0.15em]',
              conectado
                ? 'text-emerald-400'
                : 'text-red-400'
            )}
          >
            {conectado ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}

            <span className="hidden sm:inline">
              {conectado
                ? 'Sistema conectado'
                : 'Sin conexión'}
            </span>
          </Badge>

          {/* Botones temporales de prueba */}
          <button
            type="button"
            onClick={() =>
              probarPantalla(
                'verde'
              )
            }
            className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase transition hover:scale-105"
          >
            Verde
          </button>

          <button
            type="button"
            onClick={() =>
              probarPantalla(
                'amarillo'
              )
            }
            className="rounded-lg bg-yellow-500 px-3 py-2 text-[10px] font-bold uppercase text-slate-900 transition hover:scale-105"
          >
            Amarillo
          </button>

          <button
            type="button"
            onClick={() =>
              probarPantalla(
                'rojo'
              )
            }
            className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold uppercase transition hover:scale-105"
          >
            Rojo
          </button>
        </div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-81px)] items-center justify-center px-4 py-6 md:px-10">
        <div
          key={`${estado}-${evento?.rfid || 'espera'}-${evento?.fecha || ''}`}
          className={cn(
            'relative w-full max-w-5xl',
            'rounded-[2.5rem] border',
            'bg-black/45 px-6 py-8',
            'backdrop-blur-2xl',
            'md:px-12 md:py-10',
            configuracion.colorBorde,
            configuracion.colorGlow,
            estado !==
              'espera' &&
              'animate-in fade-in zoom-in-95 duration-500'
          )}
        >
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-1.5',
              'rounded-t-[2.5rem]',
              estado === 'verde' &&
                'bg-emerald-500',
              estado ===
                'amarillo' &&
                'bg-amber-400',
              estado === 'rojo' &&
                'bg-red-500',
              estado ===
                'espera' &&
                'bg-red-600'
            )}
          />

          {estado === 'espera' ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
              <div
                className={cn(
                  'mb-9 flex h-36 w-36',
                  'items-center justify-center',
                  'rounded-full border',
                  'animate-pulse',
                  configuracion.colorIcono
                )}
              >
                <Icono className="h-16 w-16" />
              </div>

              <p className="text-sm font-black uppercase tracking-[0.5em] text-red-500">
                {
                  configuracion.etiqueta
                }
              </p>

              <h1 className="mt-5 text-6xl font-black uppercase italic tracking-tighter md:text-8xl">
                {
                  configuracion.titulo
                }
              </h1>

              <p className="mt-6 text-2xl font-semibold text-white/70 md:text-4xl">
                {
                  configuracion.subtitulo
                }
              </p>

              <div className="mt-10 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white/70">
                <Clock3 className="h-4 w-4" />

                Esperando lectura
                RFID
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              {/* Estado arriba */}
              <div className="mb-7">
                <p
                  className={cn(
                    'text-sm font-black uppercase tracking-[0.45em]',
                    configuracion.colorTexto
                  )}
                >
                  {
                    configuracion.etiqueta
                  }
                </p>

                <h2
                  className={cn(
                    'mt-2 text-4xl font-black',
                    'uppercase italic tracking-tighter',
                    'md:text-6xl',
                    configuracion.colorTexto
                  )}
                >
                  {
                    configuracion.titulo
                  }
                </h2>
              </div>

              {/* Foto con temporizador circular */}
              <div className="relative flex items-center justify-center">
                <svg
                  className="absolute h-[320px] w-[320px] -rotate-90 md:h-[390px] md:w-[390px]"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="2.7"
                    fill="none"
                  />

                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke={
                      configuracion.colorSolido
                    }
                    strokeWidth="2.7"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="289"
                    strokeDashoffset="0"
                    className="animate-[temporizadorCircular_7s_linear_forwards]"
                  />
                </svg>

                <div
                  className={cn(
                    'relative h-64 w-64 overflow-hidden',
                    'rounded-full border-4 bg-zinc-950',
                    'md:h-80 md:w-80',
                    configuracion.colorBorde,
                    configuracion.colorGlow
                  )}
                >
                  {fotoUrl &&
                  !imagenConError ? (
                    <Image
                      src={fotoUrl}
                      alt={nombreAlumno}
                      fill
                      sizes="(min-width: 768px) 320px, 256px"
                      unoptimized
                      className="object-cover"
                      onError={() =>
                        setImagenConError(
                          true
                        )
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
                      <UserRound className="h-20 w-20 text-white/15 md:h-24 md:w-24" />

                      <span className="mt-4 text-5xl font-black italic text-white/70 md:text-6xl">
                        {obtenerIniciales(
                          nombreAlumno
                        )}
                      </span>
                    </div>
                  )}

                  {/* Icono temporal sobre la foto */}
                  {mostrarIconoEstado && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px] animate-[iconoEntrada_.35s_ease-out]">
                      <div
                        className={cn(
                          'flex h-28 w-28 items-center justify-center',
                          'rounded-full border-2 backdrop-blur-xl',
                          'md:h-36 md:w-36',
                          configuracion.colorIcono
                        )}
                      >
                        <Icono className="h-16 w-16 md:h-20 md:w-20" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Información debajo */}
              <div className="mt-8 max-w-4xl">
                <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-7xl">
                  {nombreAlumno}
                </h3>

                <p className="mt-4 text-xl font-semibold text-white/65 md:text-3xl">
                  {
                    configuracion.subtitulo
                  }
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5 px-5 py-2 text-sm font-black uppercase tracking-widest text-white/70"
                  >
                    Sede{' '}
                    {nombreSede(
                      evento?.sede ||
                        sede
                    )}
                  </Badge>

                  {evento?.rfid && (
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/5 px-5 py-2 font-mono text-sm font-black text-white/70"
                    >
                      RFID{' '}
                      {evento.rfid}
                    </Badge>
                  )}

                  {horaEvento && (
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/5 px-5 py-2 text-sm font-black text-white/70"
                    >
                      {horaEvento.toLocaleTimeString(
                        'es-MX',
                        {
                          hour:
                            '2-digit',
                          minute:
                            '2-digit',
                        }
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes temporizadorCircular {
          from {
            stroke-dashoffset: 0;
          }

          to {
            stroke-dashoffset: 289;
          }
        }

        @keyframes iconoEntrada {
          0% {
            opacity: 0;
            transform: scale(0.25);
          }

          65% {
            opacity: 1;
            transform: scale(1.12);
          }

          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </main>
  );
}
