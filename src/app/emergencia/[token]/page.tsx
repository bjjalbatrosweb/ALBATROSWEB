'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  HeartPulse,
  Loader2,
  MapPin,
  Phone,
  Pill,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirestore } from '@/firebase';

type Emergencia = {
  fechaNacimiento?: string;
  tipoSangre?: string;
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
  contactoNombre?: string;
  contactoParentesco?: string;
  contactoTelefono?: string;
  indicaciones?: string;
  activo?: boolean;
};

type AlumnoEmergencia = {
  id: string;
  nombre: string;
  sede?: string;
  fotoUrl?: string;
  emergenciaToken?: string;
  emergencia?: Emergencia;
};

function nombreSede(valor?: string): string {
  switch (valor) {
    case 'CAUCEL':
      return 'Caucel';

    case 'JUAN_PABLO':
      return 'Juan Pablo';

    case 'MMA':
      return 'MMA';

    default:
      return valor || 'Albatros';
  }
}

function obtenerIniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

function calcularEdad(fechaNacimiento?: string): number | null {
  if (!fechaNacimiento) {
    return null;
  }

  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);

  if (Number.isNaN(nacimiento.getTime())) {
    return null;
  }

  const hoy = new Date();

  let edad =
    hoy.getFullYear() -
    nacimiento.getFullYear();

  const diferenciaMes =
    hoy.getMonth() -
    nacimiento.getMonth();

  if (
    diferenciaMes < 0 ||
    (diferenciaMes === 0 &&
      hoy.getDate() < nacimiento.getDate())
  ) {
    edad -= 1;
  }

  return edad >= 0 ? edad : null;
}

function mostrarValor(
  valor?: string,
  respaldo = 'No especificado'
): string {
  const limpio = valor?.trim();

  return limpio || respaldo;
}

function limpiarTelefono(telefono?: string): string {
  return (telefono || '').replace(/[^\d+]/g, '');
}

