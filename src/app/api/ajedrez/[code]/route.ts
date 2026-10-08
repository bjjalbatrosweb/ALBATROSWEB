import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { applyGrapplingChessMove, legalGrapplingChessMoves, type ChessPlayerIndex, type GrapplingChessState } from "@/lib/grappling-chess";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function playerIndex(token: string, players: Array<{ tokenHash?: unknown }>): ChessPlayerIndex | null { const tokenHash = hash(token); if (players[0]?.tokenHash === tokenHash) return 0; if (players[1]?.tokenHash === tokenHash) return 1; return null; }
function publicState(state: GrapplingChessState, viewer: ChessPlayerIndex) { return { ...state, viewer, legalMoves: state.turn === viewer ? legalGrapplingChessMoves(state) : [] }; }

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const rate = await checkRateLimit(request, { scope: "ajedrez-ver", limit: 30, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Espera unos segundos antes de actualizar." }, { status: 429 });
  const { code } = await context.params; const token = new URL(request.url).searchParams.get("token") || ""; const snapshot = await adminDb.collection("AjedrezPartidas").doc(code.toUpperCase()).get(); const data = snapshot.data();
  if (!snapshot.exists || !data || !Array.isArray(data.players)) return NextResponse.json({ ok: false, mensaje: "Partida no encontrada." }, { status: 404 });
  const viewer = playerIndex(token, data.players); if (viewer === null) return NextResponse.json({ ok: false, mensaje: "Invitación inválida." }, { status: 403 });
  if (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() < Date.now()) return NextResponse.json({ ok: false, mensaje: "La partida ya venció." }, { status: 410 });
  return NextResponse.json({ ok: true, code: snapshot.id, state: publicState(data.state as GrapplingChessState, viewer), expiresAt: data.expiresAt.toDate().toISOString() });
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const rate = await checkRateLimit(request, { scope: "ajedrez-mover", limit: 12, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados movimientos. Espera un momento." }, { status: 429 });
  try {
    const { code } = await context.params; const body = await request.json().catch(() => ({})); const token = text(body.token, 200); const moveId = text(body.moveId, 60); const expectedRevision = Number(body.revision); const ref = adminDb.collection("AjedrezPartidas").doc(code.toUpperCase());
    const output = await adminDb.runTransaction(async (transaction): Promise<{ state: GrapplingChessState; viewer: ChessPlayerIndex }> => {
      const snapshot = await transaction.get(ref); const data = snapshot.data();
      if (!snapshot.exists || !data || !Array.isArray(data.players)) throw new Error("NOT_FOUND");
      const viewer = playerIndex(token, data.players); if (viewer === null) throw new Error("FORBIDDEN");
      if (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() < Date.now()) throw new Error("EXPIRED");
      const state = data.state as GrapplingChessState; if (state.winner !== null) throw new Error("FINISHED");
      if (state.turn !== viewer) throw new Error("TURN");
      if (!Number.isInteger(expectedRevision) || state.revision !== expectedRevision) throw new Error("STALE");
      const next = applyGrapplingChessMove(state, moveId); transaction.update(ref, { state: next, status: next.winner === null ? "active" : "finished", updatedAt: Timestamp.now() }); return { state: next, viewer };
    });
    return NextResponse.json({ ok: true, state: publicState(output.state, output.viewer) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ ok: false, mensaje: "Partida no encontrada." }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ ok: false, mensaje: "Invitación inválida." }, { status: 403 });
    if (code === "EXPIRED") return NextResponse.json({ ok: false, mensaje: "La partida ya venció." }, { status: 410 });
    if (code === "FINISHED") return NextResponse.json({ ok: false, mensaje: "La partida ya terminó." }, { status: 409 });
    if (code === "TURN") return NextResponse.json({ ok: false, mensaje: "Espera el movimiento de tu rival." }, { status: 409 });
    if (code === "STALE") return NextResponse.json({ ok: false, mensaje: "La posición cambió. Actualizando tablero…" }, { status: 409 });
    return NextResponse.json({ ok: false, mensaje: error instanceof Error ? error.message : "No se pudo guardar el movimiento." }, { status: 400 });
  }
}
