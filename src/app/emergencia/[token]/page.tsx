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
      className={`rounded-xl border p-4 ${
        urgent
          ? 'border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/25'
          : 'bg-card'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className={`h-4 w-4 ${urgent ? 'text-red-600' : 'text-primary'}`} />
        {label}
      </div>
      <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">{value}</p>
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
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <div className="text-center">
          <LoaderCircle className="mx-auto mb-3 h-9 w-9 animate-spin text-primary" />
          <p className="font-medium">Consultando perfil de emergencia…</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-7 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-600" />
            <h1 className="text-xl font-bold">Perfil no disponible</h1>
            <p className="mt-2 text-muted-foreground">
              {error || 'El enlace no es válido, expiró o fue desactivado.'}
            </p>
            <p className="mt-5 text-sm text-muted-foreground">
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
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
          <ShieldCheck className="h-5 w-5" />
          ALBATROS · PERFIL DE EMERGENCIA
        </div>

        <Card className="overflow-hidden shadow-lg">
          <div className="h-2 bg-red-600" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10">
                {profile.fotoUrl ? (
                  <img
                    src={profile.fotoUrl}
                    alt={`Fotografía de ${profile.nombre}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-9 w-9 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="break-words text-2xl">{profile.nombre}</CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <MapPin className="h-3 w-3" /> {profile.sede}
                  </Badge>
                  {profile.tipoSangre && (
                    <Badge className="bg-red-600 hover:bg-red-600">
                      Sangre {profile.tipoSangre}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {profile.contactoTelefono && (
              <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
                <p className="text-sm font-semibold text-muted-foreground">
                  CONTACTO DE EMERGENCIA
                </p>
                <p className="mt-1 text-lg font-bold">
                  {profile.contactoNombre || 'Contacto registrado'}
                  {profile.contactoParentesco ? ` · ${profile.contactoParentesco}` : ''}
                </p>
                <Button asChild size="lg" className="mt-4 w-full text-base">
                  <a href={`tel:${profile.contactoTelefono.replace(/[^\d+]/g, '')}`}>
                    <Phone className="mr-2 h-5 w-5" />
                    Llamar a {profile.contactoTelefono}
                  </a>
                </Button>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <HeartPulse className="h-5 w-5 text-red-600" />
                Información médica
              </h2>
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
                <p className="rounded-xl border p-4 text-muted-foreground">
                  No hay información médica adicional registrada.
                </p>
              )}
            </section>

            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              Información facilitada por el atleta para situaciones de emergencia.
              Este perfil no sustituye la valoración de personal médico.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
