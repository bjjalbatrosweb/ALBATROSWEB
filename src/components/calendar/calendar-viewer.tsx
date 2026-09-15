'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CalendarDays, CalendarX2, Download, Expand, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

import { useFirestore, useUser } from '@/firebase';

type Sede = 'TODAS' | 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type CalendarData = {
  id: string;
  titulo: string;
  mes: number;
  anio: number;
  sede: Sede;
  estado: string;
  imagenUrl: string;
};

const sites: Array<{ value: Sede; label: string }> = [
  { value: 'TODAS', label: 'General' },
  { value: 'MMA', label: 'MMA' },
  { value: 'CAUCEL', label: 'Caucel' },
  { value: 'JUAN_PABLO', label: 'Juan Pablo' },
];

async function getPublishedCalendar(
  firestore: ReturnType<typeof useFirestore>,
  site: Sede,
): Promise<CalendarData | null> {
  const pointer = await getDoc(doc(firestore, 'CalendariosActuales', site));
  const calendarId = pointer.exists()
    ? String(pointer.data().calendarioId || '')
    : '';
  if (!calendarId) return null;

  const calendar = await getDoc(doc(firestore, 'Calendarios', calendarId));
  if (!calendar.exists()) return null;
  const data = calendar.data() as Omit<CalendarData, 'id'>;
  return data.estado === 'publicado' && data.imagenUrl
    ? { id: calendar.id, ...data }
    : null;
}

export function CalendarViewer() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState<Sede>('TODAS');
  const [allowedSites, setAllowedSites] = useState<Sede[]>(['TODAS']);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getDoc(doc(firestore, 'usuarios', user.uid))
      .then((snapshot) => {
        if (!active) return;
        const ownSite = String(snapshot.data()?.sede || '') as Sede;
        if (['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(ownSite)) {
          setAllowedSites([ownSite, 'TODAS']);
          setSite(ownSite);
        }
      })
      .catch(() => {
        // El calendario general sigue disponible aunque falle la lectura del perfil.
      });
    return () => { active = false; };
  }, [firestore, user]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        let result = await getPublishedCalendar(firestore, site);
        if (!result && site !== 'TODAS') {
          result = await getPublishedCalendar(firestore, 'TODAS');
        }
        if (active) setCalendar(result);
      } catch {
        if (active) setCalendar(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [firestore, site]);

  const imageUrl = calendar?.imagenUrl || '';
  const title = calendar?.titulo || 'Sin calendario publicado';

  return (
    <>
      <div className="mb-7 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-[0.28em]">Plan mensual</span>
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter sm:text-5xl lg:text-7xl">
            Calendario <span className="text-primary">Albatros</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/60 sm:text-base">
            Programa de entrenamiento organizado por sesiones físicas, técnicas y prácticas.
          </p>
        </div>

        {calendar && <div className="flex flex-wrap gap-3">
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-black uppercase tracking-wider transition-colors hover:border-primary/60 hover:bg-primary/10">
            <Expand className="h-4 w-4 text-primary" /> Ver completa
          </a>
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-wider shadow-[0_0_28px_-8px_rgba(255,0,0,.75)] transition-transform hover:scale-[1.02]">
            <Download className="h-4 w-4" /> Descargar
          </a>
        </div>}
      </div>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Seleccionar sede">
        {sites.filter((item) => allowedSites.includes(item.value)).map((item) => (
          <button key={item.value} type="button" onClick={() => setSite(item.value)} className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${site === item.value ? 'border-primary bg-primary text-white' : 'border-white/10 bg-white/5 text-white/70 hover:border-primary/40 hover:text-white'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/55 p-2 shadow-[0_28px_90px_-35px_rgba(0,0,0,.95)] sm:rounded-3xl sm:p-3">
        <div className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        {loading ? (
          <div className="grid aspect-[4/3] place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : calendar ? (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
            <Image src={imageUrl} alt={title} width={2400} height={1800} priority quality={72} className="h-auto w-full rounded-xl sm:rounded-2xl" sizes="(max-width: 1280px) 100vw, 1152px" />
          </a>
        ) : <div className="grid min-h-72 place-items-center p-6 text-center"><div><CalendarX2 className="mx-auto h-10 w-10 text-white/30"/><h2 className="mt-4 text-xl font-black">No hay un calendario publicado</h2><p className="mt-2 max-w-md text-sm text-white/60">La agenda reservable sigue disponible. Aquí aparecerá el plan mensual cuando la academia lo publique.</p></div></div>}
      </div>
      {calendar && <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-white/70">
        {title} · Toca la imagen para verla completa
      </p>}
    </>
  );
}
