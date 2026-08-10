import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_LOW_STOCK,
  DEFAULT_STORE_STOCK,
  STORE_PRODUCTS,
  type StoreProduct,
  type StoreProductId,
  storeInventoryId,
  storeProductById,
} from "@/lib/store-products";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const MAX_UNIDADES = 50;
const ORDER_ACTIONS = ["preparar", "lista", "entregar", "cancelar"] as const;
type OrderAction = (typeof ORDER_ACTIONS)[number];
type ItemInput = { productoId?: unknown; cantidad?: unknown };

type InventoryInput = {
  sede?: unknown;
  accion?: unknown;
  productoId?: unknown;
  precio?: unknown;
  existencias?: unknown;
  minimo?: unknown;
  activo?: unknown;
  imagen?: unknown;
};

type OrderInput = {
  sede?: unknown;
  compraId?: unknown;
  accion?: unknown;
};

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
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) {
    return null;
  }

  const quantities = new Map<StoreProductId, number>();
  for (const entry of value as ItemInput[]) {
    const product = storeProductById(String(entry?.productoId || ""));
    const quantity = validarEntero(entry?.cantidad, 1, 20);
    if (!product || quantity === null) return null;
    quantities.set(product.id, (quantities.get(product.id) || 0) + quantity);
  }

  const units = Array.from(quantities.values()).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  return units <= MAX_UNIDADES ? { quantities, units } : null;
}

