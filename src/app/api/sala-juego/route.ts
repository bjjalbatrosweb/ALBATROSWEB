import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  calculatePvpStandings,
  completeGameRound,
  createGameChallenge,
  finalizeGameSchedule,
  getGameWeekKey,
  getMaxGameRound,
  isGameScheduleComplete,
  startGameRound,
  type GameMatch,
  type GameParticipant,
  type GamePvpChallenge,
} from "@/lib/game-room";
import {
  RequestAccessError,
  requireActiveActorAccess,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
type Room = {
  sede: Sede;
  estado: string;
  participants: GameParticipant[];
  schedule: GameMatch[];
  currentRound: number;
  roundFinished?: boolean;
  tournamentId: string;
};

function site(value: unknown): Sede | null {
  const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SITES.includes(normalized) ? normalized : null;
}

function id(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_-]{1,200}$/.test(normalized) ? normalized : "";
}

async function staffAction(request: Request, body: Record<string, unknown>, sede: Sede) {
  const actor = await requirePanelActorAccess(request, sede);
  const roomRef = adminDb.collection("SalasJuego").doc(sede);
  const action = String(body.accion || "");

  if (action === "finalizar") {
    const before = await roomRef.get();
    if (!before.exists) throw new RequestAccessError("La sala no existe.", 404);
    const room = before.data() as Room;
    const challengesSnapshot = await roomRef
      .collection("invitaciones")
      .where("tournamentId", "==", room.tournamentId)
      .limit(500)
      .get();
    const challenges = challengesSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as GamePvpChallenge);
    const schedule = finalizeGameSchedule(room.schedule || []);
    if (!room.roundFinished || room.currentRound < getMaxGameRound(schedule) || !isGameScheduleComplete(schedule)) {
      throw new RequestAccessError("Completa todos los rounds antes de finalizar el torneo.", 409);
    }
    const ranking = calculatePvpStandings(room.participants || [], challenges, [schedule]);
    const tournamentRef = roomRef.collection("torneos").doc(room.tournamentId);
    const rankingRefs = ranking.map((entry) => roomRef.collection("ranking").doc(entry.id));
    const created = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(roomRef);
      const tournament = await transaction.get(tournamentRef);
      const rankingSnapshots = await Promise.all(rankingRefs.map((reference) => transaction.get(reference)));
      const currentRoom = current.data() as Room | undefined;
      if (!currentRoom || currentRoom.tournamentId !== room.tournamentId) throw new RequestAccessError("La sala cambió. Actualiza la página.", 409);
      if (tournament.exists) return false;
      if (!currentRoom.roundFinished || !isGameScheduleComplete(currentRoom.schedule || [])) throw new RequestAccessError("Todavía hay combates sin completar.", 409);
      transaction.create(tournamentRef, {
        tournamentId: room.tournamentId,
        weekKey: getGameWeekKey(),
        sede,
        participants: room.participants,
        challenges,
        schedule,
        ranking,
        finalizadoEn: FieldValue.serverTimestamp(),
        finalizadoPor: actor.uid,
      });
      transaction.set(roomRef, {
        estado: "resultados",
        schedule,
        rankingFinal: ranking,
        roundStartedAt: FieldValue.delete(),
        roundStartedAtMs: 0,
        roundFinished: true,
        actualizadoEn: FieldValue.serverTimestamp(),
        actualizadoPor: actor.uid,
      }, { merge: true });
      ranking.forEach((entry, index) => {
        const saved = rankingSnapshots[index].data() || {};
        transaction.set(rankingRefs[index], {
          participantId: entry.id,
          nombre: entry.nombre,
          puntos: Math.max(0, Number(saved.puntos) || 0) + entry.points,
          victorias: Math.max(0, Number(saved.victorias) || 0) + entry.wins,
          combates: Math.max(0, Number(saved.combates) || 0) + entry.fights,
          retos: Math.max(0, Number(saved.retos) || 0) + entry.sent,
          aceptados: Math.max(0, Number(saved.aceptados) || 0) + entry.accepted,
          rechazados: Math.max(0, Number(saved.rechazados) || 0) + entry.declined,
          actualizadoEn: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      return true;
    });
    return { ok: true, duplicada: !created };
  }

  const round = Number(body.round);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) throw new RequestAccessError("La sala no existe.", 404);
    const room = snapshot.data() as Room;
    if (action === "iniciar_round") {
      const expected = room.estado === "preparada" ? 1 : room.currentRound + 1;
      if (!Number.isInteger(round) || round !== expected || (room.estado !== "preparada" && !room.roundFinished) || round > getMaxGameRound(room.schedule || [])) {
        throw new RequestAccessError("Ese round no puede iniciarse todavía.", 409);
      }
      transaction.set(roomRef, {
        estado: "en_curso",
        currentRound: round,
        roundStartedAt: FieldValue.serverTimestamp(),
        roundStartedAtMs: 0,
        roundFinished: false,
        schedule: startGameRound(room.schedule || [], round),
        actualizadoEn: FieldValue.serverTimestamp(),
        actualizadoPor: actor.uid,
      }, { merge: true });
      return;
    }
    if (action === "cerrar_round") {
      if (room.estado !== "en_curso" || room.roundFinished || room.currentRound < 1) throw new RequestAccessError("No hay un round activo para cerrar.", 409);
      transaction.set(roomRef, {
        roundStartedAt: FieldValue.delete(),
        roundStartedAtMs: 0,
        roundFinished: true,
        schedule: completeGameRound(room.schedule || [], room.currentRound),
        actualizadoEn: FieldValue.serverTimestamp(),
        actualizadoPor: actor.uid,
      }, { merge: true });
      return;
    }
    throw new RequestAccessError("Acción no válida.", 400);
  });
  return { ok: true };
}