export default function EmergenciaPublicaPage() {
  const params = useParams<{
    token: string;
  }>();

  const firestore = useFirestore();

  const [alumno, setAlumno] =
    useState<AlumnoEmergencia | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    const cargarFicha = async () => {
      if (!firestore || !params?.token) {
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const alumnosQuery = query(
          collection(firestore, 'Alumnos'),
          where(
            'emergenciaToken',
            '==',
            params.token
          ),
          limit(1)
        );

        const snapshot = await getDocs(
          alumnosQuery
        );

        if (snapshot.empty) {
          setAlumno(null);
          setError(
            'La ficha solicitada no existe o la URL no es válida.'
          );

          return;
        }

        const documento = snapshot.docs[0];

        const datos = {
          id: documento.id,
          ...documento.data(),
        } as AlumnoEmergencia;

        if (
          datos.emergencia?.activo === false
        ) {
          setAlumno(null);
          setError(
            'Esta ficha de emergencia se encuentra desactivada.'
          );

          return;
        }

        setAlumno(datos);
      } catch (error) {
        console.error(
          'Error cargando ficha pública:',
          error
        );

        setAlumno(null);
        setError(
          'No fue posible cargar la información de emergencia.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void cargarFicha();
  }, [firestore, params?.token]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-red-950/40 px-5 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-500" />

          <p className="mt-5 font-black uppercase tracking-[0.25em] text-white/60">
            Cargando ficha
          </p>
        </div>
      </main>
    );
  }

  if (!alumno || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-red-950/40 px-5 text-white">
        <Card className="w-full max-w-lg border-red-500/20 bg-black/55 text-white shadow-2xl backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />

            <h1 className="mt-5 text-3xl font-black uppercase italic tracking-tighter">
              Ficha no disponible
            </h1>

            <p className="mt-4 text-white/60">
              {error ||
                'No se encontró información para este enlace.'}
            </p>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/45">
              Verifica que la URL del tag NFC sea correcta.
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const emergencia =
    alumno.emergencia || {};

  const edad = calcularEdad(
    emergencia.fechaNacimiento
  );

  const telefono =
    limpiarTelefono(
      emergencia.contactoTelefono
    );

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-red-950/50 px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="rounded-3xl border border-red-500/20 bg-black/50 p-5 shadow-[0_0_70px_rgba(239,68,68,0.12)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-red-500/25 bg-zinc-900">
              {alumno.fotoUrl ? (
                <img
                  src={alumno.fotoUrl}
                  alt={alumno.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <UserRound className="h-12 w-12 text-white/20" />

                  <span className="mt-2 text-3xl font-black italic text-white/35">
                    {obtenerIniciales(
                      alumno.nombre
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Badge className="border-red-500/20 bg-red-500/15 font-black uppercase tracking-widest text-red-400">
                Información de emergencia
              </Badge>

              <h1 className="mt-4 break-words text-4xl font-black uppercase italic tracking-tighter sm:text-5xl">
                {alumno.nombre}
              </h1>

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/5 px-3 py-1 text-white/65"
                >
                  <Building2 className="h-3.5 w-3.5" />

                  Albatros
                </Badge>

                <Badge
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/5 px-3 py-1 text-white/65"
                >
                  <MapPin className="h-3.5 w-3.5" />

                  {nombreSede(
                    alumno.sede
                  )}
                </Badge>

                {edad !== null && (
                  <Badge
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/5 px-3 py-1 text-white/65"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />

                    {edad} años
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        <Card className="border-red-500/15 bg-black/45 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <HeartPulse className="h-5 w-5 text-red-500" />

              Información médica
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/40">
                Tipo de sangre
              </p>

              <p className="mt-2 text-3xl font-black text-red-400">
                {mostrarValor(
                  emergencia.tipoSangre
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/40">
                Fecha de nacimiento
              </p>

              <p className="mt-2 text-lg font-black">
                {mostrarValor(
                  emergencia.fechaNacimiento
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-widest text-white/40">
                Alergias
              </p>

              <p className="mt-2 text-lg font-semibold">
                {mostrarValor(
                  emergencia.alergias,
                  'Ninguna registrada'
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-widest text-white/40">
                Condiciones médicas
              </p>

              <p className="mt-2 text-lg font-semibold">
                {mostrarValor(
                  emergencia.condicionesMedicas,
                  'Ninguna registrada'
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-red-400" />

                <p className="text-xs font-black uppercase tracking-widest text-white/40">
                  Medicamentos importantes
                </p>
              </div>

              <p className="mt-2 text-lg font-semibold">
                {mostrarValor(
                  emergencia.medicamentos,
                  'Ninguno registrado'
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/15 bg-black/45 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <Phone className="h-5 w-5 text-red-500" />

              Contacto de emergencia
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-black uppercase italic">
                {mostrarValor(
                  emergencia.contactoNombre
                )}
              </p>

              <p className="mt-1 text-white/50">
                {mostrarValor(
                  emergencia.contactoParentesco,
                  'Contacto de emergencia'
                )}
              </p>

              <p className="mt-4 text-2xl font-black tracking-wide text-red-400">
                {mostrarValor(
                  emergencia.contactoTelefono
                )}
              </p>

              {telefono && (
                <Button
                  asChild
                  className="mt-5 h-14 w-full text-base font-black uppercase tracking-wider"
                >
                  <a
                    href={`tel:${telefono}`}
                  >
                    <Phone className="mr-2 h-5 w-5" />

                    Llamar ahora
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {emergencia.indicaciones?.trim() && (
          <Card className="border-amber-400/20 bg-amber-500/5 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic text-amber-300">
                <ShieldAlert className="h-5 w-5" />

                Indicaciones importantes
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-white/80">
                {emergencia.indicaciones}
              </p>
            </CardContent>
          </Card>
        )}

        <footer className="pb-4 pt-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
            Albatros Centro de Alto Rendimiento
          </p>

          <p className="mt-2 text-xs text-white/25">
            Esta información fue proporcionada para uso en situaciones de emergencia.
          </p>
        </footer>
      </div>
    </main>
  );
}
