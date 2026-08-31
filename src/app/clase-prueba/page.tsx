"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { useFirestore } from "@/firebase";
import {
  createEmptyTrialClassForm,
  prepareTrialClassRequest,
  trialClassTimes,
  type TrialClassDiscipline,
  type TrialClassFormData,
  type TrialClassSite,
} from "@/lib/trial-class-request";

const inputClass =
  "h-14 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300 focus:ring-4 focus:ring-violet-400/10";

export default function PublicTrialClassPage() {
  const firestore = useFirestore();
  const [form, setForm] = useState<TrialClassFormData>(createEmptyTrialClassForm);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const update = <Key extends keyof TrialClassFormData>(
    key: Key,
    value: TrialClassFormData[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;

    const prepared = prepareTrialClassRequest(form, "web");
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }

    setSending(true);
    setError("");
    try {
      await addDoc(collection(firestore, "SolicitudesClasePrueba"), {
        ...prepared.data,
        creadoEn: serverTimestamp(),
      });
      setSent(true);
      setForm(createEmptyTrialClassForm());
    } catch {
      setError("No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050609] px-4 py-7 text-white sm:px-6 lg:grid lg:place-items-center lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(239,68,68,.20),transparent_28%),radial-gradient(circle_at_90%_80%,rgba(139,92,246,.18),transparent_30%)]" />
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#101116]/95 shadow-[0_32px_110px_rgba(0,0,0,.62)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[360px_1fr]">
          <aside className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-red-950/70 via-[#111217] to-violet-950/40 p-6 lg:border-b-0 lg:border-r lg:p-8">
            <Logo heading={false} className="w-fit" />
            <p className="mt-10 text-xs font-black uppercase tracking-[.24em] text-violet-300">Primera visita</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Tu primera clase comienza aquí.</h1>
            <p className="mt-4 leading-7 text-slate-400">Elige la disciplina, sede y horario. Nuestro equipo te contactará para confirmar tu lugar.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <TrustItem icon={CalendarCheck} text="Solicitud sin costo" />
              <TrustItem icon={Clock3} text="Confirmación por teléfono" />
              <TrustItem icon={ShieldCheck} text="Datos protegidos" />
            </div>
          </aside>

          <div className="p-5 sm:p-8 lg:p-10">
            {sent ? (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20">
                    <CheckCircle2 className="h-10 w-10" />
                  </span>
                  <h2 className="mt-6 text-3xl font-black">Solicitud enviada</h2>
                  <p className="mx-auto mt-3 max-w-md leading-7 text-slate-400">Recibimos tus datos. El equipo de Albatros se pondrá en contacto para confirmar tu clase.</p>
                  <button type="button" onClick={() => setSent(false)} className="mt-8 rounded-2xl border border-white/10 bg-white/[.06] px-6 py-3 font-black hover:bg-white/10">
                    Agendar para otra persona
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Reserva directa</p>
                  <h2 className="mt-2 text-3xl font-black">Agenda tu clase de prueba</h2>
                  <p className="mt-2 text-sm text-slate-400">Completa los campos para solicitar tu lugar.</p>
                </div>

                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <FormField label="Nombre completo" htmlFor="trial-name">
                    <input id="trial-name" value={form.nombre} onChange={(event) => update("nombre", event.target.value)} autoComplete="name" maxLength={80} className={inputClass} placeholder="Tu nombre" />
                  </FormField>
                  <FormField label="Teléfono" htmlFor="trial-phone">
                    <input id="trial-phone" value={form.telefono} onChange={(event) => update("telefono", event.target.value.replace(/[^\d +()-]/g, ""))} autoComplete="tel" inputMode="tel" maxLength={20} className={inputClass} placeholder="999 123 4567" />
                  </FormField>
                  <FormField label="Disciplina" htmlFor="trial-discipline">
                    <select id="trial-discipline" value={form.disciplina} onChange={(event) => setForm((current) => ({ ...current, disciplina: event.target.value as TrialClassDiscipline, horario: "" }))} className={inputClass}>
                      <option>Jiu-Jitsu</option><option>Kick Boxing</option><option>MMA</option>
                    </select>
                  </FormField>
                  <FormField label="Sede" htmlFor="trial-site">
                    <select id="trial-site" value={form.sede} onChange={(event) => update("sede", event.target.value as TrialClassSite)} className={inputClass}>
                      <option value="CAUCEL">Caucel</option><option value="MMA">MMA</option><option value="JUAN_PABLO">Juan Pablo</option>
                    </select>
                  </FormField>
                  <FormField label="Horario preferido" htmlFor="trial-time">
                    <select id="trial-time" value={form.horario} onChange={(event) => update("horario", event.target.value)} className={inputClass}>
                      <option value="">Selecciona una opción</option>
                      {trialClassTimes(form.disciplina).map((time) => <option key={time}>{time}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Nota opcional" htmlFor="trial-notes">
                    <input id="trial-notes" value={form.notas} onChange={(event) => update("notas", event.target.value)} maxLength={300} className={inputClass} placeholder="Edad, experiencia o comentario" />
                  </FormField>
                </div>

                {error && <p role="alert" className="mt-5 rounded-2xl border border-red-400/15 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</p>}
                <button type="submit" disabled={sending} className="mt-6 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-violet-400 px-6 font-black text-slate-950 shadow-[0_15px_40px_rgba(167,139,250,.22)] transition hover:bg-violet-300 disabled:cursor-wait disabled:opacity-60">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {sending ? "Enviando solicitud…" : "Solicitar mi clase"}
                </button>
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><UserRoundCheck className="h-4 w-4" />No se crea una cuenta ni se realiza ningún cobro.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</label>{children}</div>;
}

function TrustItem({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.045] p-3 text-sm font-bold text-slate-300"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-violet-300"><Icon className="h-4 w-4" /></span>{text}</div>;
}
