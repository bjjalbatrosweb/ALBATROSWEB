import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_LOW_STOCK,
  DEFAULT_STORE_STOCK,
  STORE_PRODUCTS,
  type StoreProductId,
  storeInventoryId,
  storeProductById,
} from "@/lib/store-products";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const MAX_UNIDADES = 50;

type ItemEntrada = { productoId?: unknown; cantidad?: unknown };

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(sede) ? sede : null;
}

function normalizarRfid(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    : "";
}

async function buscarAlumno(rfid: string, sede: Sede) {
  const collection = adminDb.collection("Alumnos");
  let snapshot = await collection
    .where("rfids", "array-contains", rfid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    snapshot = await collection.where("rfid", "==", rfid).limit(1).get();
  }
  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  const data = document.data();
  if (normalizarSede(data.sede) !== sede) return null;

  return {
    id: document.id,
    nombre: String(data.nombre || "Alumno"),
    activo: data.activo !== false,
  };
}

function validarItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7)
    return null;

  const quantities = new Map<StoreProductId, number>();
  for (const entry of value as ItemEntrada[]) {
    const productId =
      typeof entry?.productoId === "string" ? entry.productoId : "";
    const quantity = Number(entry?.cantidad);
    if (
      !storeProductById(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return null;
    }
    const id = productId as StoreProductId;
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const units = Array.from(quantities.values()).reduce(
    (sum, current) => sum + current,
    0,
  );
  if (units > MAX_UNIDADES) return null;

  return { quantities, units };
}

function serializarFecha(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "compras-consulta",
      limit: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { ok: false, mensaje: "Demasiadas consultas. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    const url = new URL(request.url);
    const sede = normalizarSede(url.searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    const compraId = url.searchParams.get("compra")?.trim();
    if (compraId) {
      if (!/^[A-Za-z0-9_-]{20,160}$/.test(compraId)) {
        return NextResponse.json(
          { ok: false, mensaje: "La compra no es válida." },
          { status: 400 },
        );
      }
      const snapshot = await adminDb
        .collection("SolicitudesCompra")
        .doc(compraId)
        .get();
      const data = snapshot.data();
      if (!snapshot.exists || normalizarSede(data?.sede) !== sede) {
        return NextResponse.json(
          { ok: false, mensaje: "La compra no existe." },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        compra: {
          id: snapshot.id,
          folio: String(data?.folio || snapshot.id.slice(-8).toUpperCase()),
          nombre: String(data?.nombre || "Alumno"),
          sede,
          total: Number(data?.total) || 0,
          estado: String(data?.estado || "pendiente_cobro"),
          creadaEn: serializarFecha(data?.creadaEn),
        },
      });
    }

    const inventorySnapshot = await adminDb
      .collection("InventarioTienda")
      .where("sede", "==", sede)
      .get();
    const inventory = new Map(
      inventorySnapshot.docs.map((document) => [
        String(document.data().productoId || ""),
        document.data(),
      ]),
    );
    const catalogo = STORE_PRODUCTS.map((product) => {
      const saved = inventory.get(product.id);
      return {
        ...product,
        precio: Number(saved?.precio) || Number(product.precio),
        existencias: Math.max(
          0,
          (Number.isFinite(Number(saved?.existencias))
            ? Number(saved?.existencias)
            : DEFAULT_STORE_STOCK) -
            (Number.isFinite(Number(saved?.reservadas))
              ? Number(saved?.reservadas)
              : 0),
        ),
        minimo: Number.isFinite(Number(saved?.minimo))
          ? Number(saved?.minimo)
          : DEFAULT_LOW_STOCK,
        activo: saved?.activo !== false,
        imagen: String(saved?.imagen || product.imagen),
      };
    });
    return NextResponse.json({ ok: true, catalogo });
  } catch (error) {
    console.error("ERROR_CONSULTAR_COMPRAS_PUBLICAS:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo consultar la tienda." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "compras-crear",
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { ok: false, mensaje: "Demasiados intentos. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    const body = (await request.json().catch(() => null)) as {
      sede?: unknown;
      rfid?: unknown;
      items?: unknown;
      requestId?: unknown;
    } | null;

    const sede = normalizarSede(body?.sede);
    const rfid = normalizarRfid(body?.rfid);
    const requestId =
      typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const order = validarItems(body?.items);

    if (!sede || !rfid || !order || !/^[a-f0-9-]{20,50}$/i.test(requestId)) {
      return NextResponse.json(
        { ok: false, mensaje: "La compra contiene datos no válidos." },
        { status: 400 },
      );
    }

    const alumno = await buscarAlumno(rfid, sede);
    if (!alumno) {
      return NextResponse.json(
        {
          ok: false,
          mensaje: "La tarjeta no pertenece a un alumno de esta sede.",
        },
        { status: 404 },
      );
    }
    if (!alumno.activo) {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno tiene una baja temporal." },
        { status: 409 },
      );
    }

    const documentId = `publico_${requestId}`;
    const reference = adminDb.collection("SolicitudesCompra").doc(documentId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) {
        const data = existing.data();
        return {
          created: false,
          total: Number(data?.total) || 0,
          nombre: String(data?.nombre || alumno.nombre),
        };
      }

      const inventoryEntries = Array.from(order.quantities.entries()).map(
        ([productId, quantity]) => ({
          product: storeProductById(productId)!,
          quantity,
          reference: adminDb
            .collection("InventarioTienda")
            .doc(storeInventoryId(sede, productId)),
        }),
      );
      const inventorySnapshots = await Promise.all(
        inventoryEntries.map((entry) => transaction.get(entry.reference)),
      );
      const items = inventoryEntries.map((entry, index) => {
        const saved = inventorySnapshots[index].data();
        const stock = Number.isFinite(Number(saved?.existencias))
          ? Math.max(0, Number(saved?.existencias))
          : DEFAULT_STORE_STOCK;
        const reserved = Number.isFinite(Number(saved?.reservadas))
          ? Math.max(0, Number(saved?.reservadas))
          : 0;
        const price = Number(saved?.precio);
        if (!inventorySnapshots[index].exists || saved?.activo === false) {
          throw new Error(`${entry.product.nombre} no está disponible.`);
        }
        if (stock - reserved < entry.quantity) {
          throw new Error(`No hay existencias suficientes de ${entry.product.nombre}.`);
        }
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`El precio de ${entry.product.nombre} no es válido.`);
        }
        transaction.set(
          entry.reference,
          {
            reservadas: reserved + entry.quantity,
            actualizadaEn: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return {
          productoId: entry.product.id,
          nombre: entry.product.nombre,
          precioUnitario: price,
          cantidad: entry.quantity,
          subtotal: price * entry.quantity,
        };
      });
      const total = items.reduce((sum, item) => sum + item.subtotal, 0);

      transaction.create(reference, {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        sede,
        rfidConfirmacion: rfid,
        confirmadaPorRfid: true,
        items,
        totalUnidades: order.units,
        total,
        inventarioReservado: true,
        estado: "pendiente_cobro",
        origen: "catalogo_android_nfc",
        creadoPor: "modulo_publico",
        creadoPorEmail: "",
        creadaEn: FieldValue.serverTimestamp(),
        actualizadaEn: FieldValue.serverTimestamp(),
      });
      return { created: true, total, nombre: alumno.nombre };
    });

    return NextResponse.json({
      ok: true,
      duplicada: !result.created,
      compraId: documentId,
      folio: documentId.slice(-8).toUpperCase(),
      nombre: result.nombre,
      total: result.total,
      sede,
      estado: "pendiente_cobro",
      creadaEn: new Date().toISOString(),
      mensaje: result.created
        ? `Compra confirmada por ${alumno.nombre}.`
        : "Esta compra ya había sido registrada.",
    });
  } catch (error) {
    console.error("ERROR_CREAR_COMPRA:", error);
    const message = error instanceof Error ? error.message : "";
    if (/no está disponible|existencias suficientes|precio .* no es válido/i.test(message)) {
      return NextResponse.json({ ok: false, mensaje: message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar la compra." },
      { status: 500 },
    );
  }
}