function serializarFecha(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function numeroGuardado(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializarInventario(
  product: StoreProduct,
  saved?: FirebaseFirestore.DocumentData,
) {
  return {
    ...product,
    precio: numeroGuardado(saved?.precio, Number(product.precio)),
    existencias: numeroGuardado(saved?.existencias, DEFAULT_STORE_STOCK),
    minimo: numeroGuardado(saved?.minimo, DEFAULT_LOW_STOCK),
    activo: saved ? saved.activo !== false : true,
    imagen: String(saved?.imagen || product.imagen),
    configurado: Boolean(saved),
  };
}

function validarEntero(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function siguienteEstado(current: string, action: OrderAction) {
  if (action === "preparar" && current === "pendiente_cobro") {
    return "preparando";
  }
  if (action === "lista" && current === "preparando") return "lista";
  if (
    action === "entregar" &&
    ["pendiente_cobro", "preparando", "lista"].includes(current)
  ) {
    return "entregada";
  }
  if (
    action === "cancelar" &&
    !["entregada", "cobrada", "cancelada"].includes(current)
  ) {
    return "cancelada";
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizarSede(url.searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);
    const [purchaseSnapshot, inventorySnapshot] = await Promise.all([
      adminDb
        .collection("SolicitudesCompra")
        .where("sede", "==", sede)
        .limit(100)
        .get(),
      adminDb.collection("InventarioTienda").where("sede", "==", sede).get(),
    ]);

    const compras = purchaseSnapshot.docs
      .map((document) => {
        const data = document.data();
        const estado = String(data.estado || "pendiente_cobro");
        return {
          id: document.id,
          folio: String(data.folio || document.id.slice(-8).toUpperCase()),
          alumnoId: String(data.alumnoId || ""),
          nombre: String(data.nombre || "Alumno"),
          sede,
          items: Array.isArray(data.items) ? data.items : [],
          totalUnidades: Number(data.totalUnidades) || 0,
          total: Number(data.total) || 0,
          estado,
          cobrada:
            data.cobrada === true || ["entregada", "cobrada"].includes(estado),
          confirmadaPorRfid: data.confirmadaPorRfid === true,
          creadaEn: serializarFecha(data.creadaEn),
          actualizadaEn: serializarFecha(data.actualizadaEn),
          entregadaEn: serializarFecha(data.entregadaEn),
        };
      })
      .sort((a, b) =>
        String(b.creadaEn || "").localeCompare(String(a.creadaEn || "")),
      );

    const savedInventory = new Map(
      inventorySnapshot.docs.map((document) => [
        String(document.data().productoId || ""),
        document.data(),
      ]),
    );
    const inventario = STORE_PRODUCTS.map((product) =>
      serializarInventario(product, savedInventory.get(product.id)),
    );

    return NextResponse.json({ ok: true, compras, inventario });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_LISTAR_COMPRAS:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar las compras." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
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
    const validated = validarItems(body?.items);

    if (
      !sede ||
      !rfid ||
      !validated ||
      !/^[a-f0-9-]{20,50}$/i.test(requestId)
    ) {
      return NextResponse.json(
        { ok: false, mensaje: "La compra contiene datos no válidos." },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
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

    const inventoryEntries = Array.from(validated.quantities.entries()).map(
      ([productId, quantity]) => ({
        product: storeProductById(productId)!,
        quantity,
        reference: adminDb
          .collection("InventarioTienda")
          .doc(storeInventoryId(sede, productId)),
      }),
    );
    const inventorySnapshots = await adminDb.getAll(
      ...inventoryEntries.map((entry) => entry.reference),
    );
    const items = inventoryEntries.map((entry, index) => {
      const saved = inventorySnapshots[index].data();
      const price = numeroGuardado(saved?.precio, Number(entry.product.precio));
      return {
        productoId: entry.product.id,
        nombre: entry.product.nombre,
        precioUnitario: price,
        cantidad: entry.quantity,
        subtotal: price * entry.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    const documentId = `${actor.uid}_${requestId}`;
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
        items,
        totalUnidades: validated.units,
        total,
        estado: "pendiente_cobro",
        origen: "catalogo_android_nfc",
        creadoPor: actor.uid,
        creadoPorEmail: actor.email || "",
        creadaEn: FieldValue.serverTimestamp(),
        actualizadaEn: FieldValue.serverTimestamp(),
      });
      return true;
    });

    return NextResponse.json({
      ok: true,
      duplicada: !created,
      compraId: documentId,
      nombre: alumno.nombre,
      total,
      mensaje: created
        ? `Compra confirmada por ${alumno.nombre}.`
        : "Esta compra ya había sido registrada.",
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_CREAR_COMPRA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar la compra." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      (InventoryInput & OrderInput) | null;
    const sede = normalizarSede(body?.sede);
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);

    if (body?.accion === "guardar_inventario") {
      const productId =
        typeof body.productoId === "string" ? body.productoId : "";
      const product = storeProductById(productId);
      const precio = validarEntero(body.precio, 1, 100_000);
      const existencias = validarEntero(body.existencias, 0, 100_000);
      const minimo = validarEntero(body.minimo, 0, 100_000);
      const imagen = typeof body.imagen === "string" ? body.imagen.trim() : "";

      if (
        !product ||
        precio === null ||
        existencias === null ||
        minimo === null ||
        typeof body.activo !== "boolean" ||
        imagen.length > 500
      ) {
        return NextResponse.json(
          { ok: false, mensaje: "Los datos del producto no son válidos." },
          { status: 400 },
        );
      }

      const inventoryData = {
        productoId: product.id,
        sede,
        nombre: product.nombre,
        detalle: product.detalle,
        grupo: product.grupo,
        color: product.color,
        precio,
        existencias,
        minimo,
        activo: body.activo,
        imagen: imagen || product.imagen,
        actualizadoPor: actor.uid,
        actualizadoPorEmail: actor.email || "",
        actualizadaEn: FieldValue.serverTimestamp(),
      };
      await adminDb
        .collection("InventarioTienda")
        .doc(storeInventoryId(sede, product.id))
        .set(inventoryData, { merge: true });

      return NextResponse.json({
        ok: true,
        mensaje: `Existencias de ${product.nombre} actualizadas.`,
        inventario: serializarInventario(product, inventoryData),
      });
    }

    const compraId =
      typeof body?.compraId === "string" ? body.compraId.trim() : "";
    const action = ORDER_ACTIONS.includes(body?.accion as OrderAction)
      ? (body?.accion as OrderAction)
      : null;
    if (!action || !/^[A-Za-z0-9_-]{20,160}$/.test(compraId)) {
      return NextResponse.json(
        { ok: false, mensaje: "La operación no es válida." },
        { status: 400 },
      );
    }

    const purchaseReference = adminDb
      .collection("SolicitudesCompra")
      .doc(compraId);
    const nextState = await adminDb.runTransaction(async (transaction) => {
      const purchaseSnapshot = await transaction.get(purchaseReference);
      const data = purchaseSnapshot.data();
      if (!purchaseSnapshot.exists || normalizarSede(data?.sede) !== sede) {
        throw new RequestAccessError("La compra no existe en esta sede.", 404);
      }

      const current = String(data?.estado || "pendiente_cobro");
      const next = siguienteEstado(current, action);
      if (!next) {
        throw new RequestAccessError(
          "La compra ya fue atendida o no permite esa acción.",
          409,
        );
      }

      if (action === "entregar") {
        const quantities = new Map<StoreProductId, number>();
        for (const item of Array.isArray(data?.items) ? data.items : []) {
          const product = storeProductById(String(item?.productoId || ""));
          const quantity = validarEntero(item?.cantidad, 1, 100);
          if (!product || quantity === null) {
            throw new RequestAccessError(
              "La compra contiene un producto no válido.",
              409,
            );
          }
          quantities.set(
            product.id,
            (quantities.get(product.id) || 0) + quantity,
          );
        }

        const inventoryEntries = Array.from(quantities.entries()).map(
          ([productId, quantity]) => ({
            productId,
            quantity,
            reference: adminDb
              .collection("InventarioTienda")
              .doc(storeInventoryId(sede, productId)),
          }),
        );
        const inventorySnapshots = await Promise.all(
          inventoryEntries.map((entry) => transaction.get(entry.reference)),
        );

        inventoryEntries.forEach((entry, index) => {
          const snapshot = inventorySnapshots[index];
          const product = storeProductById(entry.productId)!;
          const available = numeroGuardado(
            snapshot.data()?.existencias,
            DEFAULT_STORE_STOCK,
          );
          if (available < entry.quantity) {
            throw new RequestAccessError(
              `No hay existencias suficientes de ${product.nombre} ${product.detalle}.`,
              409,
            );
          }
          transaction.set(
            entry.reference,
            {
              productoId: product.id,
              sede,
              nombre: product.nombre,
              detalle: product.detalle,
              grupo: product.grupo,
              color: product.color,
              precio: numeroGuardado(
                snapshot.data()?.precio,
                Number(product.precio),
              ),
              existencias: available - entry.quantity,
              minimo: numeroGuardado(
                snapshot.data()?.minimo,
                DEFAULT_LOW_STOCK,
              ),
              activo: snapshot.exists
                ? snapshot.data()?.activo !== false
                : true,
              imagen: String(snapshot.data()?.imagen || product.imagen),
              actualizadoPor: actor.uid,
              actualizadoPorEmail: actor.email || "",
              actualizadaEn: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });
      }

      transaction.update(purchaseReference, {
        estado: next,
        cobrada: next === "entregada" ? true : data?.cobrada === true,
        atendidaPor: actor.uid,
        atendidaPorEmail: actor.email || "",
        atendidaEn: FieldValue.serverTimestamp(),
        actualizadaEn: FieldValue.serverTimestamp(),
        ...(next === "entregada"
          ? { entregadaEn: FieldValue.serverTimestamp() }
          : {}),
      });
      return next;
    });

    const messages: Record<string, string> = {
      preparando: "Compra marcada en preparación.",
      lista: "Compra lista para entregar.",
      entregada: "Compra cobrada y entregada; el inventario fue descontado.",
      cancelada: "Compra cancelada.",
    };
    return NextResponse.json({
      ok: true,
      estado: nextState,
      mensaje: messages[nextState],
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_ACTUALIZAR_COMPRA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo actualizar la compra." },
      { status: 500 },
    );
  }
}
