"use client";

import { use, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Dumbbell, Info, Loader2, LockKeyhole, MessageSquareText, Shield, Sparkles, Swords, Target, TimerReset, UserRound } from "lucide-react";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import type { PublicCombatStyleSnapshot } from "@/lib/combat-style-profile";

type AthleteResponse = "coincide" | "parcial" | "no_coincide";
type SharedDocument = {
  activo?: boolean;
  venceEn?: Timestamp;
  contenido?: PublicCombatStyleSnapshot;
  respuestaAtleta?: AthleteResponse;
  comentarioAtleta?: string;
};

const responseOptions: Array<{ value: AthleteResponse; label: string; detail: string }> = [
  { value: "coincide", label: "Coincide", detail: "Me describe bien" },
  { value: "parcial", label: "Parcialmente", detail: "Cambiaría algunos rasgos" },
  { value: "no_coincide", label: "No coincide", detail: "Necesita revisión" },
];

const domainStyle = {
  Grappling: { icon: Shield, color: "text-emerald-300", border: "border-emerald-400/20", glow: "from-emerald-500/[.13]" },
  Wrestling: { icon: Dumbbell, color: "text-amber-300", border: "border-amber-400/20", glow: "from-amber-500/[.13]" },
  Striking: { icon: Swords, color: "text-rose-300", border: "border-rose-400/20", glow: "from-rose-500/[.13]" },
} as const;

