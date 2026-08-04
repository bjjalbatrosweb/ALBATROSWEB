'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

type Estado = 'enviando' | 'completado' | 'error';

export default function ConfirmarSolicitudPagoPage() {
  const params = useParams<{ token: string }>();
  const sentRef = useRef(false);
  const [estado, setEstado] = useState<Estado>('enviando');
  const [mensaje, setMensaje] = useState('Registrando su solicitud…');

  useEffect(() => {
    if (sentRef.current || !params.token) return;
    sentRef.current = true;

    const confirmar = async () => {
      try {
        const response = await fetch('/api/solicitudes-pago/confirmar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          mensaje?: string;
        };

        if (!response.ok || !data.ok) {
          throw new Error(data.mensaje || 'No se pudo registrar la solicitud.');
        }

        setEstado('completado');
        setMensaje(data.mensaje || 'Solicitud de pago realizada. Espere su comprobante.');
      } catch (error) {
        setEstado('error');
        setMensaje(
          error instanceof Error
            ? error.message
            : 'No se pudo registrar la solicitud.',
        );
      }
    };

    void confirmar();
  }, [params.token]);

  return (
    <main className="grid min-h-screen place-items-center bg-black px-5 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-red-500/20 bg-zinc-950 p-8 text-center shadow-[0_0_90px_rgba(220,38,38,0.14)]">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-red-500/25 bg-red-500/10">
          {estado === 'enviando' ? (
            <Loader2 className="h-10 w-10 animate-spin text-red-500" />
          ) : estado === 'completado' ? (
            <CheckCircle2 className="h-11 w-11 text-emerald-400" />
          ) : (
            <XCircle className="h-11 w-11 text-red-400" />
          )}
        </div>

        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-red-500">
          Albatros
        </p>
        <h1 className="text-2xl font-black uppercase italic">
          {estado === 'enviando'
            ? 'Procesando'
            : estado === 'completado'
              ? 'Solicitud recibida'
              : 'No se completó'}
        </h1>
        <p className="mt-4 leading-relaxed text-zinc-300">{mensaje}</p>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4" />
          Este proceso no realiza cargos automáticos.
        </div>
      </section>
    </main>
  );
}
