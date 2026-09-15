"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  Activity,
  CheckCircle2,
  CircleUserRound,
  Dumbbell,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import type { AthletePersonalProfile } from "@/lib/athlete-personal-profile";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import { normalizeAthletePhotoUrl } from "@/lib/athlete-photo";
import { getUfcWeightCategory } from "@/lib/ufc";
import { cn } from "@/lib/utils";

type ProfileResponse = {
  ok?: boolean;
  mensaje?: string;
  account?: {
    email: string;
    emailVerified: boolean;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  athlete?: {
    id: string;
    name: string;
    site: string;
    discipline: string;
    grade: string;
    goal: string;
    paymentStatus: string;
    active: boolean;
    officialWeightKg: number;
    nextCompetition: string;
    photoUrl: string;
  };
  personal?: AthletePersonalProfile;
  hasSavedPersonalProfile?: boolean;
};

const EMPTY_PERSONAL: AthletePersonalProfile = {
  gender: "male",
  weightKg: 0,
  heightCm: 0,
  age: 0,
  activityLevel: 1.55,
  goal: "maintain",
};

const ACTIVITY_OPTIONS = [
  [1.2, "Actividad ligera"],
  [1.375, "1–3 sesiones por semana"],
  [1.55, "3–5 sesiones por semana"],
  [1.725, "6–7 sesiones por semana"],
  [1.9, "Entrenamiento intenso diario"],
] as const;

const GOAL_OPTIONS = [
  ["maintain", "Mantener peso"],
  ["lose", "Reducir peso"],
  ["gain", "Aumentar masa"],
] as const;

function readableDate(value: string | null | undefined) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PerfilPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [personal, setPersonal] =
    useState<AthletePersonalProfile>(EMPTY_PERSONAL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!user) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError("");
        const token = await user.getIdToken();
        const { response, data: responseData } =
          await apiRequest<ProfileResponse>("/api/perfil", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
        if (
          !response.ok ||
          !responseData.ok ||
          !responseData.account ||
          !responseData.athlete ||
          !responseData.personal
        ) {
          throw new Error(
            apiErrorMessage(
              response.status,
              responseData.mensaje,
              "No se pudo cargar tu perfil.",
            ),
          );
        }
        setData(responseData);
        setPersonal(responseData.personal);
        setDirty(false);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "No se pudo cargar tu perfil.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const photo = normalizeAthletePhotoUrl(data?.athlete?.photoUrl);
  const initials = useMemo(
    () =>
      (data?.athlete?.name || "A")
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [data?.athlete?.name],
  );
  const bmi =
    personal.weightKg > 0 && personal.heightCm > 0
      ? personal.weightKg / (personal.heightCm / 100) ** 2
      : 0;
  const weightCategory =
    personal.weightKg > 0 ? getUfcWeightCategory(personal.weightKg) : "Pendiente";
  const completion = data?.athlete
    ? [
        Boolean(data.account?.email),
        Boolean(photo),
        Boolean(data.athlete.goal),
        personal.weightKg > 0 && personal.heightCm > 0 && personal.age > 0,
      ].filter(Boolean).length * 25
    : 0;

  function updatePersonal<Key extends keyof AthletePersonalProfile>(
    key: Key,
    value: AthletePersonalProfile[Key],
  ) {
    setPersonal((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function savePersonal() {
    if (!user || saving) return;
    try {
      setSaving(true);
      setError("");
      const token = await user.getIdToken();
      const { response, data: responseData } = await apiRequest<ProfileResponse>(
        "/api/perfil",
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(personal),
        },
      );
      if (!response.ok || !responseData.ok || !responseData.personal) {
        throw new Error(
          apiErrorMessage(
            response.status,
            responseData.mensaje,
            "No se pudieron guardar tus preferencias.",
          ),
        );
      }
      setPersonal(responseData.personal);
      setDirty(false);
      setData((current) =>
        current
          ? { ...current, personal: responseData.personal, hasSavedPersonalProfile: true }
          : current,
      );
      toast({
        title: "Preferencias actualizadas",
        description: "Las herramientas personales ya usarán estos valores.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudieron guardar tus preferencias.";
      setError(message);
      toast({ variant: "destructive", title: "No se guardó", description: message });
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    const email = data?.account?.email || user?.email || "";
    if (!email || resettingPassword) return;
    try {
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Correo enviado",
        description: `Revisa ${email} para cambiar tu contraseña.`,
      });
    } catch (caught) {
      toast({
        variant: "destructive",
        title: "No se pudo enviar el correo",
        description:
          caught instanceof Error ? caught.message : "Inténtalo nuevamente.",
      });
    } finally {
      setResettingPassword(false);
    }
  }

  if (isUserLoading || loading) {
    return (
      <main className="grid min-h-[75vh] place-items-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </main>
    );
  }

  if (!data?.athlete || !data.account) {
    return (
      <main className="min-h-screen bg-slate-950 p-5 text-white">
        <div className="mx-auto mt-20 max-w-lg rounded-3xl border border-red-300/20 bg-red-500/10 p-6 text-center">
          <CircleUserRound className="mx-auto h-10 w-10 text-red-300" />
          <h1 className="mt-3 text-xl font-black">No pudimos abrir tu perfil</h1>
          <p className="mt-2 text-sm text-red-100/80">{error}</p>
          <Button className="mt-5" onClick={() => void load(true)}>
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-28 text-white md:px-8 md:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(251,191,36,.16),transparent_38%),linear-gradient(135deg,#17191f,#0b101a)] p-6 md:p-8">
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <div
              role="img"
              aria-label={`Fotografía de ${data.athlete.name}`}
              className={cn(
                "relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-[2rem] border border-amber-300/20 bg-amber-300/10 text-3xl font-black text-amber-200",
              )}
            >
              {photo ? (
                <Image
                  src={photo}
                  alt=""
                  fill
                  sizes="112px"
                  unoptimized
                  className="object-cover"
                />
              ) : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
                Perfil vinculado
              </p>
              <h1 className="mt-2 truncate text-3xl font-black md:text-5xl">
                {data.athlete.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <Tag icon={MapPin}>{data.athlete.site}</Tag>
                <Tag icon={Dumbbell}>{data.athlete.discipline || "Disciplina pendiente"}</Tag>
                <Tag icon={Trophy}>{data.athlete.grade || "Grado pendiente"}</Tag>
              </div>
            </div>
            <div className="min-w-44 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400">
                <span>Perfil completo</span>
                <span className="text-amber-200">{completion}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-amber-300" style={{ width: `${completion}%` }} />
              </div>
              <Link
                href="/mi-academia"
                className="mt-3 inline-flex text-xs font-black text-amber-200 hover:text-amber-100"
              >
                {photo ? "Administrar fotografía" : "Agregar fotografía"}
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {error}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <article className="rounded-[2rem] border border-white/10 bg-[#12141a] p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">
                  Herramientas personales
                </p>
                <h2 className="mt-1 text-2xl font-black">Datos para tus cálculos</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Alimentación, laboratorio y rendimiento usan estos valores. No sustituyen ni modifican tu evaluación oficial del profesor.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing || dirty}
                onClick={() => void load(true)}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                Actualizar
              </Button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Field label="Peso personal" suffix="kg">
                <Input aria-label="Peso personal en kilogramos" type="number" inputMode="decimal" min={15} max={250} step="0.1" value={personal.weightKg || ""} onChange={(event) => updatePersonal("weightKg", Number(event.target.value))} className="border-white/10 bg-black/25 text-white" />
              </Field>
              <Field label="Estatura" suffix="cm">
                <Input aria-label="Estatura en centímetros" type="number" inputMode="decimal" min={80} max={230} step="0.1" value={personal.heightCm || ""} onChange={(event) => updatePersonal("heightCm", Number(event.target.value))} className="border-white/10 bg-black/25 text-white" />
              </Field>
              <Field label="Edad" suffix="años">
                <Input aria-label="Edad" type="number" inputMode="numeric" min={5} max={100} step="1" value={personal.age || ""} onChange={(event) => updatePersonal("age", Number(event.target.value))} className="border-white/10 bg-black/25 text-white" />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Sexo para cálculos">
                <select value={personal.gender} onChange={(event) => updatePersonal("gender", event.target.value as "male" | "female")} className="h-10 w-full rounded-md border border-white/10 bg-[#11151d] px-3 text-sm text-white">
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                </select>
              </Field>
              <Field label="Objetivo personal">
                <select value={personal.goal} onChange={(event) => updatePersonal("goal", event.target.value as AthletePersonalProfile["goal"])} className="h-10 w-full rounded-md border border-white/10 bg-[#11151d] px-3 text-sm text-white">
                  {GOAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Nivel habitual de actividad">
                <select value={personal.activityLevel} onChange={(event) => updatePersonal("activityLevel", Number(event.target.value) as AthletePersonalProfile["activityLevel"])} className="h-10 w-full rounded-md border border-white/10 bg-[#11151d] px-3 text-sm text-white">
                  {ACTIVITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>

            <Button className="mt-6 min-h-12 w-full font-black" disabled={saving || !dirty} onClick={() => void savePersonal()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Guardando…" : dirty ? "Guardar preferencias" : "Preferencias guardadas"}
            </Button>
          </article>

          <div className="space-y-5">
            <article className="rounded-[2rem] border border-white/10 bg-[#12141a] p-5">
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Resumen</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <ProfileMetric icon={Activity} label="IMC estimado" value={bmi ? bmi.toFixed(1) : "Pendiente"} />
                <ProfileMetric icon={Trophy} label="Categoría" value={weightCategory.split(" (")[0]} />
              </div>
              {data.athlete.officialWeightKg > 0 && (
                <p className="mt-4 rounded-xl border border-white/[.07] bg-black/20 p-3 text-xs leading-5 text-slate-400">
                  Último peso oficial: <b className="text-white">{data.athlete.officialWeightKg} kg</b>. El valor personal solamente alimenta tus herramientas privadas.
                </p>
              )}
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-[#12141a] p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-violet-300"><ShieldCheck className="h-4 w-4" /> Cuenta segura</p>
              <div className="mt-4 space-y-3 text-sm">
                <AccountRow icon={Mail} label="Correo" value={data.account.email} />
                <AccountRow icon={CheckCircle2} label="Verificación" value={data.account.emailVerified ? "Correo verificado" : "Correo sin verificar"} />
                <AccountRow icon={KeyRound} label="Último acceso" value={readableDate(data.account.lastSignInAt)} />
              </div>
              <Button variant="outline" className="mt-5 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" disabled={resettingPassword || !data.account.email} onClick={() => void resetPassword()}>
                {resettingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Cambiar contraseña
              </Button>
            </article>

            <article className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[.06] p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-amber-200"><Target className="h-4 w-4" /> Expediente oficial</p>
              <p className="mt-3 text-sm font-bold text-white">{data.athlete.goal || "Aún no hay un objetivo registrado."}</p>
              {data.athlete.nextCompetition && <p className="mt-2 text-xs leading-5 text-slate-300">Próxima competencia: {data.athlete.nextCompetition}</p>}
              <p className="mt-3 text-xs leading-5 text-slate-400">Nombre, sede, grado, pagos y evaluación física son datos administrativos protegidos. Solicita su corrección a tu academia.</p>
              <Button asChild variant="ghost" className="mt-3 px-0 text-amber-200 hover:bg-transparent hover:text-amber-100"><Link href="/mi-academia">Abrir Mi Academia</Link></Button>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return <Label className="block space-y-2"><span className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">{label}{suffix && <small className="normal-case text-slate-600">{suffix}</small>}</span>{children}</Label>;
}

function Tag({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5"><Icon className="h-3.5 w-3.5 text-amber-300" />{children}</span>;
}

function ProfileMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.07] bg-black/20 p-3"><Icon className="h-5 w-5 text-cyan-300" /><span className="mt-3 block text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span><b className="mt-1 block truncate text-lg text-white">{value}</b></div>;
}

function AccountRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[.06] bg-black/20 p-3"><Icon className="h-4 w-4 shrink-0 text-violet-300" /><div className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span><b className="block truncate text-xs text-slate-200">{value}</b></div></div>;
}
