'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  EyeOff,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';
import type { StoreProductGroup, StoreProductId } from '@/lib/store-products';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type EstadoCompra = 'pendiente_cobro' | 'preparando' | 'lista' | 'entregada' | 'cobrada' | 'cancelada';
type ItemCompra = {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
};
type Compra = {
  id: string;
  folio: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  items: ItemCompra[];
  totalUnidades: number;
  total: number;
  estado: EstadoCompra;
  cobrada: boolean;
  confirmadaPorRfid: boolean;
  creadaEn: string | null;
  actualizadaEn: string | null;
  entregadaEn: string | null;
};
type InventoryProduct = {
  id: StoreProductId;
  nombre: string;
  detalle: string;
  precio: number;
  grupo: StoreProductGroup;
  color: string;
  imagen: string;
  existencias: number;
  minimo: number;
  activo: boolean;
  configurado: boolean;
};
type OrderAction = 'preparar' | 'lista' | 'entregar' | 'cancelar';

function normalizarSede(value: string | null): Sede {
  const site = String(value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(site) ? (site as Sede) : 'MMA';
}

function moneda(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(value);
}

function statusBadge(status: EstadoCompra) {
  if (status === 'entregada' || status === 'cobrada') return <Badge className="bg-emerald-600 text-white">Entregada</Badge>;
  if (status === 'lista') return <Badge className="bg-sky-600 text-white">Lista para entregar</Badge>;
  if (status === 'preparando') return <Badge className="bg-violet-600 text-white">Preparando</Badge>;
  if (status === 'cancelada') return <Badge variant="outline" className="border-zinc-500/40 text-zinc-400">Cancelada</Badge>;
  return <Badge variant="outline" className="border-amber-500/40 text-amber-400">Pendiente de cobro</Badge>;
}

export default function ComprasPage() {
  const auth = useAuth();
  const [sede, setSede] = useState<Sede>('MMA');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [inventario, setInventario] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | EstadoCompra>('pendiente_cobro');
  const [vista, setVista] = useState<'pedidos' | 'inventario'>('pedidos');
  const [updating, setUpdating] = useState('');

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem('userSede')));
    const incomingSearch = new URLSearchParams(window.location.search).get('buscar');
    if (incomingSearch) {
      setQuery(incomingSearch);
      setFilter('todos');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        compras?: Compra[];
        inventario?: InventoryProduct[];
      }>(`/api/admin/compras?sede=${encodeURIComponent(sede)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || !data.ok) throw new Error(apiErrorMessage(response.status, data.mensaje));
      setCompras(data.compras || []);
      setInventario(data.inventario || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las compras.');
    } finally {
      setLoading(false);
    }
  }, [auth, sede]);

  useEffect(() => {
    if (!auth.currentUser) return;
    void load();
  }, [auth.currentUser, load]);

  const pendientes = compras.filter((purchase) => !['entregada', 'cobrada', 'cancelada'].includes(purchase.estado));
  const totalPendiente = pendientes.reduce((sum, purchase) => sum + purchase.total, 0);
  const stockBajo = inventario.filter((product) => product.activo && product.existencias <= product.minimo).length;

  const visibles = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return compras.filter((purchase) => {
      const normalizedStatus = purchase.estado === 'cobrada' ? 'entregada' : purchase.estado;
      const matchesStatus = filter === 'todos' || normalizedStatus === filter;
      const matchesTerm = !term || [purchase.nombre, purchase.folio, purchase.id]
        .some((value) => value.toLocaleLowerCase('es').includes(term)) ||
        purchase.items.some((item) => item.nombre.toLocaleLowerCase('es').includes(term));
      return matchesStatus && matchesTerm;
    });
  }, [compras, filter, query]);

  const actualizarEstado = async (purchase: Compra, accion: OrderAction) => {
    setUpdating(purchase.id);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const { response, data } = await apiRequest<{ ok?: boolean; mensaje?: string; estado?: EstadoCompra }>('/api/admin/compras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sede, compraId: purchase.id, accion }),
      });
      if (!response.ok || !data.ok || !data.estado) throw new Error(apiErrorMessage(response.status, data.mensaje));
      setCompras((current) => current.map((item) => item.id === purchase.id ? {
        ...item,
        estado: data.estado!,
        cobrada: data.estado === 'entregada' ? true : item.cobrada,
      } : item));
      if (accion === 'entregar') await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la compra.');
    } finally {
      setUpdating('');
    }
  };

  const updateInventoryValue = (id: StoreProductId, patch: Partial<InventoryProduct>) => {
    setInventario((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
  };

  const guardarInventario = async (product: InventoryProduct) => {
    setUpdating(`inventory-${product.id}`);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        inventario?: InventoryProduct;
      }>('/api/admin/compras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sede,
          accion: 'guardar_inventario',
          productoId: product.id,
          precio: Number(product.precio),
          existencias: Number(product.existencias),
          minimo: Number(product.minimo),
          activo: product.activo,
          imagen: product.imagen,
        }),
      });
      if (!response.ok || !data.ok || !data.inventario) throw new Error(apiErrorMessage(response.status, data.mensaje));
      updateInventoryValue(product.id, data.inventario);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el inventario.');
    } finally {
      setUpdating('');
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 px-4 py-8 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-3 border-red-500/30 text-red-500">TIENDA · {sede.replace('_', ' ')}</Badge>
          <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">Compras e inventario</h1>
          <p className="mt-2 text-muted-foreground">Seguimiento de pedidos, cobro, entrega y existencias por sede.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualizar</Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Pedidos pendientes</p><p className="mt-2 text-3xl font-black text-amber-400">{pendientes.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Total por cobrar</p><p className="mt-2 text-3xl font-black text-emerald-400">{moneda(totalPendiente)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Productos activos</p><p className="mt-2 text-3xl font-black">{inventario.filter((product) => product.activo).length}</p></CardContent></Card>
        <Card className={stockBajo ? 'border-amber-500/30' : ''}><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Stock bajo o agotado</p><p className={`mt-2 text-3xl font-black ${stockBajo ? 'text-amber-400' : 'text-emerald-400'}`}>{stockBajo}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 rounded-xl border p-1.5">
        <Button className="flex-1" variant={vista === 'pedidos' ? 'default' : 'ghost'} onClick={() => setVista('pedidos')}><ReceiptText className="mr-2 h-4 w-4" />Pedidos</Button>
        <Button className="flex-1" variant={vista === 'inventario' ? 'default' : 'ghost'} onClick={() => setVista('inventario')}><Boxes className="mr-2 h-4 w-4" />Inventario</Button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

      {vista === 'pedidos' ? (
        <>
          <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno, producto o folio…" /></div>
            <div className="flex flex-wrap gap-2">
              {([['pendiente_cobro', 'Pendientes'], ['preparando', 'Preparando'], ['lista', 'Listas'], ['entregada', 'Entregadas'], ['cancelada', 'Canceladas'], ['todos', 'Todas']] as const).map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>)}
            </div>
          </CardContent></Card>

          {loading ? (
            <div className="grid min-h-64 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-red-500" /></div>
          ) : compras.length === 0 ? (
            <Card><CardContent className="grid min-h-64 place-items-center text-center text-muted-foreground"><div><ReceiptText className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="font-bold">Todavía no hay compras confirmadas en esta sede.</p></div></CardContent></Card>
          ) : visibles.length === 0 ? (
            <Card><CardContent className="grid min-h-44 place-items-center text-center text-muted-foreground">No hay compras que coincidan con este filtro.</CardContent></Card>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {visibles.map((purchase) => {
                const busy = updating === purchase.id;
                const terminal = ['entregada', 'cobrada', 'cancelada'].includes(purchase.estado);
                return (
                  <Card key={purchase.id} className="border-red-500/15">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-xs font-black uppercase tracking-wider text-red-500">{purchase.folio}</p><CardTitle className="mt-1 uppercase">{purchase.nombre}</CardTitle></div>
                        {statusBadge(purchase.estado)}
                      </div>
                      <p className="text-xs text-muted-foreground">{purchase.creadaEn ? new Date(purchase.creadaEn).toLocaleString('es-MX') : 'Registrando fecha'}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 rounded-xl border bg-black/15 p-4">
                        {purchase.items.map((item) => <div key={item.productoId} className="flex justify-between gap-3 text-sm"><span><strong>{item.cantidad}×</strong> {item.nombre}</span><strong>{moneda(item.subtotal)}</strong></div>)}
                      </div>
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-emerald-400"><ShieldCheck className="h-4 w-4" />RFID confirmado</div><p className="text-2xl font-black">{moneda(purchase.total)}</p></div>

                      {!terminal && <div className="flex flex-wrap gap-2 border-t pt-4">
                        {purchase.estado === 'pendiente_cobro' && <Button variant="outline" onClick={() => actualizarEstado(purchase, 'preparar')} disabled={busy}><ClipboardCheck className="mr-2 h-4 w-4" />Preparar</Button>}
                        {purchase.estado === 'preparando' && <Button variant="outline" onClick={() => actualizarEstado(purchase, 'lista')} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />Marcar lista</Button>}
                        <Button className="flex-1" onClick={() => actualizarEstado(purchase, 'entregar')} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleDollarSign className="mr-2 h-4 w-4" />}Cobrar y entregar</Button>
                        <Button variant="outline" aria-label="Cancelar compra" onClick={() => actualizarEstado(purchase, 'cancelar')} disabled={busy}><Ban className="h-4 w-4" /></Button>
                      </div>}
                      {(purchase.estado === 'entregada' || purchase.estado === 'cobrada') && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400"><PackageCheck className="h-4 w-4" />Cobrada, entregada e inventario descontado.</div>}
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {inventario.map((product) => {
            const low = product.activo && product.existencias <= product.minimo;
            const busy = updating === `inventory-${product.id}`;
            return (
              <Card key={product.id} className={low ? 'border-amber-500/35' : ''}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-4">
                    <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${product.color}`}><img src={product.imagen} alt="" className="h-full w-full object-contain p-2" /></div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase text-muted-foreground">{product.detalle}</p><h2 className="truncate text-lg font-black uppercase">{product.nombre}</h2><div className="mt-2 flex flex-wrap gap-1.5">{low && <Badge className="bg-amber-500 text-black"><AlertTriangle className="mr-1 h-3 w-3" />Stock bajo</Badge>}{!product.configurado && <Badge variant="outline">Valores iniciales</Badge>}</div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">Precio<Input type="number" min={1} value={product.precio} onChange={(event) => updateInventoryValue(product.id, { precio: Number(event.target.value) })} className="mt-1" /></label>
                    <label className="text-[10px] font-black uppercase text-muted-foreground">Existencias<Input type="number" min={0} value={product.existencias} onChange={(event) => updateInventoryValue(product.id, { existencias: Number(event.target.value) })} className="mt-1" /></label>
                    <label className="text-[10px] font-black uppercase text-muted-foreground">Mínimo<Input type="number" min={0} value={product.minimo} onChange={(event) => updateInventoryValue(product.id, { minimo: Number(event.target.value) })} className="mt-1" /></label>
                  </div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground">Imagen<Input value={product.imagen} onChange={(event) => updateInventoryValue(product.id, { imagen: event.target.value })} className="mt-1" placeholder="/productos/imagen.png o https://…" /></label>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Button type="button" variant="outline" onClick={() => updateInventoryValue(product.id, { activo: !product.activo })}>{product.activo ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}{product.activo ? 'Visible' : 'Oculto'}</Button>
                    <Button type="button" onClick={() => guardarInventario(product)} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground"><PackageCheck className="h-4 w-4" />El inventario se descuenta únicamente al usar “Cobrar y entregar”.</div>
    </main>
  );
}
