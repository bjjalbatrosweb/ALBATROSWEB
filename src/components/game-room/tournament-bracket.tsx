"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Expand, MapPin, Minimize2, Radio, Shield, Swords, Trophy, Volume2, VolumeX } from "lucide-react";
import type { GameMatch } from "@/lib/game-room";
import { cn } from "@/lib/utils";

type Props = { schedule: GameMatch[]; currentRound?: number; viewerId?: string; title?: string };

export function TournamentBracket({ schedule, currentRound = 0, viewerId, title = "Cuadro del torneo" }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(true);
  const rounds = Array.from(new Set(schedule.map((match) => match.round))).sort((a, b) => a - b);
  const completed = schedule.filter((match) => match.estado === "completado").length;

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { /* El navegador conserva la vista normal si bloquea fullscreen. */ }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    window.dispatchEvent(new CustomEvent("game-room-sound", { detail: next }));
  }

  return <section ref={rootRef} className="fight-arena relative overflow-hidden rounded-[2rem] border border-red-500/25 bg-[#050506] p-4 text-white shadow-[0_32px_110px_rgba(0,0,0,.72),0_0_50px_rgba(220,38,38,.07)] md:p-7">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:36px_36px]"/>
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_22px_#ef4444]"/>
    <div className="fight-beam pointer-events-none absolute -top-40 h-[34rem] w-36 -rotate-[24deg] bg-gradient-to-b from-white/0 via-red-500/[.08] to-white/0 blur-2xl"/>
    <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-red-600/[.08] blur-3xl"/>

    <header className="relative flex flex-wrap items-center justify-between gap-5 border-b border-white/[.08] pb-5">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500 to-red-800 shadow-[0_0_28px_rgba(239,68,68,.28)]"><Swords className="h-7 w-7"/></span>
        <div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.32em] text-red-400"><Radio className="h-3 w-3 animate-pulse"/> Albatros Fight Night</p><h2 className="mt-1 text-2xl font-black uppercase italic tracking-[-.04em] md:text-4xl">{title}</h2></div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="hidden rounded-xl border border-white/10 bg-white/[.04] px-4 py-2 text-right sm:block"><p className="text-[8px] font-black uppercase tracking-widest text-white/35">Progreso</p><p className="text-sm font-black"><span className="text-red-400">{completed}</span> / {schedule.length}</p></div>
        <button type="button" onClick={toggleSound} className="fight-control" aria-label={sound ? "Silenciar avisos" : "Activar avisos"}>{sound ? <Volume2/> : <VolumeX/>}</button>
        <button type="button" onClick={() => void toggleFullscreen()} className="fight-control" aria-label="Cambiar pantalla completa">{fullscreen ? <Minimize2/> : <Expand/>}</button>
      </div>
    </header>

    <div className="relative mt-6 flex snap-x gap-5 overflow-x-auto pb-4">
      {rounds.map((round, roundIndex) => {
        const live = currentRound === round;
        const matches = schedule.filter((match) => match.round === round);
        return <section key={round} className="min-w-[300px] flex-1 snap-start animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: `${roundIndex * 80}ms`, animationFillMode: "both" }}>
          <div className={cn("relative mb-3 overflow-hidden rounded-xl border px-4 py-3", live ? "border-red-400/45 bg-red-500/15 shadow-[0_0_30px_rgba(239,68,68,.12)]" : "border-white/10 bg-white/[.035]")}>
            {live && <div className="absolute inset-y-0 left-0 w-1 bg-red-500 shadow-[0_0_15px_#ef4444]"/>}
            <div className="flex items-center justify-between"><p className="text-sm font-black uppercase italic tracking-[-.02em]">Round <span className="text-red-400">{String(round).padStart(2, "0")}</span></p><span className={cn("rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-widest", live ? "bg-red-500 text-white" : "bg-white/[.06] text-white/35")}>{live ? "● En vivo" : `${matches.length} peleas`}</span></div>
          </div>
          <div className="space-y-3">{matches.map((match, index) => <FightCard key={match.id} match={match} index={index} mine={viewerId === match.a.id || viewerId === match.b.id}/>)}</div>
        </section>;
      })}
    </div>

    <footer className="relative mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-4 text-[9px] font-black uppercase tracking-[.18em] text-white/30"><span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-red-400"/>Resultados oficiales sincronizados</span><span>{rounds.length} rounds · {schedule.length} combates</span></footer>
    <style jsx global>{`@keyframes fightBeam{0%{left:-18%;opacity:0}20%{opacity:1}80%{opacity:1}100%{left:112%;opacity:0}}.fight-beam{animation:fightBeam 8s ease-in-out infinite}.fight-control{display:grid;height:2.8rem;width:2.8rem;place-items:center;border-radius:.75rem;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.045);color:rgba(255,255,255,.72);transition:.2s}.fight-control:hover{border-color:rgba(248,113,113,.5);background:rgba(239,68,68,.14);color:white;box-shadow:0 0 22px rgba(239,68,68,.16)}.fight-control svg{height:1rem;width:1rem}.fight-arena:fullscreen{overflow:auto;border-radius:0;padding:2rem;background:#050506}`}</style>
  </section>;
}

