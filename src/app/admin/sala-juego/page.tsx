"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Check,
  Clock3,
  Dices,
  Loader2,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Square,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { PvpLeaderboards } from "@/components/game-room/pvp-leaderboards";
import { TournamentBracket } from "@/components/game-room/tournament-bracket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  buildPrivateGameCards,
  buildPvpGameSchedule,
  buildWeeklyGameLeaderboards,
  calculatePvpStandings,
  createGameChallenge,
  gameTimestampMillis,
  getGameWeekKey,
  getMaxGameRound,
  type GameMatch,
  type GameParticipant,
  type GamePvpChallenge,
} from "@/lib/game-room";

type Room = {
  sede: string;
  estado: "abierta" | "preparada" | "en_curso" | "resultados" | "finalizada";
  areas: number;
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
type AthleteDoc = { nombre?: string; activo?: boolean };
type Tournament = {
  weekKey?: string;
  participants?: GameParticipant[];
  schedule?: GameMatch[];
};

export default function AdminGameRoomPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [site, setSite] = useState("MMA");
  const [siteReady, setSiteReady] = useState(false);
  const [athletes, setAthletes] = useState<GameParticipant[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [guests, setGuests] = useState<GameParticipant[]>([]);
  const [guestName, setGuestName] = useState("");
  const [areas, setAreas] = useState(3);
  const [minutes, setMinutes] = useState(5);
  const [technicalCards, setTechnicalCards] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [challenges, setChallenges] = useState<GamePvpChallenge[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem("userSede");
    if (saved) setSite(saved);
    setSiteReady(true);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!siteReady) return;
    return onSnapshot(
        doc(firestore, "SalasJuego", site),
        (snapshot) =>
          setRoom(snapshot.exists() ? (snapshot.data() as Room) : null),
        (reason) => setError(reason.message),
      );
  }, [firestore, site, siteReady]);
  useEffect(() => {
    if (!siteReady) return;
    return onSnapshot(
        query(collection(firestore, "SalasJuego", site, "invitaciones"), where("weekKey", "==", getGameWeekKey()), limit(200)),
        (snapshot) =>
          setChallenges(
            snapshot.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as GamePvpChallenge,
            ),
          ),
        () => setChallenges([]),
      );
  }, [firestore, site, siteReady]);
  useEffect(() => {
    if (!siteReady) return;
    return onSnapshot(
        query(collection(firestore, "SalasJuego", site, "torneos"), where("weekKey", "==", getGameWeekKey()), limit(100)),
        (snapshot) =>
          setTournaments(
            snapshot.docs.map((item) => item.data() as Tournament),
          ),
        () => setTournaments([]),
      );
  }, [firestore, site, siteReady]);
  useEffect(() => {
    if (!siteReady) return;
    let cancelled = false;
    setLoadingAthletes(true);
    void getDocs(
      query(collection(firestore, "Alumnos"), where("sede", "==", site)),
    )
      .then((snapshot) => {
        if (cancelled) return;
        setAthletes(
          snapshot.docs
            .filter((item) => (item.data() as AthleteDoc).activo !== false)
            .map((item) => ({
              id: item.id,
              nombre: String((item.data() as AthleteDoc).nombre || "Atleta"),
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(
          reason instanceof Error
            ? reason.message
            : "No se pudieron cargar los atletas.",
        );
      })
      .finally(() => { if (!cancelled) setLoadingAthletes(false); });
    return () => { cancelled = true; };
  }, [firestore, site, siteReady]);

  const participants = useMemo(
    () => [...athletes.filter((item) => selected.includes(item.id)), ...guests],
    [athletes, guests, selected],
  );
  const currentChallenges = useMemo(
    () => challenges.filter((item) => item.tournamentId === room?.tournamentId),
    [challenges, room?.tournamentId],
  );
  const maxRound = getMaxGameRound(room?.schedule || []);
  const activeMatches =
    room?.schedule.filter((item) => item.round === room.currentRound) || [];
  const roundStartedAt = gameTimestampMillis(room?.roundStartedAt) || room?.roundStartedAtMs || 0;
  const remaining =
    room?.estado === "en_curso" && !room.roundFinished && roundStartedAt
      ? Math.max(
          0,
          room.roundSeconds - Math.floor((now - roundStartedAt) / 1000),
        )
      : 0;
  const weeklyParticipants = useMemo(() => {
    const all = [
      ...(room?.participants || []),
      ...tournaments.flatMap((item) => item.participants || []),
    ];
    return [...new Map(all.map((item) => [item.id, item])).values()];
  }, [room?.participants, tournaments]);
  const weeklySchedules = useMemo(() => {
    const week = getGameWeekKey();
    const historic = tournaments
      .filter((item) => item.weekKey === week)
      .map((item) => item.schedule || []);
    if (room && room.estado !== "resultados" && room.estado !== "finalizada")
      historic.push(room.schedule || []);
    return historic;
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
  const liveStandings = useMemo(
    () =>
      calculatePvpStandings(room?.participants || [], currentChallenges, [
        room?.schedule || [],
      ]),
    [room?.participants, room?.schedule, currentChallenges],
  );

  async function publish() {
    if (!user || participants.length < 2)
      return setError("Selecciona al menos dos participantes.");
    setBusy(true);
    setError("");
    try {
      const tournamentId = `${Date.now()}-${user.uid.slice(0, 8)}`;
      const [oldPreferences, oldCards] = await Promise.all([
        getDocs(collection(firestore, "SalasJuego", site, "desafios")),
        getDocs(collection(firestore, "SalasJuego", site, "cartas")),
      ]);
      const batch = writeBatch(firestore);
      oldPreferences.docs.forEach((item) => batch.delete(item.ref));
      oldCards.docs.forEach((item) => batch.delete(item.ref));
      batch.set(doc(firestore, "SalasJuego", site), {
        sede: site,
        estado: "abierta",
        areas: Math.max(1, Math.min(12, areas)),
        roundSeconds: Math.max(1, Math.min(30, minutes)) * 60,
        challengeEnabled: technicalCards,
        participants,
        participantIds: participants.map((item) => item.id),
        schedule: [],
        currentRound: 0,
        roundStartedAtMs: 0,
        roundFinished: false,
        tournamentId,
        creadoPor: user.uid,
        actualizadoEn: serverTimestamp(),
      });
      await batch.commit();
      toast({
        title: "Sala PvP publicada",
        description: "Los retos requieren respuesta del oponente.",
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo publicar la sala.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createGuestChallenge(
    challenger: GameParticipant,
    challenged: GameParticipant,
  ) {
    if (!room) return;
    const challenge = createGameChallenge(
      room.tournamentId,
      site,
      challenger,
      challenged,
    );
    await setDoc(
      doc(firestore, "SalasJuego", site, "invitaciones", challenge.id),
      challenge,
    );
  }

  async function answerForGuest(
    challenge: GamePvpChallenge,
    status: "aceptado" | "rechazado",
  ) {
    await setDoc(
      doc(firestore, "SalasJuego", site, "invitaciones", challenge.id),
      { status, respondedAtMs: Date.now(), actualizadoEn: serverTimestamp() },
      { merge: true },
    );
  }

  async function generate() {
    if (!room || !user) return;
    const schedule = buildPvpGameSchedule(
      room.participants,
      currentChallenges,
      room.areas,
    );
    if (!schedule.length)
      return setError(
        "No hay retos aceptados. Al menos una persona debe aceptar antes de crear el torneo.",
      );
    setBusy(true);
    setError("");
    try {
      const cards = buildPrivateGameCards(
        schedule,
        room.participants,
        room.challengeEnabled,
      );
      const previous = await getDocs(
        collection(firestore, "SalasJuego", site, "cartas"),
      );
      const batch = writeBatch(firestore);
      previous.docs.forEach((item) => batch.delete(item.ref));
      cards.forEach((card) =>
        batch.set(
          doc(firestore, "SalasJuego", site, "cartas", card.participantId),
          { ...card, sede: site, actualizadoEn: serverTimestamp() },
        ),
      );
      batch.set(
        doc(firestore, "SalasJuego", site),
        {
          estado: "preparada",
          schedule,
          currentRound: 0,
          roundStartedAtMs: 0,
          roundFinished: false,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: user.uid,
        },
        { merge: true },
      );
      await batch.commit();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo generar el torneo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateRoom(patch: Record<string, unknown>) {
    if (!user) return;
    await setDoc(
      doc(firestore, "SalasJuego", site),
      { ...patch, actualizadoEn: serverTimestamp(), actualizadoPor: user.uid },
      { merge: true },
    );
  }

  async function serverAction(accion: string, extra: Record<string, unknown> = {}) {
    if (!user) throw new Error("La sesión no está disponible.");
    const token = await user.getIdToken();
    const response = await fetch("/api/sala-juego", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion, sede: site, ...extra }),
    });
    const data = (await response.json().catch(() => ({}))) as { mensaje?: string };
    if (!response.ok) throw new Error(data.mensaje || "No se pudo actualizar la sala.");
  }

  async function startRound(round: number) {
    if (!room || busy) return;
    setBusy(true); setError("");
    try { await serverAction("iniciar_round", { round }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar el round."); }
    finally { setBusy(false); }
  }
  async function closeRound() {
    if (!room || busy) return;
    setBusy(true); setError("");
    try { await serverAction("cerrar_round"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cerrar el round."); }
    finally { setBusy(false); }
  }
  async function reopen() {
    await updateRoom({
      estado: "abierta",
      schedule: [],
      currentRound: 0,
      roundStartedAtMs: 0,
      roundFinished: false,
    });
  }

  async function setWinner(matchId: string, winnerId: string) {
    if (!user) return;
    const roomRef = doc(firestore, "SalasJuego", site);
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return;
      const current = snapshot.data() as Room;
      transaction.set(
        roomRef,
        {
          schedule: current.schedule.map((item) =>
            item.id === matchId
              ? {
                  ...item,
                  winnerId: item.winnerId === winnerId ? "" : winnerId,
                }
              : item,
          ),
          actualizadoEn: serverTimestamp(),
          actualizadoPor: user.uid,
        },
        { merge: true },
      );
    });
  }

  async function finish() {
    if (!room || !user || busy) return;
    if (!room.roundFinished || room.currentRound < maxRound) {
      setError("Completa todos los rounds antes de finalizar el torneo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await serverAction("finalizar");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo finalizar.",
      );
    } finally {
      setBusy(false);
    }
  }

  function addGuest() {
    const nombre = guestName.trim();
    if (!nombre) return;
    setGuests((current) => [
      ...current,
      { id: `guest-${Date.now()}`, nombre, invitado: true },
    ]);
    setGuestName("");
  }

  if (!room || room.estado === "finalizada")
    return (
      <main className="min-h-screen bg-[#06080d] p-5 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 p-7">
            <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">
              PvP con consentimiento
            </p>
            <h1 className="mt-2 text-4xl font-black">Sala de juego</h1>
            <p className="mt-2 text-white/55">
              Retos, respuestas, puntos y competencia con buen ambiente.
            </p>
          </header>
          {error && (
            <p className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-red-100">
              {error}
            </p>
          )}
          <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[.03] p-6 md:grid-cols-3">
            <label>
              <Label>Áreas</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={areas}
                onChange={(event) => setAreas(Number(event.target.value))}
              />
            </label>
            <label>
              <Label>Minutos</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
              />
            </label>
            <label className="flex items-end gap-3 pb-2">
              <Switch
                checked={technicalCards}
                onCheckedChange={setTechnicalCards}
              />
              <b>Cartas técnicas</b>
            </label>
          </section>
          <section className="rounded-3xl border border-white/10 p-6">
            <h2 className="text-xl font-black">Participantes</h2>
            {loadingAthletes ? (
              <Loader2 className="mt-5 animate-spin" />
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {athletes.map((athlete) => (
                  <button
                    key={athlete.id}
                    onClick={() =>
                      setSelected((current) =>
                        current.includes(athlete.id)
                          ? current.filter((id) => id !== athlete.id)
                          : [...current, athlete.id],
                      )
                    }
                    className={`rounded-2xl border p-4 text-left font-bold ${selected.includes(athlete.id) ? "border-cyan-300 bg-cyan-400/15" : "border-white/10 bg-white/[.03]"}`}
                  >
                    {athlete.nombre}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Nombre del invitado"
              />
              <Button onClick={addGuest}>
                <Plus className="mr-2 h-4 w-4" />
                Invitado
              </Button>
            </div>
            {guests.map((guest) => (
              <span
                key={guest.id}
                className="mr-2 mt-3 inline-flex rounded-full bg-violet-500/15 px-3 py-2 text-sm font-bold"
              >
                {guest.nombre}
              </span>
            ))}
          </section>
          <Button
            className="h-14 w-full font-black"
            disabled={busy || participants.length < 2}
            onClick={() => void publish()}
          >
            <Radio className="mr-2" />
            Publicar sala para {participants.length}
          </Button>
          <PvpLeaderboards boards={leaderboards} />
        </div>
      </main>
    );

  if (room.estado === "abierta")
    return (
      <main className="min-h-screen bg-[#06080d] p-5 text-white">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-cyan-300/20 bg-cyan-400/[.06] p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                Retos abiertos
              </p>
              <h1 className="mt-1 text-3xl font-black">
                Esperando respuestas PvP
              </h1>
              <p className="mt-1 text-sm text-white/50">
                {
                  currentChallenges.filter((item) => item.status === "aceptado")
                    .length
                }{" "}
                aceptados ·{" "}
                {
                  currentChallenges.filter(
                    (item) => item.status === "pendiente",
                  ).length
                }{" "}
                pendientes ·{" "}
                {
                  currentChallenges.filter(
                    (item) => item.status === "rechazado",
                  ).length
                }{" "}
                rechazados
              </p>
            </div>
            <Button disabled={busy} onClick={() => void generate()}>
              <Dices className="mr-2" />
              Crear torneo con aceptados
            </Button>
          </header>
          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-red-200">
              {error}
            </p>
          )}
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {currentChallenges.map((challenge) => (
              <article
                key={challenge.id}
                className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
              >
                <div className="flex items-center gap-3">
                  <Swords className="text-cyan-300" />
                  <div className="min-w-0 flex-1">
                    <b>{challenge.challengerName}</b>
                    <span className="mx-2 text-white/25">→</span>
                    <b>{challenge.challengedName}</b>
                  </div>
                  <Status status={challenge.status} />
                </div>
                {challenge.status === "pendiente" &&
                  room.participants.find(
                    (item) => item.id === challenge.challengedId,
                  )?.invitado && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void answerForGuest(challenge, "aceptado")
                        }
                      >
                        <Check className="mr-1" />
                        Aceptar por invitado
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void answerForGuest(challenge, "rechazado")
                        }
                      >
                        <X className="mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
              </article>
            ))}
          </section>
          {room.participants.some((item) => item.invitado) && (
            <section className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-500/[.05] p-5">
              <h2 className="font-black">Retos de invitados</h2>
              <div className="mt-3 space-y-3">
                {room.participants
                  .filter((item) => item.invitado)
                  .map((guest) => (
                    <div key={guest.id}>
                      <p className="text-sm font-bold text-violet-200">
                        {guest.nombre}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {room.participants
                          .filter((item) => item.id !== guest.id)
                          .map((target) => (
                            <Button
                              key={target.id}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void createGuestChallenge(guest, target)
                              }
                            >
                              {target.nombre}
                            </Button>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          <PvpLeaderboards boards={leaderboards} />
        </div>
      </main>
    );

  if (room.estado === "resultados")
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#302408,#05070b_48%)] p-5 text-white">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-[2.5rem] border border-amber-300/30 bg-black/50 p-8 text-center">
            <Trophy className="mx-auto h-14 w-14 text-amber-300" />
            <h1 className="mt-3 text-5xl font-black">Resultados PvP</h1>
            <p className="mt-2 text-white/50">
              El puntaje ya incluye retos, valentía, rechazos, combates y
              victorias.
            </p>
          </header>
          <Ranking entries={liveStandings} />
          <PvpLeaderboards boards={leaderboards} />
          <Button
            className="mt-6 h-14 w-full"
            onClick={() => void updateRoom({ estado: "finalizada" })}
          >
            Cerrar y crear otra sala
          </Button>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#05070b] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-center justify-between gap-5 rounded-[2rem] border border-amber-300/25 bg-black/45 p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">
              {room.estado === "preparada"
                ? "Cartelera lista"
                : `Round ${room.currentRound} en vivo`}
            </p>
            <h1 className="mt-1 text-3xl font-black">Sala PvP</h1>
          </div>
          {room.estado === "en_curso" && (
            <div className="text-center">
              <Clock3 className="mx-auto text-emerald-300" />
              <p className="text-5xl font-black tabular-nums">
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {room.estado === "preparada" ? (
              <>
                <Button variant="outline" onClick={() => void reopen()}>
                  <RotateCcw className="mr-2" />
                  Reabrir
                </Button>
                <Button onClick={() => void startRound(1)}>
                  <Play className="mr-2" />
                  Iniciar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() =>
                    void (room.roundFinished
                      ? startRound(room.currentRound + 1)
                      : closeRound())
                  }
                  disabled={room.roundFinished && room.currentRound >= maxRound}
                >
                  {room.roundFinished ? (
                    <Play className="mr-2" />
                  ) : (
                    <Square className="mr-2" />
                  )}
                  {room.roundFinished ? "Siguiente round" : "Cerrar round"}
                </Button>
                <Button variant="destructive" disabled={busy || !room.roundFinished || room.currentRound < maxRound} onClick={() => void finish()}>
                  Finalizar
                </Button>
              </>
            )}
          </div>
        </header>
        {room.estado === "preparada" ? (
          <div className="mt-6">
            <TournamentBracket
              schedule={room.schedule}
              title="Cartelera de retos aceptados"
            />
          </div>
        ) : (
          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            {activeMatches.map((match) => (
              <article
                key={match.id}
                className="rounded-[2rem] border border-white/10 bg-white/[.035] p-5"
              >
                <div className="flex justify-between">
                  <b className="text-cyan-300">Área {match.area}</b>
                  <span className="text-xs text-white/40">
                    {match.solicitudMutua ? "Reto mutuo" : "Reto aceptado"}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xl font-black">
                  <span>{match.a.nombre}</span>
                  <Swords className="text-white/30" />
                  <span className="text-right">{match.b.nombre}</span>
                </div>
                {room.challengeEnabled && (
                  <p className="mt-4 rounded-xl bg-black/30 p-3 text-center text-sm text-amber-200">
                    {match.derribe} + {match.sumision}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant={
                      match.winnerId === match.a.id ? "default" : "outline"
                    }
                    onClick={() => void setWinner(match.id, match.a.id)}
                  >
                    <Trophy className="mr-2" />
                    {match.a.nombre}
                  </Button>
                  <Button
                    variant={
                      match.winnerId === match.b.id ? "default" : "outline"
                    }
                    onClick={() => void setWinner(match.id, match.b.id)}
                  >
                    <Trophy className="mr-2" />
                    {match.b.nombre}
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}
        <PvpLeaderboards boards={leaderboards} />
      </div>
    </main>
  );
}

function Status({ status }: { status: GamePvpChallenge["status"] }) {
  const style =
    status === "aceptado"
      ? "bg-emerald-400/15 text-emerald-200"
      : status === "rechazado"
        ? "bg-red-400/15 text-red-200"
        : "bg-amber-400/15 text-amber-200";
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${style}`}
    >
      {status}
    </span>
  );
}

function Ranking({
  entries,
}: {
  entries: ReturnType<typeof calculatePvpStandings>;
}) {
  return (
    <section className="mt-6 space-y-3">
      {entries.map((entry, index) => (
        <article
          key={entry.id}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-5"
        >
          <span
            className={`grid h-11 w-11 place-items-center rounded-full font-black ${index === 0 ? "bg-amber-300 text-black" : "bg-white/10"}`}
          >
            {index + 1}
          </span>
          <div>
            <b className="text-lg">{entry.nombre}</b>
            <p className="text-xs text-white/45">
              {entry.sent} retos · {entry.accepted} aceptados · {entry.declined}{" "}
              rechazados · {entry.wins} victorias
            </p>
          </div>
          <b className="text-2xl text-emerald-300">{entry.points} pts</b>
        </article>
      ))}
    </section>
  );
}
