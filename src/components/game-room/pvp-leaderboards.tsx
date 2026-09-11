import { Crown, Flame, ShieldCheck, Swords, Trophy } from "lucide-react";
import type { GameLeaderboards, GameStanding } from "@/lib/game-room";

type BoardProps = {
  title: string;
  detail: string;
  entries: GameStanding[];
  icon: typeof Swords;
  tone: "cyan" | "violet" | "emerald" | "amber";
  value: (entry: GameStanding) => string;
};

const toneStyles = {
  cyan: "border-cyan-300/20 bg-cyan-400/[.06] text-cyan-300",
  violet: "border-violet-300/20 bg-violet-400/[.06] text-violet-300",
  emerald: "border-emerald-300/20 bg-emerald-400/[.06] text-emerald-300",
  amber: "border-amber-300/25 bg-amber-400/[.08] text-amber-300",
};

function Board({ title, detail, entries, icon: Icon, tone, value }: BoardProps) {
  return (
    <article className={`rounded-[1.75rem] border p-5 ${toneStyles[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-black/25"><Icon className="h-5 w-5" /></span>
        <div><h3 className="font-black text-white">{title}</h3><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{detail}</p></div>
      </div>
      <div className="mt-4 space-y-2">
        {entries.slice(0, 5).map((entry, index) => (
          <div key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/[.06] bg-black/25 p-3 text-white">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${index === 0 ? "bg-white text-slate-950" : "bg-white/10"}`}>{index + 1}</span>
            <span className="min-w-0 truncate text-sm font-bold">{entry.nombre}</span>
            <b className="text-sm">{value(entry)}</b>
          </div>
        ))}
        {!entries.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/40">La tabla empieza con el primer desafío de la semana.</p>}
      </div>
    </article>
  );
}

export function PvpLeaderboards({ boards }: { boards: GameLeaderboards }) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">Temporada semanal · desde {boards.weekKey}</p><h2 className="mt-1 text-2xl font-black text-white">Tablas PvP</h2></div>
        <p className="max-w-xl text-xs leading-5 text-white/45">Competimos para crecer: aceptar suma, rechazar resta sólo un punto y el respeto siempre vale más que la tabla.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Board title="Retadores" detail="Más desafíos enviados" entries={boards.challengers} icon={Swords} tone="cyan" value={(entry) => `${entry.sent} retos`} />
        <Board title="Más valientes" detail="Más retos aceptados" entries={boards.bravest} icon={ShieldCheck} tone="violet" value={(entry) => `${entry.accepted} sí`} />
        <Board title="Más victoriosos" detail="Victorias oficiales" entries={boards.victorious} icon={Trophy} tone="emerald" value={(entry) => `${entry.wins} V`} />
        <Board title="MVP" detail="Mejor puntuación total" entries={boards.mvp} icon={boards.mvp.length ? Crown : Flame} tone="amber" value={(entry) => `${entry.points} pts`} />
      </div>
    </section>
  );
}
