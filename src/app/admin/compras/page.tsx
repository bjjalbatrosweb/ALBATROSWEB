'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type ItemCompra = {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
};
type Compra = {
  id: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  items: ItemCompra[];
  total: number;
  estado: string;
  confirmadaPorRfid: boolean;
  creadaEn: string | null;
};

function normalizarSede(value: string | null): Sede {
  const site = String(value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(site) ? (site as Sede) : 'MMA';
}

function moneda(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(value);
}

export default function ComprasPage() {
  const auth = useAuth();
  const [sede, setSede] = useState<Sede>('MMA');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem('userSede')));
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
      }>(`/api/admin/compras?sede=${encodeURIComponent(sede)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || !data.ok) {
        throw new Error(apiErrorMessage(response.status, data.mensaje));
      }
      setCompras(data.compras || []);
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

  const totalPendiente = compras
    .filter((purchase) => purchase.estado === 'pendiente_cobro')
    .reduce((sum, purchase) => sum + purchase.total, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 px-4 py-8 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-3 border-red-500/30 text-red-500">SOLICITUDES · {sede.replace('_', ' ')}</Badge>
          <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">Compras</h1>
          <p className="mt-2 text-muted-foreground">Pedidos confirmados mediante la tarjeta RFID del alumno.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualizar</Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Pedidos mostrados</p><p className="mt-2 text-3xl font-black">{compras.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Pendientes de cobro</p><p className="mt-2 text-3xl font-black text-amber-400">{compras.filter((purchase) => purchase.estado === 'pendiente_cobro').length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Total pendiente</p><p className="mt-2 text-3xl font-black text-emerald-400">{moneda(totalPendiente)}</p></CardContent></Card>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

      {loading ? (
        <div className="grid min-h-64 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-red-500" /></div>
      ) : compras.length === 0 ? (
        <Card><CardContent className="grid min-h-64 place-items-center text-center text-muted-foreground"><div><ReceiptText className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="font-bold">Todavía no hay compras confirmadas en esta sede.</p></div></CardContent></Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {compras.map((purchase) => (
            <Card key={purchase.id} className="border-red-500/15">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-wider text-red-500">{purchase.id.slice(-8).toUpperCase()}</p><CardTitle className="mt-1 uppercase">{purchase.nombre}</CardTitle></div>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400">Pendiente de cobro</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{purchase.creadaEn ? new Date(purchase.creadaEn).toLocaleString('es-MX') : 'Registrando fecha'}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-xl border bg-black/15 p-4">
                  {purchase.items.map((item) => (
                    <div key={item.productoId} className="flex justify-between gap-3 text-sm"><span><strong>{item.cantidad}×</strong> {item.nombre}</span><strong>{moneda(item.subtotal)}</strong></div>
                  ))}
                </div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-emerald-400"><ShieldCheck className="h-4 w-4" />RFID confirmado</div><p className="text-2xl font-black">{moneda(purchase.total)}</p></div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground"><PackageCheck className="h-4 w-4" /><CheckCircle2 className="h-4 w-4" />Estas solicitudes no modifican mensualidades ni inventario.</div>
    </main>
  );
}
