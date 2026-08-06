'use client';

import { useCallback, useEffect, useState } from 'react';
import { DoorClosed, DoorOpen, Loader2, RefreshCw, ShieldAlert, Wifi } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';

function normalizarSede(value: string | null): Sede {
  const sede = String(value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(sede) ? sede as Sede : 'MMA';
}

export default function PuertaPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [sede, setSede] = useState<Sede>('MMA');
  const [liberada, setLiberada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);

  useEffect(() => setSede(normalizarSede(localStorage.getItem('userSede'))), []);

  const getToken = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
    return token;
  }, [auth]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const { response, data } = await apiRequest<{ ok?: boolean; mensaje?: string; puertaLiberada?: boolean; actualizadoEn?: string | null }>(`/api/control-puerta?sede=${encodeURIComponent(sede)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || !data.ok) throw new Error(apiErrorMessage(response.status, data.mensaje));
      setLiberada(data.puertaLiberada === true);
      setActualizadoEn(data.actualizadoEn || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la puerta.');
    } finally {
      setLoading(false);
    }
  }, [getToken, sede]);

  useEffect(() => {
    if (!auth.currentUser) return;
    void cargar();
  }, [auth.currentUser, cargar]);

  const cambiarEstado = async () => {
    if (loading || working) return;
    const next = !liberada;
    if (next && !window.confirm('¿Liberar la puerta? El imán quedará desactivado y la puerta permanecerá sin bloqueo hasta que apague este switch.')) return;

    setWorking(true);
    setError('');
    try {
      const token = await getToken();
      const { response, data } = await apiRequest<{ ok?: boolean; mensaje?: string; puertaLiberada?: boolean }>('/api/control-puerta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sede, puertaLiberada: next, confirmar: true }),
      });
      if (!response.ok || !data.ok) throw new Error(apiErrorMessage(response.status, data.mensaje));
      setLiberada(data.puertaLiberada === true);
      setActualizadoEn(new Date().toISOString());
      toast({
        title: data.puertaLiberada ? 'Puerta liberada' : 'Puerta bloqueada',
        description: data.puertaLiberada ? 'El ESP32 mantendrá desactivado el imán.' : 'El ESP32 volverá a activar el imán.',
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo cambiar la puerta.';
      setError(message);
      toast({ variant: 'destructive', title: 'No se cambió la puerta', description: message });
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-7 py-2 sm:py-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-3 border-red-500/30 text-red-500">CONTROL REMOTO · {sede.replace('_', ' ')}</Badge>
          <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">Puerta</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Controla el imán de la entrada. El estado permanece guardado por sede aunque el ESP32 se reinicie.</p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading || working}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
      </header>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <Card className={`overflow-hidden border-2 transition-all duration-500 ${liberada ? 'border-emerald-500/50 bg-emerald-500/[0.05] shadow-[0_0_45px_rgba(16,185,129,0.12)]' : 'border-red-500/40 bg-red-500/[0.04]'}`}>
        <CardContent className="p-6 sm:p-9">
          <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
            <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl ${liberada ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {loading ? <Loader2 className="h-9 w-9 animate-spin" /> : liberada ? <DoorOpen className="h-10 w-10" /> : <DoorClosed className="h-10 w-10" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Estado solicitado</p>
              <h2 className={`mt-2 text-2xl font-black uppercase sm:text-3xl ${liberada ? 'text-emerald-400' : 'text-red-400'}`}>{loading ? 'Consultando…' : liberada ? 'Puerta liberada' : 'Puerta bloqueada'}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{liberada ? 'El imán debe permanecer desactivado. Cualquier persona puede abrir la puerta.' : 'El imán debe permanecer activo. El acceso funciona normalmente mediante RFID o sensor de salida.'}</p>
              {actualizadoEn && <p className="mt-3 text-xs text-muted-foreground">Último cambio: {new Date(actualizadoEn).toLocaleString('es-MX')}</p>}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={liberada}
              aria-label={liberada ? 'Bloquear puerta' : 'Liberar puerta'}
              onClick={cambiarEstado}
              disabled={loading || working}
              className={`relative h-16 w-32 shrink-0 rounded-full border-2 p-1.5 outline-none transition-all duration-500 focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-60 ${liberada ? 'border-emerald-300/70 bg-emerald-600 shadow-[0_0_28px_rgba(16,185,129,0.3)]' : 'border-red-300/60 bg-red-700 shadow-[0_0_22px_rgba(239,68,68,0.2)]'}`}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-xl transition-transform duration-500 ease-out ${liberada ? 'translate-x-16' : 'translate-x-0'}`}>
                {working ? <Loader2 className="h-6 w-6 animate-spin" /> : liberada ? <DoorOpen className="h-6 w-6 text-emerald-600" /> : <DoorClosed className="h-6 w-6 text-red-700" />}
              </span>
            </button>
          </div>
        </CardContent>
        {liberada && <div className="flex items-center justify-center gap-2 border-t border-amber-500/25 bg-amber-500/10 px-5 py-4 text-center text-xs font-bold text-amber-300"><ShieldAlert className="h-4 w-4 shrink-0" />La puerta permanecerá físicamente sin bloqueo hasta apagar el switch.</div>}
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground"><Wifi className="mt-0.5 h-4 w-4 shrink-0" /><p>El cambio se entrega al ESP32 mediante su heartbeat. Si está desconectado, conservará el estado anterior hasta volver a conectarse.</p></div>
    </main>
  );
}
