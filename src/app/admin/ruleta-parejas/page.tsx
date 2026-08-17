"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Check, Disc3, Loader2, Plus, RefreshCw, Sparkles, UserRound, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFirestore } from "@/firebase";
import { generateQuickPairs, isCoachKarlaPair, type QuickPair, type QuickProfile } from "@/lib/quick-pairing";

type AthleteDocument = { nombre?: string; activo?: boolean };
const COACH: QuickProfile = { id: "special-coach", name: "COACH", kind: "coach" };

export default function QuickPairingRoulettePage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<QuickProfile[]>([]);
  const [guests, setGuests] = useState<QuickProfile[]>([]);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"present" | "absent">("present");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [pairs, setPairs] = useState<QuickPair[]>([]);
  const [resting, setResting] = useState<QuickProfile[]>([]);
  const [coachKarlaCount, setCoachKarlaCount] = useState(0);

  useEffect(() => { setSite(localStorage.getItem("userSede") || "MMA"); }, []);
  useEffect(() => {
    const stored = Number(sessionStorage.getItem(`quick-pairing:coach-karla:${site}`));
    setCoachKarlaCount(Number.isInteger(stored) && stored >= 0 ? Math.min(3, stored) : 0);
  }, [site]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site))).then((snapshot) => {
      if (cancelled) return;
      setAthletes(snapshot.docs.filter((entry) => (entry.data() as AthleteDocument).activo !== false).map((entry) => ({ id: entry.id, name: String((entry.data() as AthleteDocument).nombre || "Atleta"), kind: "athlete" as const })).sort((a, b) => a.name.localeCompare(b.name, "es")));
    }).catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firestore, site]);

  const roster = useMemo(() => [COACH, ...athletes, ...guests], [athletes, guests]);
  const participants = useMemo(() => selectionMode === "present" ? roster.filter((profile) => markedIds.includes(profile.id)) : roster.filter((profile) => !markedIds.includes(profile.id)), [markedIds, roster, selectionMode]);
  function changeMode(absentMode: boolean) { setSelectionMode(absentMode ? "absent" : "present"); setMarkedIds([]); setPairs([]); setResting([]); }
  function toggle(id: string) { setMarkedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); setPairs([]); setResting([]); }
  function addGuest(event: React.FormEvent) { event.preventDefault(); const name = guestName.trim(); if (!name) return; const guest = { id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: name.slice(0, 60), kind: "guest" as const }; setGuests((current) => [...current, guest]); if (selectionMode === "present") setMarkedIds((current) => [...current, guest.id]); setGuestName(""); setAddingGuest(false); }
  function removeGuest(id: string) { setGuests((current) => current.filter((profile) => profile.id !== id)); setMarkedIds((current) => current.filter((value) => value !== id)); setPairs([]); }
  function spin() { if (participants.length < 2 || spinning) return; setSpinning(true); setPairs([]); setResting([]); window.setTimeout(() => { const result = generateQuickPairs(participants, Math.random, coachKarlaCount); const appearedTogether = result.pairs.some((pair) => isCoachKarlaPair(pair.left, pair.right)); const nextCount = appearedTogether ? Math.min(3, coachKarlaCount + 1) : coachKarlaCount; if (nextCount !== coachKarlaCount) { setCoachKarlaCount(nextCount); sessionStorage.setItem(`quick-pairing:coach-karla:${site}`, String(nextCount)); } setPairs(result.pairs); setResting(result.resting); setSpinning(false); }, 750); }

  return <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white sm:px-6"><div className="mx-auto grid max-w-7xl gap-6">
    <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] via-[#111319] to-[#19110c] p-6"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-300"><Disc3 className="h-4 w-4" /> Clase · {site}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Ruleta de emparejamiento rápido</h1><p className="mt-2 max-w-3xl text-sm text-white/70">Marca quién está presente o cambia el selector para marcar únicamente ausentes. La ruleta respeta las reglas especiales y deja descanso cuando sea necesario.</p></header>

    <section className="rounded-3xl border border-white/10 bg-[#15171d] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-amber-300">Modo de selección</p><h2 className="mt-1 text-xl font-black">{selectionMode === "present" ? "Marca quienes sí están" : "Marca quienes no están"}</h2><p className="mt-1 text-xs text-white/70">{selectionMode === "present" ? "Solo las tarjetas marcadas entrarán a la ruleta." : "Todos entran excepto las tarjetas marcadas."}</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/25 px-4 py-3"><Label htmlFor="absent-mode" className={selectionMode === "present" ? "font-black text-white" : "text-white/60"}>Presentes</Label><Switch id="absent-mode" checked={selectionMode === "absent"} onCheckedChange={changeMode} /><Label htmlFor="absent-mode" className={selectionMode === "absent" ? "font-black text-white" : "text-white/60"}>Ausentes</Label></div></div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setMarkedIds(roster.map((profile) => profile.id))}>Marcar todos</Button><Button type="button" variant="outline" size="sm" onClick={() => setMarkedIds([])}>Limpiar marcas</Button><span className="ml-auto self-center text-sm font-black text-amber-200">{participants.length} participante{participants.length === 1 ? "" : "s"}</span></div></section>

    {error && <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button type="button" onClick={() => setAddingGuest(true)} className="grid min-h-36 place-items-center rounded-3xl border border-dashed border-amber-300/40 bg-amber-500/[.06] p-5 text-amber-100 hover:bg-amber-500/10"><span><Plus className="mx-auto h-8 w-8" /><strong className="mt-3 block">Agregar invitado</strong></span></button>
      {loading ? <div className="grid min-h-36 place-items-center rounded-3xl border border-white/10 bg-[#15171d]"><Loader2 className="h-6 w-6 animate-spin text-amber-300" /></div> : roster.map((profile) => { const marked = markedIds.includes(profile.id); const included = participants.some((item) => item.id === profile.id); return <article key={profile.id} className={`relative rounded-3xl border p-5 transition ${included ? "border-emerald-300/40 bg-emerald-500/10" : "border-white/10 bg-[#15171d] opacity-65"}`}><button type="button" onClick={() => toggle(profile.id)} aria-pressed={marked} className="flex w-full items-center gap-4 text-left"><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-black ${profile.kind === "coach" ? "bg-amber-300 text-slate-950" : profile.kind === "guest" ? "bg-sky-500/20 text-sky-200" : "bg-white/10 text-white"}`}>{profile.kind === "coach" ? <Sparkles className="h-6 w-6" /> : profile.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-lg">{profile.name}</strong><span className="text-xs font-bold uppercase tracking-wider text-white/60">{profile.kind === "coach" ? "Perfil especial" : profile.kind === "guest" ? "Invitado" : "Atleta"}</span><span className={`mt-2 flex items-center gap-1 text-xs font-black ${included ? "text-emerald-300" : "text-white/50"}`}>{included ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{included ? "En la ruleta" : "Fuera"}</span></span></button>{profile.kind === "guest" && <button type="button" onClick={() => removeGuest(profile.id)} aria-label={`Eliminar invitado ${profile.name}`} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-red-400/25 text-red-200"><X className="h-4 w-4" /></button>}</article>; })}
    </section>

    {addingGuest && <form onSubmit={addGuest} className="rounded-3xl border border-sky-400/25 bg-sky-500/[.08] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><Label htmlFor="guest-name" className="text-white">Nombre del invitado</Label><Input id="guest-name" autoFocus value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={60} required className="mt-2 border-white/20 bg-black/30 text-white" /></div><Button type="submit"><Plus className="mr-2 h-4 w-4" /> Agregar</Button><Button type="button" variant="outline" onClick={() => { setAddingGuest(false); setGuestName(""); }}>Cancelar</Button></div></form>}

    <section className="rounded-3xl border border-white/10 bg-[#15171d] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-violet-300">Resultado</p><h2 className="mt-1 text-xl font-black">Parejas del round</h2><p className={`mt-2 text-xs font-bold ${coachKarlaCount >= 3 ? "text-amber-300" : "text-white/60"}`}>Karla + COACH: {coachKarlaCount} de 3 apariciones en esta sesión{coachKarlaCount >= 3 ? " · combinación bloqueada" : ""}</p></div><Button type="button" onClick={spin} disabled={participants.length < 2 || spinning} className="min-h-12 bg-amber-300 font-black text-slate-950 hover:bg-amber-200">{spinning ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Disc3 className="mr-2 h-5 w-5" />}{spinning ? "Girando..." : pairs.length ? "Girar otra vez" : "Girar ruleta"}</Button></div>{pairs.length === 0 && !spinning ? <div className="mt-5 grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/15 text-center text-white/60"><span><Users className="mx-auto mb-3 h-8 w-8" />Selecciona al menos dos participantes y gira la ruleta.</span></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pairs.map((pair, index) => <article key={pair.id} className="rounded-2xl border border-violet-300/25 bg-violet-500/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Pareja {index + 1}</p><div className="mt-4 flex items-center justify-between gap-3"><ProfilePill profile={pair.left} /><span className="font-black text-white/50">VS</span><ProfilePill profile={pair.right} /></div></article>)}</div>}{resting.length > 0 && <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-amber-200">Descanso / sin pareja válida</p><p className="mt-2 font-bold text-white">{resting.map((profile) => profile.name).join(", ")}</p></div>}<p className="mt-5 text-xs leading-relaxed text-white/60">Reglas activas: Andy nunca se empareja con Lion, sin importar mayúsculas. Karla y COACH conservan una preferencia alta de aproximadamente 62%, pero aparecen juntos como máximo tres veces por sesión; después quedan bloqueados entre sí.</p></section>
  </div></main>;
}

function ProfilePill({ profile }: { profile: QuickProfile }) { return <div className="min-w-0 flex-1 text-center"><span className={`mx-auto grid h-11 w-11 place-items-center rounded-xl text-sm font-black ${profile.kind === "coach" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white"}`}>{profile.kind === "coach" ? <UserRound className="h-5 w-5" /> : profile.name.slice(0, 2).toUpperCase()}</span><strong className="mt-2 block truncate">{profile.name}</strong></div>; }
