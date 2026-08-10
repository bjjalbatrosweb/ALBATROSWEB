import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function siteValue(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const site = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SITES.includes(site) ? site : null;
}

function numberValue(value: unknown, maximum = 1_000_000) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= maximum ? number : null;
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function serialize(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() || {};
  return {
    id: document.id,
    name: String(data.name || "Consumible"),
    category: String(data.category || "General"),
    unit: String(data.unit || "unidad"),
    stock: Math.max(0, Number(data.stock) || 0),
    minimum: Math.max(0, Number(data.minimum) || 0),
    target: Math.max(0, Number(data.target) || 0),
    unitCost: Math.max(0, Number(data.unitCost) || 0),
    supplier: String(data.supplier || ""),
    notes: String(data.notes || ""),
    history: Array.isArray(data.history) ? data.history.slice(0, 25) : [],
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : null,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION:")) {
    return NextResponse.json({ ok: false, mensaje: message.slice(11) }, { status: 400 });
  }
  return NextResponse.json({ ok: false, mensaje: "No se pudo actualizar el inventario." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const site = siteValue(new URL(request.url).searchParams.get("sede"));
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    await requirePanelActorAccess(request, site);
    const snapshot = await adminDb.collection("InventarioConsumibles").where("sede", "==", site).limit(200).get();
    const items = snapshot.docs.map(serialize).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const site = siteValue(body.sede);
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    const actor = await requirePanelActorAccess(request, site);

    if (body.action === "create") {
      const name = text(body.name, 80);
      const category = text(body.category, 40) || "General";
      const unit = text(body.unit, 20) || "unidad";
      const stock = numberValue(body.stock);
      const minimum = numberValue(body.minimum);
      const target = numberValue(body.target);
      const unitCost = numberValue(body.unitCost);
      if (!name || stock === null || minimum === null || target === null || unitCost === null) {
        throw new Error("VALIDATION:Revisa el nombre y las cantidades.");
      }
      if (target < minimum) throw new Error("VALIDATION:La existencia objetivo debe ser igual o mayor al mínimo.");
      const ref = adminDb.collection("InventarioConsumibles").doc();
      await ref.create({
        sede: site,
        name,
        category,
        unit,
        stock,
        minimum,
        target,
        unitCost,
        supplier: text(body.supplier, 100),
        notes: text(body.notes, 300),
        history: [],
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, item: serialize(await ref.get()) });
    }

    if (body.action === "movement") {
      const id = text(body.id, 100);
      const type = body.type === "entry" || body.type === "consumption" || body.type === "adjustment" ? body.type : null;
      const quantity = numberValue(body.quantity);
      const responsible = text(body.responsible, 80);
      if (!id || !type || quantity === null || !responsible) {
        throw new Error("VALIDATION:Completa el movimiento y el responsable.");
      }
      const ref = adminDb.collection("InventarioConsumibles").doc(id);
      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists || snapshot.data()?.sede !== site) throw new Error("VALIDATION:Artículo no encontrado.");
        const data = snapshot.data() || {};
        const before = Math.max(0, Number(data.stock) || 0);
        const after = type === "entry" ? before + quantity : type === "consumption" ? before - quantity : quantity;
        if (after < 0) throw new Error("VALIDATION:La salida supera la existencia disponible.");
        const movement = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type,
          quantity,
          before,
          after,
          responsible,
          notes: text(body.notes, 240),
          at: new Date().toISOString(),
          actorId: actor.uid,
        };
        const history = Array.isArray(data.history) ? data.history : [];
        transaction.update(ref, {
          stock: after,
          history: [movement, ...history].slice(0, 25),
          lastMovement: movement,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ ok: true, item: serialize(await ref.get()) });
    }

    throw new Error("VALIDATION:Acción no válida.");
  } catch (error) {
    return errorResponse(error);
  }
}
