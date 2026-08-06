'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Loader2,
  PackageCheck,
  Search,
  UserRound,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type SearchResult = {
  id: string;
  type: 'alumno' | 'compra' | 'pago';
  title: string;
  detail: string;
  keywords: string;
  href: string;
};

function currentSite(): Sede | null {
  const value = String(localStorage.getItem('userSede') || '').trim().toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(value) ? value as Sede : null;
}

function normalized(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

export function AdminGlobalSearch() {
  const firestore = useFirestore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [term, setTerm] = useState('');
  const [records, setRecords] = useState<SearchResult[]>([]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const load = async () => {
    const sede = currentSite();
    if (!sede || loading) return;
    try {
      setLoading(true);
      setError('');
      const [students, purchases, paymentRequests] = await Promise.all([
        getDocs(query(collection(firestore, 'Alumnos'), where('sede', '==', sede))),
        getDocs(query(collection(firestore, 'SolicitudesCompra'), where('sede', '==', sede))),
        getDocs(query(collection(firestore, 'SolicitudesPago'), where('sede', '==', sede))),
      ]);

      const next: SearchResult[] = [];
      students.docs.forEach((document) => {
        const data = document.data();
        const nombre = String(data.nombre || 'Alumno sin nombre');
        const rfid = [data.rfid, ...(Array.isArray(data.rfids) ? data.rfids : [])].filter(Boolean).join(' ');
        const telefono = String(data.telefono || '');
        next.push({
          id: `student-${document.id}`,
          type: 'alumno',
          title: nombre,
          detail: [telefono || 'Sin teléfono', rfid ? `RFID ${rfid}` : 'Sin RFID'].join(' · '),
          keywords: normalized(`${nombre} ${telefono} ${rfid} ${document.id}`),
          href: `/admin/dashboard?buscar=${encodeURIComponent(nombre)}&alumno=${encodeURIComponent(document.id)}`,
        });
      });
      purchases.docs.forEach((document) => {
        const data = document.data();
        const nombre = String(data.nombre || 'Alumno');
        const folio = String(data.folio || document.id.slice(-8).toUpperCase());
        const estado = String(data.estado || 'pendiente_cobro');
        next.push({
          id: `purchase-${document.id}`,
          type: 'compra',
          title: folio,
          detail: `${nombre} · ${estado.replaceAll('_', ' ')}`,
          keywords: normalized(`${folio} ${nombre} ${estado} ${document.id}`),
          href: `/admin/compras?buscar=${encodeURIComponent(folio)}`,
        });
      });
      paymentRequests.docs.forEach((document) => {
        const data = document.data();
        const nombre = String(data.nombre || 'Alumno');
        const periodo = String(data.periodo || 'Sin periodo');
        next.push({
          id: `payment-${document.id}`,
          type: 'pago',
          title: nombre,
          detail: `Solicitud ${periodo} · ${String(data.estado || 'pendiente')}`,
          keywords: normalized(`${nombre} ${periodo} ${data.estado || ''} ${document.id}`),
          href: `/admin/pagar?buscar=${encodeURIComponent(nombre)}`,
        });
      });
      setRecords(next);
      setLoaded(true);
    } catch {
      setError('No se pudo cargar el índice de búsqueda de esta sede.');
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    const value = normalized(term.trim());
    if (value.length < 2) return [];
    return records.filter((record) => record.keywords.includes(value)).slice(0, 15);
  }, [records, term]);

  const goTo = (href: string) => {
    setOpen(false);
    setTerm('');
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next && !loaded) void load();
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-2 px-2 text-muted-foreground hover:text-primary" title="Buscar en el panel (Ctrl K)" aria-label="Buscar en el panel">
          <Search className="h-4 w-4" />
          <span className="hidden 2xl:inline">Buscar</span>
          <kbd className="hidden rounded border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground 2xl:inline">Ctrl K</kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic"><Search className="h-5 w-5 text-primary" />Búsqueda general</DialogTitle>
          <DialogDescription>Atletas, teléfonos, RFID, compras y solicitudes de pago de la sede actual.</DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} className="h-12 pl-10" placeholder="Nombre, teléfono, RFID o folio…" />
          </div>

          <div className="mt-4 max-h-[55vh] overflow-y-auto">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Preparando búsqueda…</div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
            ) : term.trim().length < 2 ? (
              <div className="grid min-h-40 place-items-center text-center text-sm text-muted-foreground"><div><p className="font-bold">Escribe al menos dos caracteres.</p><p className="mt-1 text-xs">Hay {records.length} registros disponibles.</p></div></div>
            ) : results.length === 0 ? (
              <div className="grid min-h-40 place-items-center text-center text-sm text-muted-foreground">No se encontraron coincidencias.</div>
            ) : (
              <div className="space-y-2">
                {results.map((result) => {
                  const Icon = result.type === 'alumno' ? UserRound : result.type === 'compra' ? PackageCheck : CreditCard;
                  return (
                    <button key={result.id} type="button" onClick={() => goTo(result.href)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-black uppercase">{result.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.detail}</span></span>
                      <Badge variant="outline" className="capitalize">{result.type}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
