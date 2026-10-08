import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import { createGrapplingChessState } from "@/lib/grappling-chess";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function siteValue(value: unknown): Sede | null { const site = text(value, 30).toUpperCase().replace(/\s+/g, "_") as Sede; return SITES.includes(site) ? site : null; }
function code() { return randomBytes(4).toString("hex").slice(0, 6).toUpperCase(); }
function failure(error: unknown) {
  if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION:")) return NextResponse.json({ ok: false, mensaje: message.slice(11) }, { status: 400 });
  return NextResponse.json({ ok: false, mensaje: "No se pudo crear la partida." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})); const site = siteValue(body.sede); const playerOne = text(body.playerOne, 60); const playerTwo = text(body.playerTwo, 60);
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    if (!playerOne || !playerTwo) throw new Error("VALIDATION:Escribe los nombres de ambos jugadores.");
    const actor = await requirePanelActorAccess(request, site); const tokens = [randomBytes(24).toString("base64url"), randomBytes(24).toString("base64url")];
    let roomCode = ""; let ref = adminDb.collection("AjedrezPartidas").doc();
    for (let attempt = 0; attempt < 6; attempt += 1) { roomCode = code(); ref = adminDb.collection("AjedrezPartidas").doc(roomCode); if (!(await ref.get()).exists) break; }
    if (!roomCode || (await ref.get()).exists) throw new Error("No se pudo reservar un código.");
    await ref.create({ sede: site, players: [{ name: playerOne, tokenHash: hash(tokens[0]) }, { name: playerTwo, tokenHash: hash(tokens[1]) }], state: createGrapplingChessState(playerOne, playerTwo), status: "active", createdBy: actor.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 8 * 60 * 60 * 1000) });
    const origin = new URL(request.url).origin;
    return NextResponse.json({ ok: true, code: roomCode, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), links: tokens.map((token, index) => `${origin}/ajedrez/${roomCode}?jugador=${index + 1}&token=${encodeURIComponent(token)}`) });
  } catch (error) { return failure(error); }
}
