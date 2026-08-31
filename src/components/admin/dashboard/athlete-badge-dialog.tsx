"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Award, Check, Loader2, ShieldCheck } from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { AdminAlumno } from "./admin-dashboard-model";

type AthleteBadgeDialogProps = {
  athlete: AdminAlumno | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (badgeIds: AthleteBadgeId[]) => Promise<void>;
};

export function AthleteBadgeDialog({
  athlete,
  saving,
  onOpenChange,
  onSave,
}: AthleteBadgeDialogProps) {
  const [selected, setSelected] = useState<AthleteBadgeId[]>([]);

  useEffect(() => {
    setSelected(normalizeAthleteBadgeIds(athlete?.insignias));
  }, [athlete]);

  const initial = useMemo(
    () => normalizeAthleteBadgeIds(athlete?.insignias),
    [athlete],
  );
  const hasChanges = initial.join("|") !== selected.join("|");

  const toggle = (id: AthleteBadgeId) => {
    if (saving) return;
    setSelected((current) =>
      current.includes(id)
        ? current.filter((badgeId) => badgeId !== id)
        : ATHLETE_BADGES.map((badge) => badge.id).filter(
            (badgeId) => badgeId === id || current.includes(badgeId),
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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-amber-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.1),transparent_36%),hsl(var(--card))] sm:max-w-3xl">
        {athlete && (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10">
                <Award className="h-5 w-5 text-amber-300" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">
                Insignias de {athlete.nombre}
              </DialogTitle>
              <DialogDescription>
                Selecciona uno o varios reconocimientos. Pulsa otra vez una
                insignia para retirarla.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-3 sm:grid-cols-3">
              {ATHLETE_BADGES.map((badge) => {
                const isSelected = selected.includes(badge.id);

                return (
                  <button
                    key={badge.id}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={saving}
                    onClick={() => toggle(badge.id)}
                    className={cn(
                      "group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70",
                      isSelected && badge.selectedClass,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full border transition",
                        isSelected
                          ? "border-emerald-300/60 bg-emerald-400 text-slate-950"
                          : "border-white/15 bg-black/35 text-transparent",
                      )}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <div className="relative mx-auto aspect-square w-full max-w-40 transition duration-200 group-hover:scale-[1.03]">
                      <Image
                        src={badge.imagen}
                        alt={badge.nombre}
                        fill
                        sizes="(max-width: 640px) 160px, 180px"
                        className={cn(
                          "object-contain drop-shadow-[0_15px_24px_rgba(0,0,0,.45)] transition",
                          !isSelected && "saturate-[.72] opacity-75",
                        )}
                      />
                    </div>
                    <p className={cn("mt-2 font-black", badge.accentClass)}>
                      {badge.nombre}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {badge.descripcion}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold">
                  {selected.length === 0
                    ? "Sin insignias asignadas"
                    : `${selected.length} de ${ATHLETE_BADGES.length} seleccionadas`}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  El cambio quedará guardado en la ficha del atleta y será
                  visible en su apartado de Recompensas.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving || !hasChanges}
                onClick={() => void onSave(selected)}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Award className="mr-2 h-4 w-4" />
                    Guardar insignias
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
