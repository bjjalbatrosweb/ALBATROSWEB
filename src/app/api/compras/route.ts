import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_LOW_STOCK,
  DEFAULT_STORE_STOCK,
  STORE_PRODUCTS,
} from "@/lib/store-products";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const MAX_UNIDADES = 50;

const PRODUCTOS = {
  agua_600: { nombre: "Agua 600 ml", precio: 10 },
  agua_1l: { nombre: "Agua 1 litro", precio: 15 },
  amper_mango: { nombre: "Amper mango", precio: 22 },
  amper_blanco: { nombre: "Amper blanco", precio: 22 },
  amper_azul: { nombre: "Amper azul", precio: 22 },
  barra_proteina: { nombre: "Barra de proteína", precio: 15 },
  chocolate: { nombre: "Chocolate", precio: 15 },
} as const;

type ProductoId = keyof typeof PRODUCTOS;
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

  const quantities = new Map<ProductoId, number>();
  for (const entry of value as ItemEntrada[]) {
    const productId =
      typeof entry?.productoId === "string" ? entry.productoId : "";
    const quantity = Number(entry?.cantidad);
    if (
      !(productId in PRODUCTOS) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return null;
    }
    const id = productId as ProductoId;
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const units = Array.from(quantities.values()).reduce(
    (sum, current) => sum + current,
    0,
  );
  if (units > MAX_UNIDADES) return null;

  const items = Array.from(quantities.entries()).map(
    ([productoId, cantidad]) => {
      const product = PRODUCTOS[productoId];
      return {
        productoId,
        nombre: product.nombre,
        precioUnitario: product.precio,
        cantidad,
        subtotal: product.precio * cantidad,
      };
    },
  );

  return {
    items,
    units,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

function serializarFecha(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const rate = checkRateLimit(request, {
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
        existencias: Number.isFinite(Number(saved?.existencias))
          ? Number(saved?.existencias)
          : DEFAULT_STORE_STOCK,
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
    const rate = checkRateLimit(request, {
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
    const created = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return false;

      transaction.create(reference, {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        sede,
        rfidConfirmacion: rfid,
        confirmadaPorRfid: true,
        items: order.items,
        totalUnidades: order.units,
        total: order.total,
        estado: "pendiente_cobro",
        origen: "catalogo_android_nfc",
        creadoPor: "modulo_publico",
        creadoPorEmail: "",
        creadaEn: FieldValue.serverTimestamp(),
        actualizadaEn: FieldValue.serverTimestamp(),
      });
      return true;
    });

    return NextResponse.json({
      ok: true,
      duplicada: !created,
      compraId: documentId,
      folio: documentId.slice(-8).toUpperCase(),
      nombre: alumno.nombre,
      total: order.total,
      sede,
      estado: "pendiente_cobro",
      creadaEn: new Date().toISOString(),
      mensaje: created
        ? `Compra confirmada por ${alumno.nombre}.`
        : "Esta compra ya había sido registrada.",
    });
  } catch (error) {
    console.error("ERROR_CREAR_COMPRA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar la compra." },
      { status: 500 },
    );
  }
}
