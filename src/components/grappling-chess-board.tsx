"use client";

import { Crown, Shield, Swords, Target } from "lucide-react";

import { POSITION_LABELS, type GrapplingChessMove, type GrapplingChessState } from "@/lib/grappling-chess";

export function GrapplingChessBoard({ state, moves, requiredMove, onMove, busy = false, online = false }: { state: GrapplingChessState; moves: GrapplingChessMove[]; requiredMove?: GrapplingChessMove | null; onMove: (moveId: string) => void; busy?: boolean; online?: boolean }) {
  const winner = state.winner === null ? null : state.players[state.winner]; const controlling = state.controller === null ? "Posición disputada" : `${state.players[state.controller]} controla`;
  return <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
    <div className="relative min-h-[570px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(239,68,68,.14),transparent_34%),linear-gradient(145deg,#12151d,#08090d)] p-5 shadow-2xl sm:p-7">
      <div className="absolute inset-8 rounded-[38%] border border-red-400/10" /><div className="absolute inset-20 rounded-[38%] border border-white/[.04]" />
      <header className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PlayerCard name={state.players[0]} active={state.turn === 0 && state.winner === null} control={state.controller === 0} tone="red" />
        <div className="text-center"><Swords className="mx-auto h-6 w-6 text-white/30" /><span className="mt-1 block text-[9px] font-black uppercase tracking-[.22em] text-white/35">{online ? "En línea" : "En el tatami"}</span></div>
        <PlayerCard name={state.players[1]} active={state.turn === 1 && state.winner === null} control={state.controller === 1} tone="blue" />
      </header>
      <div className="relative z-10 grid min-h-[410px] place-items-center text-center">
        <div>
          {winner ? <><Crown className="mx-auto h-14 w-14 text-amber-300" /><p className="mt-4 text-xs font-black uppercase tracking-[.25em] text-amber-300">Sumisión consolidada</p><h2 className="mt-2 text-4xl font-black sm:text-6xl">{winner}</h2><p className="mx-auto mt-3 max-w-md text-sm text-white/55">Llegó a la finalización después de cerrar las salidas. Partida terminada.</p></> : <><p className="text-[10px] font-black uppercase tracking-[.24em] text-red-300">Posición actual</p><h2 className="mt-2 text-4xl font-black sm:text-6xl">{POSITION_LABELS[state.position]}</h2><p className="mt-3 text-sm font-bold text-white/55">{controlling}</p><div className="mx-auto mt-5 flex max-w-sm items-center gap-2"><span className="text-[9px] font-black uppercase text-white/35">Control</span>{[1,2,3].map((level) => <i key={level} className={`h-3 flex-1 rounded-full ${state.control >= level ? "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,.35)]" : "bg-white/10"}`} />)}</div>{state.control >= 3 && state.controller === state.turn && <p className="mx-auto mt-5 max-w-md rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-200">Las salidas están cerradas: busca la sumisión.</p>}</>}
        </div>
      </div>
      {!winner && <footer className="relative z-10 text-center"><span className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-black text-white/65">Turno de {state.players[state.turn]}</span></footer>}
    </div>
    <aside className="rounded-[2rem] border border-white/10 bg-[#13151b] p-5">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-500/15 text-red-300">{requiredMove ? <Target /> : <Shield />}</span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-red-300">{requiredMove ? "Movimiento de la ruleta" : "Movimientos legales"}</p><h3 className="font-black">{requiredMove ? requiredMove.label : `${moves.length} opciones`}</h3></div></div>
      {requiredMove && <p className="mt-4 rounded-xl border border-red-300/15 bg-red-500/[.07] p-3 text-sm leading-6 text-white/65">{requiredMove.detail}</p>}
      <div className="mt-4 grid gap-2">{moves.map((move) => { const selected = !requiredMove || requiredMove.id === move.id; return <button key={move.id} type="button" disabled={busy || !selected || state.winner !== null} onClick={() => onMove(move.id)} className={`group rounded-2xl border p-4 text-left transition active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-30 ${move.category === "sumision" ? "border-amber-300/35 bg-amber-400/10" : selected ? "border-white/10 bg-white/[.045] hover:border-red-300/30 hover:bg-red-500/[.08]" : "border-white/[.04] bg-transparent"}`}><span className={`text-[9px] font-black uppercase tracking-[.18em] ${move.category === "sumision" ? "text-amber-300" : "text-red-300"}`}>{move.category}</span><b className="mt-1 block text-base">{move.label}</b><small className="mt-1 block leading-5 text-white/45">{move.detail}</small></button>; })}{!moves.length && !winner && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">Esperando el movimiento del rival.</p>}</div>
      <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-white/60">Historial ({state.history.length})</summary><div className="mt-3 grid max-h-52 gap-2 overflow-auto">{[...state.history].reverse().map((item, index) => <p key={`${item.at}-${index}`} className="text-xs text-white/45"><b className={item.player === 0 ? "text-red-300" : "text-sky-300"}>{state.players[item.player]}</b> · {item.label}</p>)}</div></details>
    </aside>
  </section>;
}

function PlayerCard({ name, active, control, tone }: { name: string; active: boolean; control: boolean; tone: "red" | "blue" }) {
  return <article className={`rounded-2xl border p-3 ${active ? tone === "red" ? "border-red-400/45 bg-red-500/10" : "border-sky-400/45 bg-sky-500/10" : "border-white/10 bg-black/20"} ${tone === "blue" ? "text-right" : ""}`}><span className={`text-[9px] font-black uppercase tracking-wider ${tone === "red" ? "text-red-300" : "text-sky-300"}`}>{active ? "Tu turno" : control ? "Control" : "Jugador"}</span><b className="block truncate text-sm sm:text-lg">{name}</b></article>;
}
