import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { claimLiveControl, LivePairingError } from "@/lib/live-control-pairing";
import { hashToken } from "@/lib/taekwondo";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await checkRateLimit(request, { scope: "tkd-vincular-control", limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos." }, { status: 429 });
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await claimLiveControl({ fightCollection: "CombatesTaekwondo", fightId: id, pairingToken: body.pairingToken, deviceId: body.deviceId, hash: hashToken, controlLabel: "Juez" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof LivePairingError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, mensaje: "No se pudo vincular el control." }, { status: 500 });
  }
}