async function athleteAction(request: Request, body: Record<string, unknown>, sede: Sede) {
  const actor = await requireActiveActorAccess(request);
  if (actor.profile.rol !== "atleta" || actor.profile.sede !== sede || !actor.profile.alumnoId) throw new RequestAccessError("Cuenta de atleta no válida para esta sede.", 403);
  const roomRef = adminDb.collection("SalasJuego").doc(sede);
  const roomSnapshot = await roomRef.get();
  const room = roomSnapshot.data() as Room | undefined;
  if (!room || room.estado !== "abierta") throw new RequestAccessError("Los retos ya no están abiertos.", 409);
  const me = room.participants.find((entry) => entry.id === actor.profile.alumnoId);
  if (!me) throw new RequestAccessError("No participas en esta sala.", 403);
  const action = String(body.accion || "");
  if (action === "retar") {
    const target = room.participants.find((entry) => entry.id === id(body.oponenteId));
    if (!target || target.id === me.id) throw new RequestAccessError("Oponente no válido.", 400);
    const challenge = createGameChallenge(room.tournamentId, sede, me, target, new Date());
    await roomRef.collection("invitaciones").doc(challenge.id).create({ ...challenge, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp() });
    return { ok: true };
  }
  const challengeId = id(body.desafioId);
  if (!challengeId) throw new RequestAccessError("Desafío no válido.", 400);
  const reference = roomRef.collection("invitaciones").doc(challengeId);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const challenge = snapshot.data() as GamePvpChallenge | undefined;
    if (!challenge || challenge.tournamentId !== room.tournamentId) throw new RequestAccessError("El desafío no existe.", 404);
    if (action === "cancelar_reto") {
      if (challenge.challengerId !== me.id || challenge.status !== "pendiente") throw new RequestAccessError("Ese reto ya no puede cancelarse.", 409);
      transaction.delete(reference);
      return;
    }
    if (action === "responder") {
      const status = body.estado === "aceptado" ? "aceptado" : body.estado === "rechazado" ? "rechazado" : null;
      if (!status || challenge.challengedId !== me.id || challenge.status !== "pendiente") throw new RequestAccessError("Ese reto ya no puede responderse.", 409);
      transaction.update(reference, { status, respondedAtMs: Date.now(), respondidoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp() });
      return;
    }
    throw new RequestAccessError("Acción no válida.", 400);
  });
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const sede = site(body?.sede);
    if (!body || !sede) throw new RequestAccessError("Sede no válida.", 400);
    const action = String(body.accion || "");
    const result = ["iniciar_round", "cerrar_round", "finalizar"].includes(action)
      ? await staffAction(request, body, sede)
      : await athleteAction(request, body, sede);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    const code = String((error as { code?: unknown })?.code || "");
    if (code.includes("already-exists")) return NextResponse.json({ ok: false, mensaje: "Ese reto ya fue enviado." }, { status: 409 });
    console.error("GAME_ROOM_ACTION_ERROR", error);
    return NextResponse.json({ ok: false, mensaje: "No se pudo actualizar la sala." }, { status: 500 });
  }
}
