"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowRight,
  CheckCircle2,
  Droplets,
  Loader2,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import {
  DEFAULT_LOW_STOCK,
  DEFAULT_STORE_STOCK,
  STORE_PRODUCTS,
  type StoreProductGroup,
  type StoreProductId,
} from "@/lib/store-products";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type Estado =
  | "catalogo"
  | "iniciando"
  | "esperando_rfid"
  | "enviando"
  | "completado"
  | "error";
type ProductoId = StoreProductId;
type Producto = {
  id: ProductoId;
  nombre: string;
  detalle: string;
  precio: number;
  grupo: StoreProductGroup;
  color: string;
  imagen: string;
  existencias: number;
  minimo: number;
  activo: boolean;
};
type FiltroProducto = "todos" | Producto["grupo"];
type EstadoCompra =
  "pendiente_cobro" | "preparando" | "lista" | "entregada" | "cancelada";
type ResultadoCompra = {
  compraId: string;
  folio: string;
  nombre: string;
  total: number;
  sede: Sede;
  estado: EstadoCompra;
  creadaEn: string | null;
};

type NfcReadingEvent = Event & { serialNumber?: string };
type NfcReader = EventTarget & {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
};
type NfcConstructor = new () => NfcReader;

function moneda(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizarSede(value: string | null): Sede {
  const site = String(value || "MMA")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(site)
    ? (site as Sede)
    : "MMA";
}

function normalizarRfid(value: unknown) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function ProductIcon({ group }: { group: Producto["grupo"] }) {
  if (group === "agua") return <Droplets className="h-4 w-4" />;
  if (group === "energetica") return <Zap className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

function nombreGrupo(group: Producto["grupo"]) {
  if (group === "agua") return "Hidratación";
  if (group === "energetica") return "Energética";
  return "Snack";
}

function estadoCompraLabel(estado: EstadoCompra) {
  if (estado === "preparando") return "Preparando pedido";
  if (estado === "lista") return "Listo para entregar";
  if (estado === "entregada") return "Cobrado y entregado";
  if (estado === "cancelada") return "Compra cancelada";
  return "Pendiente de cobro";
}

const CATALOGO_INICIAL: Producto[] = STORE_PRODUCTS.map((product) => ({
  ...product,
  precio: Number(product.precio),
  existencias: DEFAULT_STORE_STOCK,
  minimo: DEFAULT_LOW_STOCK,
  activo: true,
}));

export default function ComprarPage() {
  const router = useRouter();
  const controllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<NfcReader | null>(null);
  const sendingRef = useRef(false);
  const requestIdRef = useRef("");

  const [sede, setSede] = useState<Sede>("MMA");
  const [catalogo, setCatalogo] = useState<Producto[]>(CATALOGO_INICIAL);
  const [cart, setCart] = useState<Partial<Record<ProductoId, number>>>({});
  const [estado, setEstado] = useState<Estado>("catalogo");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoCompra | null>(null);
  const [qrCompra, setQrCompra] = useState("");
  const [accesoListo, setAccesoListo] = useState(false);
  const [filtro, setFiltro] = useState<FiltroProducto>("todos");

  useEffect(() => {
    if (sessionStorage.getItem("albatrosFunctionsUnlocked") !== "1") {
      router.replace("/");
      return;
    }
    setAccesoListo(true);
  }, [router]);

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem("userSede")));
    return () => {
      controllerRef.current?.abort();
      readerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cargarCatalogo = async () => {
      try {
        const { response, data } = await apiRequest<{
          ok?: boolean;
          catalogo?: Producto[];
        }>(`/api/compras?sede=${encodeURIComponent(sede)}`, {
          cache: "no-store",
        });
        if (
          !cancelled &&
          response.ok &&
          data.ok &&
          Array.isArray(data.catalogo)
        ) {
          setCatalogo(data.catalogo);
        }
      } catch {
        // El catálogo base permanece visible durante una interrupción temporal.
      }
    };

    void cargarCatalogo();
    return () => {
      cancelled = true;
    };
  }, [sede]);

  useEffect(() => {
    const saved = localStorage.getItem("albatrosLastPurchase");
    if (!saved) return;

    let initial: ResultadoCompra | null = null;
    try {
      initial = JSON.parse(saved) as ResultadoCompra;
    } catch {
      localStorage.removeItem("albatrosLastPurchase");
      return;
    }
    if (!initial?.compraId || initial.sede !== sede) return;

    let cancelled = false;
    let nextPoll: ReturnType<typeof setTimeout> | null = null;
    const pollingStartedAt = Date.now();
    setResultado(initial);
    setEstado("completado");
    void QRCode.toDataURL(
      JSON.stringify({
        folio: initial.folio,
        sede: initial.sede,
        total: initial.total,
      }),
      { width: 320, margin: 1, color: { dark: "#050505", light: "#ffffff" } },
    )
      .then((value) => {
        if (!cancelled) setQrCompra(value);
      })
      .catch(() => undefined);

    const consultarEstado = async () => {
      if (document.hidden) {
        nextPoll = setTimeout(consultarEstado, 30000);
        return;
      }
      try {
        const { response, data } = await apiRequest<{
          ok?: boolean;
          compra?: {
            id: string;
            folio: string;
            nombre: string;
            sede: Sede;
            total: number;
            estado: EstadoCompra;
            creadaEn: string | null;
          };
        }>(
          `/api/compras?sede=${encodeURIComponent(sede)}&compra=${encodeURIComponent(initial!.compraId)}`,
          {
            cache: "no-store",
          },
        );
        if (!cancelled && response.ok && data.ok && data.compra) {
          const updated: ResultadoCompra = {
            compraId: data.compra.id,
            folio: data.compra.folio,
            nombre: data.compra.nombre,
            sede: data.compra.sede,
            total: data.compra.total,
            estado: data.compra.estado,
            creadaEn: data.compra.creadaEn,
          };
          setResultado(updated);
          localStorage.setItem("albatrosLastPurchase", JSON.stringify(updated));
          if (!["entregada", "cancelada"].includes(updated.estado)) {
            const delay =
              Date.now() - pollingStartedAt < 2 * 60_000 ? 6000 : 30000;
            nextPoll = setTimeout(consultarEstado, delay);
          }
          return;
        }
      } catch {
        // El comprobante local permanece visible y se vuelve a intentar.
      }
      if (!cancelled) nextPoll = setTimeout(consultarEstado, 30000);
    };

    const refreshVisible = () => {
      if (!document.hidden) {
        if (nextPoll) clearTimeout(nextPoll);
        void consultarEstado();
      }
    };
    document.addEventListener("visibilitychange", refreshVisible);
    void consultarEstado();
    return () => {
      cancelled = true;
      if (nextPoll) clearTimeout(nextPoll);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [sede]);

  const lines = useMemo(
    () =>
      catalogo
        .filter((product) => (cart[product.id] || 0) > 0)
        .map((product) => ({
          ...product,
          cantidad: cart[product.id] || 0,
          subtotal: product.precio * (cart[product.id] || 0),
        })),
    [cart, catalogo],
  );
  const units = lines.reduce((sum, line) => sum + line.cantidad, 0);
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const productosVisibles = useMemo(
    () =>
      filtro === "todos"
        ? catalogo
        : catalogo.filter((product) => product.grupo === filtro),
    [catalogo, filtro],
  );
  const compraBloqueada = [
    "iniciando",
    "esperando_rfid",
    "enviando",
    "completado",
  ].includes(estado);

  const changeQuantity = (id: ProductoId, delta: number) => {
    if (estado !== "catalogo" && estado !== "error") return;
    if (estado === "error") setEstado("catalogo");
    setCart((current) => {
      const product = catalogo.find((item) => item.id === id);
      const max = Math.max(
        0,
        Math.min(
          20,
          product?.activo === false ? 0 : (product?.existencias ?? 20),
        ),
      );
      const next = Math.max(0, Math.min(max, (current[id] || 0) + delta));
      const result = { ...current, [id]: next };
      if (next === 0) delete result[id];
      return result;
    });
    setError("");
    setResultado(null);
    requestIdRef.current = "";
  };

  const enviarCompra = async (uid: string) => {
    if (sendingRef.current || lines.length === 0) return;
    sendingRef.current = true;
    setEstado("enviando");
    setError("");

    try {
      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        compraId?: string;
        folio?: string;
        nombre?: string;
        total?: number;
        sede?: Sede;
        estado?: EstadoCompra;
        creadaEn?: string;
      }>("/api/compras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sede,
          rfid: uid,
          requestId: requestIdRef.current,
          items: lines.map((line) => ({
            productoId: line.id,
            cantidad: line.cantidad,
          })),
        }),
      });

      if (
        !response.ok ||
        !data.ok ||
        !data.nombre ||
        !data.compraId ||
        !data.folio
      ) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo confirmar la compra.",
          ),
        );
      }

      controllerRef.current?.abort();
      readerRef.current = null;
      const compra: ResultadoCompra = {
        compraId: data.compraId,
        folio: data.folio,
        nombre: data.nombre,
        total: Number(data.total) || total,
        sede: data.sede || sede,
        estado: data.estado || "pendiente_cobro",
        creadaEn: data.creadaEn || new Date().toISOString(),
      };
      setResultado(compra);
      localStorage.setItem("albatrosLastPurchase", JSON.stringify(compra));
      void QRCode.toDataURL(
        JSON.stringify({
          folio: compra.folio,
          sede: compra.sede,
          total: compra.total,
        }),
        { width: 320, margin: 1, color: { dark: "#050505", light: "#ffffff" } },
      )
        .then(setQrCompra)
        .catch(() => setQrCompra(""));
      setEstado("completado");
      setCart({});
    } catch (cause) {
      controllerRef.current?.abort();
      readerRef.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo confirmar la compra.",
      );
      setEstado("error");
    } finally {
      sendingRef.current = false;
    }
  };

  const confirmarConRfid = async () => {
    setError("");
    setResultado(null);
    if (lines.length === 0) {
      setError("Agregue al menos un producto al carrito.");
      return;
    }
    if (!window.isSecureContext) {
      setEstado("error");
      setError("La lectura NFC necesita abrirse desde HTTPS.");
      return;
    }

    const Constructor = (window as Window & { NDEFReader?: NfcConstructor })
      .NDEFReader;
    if (!Constructor) {
      setEstado("error");
      setError("Abra este apartado en Chrome para Android y active el NFC.");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    requestIdRef.current = crypto.randomUUID();
    setEstado("iniciando");

    try {
      const reader = new Constructor();
      readerRef.current = reader;
      reader.addEventListener("readingerror", () => {
        setError("No se pudo leer la tarjeta. Manténgala junto al teléfono.");
      });
      reader.addEventListener("reading", (event: Event) => {
        const uid = normalizarRfid((event as NfcReadingEvent).serialNumber);
        if (!uid) {
          setError("El teléfono detectó la tarjeta, pero no entregó su UID.");
          return;
        }
        void enviarCompra(uid);
      });

      await reader.scan({ signal: controller.signal });
      setEstado("esperando_rfid");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setEstado("error");
      setError(
        cause instanceof Error ? cause.message : "No se pudo iniciar el NFC.",
      );
    }
  };

  const nuevaCompra = () => {
    controllerRef.current?.abort();
    readerRef.current = null;
    sendingRef.current = false;
    requestIdRef.current = "";
    setCart({});
    setEstado("catalogo");
    setError("");
    setResultado(null);
    setQrCompra("");
    localStorage.removeItem("albatrosLastPurchase");
  };

  const cancelarLectura = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    readerRef.current = null;
    requestIdRef.current = "";
    setEstado("catalogo");
    setError("");
  };

  if (!accesoListo) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#06070a]">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-red-500" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-white/70">
            Preparando tienda
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06070a] pb-28 text-white xl:pb-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-16 h-[34rem] w-[34rem] rounded-full bg-red-600/[0.11] blur-[120px]" />
        <div className="absolute -right-40 top-[34rem] h-[30rem] w-[30rem] rounded-full bg-orange-500/[0.06] blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-[#1a090b] via-[#101116] to-[#0b0c10] shadow-[0_30px_100px_rgba(0,0,0,.45)]">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(239,68,68,.16),transparent_62%)] lg:block" />
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[48px] border-red-500/[0.035]" />

          <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1fr_410px] lg:items-end lg:px-12 lg:py-12">
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Badge className="border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-red-400 hover:bg-red-500/10">
                  Albatros Fuel Station
                </Badge>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                  Sede {sede.replace("_", " ")}
                </span>
              </div>

              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-red-500">
                <span className="h-px w-8 bg-red-500" />
                Energía para tu siguiente round
              </p>
              <h1 className="max-w-4xl text-4xl font-black uppercase italic leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
                Elige. Acerca.
                <span className="mt-1 block text-red-500">
                  Sigue entrenando.
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Selecciona tus productos y confirma la solicitud acercando tu
                tarjeta RFID. El cobro se realiza directamente en recepción.
              </p>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 backdrop-blur-sm">
              {[
                { paso: "01", titulo: "Elige", texto: "Agrega productos" },
                { paso: "02", titulo: "Confirma", texto: "Acerca tu RFID" },
                { paso: "03", titulo: "Recibe", texto: "Paga en recepción" },
              ].map((item, index) => (
                <div
                  key={item.paso}
                  className={`p-4 sm:p-5 ${index > 0 ? "border-l border-white/[0.08]" : ""}`}
                >
                  <span className="text-[10px] font-black tracking-[0.2em] text-red-500">
                    {item.paso}
                  </span>
                  <p className="mt-2 text-xs font-black uppercase text-white sm:text-sm">
                    {item.titulo}
                  </p>
                  <p className="mt-1 hidden text-[10px] leading-4 text-white/70 sm:block">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {resultado && (
          <section
            className={`mt-6 overflow-hidden rounded-[2rem] border shadow-[0_20px_70px_rgba(0,0,0,.2)] ${
              resultado.estado === "cancelada"
                ? "border-red-400/25 bg-gradient-to-r from-red-500/[0.13] via-red-500/[0.05] to-transparent"
                : "border-emerald-400/25 bg-gradient-to-r from-emerald-500/[0.13] via-emerald-500/[0.05] to-transparent"
            }`}
          >
            <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
              <div
                className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl border ${
                  resultado.estado === "cancelada"
                    ? "border-red-400/25 bg-red-400/10 text-red-400"
                    : "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
                }`}
              >
                {resultado.estado === "entregada" ? (
                  <PackageCheck className="h-8 w-8" />
                ) : resultado.estado === "cancelada" ? (
                  <XCircle className="h-8 w-8" />
                ) : (
                  <CheckCircle2 className="h-8 w-8" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.2em] ${resultado.estado === "cancelada" ? "text-red-400" : "text-emerald-400"}`}
                >
                  Folio {resultado.folio}
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase italic">
                  {estadoCompraLabel(resultado.estado)}
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  {resultado.nombre} · {moneda(resultado.total)} · sede{" "}
                  {resultado.sede.replace("_", " ")}.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {(
                    [
                      "pendiente_cobro",
                      "preparando",
                      "lista",
                      "entregada",
                    ] as EstadoCompra[]
                  ).map((step, index) => {
                    const order = [
                      "pendiente_cobro",
                      "preparando",
                      "lista",
                      "entregada",
                    ];
                    const reached =
                      resultado.estado !== "cancelada" &&
                      order.indexOf(resultado.estado) >= index;
                    return (
                      <span
                        key={step}
                        className={`h-1.5 w-10 rounded-full ${reached ? "bg-emerald-400" : "bg-white/10"}`}
                      />
                    );
                  })}
                </div>
              </div>
              {qrCompra && (
                <div
                  className="rounded-2xl bg-white p-2 shadow-xl"
                  title={`Comprobante ${resultado.folio}`}
                >
                  <Image
                    src={qrCompra}
                    alt={`QR de la compra ${resultado.folio}`}
                    width={104}
                    height={104}
                    unoptimized
                    className="h-[104px] w-[104px]"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-white/10 bg-white/5 px-5 hover:bg-white/10"
                  onClick={nuevaCompra}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Nueva compra
                </Button>
                <p className="text-center text-[9px] uppercase tracking-wider text-white/70">
                  Estado actualizado automáticamente
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section aria-labelledby="catalogo-title" className="min-w-0">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">
                  Catálogo
                </p>
                <h2
                  id="catalogo-title"
                  className="mt-1 text-2xl font-black uppercase italic tracking-tight sm:text-3xl"
                >
                  Recarga tu energía
                </h2>
              </div>

              <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  ["todos", "agua", "energetica", "snack"] as FiltroProducto[]
                ).map((option) => {
                  const label =
                    option === "todos" ? "Todos" : nombreGrupo(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFiltro(option)}
                      className={`shrink-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                        filtro === option
                          ? "bg-red-600 text-white shadow-[0_8px_22px_rgba(220,38,38,.28)]"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {productosVisibles.map((product) => {
                const quantity = cart[product.id] || 0;
                const agotado = !product.activo || product.existencias <= 0;
                const stockBajo =
                  !agotado && product.existencias <= product.minimo;
                const controlesBloqueados = compraBloqueada || agotado;

                return (
                  <article
                    key={product.id}
                    className={`group relative overflow-hidden rounded-[1.65rem] border bg-[#101116] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_60px_rgba(0,0,0,.45)] ${agotado ? "opacity-65 grayscale-[.35]" : ""} ${
                      quantity > 0
                        ? "border-red-500/55 shadow-[0_20px_55px_rgba(220,38,38,.09)] ring-1 ring-red-500/15"
                        : "border-white/[0.08]"
                    }`}
                  >
                    <div
                      className={`relative m-2.5 h-52 overflow-hidden rounded-[1.2rem] bg-gradient-to-br ${product.color}`}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_85%,rgba(255,255,255,.10),transparent_48%)]" />
                      <Image
                        src={product.imagen}
                        alt={`${product.nombre} ${product.detalle}`}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-contain p-5 drop-shadow-[0_20px_20px_rgba(0,0,0,.55)] transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/75 backdrop-blur-md">
                          <ProductIcon group={product.grupo} />
                          {nombreGrupo(product.grupo)}
                        </span>
                        {agotado ? (
                          <span className="rounded-full border border-red-400/25 bg-red-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg">
                            Agotado
                          </span>
                        ) : stockBajo ? (
                          <span className="rounded-full border border-amber-400/25 bg-amber-400 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-900 shadow-lg">
                            Últimas {product.existencias}
                          </span>
                        ) : (
                          quantity > 0 && (
                            <span className="grid h-8 min-w-8 place-items-center rounded-full bg-red-600 px-2 text-xs font-black shadow-lg shadow-red-950/50">
                              {quantity}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-2">
                      <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                            {product.detalle}
                          </p>
                          <h3 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white">
                            {product.nombre}
                          </h3>
                        </div>
                        <span className="shrink-0 text-2xl font-black tracking-[-0.04em] text-white">
                          {moneda(product.precio)}
                        </span>
                      </div>

                      {quantity === 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-5 h-11 w-full rounded-xl border-white/10 bg-white/[0.035] font-black uppercase tracking-wider text-white hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                          onClick={() => changeQuantity(product.id, 1)}
                          disabled={controlesBloqueados}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {agotado ? "No disponible" : "Agregar"}
                        </Button>
                      ) : (
                        <div className="mt-5 flex h-11 items-center justify-between rounded-xl border border-red-500/25 bg-red-500/[0.08] p-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-lg hover:bg-white/10"
                            onClick={() => changeQuantity(product.id, -1)}
                            disabled={controlesBloqueados}
                            aria-label={`Quitar ${product.nombre}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="text-center">
                            <span className="text-base font-black">
                              {quantity}
                            </span>
                            <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-white/70">
                              unidades
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-lg hover:bg-white/10"
                            onClick={() => changeQuantity(product.id, 1)}
                            disabled={
                              controlesBloqueados ||
                              quantity >= Math.min(20, product.existencias)
                            }
                            aria-label={`Agregar ${product.nombre}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside
            id="resumen-compra"
            className="scroll-mt-6 xl:sticky xl:top-24 xl:self-start"
          >
            <Card className="overflow-hidden rounded-[2rem] border-white/[0.09] bg-[#101116]/95 shadow-[0_30px_90px_rgba(0,0,0,.5)] backdrop-blur-xl">
              <CardHeader className="border-b border-white/[0.07] bg-gradient-to-r from-red-950/30 to-transparent px-6 py-5">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-lg font-black uppercase italic">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500">
                      <ShoppingCart className="h-5 w-5" />
                    </span>
                    Tu selección
                  </span>
                  <Badge className="border border-white/10 bg-white/5 text-white hover:bg-white/5">
                    {units} {units === 1 ? "unidad" : "unidades"}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 p-5 sm:p-6">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-6 py-10 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.035] text-white/70">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-sm font-black uppercase text-white/70">
                      Tu carrito está vacío
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/70">
                      Agrega productos del catálogo para comenzar.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[21rem] space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,.12)_transparent]">
                    {lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-2.5"
                      >
                        <div
                          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${line.color}`}
                        >
                          <Image
                            src={line.imagen}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-contain p-1.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black uppercase">
                            {line.nombre} · {line.detalle}
                          </p>
                          <p className="mt-1 text-[10px] text-white/70">
                            {line.cantidad} × {moneda(line.precio)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black">
                          {moneda(line.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-white/70">
                    <span>Productos</span>
                    <span>{units}</span>
                  </div>
                  <div className="my-3 h-px bg-white/[0.07]" />
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-black uppercase">Total</span>
                    <span className="text-3xl font-black tracking-[-0.05em] text-emerald-400">
                      {moneda(total)}
                    </span>
                  </div>
                </div>

                {(estado === "iniciando" ||
                  estado === "esperando_rfid" ||
                  estado === "enviando") && (
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.08] p-5 text-center">
                    <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-emerald-400" />
                    {estado === "enviando" ? (
                      <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-400" />
                    ) : (
                      <ScanLine className="mx-auto h-9 w-9 animate-pulse text-emerald-400" />
                    )}
                    <p className="mt-3 text-sm font-black uppercase tracking-wide">
                      {estado === "enviando"
                        ? "Registrando compra"
                        : "Acerca tu tarjeta RFID"}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-white/70">
                      {estado === "enviando"
                        ? "Estamos enviando tu solicitud a recepción."
                        : "Mantén la tarjeta junto al teléfono hasta confirmar."}
                    </p>
                    {estado !== "enviando" && (
                      <button
                        type="button"
                        onClick={cancelarLectura}
                        className="mt-3 text-[10px] font-black uppercase tracking-wider text-white/70 underline-offset-4 hover:text-white hover:underline"
                      >
                        Cancelar lectura
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.08] p-4 text-sm text-red-300">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span className="leading-5">{error}</span>
                  </div>
                )}

                <Button
                  className="h-14 w-full rounded-xl bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-[0_16px_35px_rgba(220,38,38,.25)] hover:bg-red-500"
                  onClick={confirmarConRfid}
                  disabled={!lines.length || compraBloqueada}
                >
                  {estado === "iniciando" || estado === "enviando" ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Smartphone className="mr-2 h-5 w-5" />
                  )}
                  Confirmar con RFID
                  {!compraBloqueada && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-5">
                  {[
                    { icon: LockKeyhole, label: "Sin iniciar sesión" },
                    { icon: ShieldCheck, label: "Validación RFID" },
                    { icon: PackageCheck, label: "Cobro en recepción" },
                  ].map(({ icon: FeatureIcon, label }) => (
                    <div key={label} className="text-center">
                      <FeatureIcon className="mx-auto h-4 w-4 text-white/70" />
                      <p className="mt-2 text-[8px] font-black uppercase leading-3 tracking-wider text-white/70">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {!resultado && (
        <div className="fixed inset-x-3 bottom-3 z-40 xl:hidden">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("resumen-compra")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#14151b]/95 p-3 text-left shadow-[0_20px_70px_rgba(0,0,0,.65)] backdrop-blur-xl"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
              <ShoppingCart className="h-5 w-5" />
              {units > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#14151b] bg-white px-1 text-[9px] font-black text-slate-900">
                  {units}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-white/70">
                Tu compra
              </span>
              <span className="block text-sm font-black">
                {lines.length
                  ? `${units} ${units === 1 ? "producto" : "productos"}`
                  : "Selecciona productos"}
              </span>
            </span>
            <span className="text-xl font-black text-emerald-400">
              {moneda(total)}
            </span>
            <ArrowRight className="h-4 w-4 text-white/70" />
          </button>
        </div>
      )}
    </main>
  );
}
