import { NextResponse } from "next/server";

import { hashTokenJiujitsu } from "@/lib/jiujitsu";
import { claimLiveControl, LivePairingError } from "@/lib/live-control-pairing";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, { scope: "bjj-vincular-control", limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos." }, { status: 429 });
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await claimLiveControl({ fightCollection: "CombatesJiujitsu", fightId: id, pairingToken: body.pairingToken, deviceId: body.deviceId, hash: hashTokenJiujitsu, controlLabel: "Árbitro" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof LivePairingError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, mensaje: "No se pudo vincular el control." }, { status: 500 });
  }
}