function FightCard({ match, index, mine }: { match: GameMatch; index: number; mine: boolean }) {
  const live = match.estado === "en_curso";
  const done = match.estado === "completado";
  return <article className={cn("group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#17181b] to-[#09090b] p-3 transition duration-300 hover:-translate-y-1", live ? "border-red-400/50 shadow-[0_0_34px_rgba(239,68,68,.17)]" : mine ? "border-amber-300/45 shadow-[0_0_28px_rgba(251,191,36,.1)]" : "border-white/10", done && "opacity-85")}>
    <div className={cn("absolute inset-y-0 left-0 w-1", live ? "animate-pulse bg-red-500 shadow-[0_0_16px_#ef4444]" : mine ? "bg-amber-300" : "bg-white/10")}/>
    <div className="flex items-center justify-between px-2 text-[8px] font-black uppercase tracking-[.18em] text-white/35"><span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-red-400"/>Octágono {match.area}</span><span>{live ? <b className="text-red-400">● Live</b> : done ? "Resultado oficial" : `Pelea ${index + 1}`}</span></div>
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[.06] bg-black/40">
      <FighterRow name={match.a.nombre} winner={match.winnerId === match.a.id} corner="red"/>
      <div className="relative flex h-6 items-center justify-center border-y border-white/[.06] bg-[#0c0c0e]"><span className="absolute left-3 text-[8px] font-black uppercase tracking-widest text-red-400">Roja</span><span className="rounded bg-white px-2 py-0.5 text-[8px] font-black italic text-black">VS</span><span className="absolute right-3 text-[8px] font-black uppercase tracking-widest text-blue-400">Azul</span></div>
      <FighterRow name={match.b.nombre} winner={match.winnerId === match.b.id} corner="blue"/>
    </div>
    <div className="mt-3 flex items-center justify-between px-2"><span className="text-[8px] font-black uppercase tracking-widest text-white/25">{match.solicitudMutua ? "Desafío mutuo" : "Combate solicitado"}</span>{mine && <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase text-amber-200">Tu combate</span>}</div>
  </article>;
}

function FighterRow({ name, winner, corner }: { name: string; winner: boolean; corner: "red" | "blue" }) {
  return <div className={cn("flex min-h-12 items-center justify-between gap-3 px-3", winner && "bg-amber-300/10 text-amber-100")}><span className={cn("h-7 w-1 rounded-full", corner === "red" ? "bg-red-500 shadow-[0_0_10px_#ef4444]" : "bg-blue-500 shadow-[0_0_10px_#3b82f6]")}/><strong className="min-w-0 flex-1 truncate text-sm font-black uppercase italic tracking-tight">{name}</strong>{winner ? <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-300"><Crown className="h-4 w-4"/>Ganador</span> : <Trophy className="h-4 w-4 text-white/10"/>}</div>;
}
