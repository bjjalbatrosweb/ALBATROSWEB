'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  Droplets,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ScanLine,
  ShoppingCart,
  Smartphone,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type Estado = 'catalogo' | 'iniciando' | 'esperando_rfid' | 'enviando' | 'completado' | 'error';
type ProductoId =
  | 'agua_600'
  | 'agua_1l'
  | 'amper_mango'
  | 'amper_blanco'
  | 'amper_azul'
  | 'barra_proteina'
  | 'chocolate';

type Producto = {
  id: ProductoId;
  nombre: string;
  detalle: string;
  precio: number;
  grupo: 'agua' | 'energetica' | 'snack';
  color: string;
  imagen: string;
};

type NfcReadingEvent = Event & { serialNumber?: string };
type NfcReader = EventTarget & { scan: (options?: { signal?: AbortSignal }) => Promise<void> };
type NfcConstructor = new () => NfcReader;

const PRODUCTOS: Producto[] = [
  { id: 'agua_600', nombre: 'Agua', detalle: '600 ml', precio: 10, grupo: 'agua', color: 'from-sky-500/25 to-blue-950/20', imagen: '/productos/agua-600.png' },
  { id: 'agua_1l', nombre: 'Agua', detalle: '1 litro', precio: 15, grupo: 'agua', color: 'from-cyan-500/25 to-blue-950/20', imagen: '/productos/agua-1l.png' },
  { id: 'amper_mango', nombre: 'Amper', detalle: 'Mango', precio: 22, grupo: 'energetica', color: 'from-orange-500/30 to-amber-950/20', imagen: '/productos/amper-mango.png' },
  { id: 'amper_blanco', nombre: 'Amper', detalle: 'Blanco', precio: 22, grupo: 'energetica', color: 'from-zinc-100/20 to-zinc-900/20', imagen: '/productos/amper-blanco.png' },
  { id: 'amper_azul', nombre: 'Amper', detalle: 'Azul', precio: 22, grupo: 'energetica', color: 'from-blue-500/30 to-indigo-950/20', imagen: '/productos/amper-azul.png' },
  { id: 'barra_proteina', nombre: 'Barra de proteína', detalle: 'Nature Valley', precio: 15, grupo: 'snack', color: 'from-emerald-500/25 to-green-950/20', imagen: '/productos/barra-proteina.png' },
  { id: 'chocolate', nombre: 'Chocolate', detalle: 'Crunch', precio: 15, grupo: 'snack', color: 'from-amber-800/35 to-stone-950/20', imagen: '/productos/chocolate-crunch.png' },
];

function moneda(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(value);
}

