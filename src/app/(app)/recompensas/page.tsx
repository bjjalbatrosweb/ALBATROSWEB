"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { Award, Check, ChevronDown, Home, Loader2, Lock, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MedalShowcase } from "@/components/athlete/medal-showcase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useUser } from "@/firebase";
import { ATHLETE_BADGES, normalizeAthleteBadgeIds, type AthleteBadgeId } from "@/lib/athlete-badges";
import { normalizeTournamentMedalIds, type TournamentMedalId } from "@/lib/tournament-medals";
import { cn } from "@/lib/utils";

const months = [
  { name: "JUNIO", points: "+1" }, { name: "JULIO", points: "+2" },
  { name: "AGOSTO", points: "+3", hasChest: true }, { name: "SEPTIEMBRE", points: "+4" },
  { name: "OCTUBRE", points: "+5" }, { name: "NOVIEMBRE", points: "+6" },
  { name: "DICIEMBRE", points: "+7", hasChest: true },
];

export default function RecompensasPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [assignedBadges, setAssignedBadges] = useState<AthleteBadgeId[]>([]);
  const [assignedMedals, setAssignedMedals] = useState<TournamentMedalId[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [badgeError, setBadgeError] = useState("");

  useEffect(() => {
    const month = new Date().getMonth();
    setCurrentMonthIndex(month < 5 ? -1 : month > 11 ? 7 : month - 5);
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    let active = true;
    const loadAssignedBadges = async () => {
      try {
        setLoadingBadges(true);
        setBadgeError("");
        const accessSnapshot = await getDoc(doc(firestore, "usuarios", user.uid));
        const athleteId = accessSnapshot.exists() ? String(accessSnapshot.data().alumnoId || "") : "";
        if (!athleteId) {
          if (active) {
            setAssignedBadges([]);
            setAssignedMedals([]);
          }
          return;
        }
        const athleteSnapshot = await getDoc(doc(firestore, "Alumnos", athleteId));
        if (!athleteSnapshot.exists()) throw new Error("No se encontró la ficha vinculada a tu cuenta.");
        if (active) {
          setAssignedBadges(normalizeAthleteBadgeIds(athleteSnapshot.data().insignias));
          setAssignedMedals(normalizeTournamentMedalIds(athleteSnapshot.data().medallas));
        }
      } catch (error) {
        if (active) setBadgeError(error instanceof Error ? error.message : "No fue posible consultar tus insignias.");
      } finally {
        if (active) setLoadingBadges(false);
      }
    };
    void loadAssignedBadges();
    return () => { active = false; };
  }, [firestore, user]);

  return (
    <div className="min-h-screen space-y-10 bg-background p-4 md:p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Programa de Recompensas</h1>
          <p className="text-muted-foreground">Tu constancia y desempeño también se reconocen.</p>
        </div>
        <Button variant="ghost" size="sm" asChild><Link href="/"><Home className="mr-2 h-4 w-4" /> Inicio</Link></Button>
      </header>

      <main className="mx-auto max-w-6xl space-y-10">
        <Card className="overflow-hidden border-amber-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.11),transparent_40%),hsl(var(--card)/.55)] backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10"><Award className="h-5 w-5 text-amber-300" /></div>
              <div><CardTitle className="font-black uppercase italic tracking-wide">Mis insignias Albatros</CardTitle><CardDescription>Reconocimientos asignados por tu profesor.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBadges ? (
              <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Consultando reconocimientos...</div>
            ) : badgeError ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">{badgeError}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {ATHLETE_BADGES.map((badge) => {
                  const unlocked = assignedBadges.includes(badge.id);
                  return (
                    <article key={badge.id} className={cn("relative overflow-hidden rounded-3xl border p-4 transition", unlocked ? badge.selectedClass : "border-white/5 bg-black/20 opacity-45 grayscale")}>
                      <span className={cn("absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider", unlocked ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-300" : "border-white/10 bg-black/30 text-muted-foreground")}>
                        {unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{unlocked ? "Obtenida" : "Pendiente"}
                      </span>
                      <div className="relative mx-auto aspect-square w-full max-w-44"><Image src={badge.imagen} alt={badge.nombre} fill sizes="(max-width: 640px) 176px, 190px" className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,.48)]" /></div>
                      <p className={cn("mt-2 font-black", badge.accentClass)}>{badge.nombre}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{unlocked ? badge.descripcion : "Sigue entrenando: tu profesor puede otorgarte este reconocimiento."}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <MedalShowcase assignedMedals={assignedMedals} />

        <Card className="overflow-hidden border-primary/20 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-0 text-center">
            <div className="mb-2 flex items-center justify-center gap-2"><Trophy className="h-6 w-6 text-primary" /><CardTitle className="font-black uppercase italic tracking-widest">Progreso de Temporada</CardTitle></div>
            <CardDescription>Avance automático basado en tu permanencia.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-16">
            <div className="scrollbar-hide relative overflow-x-auto pb-12 pt-32">
              <div className="absolute left-0 right-0 top-[204px] h-1 rounded-full bg-muted-foreground/20" />
              <div className="relative flex min-w-[800px] items-start justify-between px-4">
                {months.map((month, index) => {
                  const isPastOrCurrent = index <= currentMonthIndex;
                  const isCurrent = index === currentMonthIndex;
                  const chestImage = isPastOrCurrent ? "/cofreabierto.png" : "/cofrecerrado.png";
                  return (
                    <div key={month.name} className="relative z-10 flex w-24 flex-col items-center">
                      <div className="group mb-4 flex h-32 flex-col items-center justify-end">
                        {month.hasChest && <div className={cn("relative transition-all duration-700", isPastOrCurrent ? "scale-110" : "grayscale opacity-50", isCurrent && "animate-pulse")}>
                          <Image src={chestImage} alt="Cofre" width={85} height={85} className="drop-shadow-[0_0_15px_rgba(255,0,0,0.2)]" />
                          {isPastOrCurrent && <div className="absolute -right-2 -top-2 animate-bounce rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold italic text-white shadow-lg">¡REVELADO!</div>}
                        </div>}
                      </div>
                      <span className={cn("mb-4 text-xs font-black tracking-tighter", isPastOrCurrent ? "text-primary" : "text-muted-foreground")}>{month.name}</span>
                      <div className="relative flex h-10 w-10 items-center justify-center">
                        {isCurrent && <div className="absolute -top-12 flex animate-bounce flex-col items-center"><ChevronDown className="h-10 w-10 text-primary" strokeWidth={5} /><div className="h-2 w-2 animate-ping rounded-full bg-primary" /></div>}
                        <div className={cn("h-4 w-4 rounded-full border-2", isPastOrCurrent ? "scale-125 border-primary bg-primary" : "border-muted-foreground bg-background")} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
