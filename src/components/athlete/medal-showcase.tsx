import Image from "next/image";
import { Medal, Sparkles, Trophy } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssignedTournamentMedals } from "@/lib/tournament-medals";
import { cn } from "@/lib/utils";

type MedalShowcaseProps = {
  assignedMedals: unknown;
  compact?: boolean;
  className?: string;
};

export function MedalShowcase({ assignedMedals, compact = false, className }: MedalShowcaseProps) {
  const medals = getAssignedTournamentMedals(assignedMedals);

  return (
    <Card
      className={cn(
        "overflow-hidden border-amber-300/20 bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,.14),transparent_35%),linear-gradient(135deg,hsl(var(--card)/.92),hsl(var(--card)/.55))]",
        className,
      )}
    >
      <CardHeader className={cn(compact && "pb-3")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,.1)]">
              <Trophy className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-black uppercase italic tracking-wide">Medallero</CardTitle>
              <CardDescription>Participaciones y reconocimientos de torneos.</CardDescription>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
            <Medal className="h-3.5 w-3.5" />
            {medals.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {medals.length === 0 ? (
          <div className={cn("grid place-items-center rounded-3xl border border-dashed border-amber-200/15 bg-black/10 px-5 text-center", compact ? "min-h-28" : "min-h-40")}>
            <div>
              <Sparkles className="mx-auto h-6 w-6 text-amber-200/45" />
              <p className="mt-2 text-sm font-black text-foreground/80">Tu medallero está listo</p>
              <p className="mt-1 text-xs text-muted-foreground">Aquí aparecerán las medallas de los torneos en los que participes.</p>
            </div>
          </div>
        ) : (
          <div className={cn("grid gap-3", compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
            {medals.map((medal) => (
              <article key={medal.id} className="group relative overflow-hidden rounded-3xl border border-amber-200/20 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition hover:-translate-y-0.5 hover:border-amber-200/40">
                <span className="absolute right-3 top-3 rounded-full border border-amber-200/20 bg-amber-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">Obtenida</span>
                <div className={cn("relative mx-auto", compact ? "h-32 w-32" : "h-44 w-44")}>
                  <Image src={medal.imagen} alt={medal.nombre} fill sizes={compact ? "128px" : "176px"} className="object-contain drop-shadow-[0_18px_26px_rgba(245,158,11,.22)] transition duration-300 group-hover:scale-[1.03]" />
                </div>
                <p className="mt-3 text-sm font-black text-amber-100">{medal.nombreCorto}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{medal.descripcion}</p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
