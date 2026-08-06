'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  UserRound,
  XCircle,
} from 'lucide-react';
import QRCode from 'qrcode';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type EstadoLector = 'inactivo' | 'iniciando' | 'escaneando' | 'consultando' | 'error';

type AlumnoPago = {
  id: string;
  nombre: string;
  sede: Sede;
  monto: number;
  montoBase: number;
  descuento: number;
  telefono: string;
  disciplina: string;
  activo: boolean;
};

type NfcReadingEvent = Event & { serialNumber?: string };
type NfcReader = EventTarget & {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
};
type NfcConstructor = new () => NfcReader;

function normalizarSede(value: string | null): Sede {
  const sede = String(value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(sede)
    ? (sede as Sede)
    : 'MMA';
}

function normalizarRfid(value: unknown): string {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function periodoActual(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function moneda(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PagarPage() {
  const controllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<NfcReader | null>(null);
  const lastReadRef = useRef<{ uid: string; at: number } | null>(null);

  const [sede, setSede] = useState<Sede>('MMA');
  const [estado, setEstado] = useState<EstadoLector>('inactivo');
  const [compatible, setCompatible] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [rfid, setRfid] = useState('');
  const [alumno, setAlumno] = useState<AlumnoPago | null>(null);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    const currentSite = normalizarSede(localStorage.getItem('userSede'));
    setSede(currentSite);
    setCompatible(window.isSecureContext && 'NDEFReader' in window);
    return () => {
      controllerRef.current?.abort();
      readerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!qrExpiresAt || qrConfirmed) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(qrExpiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [qrConfirmed, qrExpiresAt]);

  const consultarTarjeta = useCallback(
    async (uid: string) => {
      setEstado('consultando');
      setError('');
      setAlumno(null);
      setQrDataUrl('');
      setQrExpiresAt('');
      setQrUrl('');
      setQrConfirmed(false);
      setRfid(uid);

      try {
        const { response, data } = await apiRequest<{
          ok?: boolean;
          mensaje?: string;
          alumno?: AlumnoPago;
        }>('/api/pagar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accion: 'consultar', rfid: uid, sede }),
        });

        if (!response.ok || !data.ok || !data.alumno) {
          throw new Error(apiErrorMessage(response.status, data.mensaje, 'No se encontró la tarjeta.'));
        }
        setAlumno(data.alumno);
        setEstado('escaneando');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar la tarjeta.');
        setEstado('escaneando');
      }
    },
    [sede],
  );

  const iniciarLector = async () => {
    setError('');
    if (!window.isSecureContext) {
      setEstado('error');
      setError('Esta función necesita abrirse desde HTTPS.');
      return;
    }

    const Constructor = (window as Window & { NDEFReader?: NfcConstructor }).NDEFReader;
    if (!Constructor) {
      setCompatible(false);
      setEstado('error');
      setError('Abra este apartado en Chrome para Android y active el NFC.');
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
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

        const now = Date.now();
        const previous = lastReadRef.current;
        if (previous?.uid === uid && now - previous.at < 3500) return;
        lastReadRef.current = { uid, at: now };
        void consultarTarjeta(uid);
      });

      await reader.scan({ signal: controller.signal });
      setCompatible(true);
      setEstado('escaneando');
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setEstado('error');
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el NFC.');
    }
  };

  const generarQr = async () => {
    if (!alumno || !rfid) return;
    setGenerando(true);
    setError('');
    setQrConfirmed(false);
    setCopied(false);
    try {
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        token?: string;
        expiraEn?: string;
      }>('/api/pagar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accion: 'generar', rfid, sede, periodo }),
      });

      if (!response.ok || !data.ok || !data.token) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, 'No se pudo generar el QR.'));
      }

      const confirmationUrl = `${window.location.origin}/solicitud-pago/${data.token}`;
      const image = await QRCode.toDataURL(confirmationUrl, {
        width: 560,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#050505', light: '#ffffff' },
      });
      setQrDataUrl(image);
      setQrUrl(confirmationUrl);
      setQrExpiresAt(data.expiraEn || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el QR.');
    } finally {
      setGenerando(false);
    }
  };

  const copyQrLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No se pudo copiar el enlace. Puede escanear o descargar el QR.');
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl || !alumno) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `pago-${alumno.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${periodo}.png`;
    anchor.click();
  };

  const qrExpired = Boolean(qrExpiresAt && secondsLeft <= 0);
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 px-4 py-8 lg:px-8">
      <header>
        <Badge variant="outline" className="mb-3 border-red-500/30 text-red-500">
          PRUEBA CONTROLADA · {sede.replace('_', ' ')}
        </Badge>
        <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">Pagar</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Identifique al alumno con su tag, genere el QR y reciba una solicitud pendiente. No se registra ningún pago automáticamente.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-red-500" /> Escanear tag RFID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-red-500/25 bg-red-500/5 p-6 text-center">
              <div>
                {estado === 'iniciando' || estado === 'consultando' ? (
                  <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-red-500" />
                ) : (
                  <ScanLine className={`mx-auto mb-4 h-12 w-12 ${estado === 'escaneando' ? 'animate-pulse text-emerald-400' : 'text-red-500'}`} />
                )}
                <p className="font-black uppercase">
                  {estado === 'escaneando' ? 'Acerque la tarjeta' : estado === 'consultando' ? 'Consultando alumno' : 'Lector detenido'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Chrome para Android · NFC activo</p>
              </div>
            </div>

            {error && <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"><XCircle className="h-5 w-5 shrink-0" />{error}</div>}

            <Button className="w-full" onClick={iniciarLector} disabled={estado === 'iniciando' || estado === 'consultando'}>
              {estado === 'escaneando' ? <RefreshCw className="mr-2 h-4 w-4" /> : <Smartphone className="mr-2 h-4 w-4" />}
              {estado === 'escaneando' ? 'Reiniciar lector NFC' : 'Iniciar lector NFC'}
            </Button>
            {compatible === false && <p className="text-center text-xs text-amber-400">Web NFC no está disponible en este dispositivo.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-red-500" /> Perfil y solicitud</CardTitle></CardHeader>
          <CardContent>
            {!alumno ? (
              <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Escanee una tarjeta para mostrar el perfil y el monto correspondiente.</div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-red-500/20 bg-black/30 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-red-500">Alumno identificado</p>
                  <h2 className="mt-1 text-2xl font-black uppercase">{alumno.nombre}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Disciplina</p><p className="font-bold">{alumno.disciplina || 'Sin especificar'}</p></div>
                    <div><p className="text-muted-foreground">Sede</p><p className="font-bold">{alumno.sede.replace('_', ' ')}</p></div>
                    <div><p className="text-muted-foreground">Monto</p><p className="text-xl font-black text-emerald-400">{moneda(alumno.monto)}</p></div>
                    <div><p className="text-muted-foreground">Descuento</p><p className="font-bold">{moneda(alumno.descuento)}</p></div>
                  </div>
                </div>

                <label className="block text-sm font-bold">Mes solicitado<Input className="mt-2" type="month" value={periodo} onChange={(event) => { setPeriodo(event.target.value); setQrDataUrl(''); setQrUrl(''); setQrConfirmed(false); }} /></label>
                <Button className="w-full" onClick={generarQr} disabled={generando || !periodo}>
                  {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                  Generar QR de solicitud
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {qrDataUrl && alumno && (
        <Card id="pago-qr-imprimible" className="overflow-hidden border-emerald-500/30 print:fixed print:inset-0 print:z-[9999] print:m-0 print:rounded-none print:border-0 print:bg-white print:text-black">
          <CardContent className="grid gap-6 p-6 text-center md:grid-cols-[1fr_auto] md:text-left print:block print:p-10 print:text-center">
            <div className="self-center">
              <Badge className={`mb-3 ${qrConfirmed ? 'bg-emerald-600' : qrExpired ? 'bg-zinc-600' : 'bg-amber-600'}`}>{qrConfirmed ? 'Solicitud recibida' : qrExpired ? 'QR vencido' : 'Esperando escaneo'}</Badge>
              <h2 className="text-2xl font-black uppercase">{qrConfirmed ? 'Confirmado por ' : 'Solicitud de '}{alumno.nombre}</h2>
              <p className="mt-2 text-muted-foreground print:text-zinc-700">Periodo {periodo} · {moneda(alumno.monto)}</p>
              <p className="mt-3 text-sm text-muted-foreground print:text-zinc-700">{qrConfirmed ? 'La solicitud ya aparece en recepción. El pago todavía debe validarse administrativamente.' : 'Escanee con la cámara del teléfono y confirme la solicitud. No realiza cargos automáticos.'}</p>
              {!qrConfirmed && !qrExpired && <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-lg font-black text-amber-400"><Clock3 className="h-4 w-4" />{countdown}</p>}
              {qrExpiresAt && <p className="mt-2 text-xs text-muted-foreground print:text-zinc-600">Vigente hasta {new Date(qrExpiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>}
              <div className="mt-5 flex flex-wrap gap-2 print:hidden">
                {qrExpired ? <Button onClick={generarQr} disabled={generando}><RefreshCw className="mr-2 h-4 w-4" />Generar uno nuevo</Button> : <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>}
                <Button variant="outline" onClick={downloadQr}><Download className="mr-2 h-4 w-4" />Descargar</Button>
                <Button variant="outline" onClick={copyQrLink}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? 'Copiado' : 'Copiar enlace'}</Button>
              </div>
            </div>
            <div className={`relative mx-auto rounded-2xl bg-white p-4 print:mt-8 print:w-fit ${qrExpired ? 'opacity-35 grayscale' : ''}`}><img src={qrDataUrl} alt="QR de solicitud de pago" className="h-64 w-64" />{qrConfirmed && <div className="absolute inset-0 grid place-items-center rounded-2xl bg-emerald-950/85"><div><CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" /><p className="mt-2 font-black uppercase text-white">Recibida</p></div></div>}</div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden"><ShieldCheck className="h-4 w-4" /><CreditCard className="h-4 w-4" />Este módulo no registra pagos ni altera el acceso RFID.</div>
    </main>
  );
}