function normalizarSede(value: string | null): Sede {
  const site = String(value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(site) ? (site as Sede) : 'MMA';
}

function normalizarRfid(value: unknown) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function ProductIcon({ group }: { group: Producto['grupo'] }) {
  if (group === 'agua') return <Droplets className="h-8 w-8" />;
  if (group === 'energetica') return <Zap className="h-8 w-8" />;
  return <Sparkles className="h-8 w-8" />;
}

function nombreGrupo(group: Producto['grupo']) {
  if (group === 'agua') return 'Hidratación';
  if (group === 'energetica') return 'Energética';
  return 'Snack';
}

export default function ComprarPage() {
  const auth = useAuth();
  const controllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<NfcReader | null>(null);
  const sendingRef = useRef(false);
  const requestIdRef = useRef('');

  const [sede, setSede] = useState<Sede>('MMA');
  const [cart, setCart] = useState<Partial<Record<ProductoId, number>>>({});
  const [estado, setEstado] = useState<Estado>('catalogo');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ nombre: string; total: number } | null>(null);

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem('userSede')));
    return () => {
      controllerRef.current?.abort();
      readerRef.current = null;
    };
  }, []);

  const lines = useMemo(
    () => PRODUCTOS.filter((product) => (cart[product.id] || 0) > 0).map((product) => ({
      ...product,
      cantidad: cart[product.id] || 0,
      subtotal: product.precio * (cart[product.id] || 0),
    })),
    [cart],
  );
  const units = lines.reduce((sum, line) => sum + line.cantidad, 0);
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  const changeQuantity = (id: ProductoId, delta: number) => {
    if (estado !== 'catalogo' && estado !== 'error') return;
    if (estado === 'error') setEstado('catalogo');
    setCart((current) => {
      const next = Math.max(0, Math.min(20, (current[id] || 0) + delta));
      const result = { ...current, [id]: next };
      if (next === 0) delete result[id];
      return result;
    });
    setError('');
    setResultado(null);
    requestIdRef.current = '';
  };

  const enviarCompra = async (uid: string) => {
    if (sendingRef.current || lines.length === 0) return;
    sendingRef.current = true;
    setEstado('enviando');
    setError('');

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        nombre?: string;
        total?: number;
      }>('/api/admin/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sede,
          rfid: uid,
          requestId: requestIdRef.current,
          items: lines.map((line) => ({ productoId: line.id, cantidad: line.cantidad })),
        }),
      });

      if (!response.ok || !data.ok || !data.nombre) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, 'No se pudo confirmar la compra.'));
      }

      controllerRef.current?.abort();
      readerRef.current = null;
      setResultado({ nombre: data.nombre, total: Number(data.total) || total });
      setEstado('completado');
      setCart({});
    } catch (cause) {
      controllerRef.current?.abort();
      readerRef.current = null;
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar la compra.');
      setEstado('error');
    } finally {
      sendingRef.current = false;
    }
  };

  const confirmarConRfid = async () => {
    setError('');
    setResultado(null);
    if (lines.length === 0) {
      setError('Agregue al menos un producto al carrito.');
      return;
    }
    if (!window.isSecureContext) {
      setEstado('error');
      setError('La lectura NFC necesita abrirse desde HTTPS.');
      return;
    }

    const Constructor = (window as Window & { NDEFReader?: NfcConstructor }).NDEFReader;
    if (!Constructor) {
      setEstado('error');
      setError('Abra este apartado en Chrome para Android y active el NFC.');
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    requestIdRef.current = crypto.randomUUID();
    setEstado('iniciando');

    try {
      const reader = new Constructor();
      readerRef.current = reader;
      reader.addEventListener('readingerror', () => {
        setError('No se pudo leer la tarjeta. Manténgala junto al teléfono.');
      });
      reader.addEventListener('reading', (event: Event) => {
        const uid = normalizarRfid((event as NfcReadingEvent).serialNumber);
        if (!uid) {
          setError('El teléfono detectó la tarjeta, pero no entregó su UID.');
          return;
        }
        void enviarCompra(uid);
      });

      await reader.scan({ signal: controller.signal });
      setEstado('esperando_rfid');
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setEstado('error');
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el NFC.');
    }
  };

  const nuevaCompra = () => {
    controllerRef.current?.abort();
    readerRef.current = null;
    sendingRef.current = false;
    requestIdRef.current = '';
    setCart({});
    setEstado('catalogo');
    setError('');
    setResultado(null);
  };

  return (
    <main className="relative mx-auto w-full max-w-7xl space-y-7 overflow-hidden px-4 py-8 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-0 -z-10 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />

      <header className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/35 via-card to-card px-6 py-7 shadow-2xl sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[42px] border-red-500/5" />
        <div className="relative max-w-3xl">
          <Badge variant="outline" className="mb-4 border-red-500/40 bg-red-500/10 px-3 py-1 text-red-400">TIENDA ALBATROS · {sede.replace('_', ' ')}</Badge>
          <h1 className="text-4xl font-black uppercase italic tracking-[-0.04em] text-white sm:text-5xl">Carga. Entrena. Repite.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Elija sus productos, revise el carrito y confirme la compra acercando su tarjeta RFID al teléfono Android.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">7 productos</span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">Confirmación RFID</span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">Cobro en recepción</span>
          </div>
        </div>
      </header>

      {resultado && (
        <Card className="border-emerald-500/35 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:text-left">
            <CheckCircle2 className="h-12 w-12 shrink-0 text-emerald-400" />
            <div className="flex-1"><h2 className="text-xl font-black uppercase">Compra confirmada</h2><p className="text-muted-foreground">{resultado.nombre} · {moneda(resultado.total)} · pendiente de cobro.</p></div>
            <Button variant="outline" onClick={nuevaCompra}><RotateCcw className="mr-2 h-4 w-4" />Nueva compra</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTOS.map((product) => {
            const quantity = cart[product.id] || 0;
            return (
              <Card key={product.id} className={`group overflow-hidden border-white/10 bg-gradient-to-br ${product.color} shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl ${quantity ? 'border-red-500/60 ring-1 ring-red-500/25' : ''}`}>
                <CardContent className="p-3">
                  <div className="relative h-52 w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-inner">
                    <Image
                      src={product.imagen}
                      alt={`${product.nombre} ${product.detalle}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-2 transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><ProductIcon group={product.grupo} /></span>
                        {nombreGrupo(product.grupo)}
                      </span>
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500 px-3 py-1 text-lg font-black leading-none text-black shadow-lg">{moneda(product.precio)}</span>
                    </div>
                  </div>
                  <div className="px-2 pb-2 pt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div><h2 className="text-xl font-black uppercase tracking-tight text-white">{product.nombre}</h2><p className="text-sm text-muted-foreground">{product.detalle}</p></div>
                      {quantity > 0 && <Badge className="bg-red-600 text-white">{quantity} en carrito</Badge>}
                    </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-1.5">
                    <Button size="icon" variant="ghost" onClick={() => changeQuantity(product.id, -1)} disabled={!quantity || estado === 'enviando'} aria-label={`Quitar ${product.nombre}`}><Minus className="h-4 w-4" /></Button>
                    <span className="min-w-8 text-center text-lg font-black">{quantity}</span>
                    <Button size="icon" variant="ghost" onClick={() => changeQuantity(product.id, 1)} disabled={quantity >= 20 || estado === 'enviando'} aria-label={`Agregar ${product.nombre}`}><Plus className="h-4 w-4" /></Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden border-red-500/25 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-white/5 bg-gradient-to-r from-red-950/30 to-transparent"><CardTitle className="flex items-center gap-2"><span className="rounded-xl bg-red-500/10 p-2 text-red-500"><ShoppingCart className="h-5 w-5" /></span>Su compra <Badge variant="secondary">{units}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {lines.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Seleccione productos del catálogo.</p> : lines.map((line) => (
                <div key={line.id} className="flex justify-between gap-3 text-sm"><div><p className="font-bold">{line.nombre} · {line.detalle}</p><p className="text-muted-foreground">{line.cantidad} × {moneda(line.precio)}</p></div><p className="font-black">{moneda(line.subtotal)}</p></div>
              ))}
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><span className="font-black uppercase">Total</span><span className="text-2xl font-black text-emerald-400">{moneda(total)}</span></div>

              {(estado === 'iniciando' || estado === 'esperando_rfid' || estado === 'enviando') && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                  {estado === 'enviando' ? <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-emerald-400" /> : <ScanLine className="mx-auto mb-3 h-10 w-10 animate-pulse text-emerald-400" />}
                  <p className="font-black uppercase">{estado === 'enviando' ? 'Registrando compra' : 'Acerque su RFID'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">La compra solo se confirma después de identificar al alumno.</p>
                </div>
              )}

              {error && <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><XCircle className="h-5 w-5 shrink-0" />{error}</div>}

              <Button className="w-full" onClick={confirmarConRfid} disabled={!lines.length || ['iniciando', 'esperando_rfid', 'enviando', 'completado'].includes(estado)}>
                {estado === 'iniciando' || estado === 'enviando' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                Confirmar con RFID
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">No registra pagos ni descuenta inventario.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
