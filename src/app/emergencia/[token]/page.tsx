'use client';

import { use, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  HeartPulse,
  LoaderCircle,
  MapPin,
  Phone,
  Pill,
  Siren,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type EmergencyProfile = {
  nombre: string;
  sede: string;
  fotoUrl?: string;
  fechaNacimiento?: string;
  tipoSangre?: string;
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
  contactoNombre?: string;
  contactoParentesco?: string;
  contactoTelefono?: string;
  indicaciones?: string;
};

type ApiResponse =
  | { ok: true; perfil: EmergencyProfile }
  | { ok: false; mensaje: string };

function Field({
  icon: Icon,
  label,
  value,
  urgent = false,
}: {
  icon: typeof HeartPulse;
  label: string;
  value?: string;
  urgent?: boolean;
}) {
  if (!value?.trim()) return null;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-colors ${
        urgent
          ? 'border-red-500/45 bg-gradient-to-br from-red-950/55 to-[#171719]'
          : 'border-white/[0.08] bg-gradient-to-br from-[#1c1c1f] to-[#151517]'
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-red-600 opacity-80" />
      <div className="mb-2 flex items-center gap-2 pl-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-600/10">
          <Icon className="h-4 w-4 text-red-500" />
        </span>
        {label}
      </div>
      <p className="whitespace-pre-wrap pl-1 text-[15px] font-semibold leading-relaxed text-zinc-100">{value}</p>
    </div>
  );
}

export default function PublicEmergencyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/emergencia?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.ok ? 'No se pudo abrir el perfil.' : data.mensaje);
        }

        setProfile(data.perfil);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'No se pudo consultar la información de emergencia.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [token]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] p-6 text-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto mb-3 h-9 w-9 animate-spin text-red-500" />
          <p className="font-black uppercase italic">Consultando perfil de emergencia…</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] p-6 text-white">
        <Card className="w-full max-w-md border-red-600/50 bg-[#111113] text-white">
          <CardContent className="pt-7 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-600" />
            <h1 className="text-xl font-black uppercase italic">Perfil no disponible</h1>
            <p className="mt-2 text-zinc-400">
              {error || 'El enlace no es válido, expiró o fue desactivado.'}
            </p>
            <p className="mt-5 text-sm text-zinc-500">
              Si existe una emergencia, llama al 911.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const hasMedicalData = Boolean(
    profile.tipoSangre ||
      profile.alergias ||
      profile.condicionesMedicas ||
      profile.medicamentos ||
      profile.indicaciones,
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080a] px-4 py-5 text-white sm:py-10">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-red-700/10 blur-[100px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-red-950/20 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-2xl space-y-4">
        <header className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-red-600/30 bg-[#141416]">
              <img src="/milogo.png" alt="ALBATROS" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-black uppercase italic leading-none tracking-wide">ALBATROS</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">Centro de alto rendimiento</p>
            </div>
          </div>
          <Badge className="gap-1.5 border border-red-500/30 bg-red-600/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-400 hover:bg-red-600/10">
            <ShieldCheck className="h-3.5 w-3.5" /> Perfil verificado
          </Badge>
        </header>

        <Card className="relative overflow-hidden rounded-[28px] border border-red-600/30 bg-[#111113] text-white shadow-2xl shadow-black/60">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-800 via-[#ff1515] to-red-800" />
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.14),transparent_68%)]" />

          <CardHeader className="relative pb-5 pt-8">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-[26px] border border-red-500/35 bg-[#1a1a1d] shadow-xl shadow-black/50">
                {profile.fotoUrl ? (
                  <img
                    src={profile.fotoUrl}
                    alt={`Fotografía de ${profile.nombre}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-10 w-10 text-red-500" />
                )}
              </div>
                <span className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full border-[3px] border-[#1a1a1d] bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Ficha médica de emergencia</p>
                <CardTitle className="break-words text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
                  {profile.nombre}
                </CardTitle>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge className="gap-1.5 border border-white/10 bg-[#202024] px-3 py-1 text-[10px] font-black uppercase text-zinc-200 hover:bg-[#202024]">
                    <MapPin className="h-3 w-3" /> {profile.sede}
                  </Badge>
                  {profile.tipoSangre && (
                    <Badge className="bg-[#f20d18] px-3 py-1 text-[10px] font-black uppercase shadow-lg shadow-red-950/30 hover:bg-[#f20d18]">
                      Sangre {profile.tipoSangre}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-6 px-5 pb-6 sm:px-7">
            {profile.contactoTelefono && (
              <section className="rounded-[22px] border border-red-500/35 bg-gradient-to-r from-red-950/45 via-[#1a1719] to-[#18181b] p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-950/40">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Contacto de emergencia</p>
                    <p className="truncate text-lg font-black uppercase italic text-white">
                      {profile.contactoNombre || 'Contacto registrado'}
                    </p>
                    {profile.contactoParentesco && <p className="text-xs font-semibold text-zinc-400">{profile.contactoParentesco}</p>}
                  </div>
                </div>
                <Button asChild size="lg" className="mt-4 h-12 w-full rounded-xl bg-[#f20d18] text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 hover:bg-red-700">
                  <a href={`tel:${profile.contactoTelefono.replace(/[^\d+]/g, '')}`}>
                    <Phone className="mr-2 h-5 w-5" />
                    Llamar a {profile.contactoTelefono}
                  </a>
                </Button>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/20 bg-red-600/10">
                  <HeartPulse className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase italic leading-none text-white">Información médica</h2>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Datos importantes para primeros auxilios</p>
                </div>
              </div>
              {hasMedicalData ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field icon={HeartPulse} label="Tipo de sangre" value={profile.tipoSangre} />
                  <Field icon={CalendarDays} label="Fecha de nacimiento" value={profile.fechaNacimiento} />
                  <Field icon={AlertTriangle} label="Alergias" value={profile.alergias} urgent />
                  <Field icon={Stethoscope} label="Condiciones médicas" value={profile.condicionesMedicas} />
                  <Field icon={Pill} label="Medicamentos" value={profile.medicamentos} />
                  <Field icon={ShieldCheck} label="Indicaciones importantes" value={profile.indicaciones} urgent />
                </div>
              ) : (
                <p className="rounded-xl border border-white/10 bg-[#18181b] p-4 text-zinc-400">
                  No hay información médica adicional registrada.
                </p>
              )}
            </section>

            <a href="tel:911" className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs font-black uppercase tracking-wider text-zinc-400 transition hover:border-red-500/30 hover:text-white">
              <Siren className="h-4 w-4 text-red-500" /> En una emergencia grave, llamar al 911
            </a>

            <div className="border-t border-white/[0.08] pt-4 text-center text-[10px] font-medium leading-relaxed text-zinc-600">
              Información facilitada por el atleta para situaciones de emergencia.<br />
              Este perfil no sustituye la valoración de personal médico.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
