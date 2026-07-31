'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Save,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const WORKER_URL_KEY = 'albatrosWhatsAppWorkerUrl';

type Prospect = {
  id: string;
  telefono?: string;
  nombre?: string;
  nombreWhatsApp?: string;
  disciplina?: string;
  horario?: string;
  sede?: string;
  diaPosible?: string;
  puntuacion?: number;
  requiereHumano?: boolean;
  motivoTransferencia?: string;
  botPausado?: boolean;
  estadoSeguimiento?: string;
  ultimoMensaje?: string;
  origen?: { headline?: string; body?: string };
};

function selectedSite() {
  return localStorage.getItem('userSede') || 'MMA';
}

function normalizeWorkerUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export default function WhatsAppProspectsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [workerUrl, setWorkerUrl] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const saved =
      process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL ||
      localStorage.getItem(WORKER_URL_KEY) ||
      '';
    setWorkerUrl(normalizeWorkerUrl(saved));
    setUrlDraft(normalizeWorkerUrl(saved));
  }, []);

  const authHeaders = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('La sesión expiró');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [auth]);

  const loadProspects = useCallback(async () => {
    if (!workerUrl) return;
    try {
      setLoading(true);
      const headers = await authHeaders();
      const response = await fetch(
        `${workerUrl}/api/prospects?sede=${encodeURIComponent(selectedSite())}`,
        { headers, cache: 'no-store' },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar');
      setProspects(data.prospects || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudieron cargar los prospectos',
        description:
          error instanceof Error ? error.message : 'Intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, toast, workerUrl]);

  useEffect(() => {
    if (workerUrl) void loadProspects();
  }, [loadProspects, workerUrl]);

  const saveWorkerUrl = () => {
    const normalized = normalizeWorkerUrl(urlDraft);
    if (!/^https:\/\/.+\.workers\.dev$/i.test(normalized)) {
      toast({
        variant: 'destructive',
        title: 'Dirección inválida',
        description: 'Pega la URL HTTPS completa que te entregó Cloudflare.',
      });
      return;
    }
    localStorage.setItem(WORKER_URL_KEY, normalized);
    setWorkerUrl(normalized);
    toast({ title: 'Worker conectado' });
  };

  const updateProspect = async (
    prospect: Prospect,
    action: 'pause' | 'resume' | 'contacted' | 'discard',
  ) => {
    try {
      setUpdatingId(prospect.id);
      const headers = await authHeaders();
      const response = await fetch(`${workerUrl}/api/prospects`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: prospect.id,
          sede: selectedSite(),
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar');
      await loadProspects();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo actualizar',
        description:
          error instanceof Error ? error.message : 'Intenta nuevamente.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!workerUrl) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="border-emerald-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-emerald-500" />
              Conectar Cloudflare Worker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pega la dirección que Cloudflare muestra después de publicar,
              por ejemplo: https://albatros-whatsapp.usuario.workers.dev
            </p>
            <Input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="https://albatros-whatsapp....workers.dev"
            />
            <Button className="w-full" onClick={saveWorkerUrl}>
              <Save className="mr-2 h-4 w-4" />
              Guardar y conectar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 shadow-xl md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge className="mb-3 bg-emerald-500/15 text-emerald-500">
              WHATSAPP · PROSPECTOS CALIFICADOS
            </Badge>
            <h1 className="text-3xl font-black uppercase italic md:text-4xl">
              Interesados reales
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Solo aparecen contactos con interés alto o que solicitaron una persona.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem(WORKER_URL_KEY);
                setWorkerUrl('');
              }}
            >
              Cambiar Worker
            </Button>
            <Button variant="outline" disabled={loading} onClick={() => void loadProspects()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
      ) : prospects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bot className="mx-auto mb-3 h-10 w-10" />
            Todavía no hay prospectos calificados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prospects.map((prospect) => {
            const busy = updatingId === prospect.id;
            const name = prospect.nombre || prospect.nombreWhatsApp || 'Sin nombre';
            const phone = prospect.telefono || prospect.id;
            return (
              <Card key={prospect.id} className="border-emerald-500/15 bg-card/70">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-black">{name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">+{phone}</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-500">
                      {prospect.puntuacion || 0} puntos
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><b>Disciplina:</b> {prospect.disciplina || 'Pendiente'}</p>
                    <p><b>Horario:</b> {prospect.horario || 'Pendiente'}</p>
                    <p><b>Sede:</b> {prospect.sede?.replace('_', ' ') || 'Pendiente'}</p>
                    <p><b>Día posible:</b> {prospect.diaPosible || 'Pendiente'}</p>
                  </div>
                  {prospect.ultimoMensaje && (
                    <div className="rounded-xl border bg-background/60 p-3">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">
                        Último mensaje
                      </p>
                      <p className="mt-1 text-sm">{prospect.ultimoMensaje}</p>
                    </div>
                  )}
                  {prospect.requiereHumano && (
                    <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500">
                      <UserRoundCheck className="mr-2 inline h-4 w-4" />
                      {prospect.motivoTransferencia || 'Solicitó atención humana.'}
                    </p>
                  )}
                  {(prospect.origen?.headline || prospect.origen?.body) && (
                    <p className="text-xs text-muted-foreground">
                      <b>Anuncio:</b> {prospect.origen.headline || prospect.origen.body}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Abrir WhatsApp
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateProspect(prospect, 'contacted')}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Contactado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void updateProspect(
                          prospect,
                          prospect.botPausado ? 'resume' : 'pause',
                        )
                      }
                    >
                      {prospect.botPausado ? (
                        <Play className="mr-2 h-4 w-4" />
                      ) : (
                        <Pause className="mr-2 h-4 w-4" />
                      )}
                      {prospect.botPausado ? 'Reanudar bot' : 'Pausar bot'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => void updateProspect(prospect, 'discard')}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Descartar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