function SharedCombatProfileView({
  content,
  expiresAt,
  initialResponse,
  initialComment = "",
  onConfirm,
}: {
  content: PublicCombatStyleSnapshot;
  expiresAt: Date;
  initialResponse?: AthleteResponse;
  initialComment?: string;
  onConfirm: (response: AthleteResponse, comment: string) => Promise<void>;
}) {
  const [response, setResponse] = useState<AthleteResponse | "">(initialResponse || "");
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(Boolean(initialResponse));
  const [error, setError] = useState("");
  const physicalEntries = content.physicalProfile ? [
    ["Estatura", content.physicalProfile.estatura], ["Complexión", content.physicalProfile.complexion],
    ["Torso", content.physicalProfile.torso], ["Brazos", content.physicalProfile.brazos],
    ["Piernas", content.physicalProfile.piernas], ["Hombros", content.physicalProfile.hombros],
    ["Cintura", content.physicalProfile.cintura], ["Cadera", content.physicalProfile.cadera],
    ["Glúteos", content.physicalProfile.gluteos], ["Muslos", content.physicalProfile.muslos],
  ] : [];

  const submit = async () => {
    if (!response) { setError("Selecciona qué tanto coincide el perfil contigo."); return; }
    setSaving(true); setError("");
    try {
      await onConfirm(response, comment.trim());
      setConfirmed(true);
    } catch {
      setError("No pudimos guardar tu respuesta. Revisa tu conexión e intenta nuevamente.");
    } finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] px-4 py-5 text-white [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Segoe_UI',sans-serif] sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed -left-44 -top-52 h-[34rem] w-[34rem] rounded-full bg-blue-600/15 blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-56 -right-44 h-[36rem] w-[36rem] rounded-full bg-violet-600/10 blur-[140px]" />
      <div className="relative mx-auto max-w-5xl space-y-5">
        <header className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.06] shadow-xl"><Sparkles className="h-5 w-5 text-blue-300" /></div><div><b className="block text-sm tracking-tight">ALBATROS</b><span className="text-[9px] font-bold uppercase tracking-[.2em] text-[#6e6e73]">Perfil técnico compartido</span></div></div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/[.07] px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-emerald-200"><LockKeyhole className="h-3.5 w-3.5" />Enlace privado</span>
        </header>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_88%_5%,rgba(10,132,255,.2),transparent_34%),linear-gradient(145deg,#1c1c1e,#0d0d10)] p-6 shadow-[0_35px_100px_rgba(0,0,0,.55)] sm:p-9">
          <div className="relative max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-blue-300">Tu lectura técnica</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{content.athleteName ? `${content.athleteName}, este es tu perfil` : "Este es tu perfil técnico"}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#a1a1a6]">Una propuesta inicial para orientar tu entrenamiento. Se confirma observando cómo te mueves, controlas y resuelves en clase.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-semibold text-slate-300">{content.qualityLabel}</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-slate-400">Disponible hasta {expiresAt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span></div></div>
        </section>

        {content.physicalProfile && <section className="rounded-[1.75rem] border border-white/10 bg-[#121214]/90 p-5 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10"><UserRound className="h-5 w-5 text-blue-300" /></div><div><h2 className="text-xl font-semibold tracking-tight">Características corporales</h2><p className="mt-1 text-xs text-[#86868b]">Descripción cualitativa para que confirmes si te representa.</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{physicalEntries.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73]">{label}</span><b className="mt-1 block text-sm">{value}</b></div>)}</div></section>}

        <section className="grid gap-5 lg:grid-cols-[1.05fr_1.95fr]">
          <div className="rounded-[1.75rem] border border-violet-400/15 bg-[linear-gradient(145deg,rgba(139,92,246,.1),rgba(18,18,20,.96))] p-5 sm:p-7"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-violet-300">Sumisiones recomendadas</p><div className="mt-4 space-y-2">{content.submissions.map((item, index) => <article key={`${item.name}-${item.entry}`} className="rounded-2xl border border-white/[.07] bg-black/20 p-4"><div className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-[10px] font-bold text-violet-200">{index + 1}</span><div className="min-w-0"><b className="block truncate text-sm">{item.name}</b><span className="text-[10px] text-[#86868b]">Entrada: {item.entry}</span></div></div><p className="mt-3 text-[11px] leading-5 text-slate-400">{item.why}</p>{item.caution && <p className="mt-2 text-[10px] text-amber-200/80">Cuidado: {item.caution}</p>}</article>)}</div></div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#121214]/90 p-5 sm:p-7"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#86868b]">Plan A por disciplina</p><div className="mt-4 grid gap-3 md:grid-cols-3">{content.primaryRoutes.map(route => { const style = domainStyle[route.domain]; const Icon = style.icon; return <article key={route.domain} className={`overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-b ${style.glow} to-black/20 p-4`}><div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${style.color}`}><Icon className="h-4 w-4" />{route.domain}</div><h3 className="mt-3 text-lg font-semibold tracking-tight">{route.title}</h3><p className="mt-2 text-[11px] leading-5 text-slate-400">{route.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{route.techniques.map(item => <span key={item} className="rounded-full bg-white/[.06] px-2 py-1 text-[9px] text-slate-300">{item}</span>)}</div><div className="mt-4 border-t border-white/[.07] pt-3"><span className="text-[9px] font-bold uppercase text-[#6e6e73]">Primera prueba</span><p className="mt-1 text-[10px] leading-4 text-slate-300">{route.drill}</p></div></article>; })}</div></div>
        </section>

        {!!content.deprioritized?.length && <section className="rounded-[1.75rem] border border-amber-400/20 bg-[linear-gradient(145deg,rgba(245,158,11,.08),rgba(18,18,20,.96))] p-5 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10"><AlertTriangle className="h-5 w-5 text-amber-300" /></div><div><h2 className="text-lg font-semibold">No recomendadas por ahora</h2><p className="mt-1 text-[10px] leading-4 text-[#86868b]">Son variantes de menor prioridad, no límites permanentes. El entrenador debe comprobarlas técnicamente.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{content.deprioritized.map(item => <article key={item.id} className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{item.technique}</b><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${item.status === "Evitar por ahora" ? "bg-rose-500/15 text-rose-200" : "bg-amber-400/15 text-amber-200"}`}>{item.status}</span></div><p className="mt-3 text-[11px] leading-5 text-slate-400">{item.reason}</p><p className="mt-3 rounded-xl bg-white/[.04] p-3 text-[10px] leading-4 text-slate-200"><span className="font-bold uppercase text-cyan-300">Alternativa · </span>{item.alternative}</p></article>)}</div></section>}

        <section className="rounded-[1.75rem] border border-white/10 bg-[#121214]/90 p-5 sm:p-7"><div className="flex items-center gap-3"><Target className="h-5 w-5 text-cyan-300" /><div><h2 className="text-lg font-semibold">Cómo se valida</h2><p className="text-[10px] text-[#86868b]">No es una etiqueta permanente: se comprueba en sesiones comparables.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{content.validationPlan.map((item, index) => <article key={item.session} className="rounded-2xl border border-white/[.07] bg-black/20 p-4"><span className="text-[9px] font-bold text-cyan-300">{index + 1} · {item.session}</span><b className="mt-2 block text-xs">{item.task}</b><p className="mt-2 text-[10px] leading-4 text-slate-500">{item.measure}</p></article>)}</div></section>

        <section className="rounded-[2rem] border border-blue-400/20 bg-[radial-gradient(circle_at_90%_0%,rgba(10,132,255,.18),transparent_40%),#111216] p-5 shadow-2xl sm:p-8"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/15"><MessageSquareText className="h-5 w-5 text-blue-300" /></div><div><h2 className="text-xl font-semibold tracking-tight">¿Esto coincide contigo?</h2><p className="mt-1 text-xs leading-5 text-[#86868b]">Tu respuesta ayuda al profesor a ajustar el perfil antes de consolidarlo.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-3">{responseOptions.map(option => <button key={option.value} type="button" onClick={() => { setResponse(option.value); setConfirmed(false); }} className={`min-h-[74px] rounded-2xl border p-3 text-left transition ${response === option.value ? "border-blue-300 bg-blue-500/20 shadow-[0_0_30px_rgba(10,132,255,.16)]" : "border-white/[.08] bg-black/20 hover:bg-white/[.05]"}`}><span className="flex items-center justify-between text-sm font-semibold">{option.label}{response === option.value && <Check className="h-4 w-4 text-blue-300" />}</span><span className="mt-1 block text-[10px] text-[#86868b]">{option.detail}</span></button>)}</div><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-[#86868b]" htmlFor="athlete-comment">Comentario opcional</label><textarea id="athlete-comment" value={comment} maxLength={300} onChange={event => { setComment(event.target.value); setConfirmed(false); }} placeholder="¿Qué cambiarías o qué se siente diferente?" className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-sm outline-none placeholder:text-[#48484a] focus:border-blue-400/50" /><div className="mt-2 flex items-center justify-between text-[9px] text-[#636366]"><span>No escribas información médica o sensible.</span><span>{comment.length}/300</span></div>{error && <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}{confirmed && <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-200"><Check className="h-4 w-4" />Tu confirmación quedó guardada. Puedes modificarla mientras el enlace siga activo.</p>}<button type="button" onClick={() => void submit()} disabled={!response || saving} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0a84ff] px-5 text-sm font-semibold shadow-[0_12px_35px_rgba(10,132,255,.3)] disabled:cursor-not-allowed disabled:opacity-35">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}{confirmed ? "Actualizar confirmación" : "Enviar confirmación"}</button></section>

        <footer className="flex flex-col items-center justify-between gap-3 px-2 py-3 text-center text-[10px] leading-5 text-[#636366] sm:flex-row sm:text-left"><span className="inline-flex items-center gap-2"><Info className="h-3.5 w-3.5" />Este perfil orienta el entrenamiento; no es un diagnóstico médico.</span><span className="inline-flex items-center gap-2"><TimerReset className="h-3.5 w-3.5" />No contiene peso, centímetros, lesiones ni notas privadas.</span></footer>
      </div>
    </main>
  );
}

export default function SharedCombatProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const firestore = useFirestore();
  const [data, setData] = useState<SharedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("invalid");
        const snapshot = await getDoc(doc(firestore, "PerfilesTecnicosCompartidos", token));
        const value = snapshot.exists() ? snapshot.data() as SharedDocument : null;
        if (!value?.contenido || value.activo !== true || !value.venceEn || value.venceEn.toMillis() <= Date.now()) throw new Error("unavailable");
        if (mounted) setData(value);
      } catch { if (mounted) setError("Este enlace no está disponible, caducó o fue desactivado."); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [firestore, token]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#050506] p-6 text-white"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-400" /><p className="mt-3 text-sm font-semibold">Abriendo perfil técnico…</p></div></main>;
  if (error || !data?.contenido || !data.venceEn) return <main className="grid min-h-screen place-items-center bg-[#050506] p-6 text-white"><div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#151517] p-8 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-[#86868b]" /><h1 className="mt-4 text-xl font-semibold">Perfil no disponible</h1><p className="mt-2 text-sm leading-6 text-[#86868b]">{error || "El enlace ya no puede consultarse."}</p></div></main>;

  return <SharedCombatProfileView content={data.contenido} expiresAt={data.venceEn.toDate()} initialResponse={data.respuestaAtleta} initialComment={data.comentarioAtleta} onConfirm={async (response, comment) => { await updateDoc(doc(firestore, "PerfilesTecnicosCompartidos", token), { respuestaAtleta: response, comentarioAtleta: comment, respondidoEn: serverTimestamp() }); }} />;
}
