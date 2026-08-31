"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Award, Check, Loader2, Medal, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ATHLETE_BADGES,
  normalizeAthleteBadgeIds,
  type AthleteBadgeId,
} from "@/lib/athlete-badges";
import { isBillableAthlete } from "@/lib/member-role";
import {
  normalizeTournamentMedalIds,
  TOURNAMENT_MEDALS,
  type TournamentMedalId,
} from "@/lib/tournament-medals";
import { cn } from "@/lib/utils";
import type { AdminAlumno } from "./admin-dashboard-model";

type RecognitionSection = "badges" | "medals";

type AthleteBadgeDialogProps = {
  athlete: AdminAlumno | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (badgeIds: AthleteBadgeId[], medalIds: TournamentMedalId[]) => Promise<void>;
};

export function AthleteBadgeDialog({
  athlete,
  saving,
  onOpenChange,
  onSave,
}: AthleteBadgeDialogProps) {
  const [section, setSection] = useState<RecognitionSection>("badges");
  const [selectedBadges, setSelectedBadges] = useState<AthleteBadgeId[]>([]);
  const [selectedMedals, setSelectedMedals] = useState<TournamentMedalId[]>([]);
  const athleteProfile = isBillableAthlete(athlete?.rol);

  useEffect(() => {
    setSelectedBadges(normalizeAthleteBadgeIds(athlete?.insignias));
    setSelectedMedals(normalizeTournamentMedalIds(athlete?.medallas));
    setSection(isBillableAthlete(athlete?.rol) ? "badges" : "medals");
  }, [athlete]);

  const initialBadges = useMemo(
    () => normalizeAthleteBadgeIds(athlete?.insignias),
    [athlete],
  );
  const initialMedals = useMemo(
    () => normalizeTournamentMedalIds(athlete?.medallas),
    [athlete],
  );
  const hasChanges =
    initialBadges.join("|") !== selectedBadges.join("|") ||
    initialMedals.join("|") !== selectedMedals.join("|");

  const toggleBadge = (id: AthleteBadgeId) => {
    if (saving || !athleteProfile) return;
    setSelectedBadges((current) =>
      current.includes(id)
        ? current.filter((badgeId) => badgeId !== id)
        : ATHLETE_BADGES.map((badge) => badge.id).filter(
            (badgeId) => badgeId === id || current.includes(badgeId),
          ),
    );
  };

  const toggleMedal = (id: TournamentMedalId) => {
    if (saving) return;
    setSelectedMedals((current) =>
      current.includes(id)
        ? current.filter((medalId) => medalId !== id)
        : TOURNAMENT_MEDALS.map((medal) => medal.id).filter(
            (medalId) => medalId === id || current.includes(medalId),
          ),
    );
  };

  return (
    <Dialog
      open={athlete !== null}
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-amber-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.1),transparent_36%),hsl(var(--card))] sm:max-w-4xl">
        {athlete && (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10">
                <Trophy className="h-5 w-5 text-amber-300" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">
                Reconocimientos de {athlete.nombre}
              </DialogTitle>
              <DialogDescription>
                Administra insignias de nivel y medallas digitales de torneos desde un solo lugar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
              <button
                type="button"
                disabled={!athleteProfile || saving}
                onClick={() => setSection("badges")}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition",
                  section === "badges" ? "bg-white/10 text-white shadow" : "text-muted-foreground hover:bg-white/5",
                  !athleteProfile && "cursor-not-allowed opacity-40",
                )}
              >
                <Award className="h-4 w-4" />
                Insignias · {selectedBadges.length}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSection("medals")}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition",
                  section === "medals" ? "bg-amber-400/15 text-amber-200 shadow" : "text-muted-foreground hover:bg-white/5",
                )}
              >
                <Medal className="h-4 w-4" />
                Medallero · {selectedMedals.length}
              </button>
            </div>

            {section === "badges" ? (
              <div className="grid gap-3 py-3 sm:grid-cols-3">
                {ATHLETE_BADGES.map((badge) => (
                  <RecognitionCard
                    key={badge.id}
                    selected={selectedBadges.includes(badge.id)}
                    disabled={saving}
                    onClick={() => toggleBadge(badge.id)}
                    image={badge.imagen}
                    name={badge.nombre}
                    description={badge.descripcion}
                    selectedClass={badge.selectedClass}
                    accentClass={badge.accentClass}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 py-3 sm:grid-cols-2">
                {TOURNAMENT_MEDALS.map((medal) => (
                  <RecognitionCard
                    key={medal.id}
                    selected={selectedMedals.includes(medal.id)}
                    disabled={saving}
                    onClick={() => toggleMedal(medal.id)}
                    image={medal.imagen}
                    name={medal.nombre}
                    description={medal.descripcion}
                    selectedClass="border-amber-300/70 bg-amber-400/10 shadow-[0_0_34px_rgba(251,191,36,.18)]"
                    accentClass="text-amber-200"
                  />
                ))}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold">
                  {selectedBadges.length} insignias · {selectedMedals.length} medallas
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Las medallas están disponibles para atletas, profesores, staff y administración. Las insignias de nivel permanecen reservadas para atletas.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saving || !hasChanges} onClick={() => void onSave(selectedBadges, selectedMedals)}>
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : (
                  <><Trophy className="mr-2 h-4 w-4" />Guardar reconocimientos</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecognitionCard({ selected, disabled, onClick, image, name, description, selectedClass, accentClass }: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  image: string;
  name: string;
  description: string;
  selectedClass: string;
  accentClass: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70",
        selected && selectedClass,
      )}
    >
      <span className={cn("absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full border transition", selected ? "border-emerald-300/60 bg-emerald-400 text-slate-950" : "border-white/15 bg-black/35 text-transparent")}>
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <div className="relative mx-auto aspect-square w-full max-w-40 transition duration-200 group-hover:scale-[1.03]">
        <Image src={image} alt={name} fill sizes="(max-width: 640px) 160px, 180px" className={cn("object-contain drop-shadow-[0_15px_24px_rgba(0,0,0,.45)] transition", !selected && "saturate-[.72] opacity-75")} />
      </div>
      <p className={cn("mt-2 font-black", accentClass)}>{name}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}
