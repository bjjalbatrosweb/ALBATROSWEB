"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Check,
  Clock3,
  Loader2,
  ShieldCheck,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { PvpLeaderboards } from "@/components/game-room/pvp-leaderboards";
import { TournamentBracket } from "@/components/game-room/tournament-bracket";
import { Button } from "@/components/ui/button";
import { useFirestore, useUser } from "@/firebase";
import {
  buildWeeklyGameLeaderboards,
  calculatePvpStandings,
  gameTimestampMillis,
  getGameWeekKey,
  type GameMatch,
  type GameParticipant,
  type GamePrivateCard,
  type GamePvpChallenge,
} from "@/lib/game-room";

type Room = {
  sede: string;
  estado: "abierta" | "preparada" | "en_curso" | "resultados" | "finalizada";
  roundSeconds: number;
  challengeEnabled: boolean;
  participants: GameParticipant[];
  schedule: GameMatch[];
  currentRound: number;
  roundStartedAt?: unknown;
  roundStartedAtMs?: number;
  roundFinished?: boolean;
  tournamentId: string;
};
type Profile = { sede?: string; alumnoId?: string };
type Tournament = {
  weekKey?: string;
  participants?: GameParticipant[];
  schedule?: GameMatch[];
};

export default function AthleteGameRoomPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [profile, setProfile] = useState<Profile>({});
  const [room, setRoom] = useState<Room | null>(null);
  const [card, setCard] = useState<GamePrivateCard | null>(null);
  const [challenges, setChallenges] = useState<GamePvpChallenge[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(firestore, "usuarios", user.uid), (snapshot) =>
      setProfile(snapshot.data() as Profile),
    );
  }, [firestore, user]);
  useEffect(() => {
    if (!profile.sede) return;
    return onSnapshot(
      doc(firestore, "SalasJuego", profile.sede),
      (snapshot) =>
        setRoom(snapshot.exists() ? (snapshot.data() as Room) : null),
      () => setRoom(null),
    );
  }, [firestore, profile.sede]);
  useEffect(() => {
    if (!profile.sede) return;
    return onSnapshot(
      query(collection(firestore, "SalasJuego", profile.sede, "invitaciones"), where("weekKey", "==", getGameWeekKey()), limit(200)),
      (snapshot) =>
        setChallenges(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as GamePvpChallenge,
          ),
        ),
      () => setChallenges([]),
    );
  }, [firestore, profile.sede]);
  useEffect(() => {
    if (!profile.sede) return;
    return onSnapshot(
      query(collection(firestore, "SalasJuego", profile.sede, "torneos"), where("weekKey", "==", getGameWeekKey()), limit(100)),
      (snapshot) =>
        setTournaments(snapshot.docs.map((item) => item.data() as Tournament)),
      () => setTournaments([]),
    );
  }, [firestore, profile.sede]);
  useEffect(() => {
    if (!profile.sede || !profile.alumnoId) return;
    return onSnapshot(
      doc(firestore, "SalasJuego", profile.sede, "cartas", profile.alumnoId),
      (snapshot) =>
        setCard(
          snapshot.exists() ? (snapshot.data() as GamePrivateCard) : null,
        ),
      () => setCard(null),
    );
  }, [firestore, profile.sede, profile.alumnoId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const me = room?.participants.find((item) => item.id === profile.alumnoId);
  const currentChallenges = useMemo(
    () => challenges.filter((item) => item.tournamentId === room?.tournamentId),
    [challenges, room?.tournamentId],
  );
  const incoming = useMemo(
    () => currentChallenges.filter((item) => item.challengedId === me?.id),
    [currentChallenges, me?.id],
  );
  const outgoing = useMemo(
    () => currentChallenges.filter((item) => item.challengerId === me?.id),
    [currentChallenges, me?.id],
  );
  const currentMatch = room?.schedule.find(
    (match) =>
      (room.estado === "preparada" || match.round === room.currentRound) &&
      (match.a.id === me?.id || match.b.id === me?.id),
  );
  const opponent = currentMatch
    ? currentMatch.a.id === me?.id
      ? currentMatch.b
      : currentMatch.a
    : null;
  const ownChallenge = currentMatch
    ? card?.retos?.[currentMatch.id]
    : undefined;
  const roundStartedAt = gameTimestampMillis(room?.roundStartedAt) || room?.roundStartedAtMs || 0;
  const seconds =
    room?.estado === "en_curso" && !room.roundFinished && roundStartedAt
      ? Math.max(
          0,
          room.roundSeconds - Math.floor((now - roundStartedAt) / 1000),
        )
      : 0;
  const weeklyParticipants = useMemo(
    () => [
      ...new Map(
        [
          ...(room?.participants || []),
          ...tournaments.flatMap((item) => item.participants || []),
        ].map((item) => [item.id, item]),
      ).values(),
    ],
    [room?.participants, tournaments],
  );
  const weeklySchedules = useMemo(() => {
    const week = getGameWeekKey();
    const values = tournaments
      .filter((item) => item.weekKey === week)
      .map((item) => item.schedule || []);
    if (room && room.estado !== "resultados" && room.estado !== "finalizada")
      values.push(room.schedule || []);
    return values;
  }, [room, tournaments]);
  const leaderboards = useMemo(
    () =>
      buildWeeklyGameLeaderboards(
        weeklyParticipants,
        challenges,
        weeklySchedules,
      ),
    [weeklyParticipants, challenges, weeklySchedules],
  );
  const currentStandings = useMemo(
    () =>
      calculatePvpStandings(room?.participants || [], currentChallenges, [
        room?.schedule || [],
      ]),
    [room?.participants, room?.schedule, currentChallenges],
  );
  const myStanding = currentStandings.find((item) => item.id === me?.id);

  async function challenge(target: GameParticipant) {
    if (!room || !me || !profile.sede || !user) return;
    const existing = outgoing.find((item) => item.challengedId === target.id);
    setBusyId(target.id);
    setError("");
    try {
      if (existing?.status === "pendiente")
        await gameAction("cancelar_reto", { desafioId: existing.id });
      else if (!existing) await gameAction("retar", { oponenteId: target.id });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el reto.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function answer(
    invitation: GamePvpChallenge,
    status: "aceptado" | "rechazado",
  ) {
    if (
      !profile.sede ||
      invitation.challengedId !== me?.id ||
      invitation.status !== "pendiente"
    )
      return;
    setBusyId(invitation.id);
    setError("");
    try {
      await gameAction("responder", { desafioId: invitation.id, estado: status });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo responder el reto.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function gameAction(accion: string, extra: Record<string, unknown>) {
    if (!user || !profile.sede) throw new Error("La sesión no está disponible.");
    const token = await user.getIdToken();
    const response = await fetch("/api/sala-juego", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion, sede: profile.sede, ...extra }),
    });
    const data = (await response.json().catch(() => ({}))) as { mensaje?: string };
    if (!response.ok) throw new Error(data.mensaje || "No se pudo actualizar el reto.");
  }

  if (isUserLoading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#06080d] text-white">
        <Loader2 className="animate-spin" />
      </main>
    );
  if (!room || room.estado === "finalizada" || !me)
    return (
      <main className="grid min-h-screen place-items-center bg-[#06080d] p-5 text-white">
        <div className="max-w-lg rounded-[2rem] border border-dashed border-white/20 p-10 text-center">
          <Swords className="mx-auto h-12 w-12 text-cyan-300" />
          <h1 className="mt-4 text-3xl font-black">Sala de juego PvP</h1>
          <p className="mt-2 text-white/55">
            Todavía no hay una sala abierta para ti.
          </p>
        </div>
      </main>
    );

  if (room.estado === "abierta")
    return (
      <main className="min-h-screen bg-[#06080d] px-4 py-7 text-white">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 p-7">
            <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">
              PvP con buen ambiente
            </p>
            <h1 className="mt-2 text-4xl font-black">
              Desafía. Responde. Compite.
            </h1>
            <p className="mt-2 text-white/55">
              Enviar reto: +1 · Aceptar: +2 · Rechazar: −1 · Competir: +1 ·
              Victoria: +5.
            </p>
            {myStanding && (
              <div className="mt-5 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 font-black text-emerald-200">
                Tu marcador provisional: {myStanding.points} pts
              </div>
            )}
          </header>
          {error && (
            <p className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-red-100">
              {error}
            </p>
          )}
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-violet-300">
                  Bandeja de entrada
                </p>
                <h2 className="text-2xl font-black">Personas que te retaron</h2>
              </div>
              <span className="text-sm text-white/40">
                {incoming.filter((item) => item.status === "pendiente").length}{" "}
                pendientes
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {incoming.map((invitation) => (
                <article
                  key={invitation.id}
                  className={`rounded-2xl border p-5 ${invitation.status === "aceptado" ? "border-emerald-300/25 bg-emerald-400/[.07]" : invitation.status === "rechazado" ? "border-red-300/20 bg-red-400/[.06]" : "border-violet-300/25 bg-violet-400/[.07]"}`}
                >
                  <div className="flex items-center gap-3">
                    <Swords className="text-violet-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/40">Te desafía</p>
                      <b className="text-lg">{invitation.challengerName}</b>
                    </div>
                    <Decision status={invitation.status} />
                  </div>
                  {invitation.status === "pendiente" && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        disabled={busyId === invitation.id}
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={() => void answer(invitation, "aceptado")}
                      >
                        <Check className="mr-2" />
                        Aceptar +2
                      </Button>
                      <Button
                        disabled={busyId === invitation.id}
                        variant="outline"
                        className="border-red-300/25 text-red-200"
                        onClick={() => void answer(invitation, "rechazado")}
                      >
                        <X className="mr-2" />
                        No aceptar −1
                      </Button>
                    </div>
                  )}
                </article>
              ))}
              {!incoming.length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-white/40">
                  Aún no te han retado. Tú puedes iniciar la competencia.
                </p>
              )}
            </div>
          </section>
          <section className="mt-8">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
              Lanza un reto
            </p>
            <h2 className="text-2xl font-black">Elige oponente</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {room.participants
                .filter((item) => item.id !== me.id)
                .map((target) => {
                  const invitation = outgoing.find(
                    (item) => item.challengedId === target.id,
                  );
                  return (
                    <button
                      key={target.id}
                      disabled={
                        Boolean(
                          invitation && invitation.status !== "pendiente",
                        ) || busyId === target.id
                      }
                      onClick={() => void challenge(target)}
                      className={`rounded-3xl border p-5 text-left transition ${invitation?.status === "aceptado" ? "border-emerald-300/30 bg-emerald-400/10" : invitation?.status === "rechazado" ? "border-red-300/20 bg-red-400/[.06]" : invitation ? "border-amber-300/30 bg-amber-400/10" : "border-white/10 bg-white/[.03] hover:border-cyan-300/35"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <b className="text-lg">{target.nombre}</b>
                        {invitation ? (
                          <Decision status={invitation.status} />
                        ) : (
                          <Swords className="h-4 w-4 text-cyan-300" />
                        )}
                      </span>
                      <span className="mt-2 block text-xs text-white/40">
                        {invitation?.status === "pendiente"
                          ? "Pulsa para cancelar mientras no responda"
                          : invitation
                            ? "Respuesta registrada"
                            : "Enviar desafío · +1 punto"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
          <PvpLeaderboards boards={leaderboards} />
        </div>
      </main>
    );

  if (room.estado === "resultados") {
    const place = currentStandings.findIndex((entry) => entry.id === me.id) + 1;
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#302408,#05070b_48%)] px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <header className="rounded-[2.5rem] border border-amber-300/30 bg-black/50 p-8 text-center">
            <Trophy className="mx-auto h-14 w-14 text-amber-300" />
            <p className="mt-3 text-xs font-black uppercase tracking-widest text-amber-300">
              Torneo terminado
            </p>
            <h1 className="mt-2 text-5xl font-black">Terminaste #{place}</h1>
            <p className="mt-2 text-white/50">
              {myStanding?.points || 0} puntos PvP en esta sala.
            </p>
          </header>
          <Ranking entries={currentStandings} me={me.id} />
          <PvpLeaderboards boards={leaderboards} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070b] px-4 py-7 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-amber-300/25 bg-black/45 p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">
            {room.estado === "preparada"
              ? "Reto aceptado · cartelera lista"
              : `Round ${room.currentRound} en vivo`}
          </p>
          <h1 className="mt-2 text-4xl font-black">
            {opponent
              ? `${me.nombre} vs ${opponent.nombre}`
              : "Descansas este round"}
          </h1>
          {room.estado === "en_curso" && (
            <>
              <Clock3 className="mx-auto mt-5 text-emerald-300" />
              <p className="text-7xl font-black tabular-nums">
                {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                {String(seconds % 60).padStart(2, "0")}
              </p>
            </>
          )}
        </header>
        {currentMatch && opponent ? (
          <section className="mt-6 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <PlayerCard player={me} label="Tú" challenge={ownChallenge} />
            <Swords className="mx-auto h-8 w-8 text-white/30" />
            <PlayerCard player={opponent} label="Rival" />
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-cyan-300" />
            <h2 className="mt-4 text-2xl font-black">Turno de recuperación</h2>
          </section>
        )}
        <div className="mt-6">
          <TournamentBracket
            schedule={room.schedule}
            currentRound={room.currentRound}
            viewerId={me.id}
            title="Cartelera PvP"
          />
        </div>
        <PvpLeaderboards boards={leaderboards} />
      </div>
    </main>
  );
}

function Decision({ status }: { status: GamePvpChallenge["status"] }) {
  const style =
    status === "aceptado"
      ? "bg-emerald-400/15 text-emerald-200"
      : status === "rechazado"
        ? "bg-red-400/15 text-red-200"
        : "bg-amber-400/15 text-amber-200";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${style}`}
    >
      {status}
    </span>
  );
}

function PlayerCard({
  player,
  label,
  challenge,
}: {
  player: GameParticipant;
  label: string;
  challenge?: { derribe: string; sumision: string };
}) {
  return (
    <article className="min-h-72 rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-violet-400/10 p-7">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
        {label}
      </p>
      <h2 className="mt-7 text-4xl font-black">{player.nombre}</h2>
      {challenge ? (
        <div className="mt-8 space-y-4">
          <p className="rounded-xl bg-black/25 p-3">
            <span className="block text-[10px] uppercase text-white/40">
              Derribe
            </span>
            <b>{challenge.derribe}</b>
          </p>
          <p className="rounded-xl bg-black/25 p-3">
            <span className="block text-[10px] uppercase text-white/40">
              Sumisión
            </span>
            <b>{challenge.sumision}</b>
          </p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-white/40">
          Su carta técnica permanece privada.
        </p>
      )}
    </article>
  );
}

function Ranking({
  entries,
  me,
}: {
  entries: ReturnType<typeof calculatePvpStandings>;
  me: string;
}) {
  return (
    <section className="mt-6 space-y-3">
      {entries.map((entry, index) => (
        <article
          key={entry.id}
          className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border p-5 ${entry.id === me ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[.035]"}`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 font-black">
            {index + 1}
          </span>
          <div>
            <b>{entry.nombre}</b>
            <p className="text-xs text-white/40">
              {entry.wins} victorias · {entry.accepted} aceptados ·{" "}
              {entry.declined} rechazados
            </p>
          </div>
          <b className="text-2xl text-emerald-300">{entry.points} pts</b>
        </article>
      ))}
    </section>
  );
}
