'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { recordAdminAudit } from '@/lib/admin-audit';
import { cn } from '@/lib/utils';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type Category = 'alumnos' | 'pagos' | 'asistencias';
type ReportType = 'resumen' | 'pagos' | 'asistencias';
type BackupRecord = Record<string, unknown> & { id: string };
type Backup = {
  sistema: 'ALBATROS';
  sede: Sede;
  generadoEn?: string;
  version?: number;
  alumnos: BackupRecord[];
  pagos: BackupRecord[];
  asistencias: BackupRecord[];
};
type PreviewItem = {
  total: number;
  nuevos: number;
  duplicados: number;
  invalidos: number;
};
type Preview = Record<Category, PreviewItem>;

const VALID_SITES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function siteFromStorage(): Sede | null {
  if (typeof window === 'undefined') return null;
  const value = (localStorage.getItem('userSede') || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  return VALID_SITES.includes(value as Sede) ? (value as Sede) : null;
}

function serializeValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
    );
  }

  return value;
}

function toDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (
    value instanceof Date ||
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizedId(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}

function normalizedName(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizedRfid(value: unknown) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

export function AdminDataTools() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('resumen');
  const [reportStart, setReportStart] = useState(() =>
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
  );
  const [reportEnd, setReportEnd] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [isReporting, setIsReporting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [fileName, setFileName] = useState('');
  const [backup, setBackup] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selection, setSelection] = useState<Record<Category, boolean>>({
    alumnos: true,
    pagos: true,
    asistencias: true,
  });

  const getSite = () => {
    const site = siteFromStorage();
    if (!site) throw new Error('No se pudo identificar la sede actual.');
    return site;
  };

  const loadSiteData = async (site: Sede) => {
    const [students, payments, attendance] = await Promise.all([
      getDocs(query(collection(firestore, 'Alumnos'), where('sede', '==', site))),
      getDocs(query(collection(firestore, 'Pagos'), where('sede', '==', site))),
      getDocs(
        query(collection(firestore, 'Asistencias'), where('sede', '==', site)),
      ),
    ]);

    return {
      alumnos: students.docs.map((item) => ({ id: item.id, ...item.data() })),
      pagos: payments.docs.map((item) => ({ id: item.id, ...item.data() })),
      asistencias: attendance.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    };
  };

  const downloadBackup = async () => {
    if (isBackingUp) return;

    try {
      setIsBackingUp(true);
      const site = getSite();
      const data = await loadSiteData(site);
      const payload = {
        sistema: 'ALBATROS',
        sede: site,
        generadoEn: new Date().toISOString(),
        version: 1,
        alumnos: data.alumnos.map(serializeValue),
        pagos: data.pagos.map(serializeValue),
        asistencias: data.asistencias.map(serializeValue),
      };
      const file = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');

      link.href = url;
      link.download = `respaldo_albatros_${site}_${format(
        new Date(),
        'yyyy-MM-dd_HHmm',
      )}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Respaldo descargado',
        description: `${data.alumnos.length} alumnos, ${data.pagos.length} pagos y ${data.asistencias.length} asistencias incluidos.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear el respaldo',
        description: error instanceof Error ? error.message : 'Error desconocido.',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const downloadCsv = (rows: unknown[][], name: string) => {
    const protect = (value: unknown) => {
      const text = String(value ?? '');
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const content = rows
      .map((row) => row.map(protect).join(';'))
      .join('\r\n');
    const file = new Blob([`\uFEFF${content}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportReport = async () => {
    const start = new Date(`${reportStart}T00:00:00`);
    const end = new Date(`${reportEnd}T23:59:59`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      toast({
        variant: 'destructive',
        title: 'Periodo inválido',
        description: 'Revisa las fechas seleccionadas.',
      });
      return;
    }

    try {
      setIsReporting(true);
      const site = getSite();
      const data = await loadSiteData(site);
      const payments = data.pagos.filter((item) => {
        const date = toDate(item.fecha);
        return date && date >= start && date <= end;
      });
      const attendance = data.asistencias.filter((item) => {
        const date = toDate(item.fecha);
        return date && date >= start && date <= end;
      });
      const names = new Map(
        data.alumnos.map(
          (item) =>
            [String(item.id), String(item.nombre || 'Alumno')] as const,
        ),
      );

      if (reportType === 'pagos') {
        downloadCsv(
          [
            ['Alumno', 'Monto', 'Método', 'Fecha', 'Periodo', 'Sede'],
            ...payments.map((item) => [
              item.nombre || names.get(String(item.alumnoId)) || 'Alumno',
              Number(item.monto || 0).toFixed(2),
              item.metodoPago || 'Sin método',
              toDate(item.fecha)
                ? format(toDate(item.fecha) as Date, 'dd/MM/yyyy HH:mm')
                : '',
              item.periodo || '',
              site,
            ]),
          ],
          `reporte_pagos_${site}_${reportStart}_${reportEnd}.csv`,
        );
      } else if (reportType === 'asistencias') {
        const unique = Array.from(
          new Map(
            attendance.map((item) => {
              const date = toDate(item.fecha);
              return [
                `${item.alumnoId}-${date ? format(date, 'yyyy-MM-dd') : item.id}`,
                item,
              ] as const;
            }),
          ).values(),
        );

        downloadCsv(
          [
            ['Alumno', 'Fecha', 'Hora', 'Sede'],
            ...unique.map((item) => {
              const date = toDate(item.fecha);
              return [
                names.get(String(item.alumnoId)) || 'Alumno',
                date ? format(date, 'dd/MM/yyyy') : '',
                date ? format(date, 'HH:mm') : '',
                site,
              ];
            }),
          ],
          `reporte_asistencias_${site}_${reportStart}_${reportEnd}.csv`,
        );
      } else {
        downloadCsv(
          [
            ['Alumno', 'Total pagado', 'Días de asistencia', 'Sede'],
            ...data.alumnos.map((student) => {
              const total = payments
                .filter((item) => item.alumnoId === student.id)
                .reduce((sum, item) => sum + Number(item.monto || 0), 0);
              const days = new Set(
                attendance
                  .filter((item) => item.alumnoId === student.id)
                  .map((item) => toDate(item.fecha))
                  .filter((date): date is Date => Boolean(date))
                  .map((date) => format(date, 'yyyy-MM-dd')),
              ).size;

              return [student.nombre || 'Alumno', total.toFixed(2), days, site];
            }),
          ],
          `reporte_resumen_${site}_${reportStart}_${reportEnd}.csv`,
        );
      }

      setReportOpen(false);
      toast({ title: 'Reporte descargado', description: 'El CSV está listo.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo exportar',
        description: error instanceof Error ? error.message : 'Error desconocido.',
      });
    } finally {
      setIsReporting(false);
    }
  };

  const analyzeBackup = async (payload: Backup) => {
    const site = getSite();
    const current = await loadSiteData(site);
    const studentIds = new Set(current.alumnos.map((item) => item.id));
    const studentNames = new Set(current.alumnos.map((item) => normalizedName(item.nombre)));
    const studentRfids = new Set(
      current.alumnos
        .flatMap((item) => [
          normalizedRfid(item.rfid),
          ...(Array.isArray(item.rfids) ? item.rfids.map(normalizedRfid) : []),
        ])
        .filter(Boolean),
    );
    const paymentIds = new Set(current.pagos.map((item) => item.id));
    const paymentKeys = new Set(
      current.pagos.map((item) => `${item.alumnoId || ''}|${item.periodo || ''}`),
    );
    const attendanceIds = new Set(current.asistencias.map((item) => item.id));
    const attendanceKeys = new Set(
      current.asistencias.map((item) => {
        const date = toDate(item.fecha);
        return `${item.alumnoId || ''}|${date ? format(date, 'yyyy-MM-dd') : ''}`;
      }),
    );
    const records: Record<Category, BackupRecord[]> = {
      alumnos: [],
      pagos: [],
      asistencias: [],
    };
    const result: Preview = {
      alumnos: { total: payload.alumnos.length, nuevos: 0, duplicados: 0, invalidos: 0 },
      pagos: { total: payload.pagos.length, nuevos: 0, duplicados: 0, invalidos: 0 },
      asistencias: { total: payload.asistencias.length, nuevos: 0, duplicados: 0, invalidos: 0 },
    };

    payload.alumnos.forEach((item) => {
      const id = normalizedId(item.id);
      const name = normalizedName(item.nombre);
      const rfids = [
        normalizedRfid(item.rfid),
        ...(Array.isArray(item.rfids) ? item.rfids.map(normalizedRfid) : []),
      ].filter(Boolean);

      if (!id || !name) {
        result.alumnos.invalidos += 1;
      } else if (
        studentIds.has(id) ||
        studentNames.has(name) ||
        rfids.some((rfid) => studentRfids.has(rfid))
      ) {
        result.alumnos.duplicados += 1;
      } else {
        studentIds.add(id);
        studentNames.add(name);
        rfids.forEach((rfid) => studentRfids.add(rfid));
        records.alumnos.push({ ...item, id });
        result.alumnos.nuevos += 1;
      }
    });

    payload.pagos.forEach((item) => {
      const id = normalizedId(item.id);
      const studentId = normalizedId(item.alumnoId);
      const period = String(item.periodo || '');
      const key = `${studentId}|${period}`;

      if (!id || !studentId || !studentIds.has(studentId) || !/^\d{4}-\d{2}$/.test(period)) {
        result.pagos.invalidos += 1;
      } else if (paymentIds.has(id) || paymentKeys.has(key)) {
        result.pagos.duplicados += 1;
      } else {
        paymentIds.add(id);
        paymentKeys.add(key);
        records.pagos.push({ ...item, id });
        result.pagos.nuevos += 1;
      }
    });

    payload.asistencias.forEach((item) => {
      const id = normalizedId(item.id);
      const studentId = normalizedId(item.alumnoId);
      const date = toDate(item.fecha);
      const day = date ? format(date, 'yyyy-MM-dd') : '';
      const key = `${studentId}|${day}`;

      if (!id || !studentId || !studentIds.has(studentId) || !day) {
        result.asistencias.invalidos += 1;
      } else if (attendanceIds.has(id) || attendanceKeys.has(key)) {
        result.asistencias.duplicados += 1;
      } else {
        attendanceIds.add(id);
        attendanceKeys.add(key);
        records.asistencias.push({ ...item, id });
        result.asistencias.nuevos += 1;
      }
    });

    return { preview: result, records };
  };

  const resetRestore = () => {
    setFileName('');
    setBackup(null);
    setPreview(null);
    setSelection({ alumnos: true, pagos: true, asistencias: true });
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo demasiado grande',
        description: 'El respaldo no debe superar 15 MB.',
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      resetRestore();
      const site = getSite();
      const parsed = JSON.parse(await file.text()) as Partial<Backup>;
      const rawSite =
        typeof parsed.sede === 'string'
          ? parsed.sede.trim().toUpperCase().replace(/\s+/g, '_')
          : '';

      if (
        parsed.sistema !== 'ALBATROS' ||
        rawSite !== site ||
        !Array.isArray(parsed.alumnos) ||
        !Array.isArray(parsed.pagos) ||
        !Array.isArray(parsed.asistencias)
      ) {
        throw new Error(`Selecciona un respaldo ALBATROS de la sede ${site}.`);
      }

      const payload: Backup = {
        sistema: 'ALBATROS',
        sede: site,
        generadoEn: parsed.generadoEn,
        version: parsed.version,
        alumnos: parsed.alumnos as BackupRecord[],
        pagos: parsed.pagos as BackupRecord[],
        asistencias: parsed.asistencias as BackupRecord[],
      };
      const analysis = await analyzeBackup(payload);

      setFileName(file.name);
      setBackup(payload);
      setPreview(analysis.preview);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Respaldo no válido',
        description: error instanceof Error ? error.message : 'No se pudo leer.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const restore = async () => {
    if (!backup || !preview || isRestoring) return;

    const expected = (Object.keys(selection) as Category[]).reduce(
      (total, category) =>
        total + (selection[category] ? preview[category].nuevos : 0),
      0,
    );

    if (
      expected === 0 ||
      !window.confirm(
        `¿Restaurar hasta ${expected} registros nuevos? Los existentes no se reemplazarán.`,
      )
    ) {
      return;
    }

    try {
      setIsRestoring(true);
      const site = getSite();
      const fresh = await analyzeBackup(backup);
      const current = await loadSiteData(site);
      const allowedStudents = new Set(current.alumnos.map((item) => item.id));
      const restored: Record<Category, number> = {
        alumnos: 0,
        pagos: 0,
        asistencias: 0,
      };

      if (selection.alumnos) {
        fresh.records.alumnos.forEach((item) => allowedStudents.add(item.id));
      }

      for (const category of ['alumnos', 'pagos', 'asistencias'] as Category[]) {
        if (!selection[category]) continue;
        const collectionName = {
          alumnos: 'Alumnos',
          pagos: 'Pagos',
          asistencias: 'Asistencias',
        }[category];
        const items =
          category === 'alumnos'
            ? fresh.records[category]
            : fresh.records[category].filter((item) =>
                allowedStudents.has(normalizedId(item.alumnoId)),
              );

        for (let start = 0; start < items.length; start += 350) {
          const batch = writeBatch(firestore);

          items.slice(start, start + 350).forEach((item) => {
            const { id, ...raw } = item;
            const restoredData = Object.fromEntries(
              Object.entries(raw).map(([key, value]) => [
                key,
                [
                  'fecha',
                  'creadoEn',
                  'actualizadoEn',
                  'fechaRegistro',
                  'fechaUltimoPago',
                  'fechaCambioActividad',
                ].includes(key) && toDate(value)
                  ? Timestamp.fromDate(toDate(value) as Date)
                  : value,
              ]),
            );

            batch.set(doc(firestore, collectionName, id), {
              ...restoredData,
              sede: site,
            });
          });

          await batch.commit();
        }

        restored[category] = items.length;
      }

      void recordAdminAudit(auth, {
        sede: site,
        action: 'crear',
        entity: 'alumno',
        summary: `Se restauró el respaldo ${fileName}.`,
        details: restored,
      });

      toast({
        title: 'Restauración completada',
        description: `${restored.alumnos} alumnos, ${restored.pagos} pagos y ${restored.asistencias} asistencias recuperados.`,
      });
      setRestoreOpen(false);
      resetRestore();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Restauración incompleta',
        description: error instanceof Error ? error.message : 'Error desconocido.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04] md:p-6"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase italic">
                  Herramientas de datos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reportes, restauración y respaldos
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform duration-300',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <div className="grid gap-3 border-t border-border/70 p-4 sm:grid-cols-3 md:p-6">
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 justify-center rounded-xl">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Reportes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Exportar por periodo</DialogTitle>
                  <DialogDescription>
                    Genera un CSV compatible con Excel.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contenido</Label>
                    <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resumen">Resumen</SelectItem>
                        <SelectItem value="pagos">Pagos</SelectItem>
                        <SelectItem value="asistencias">Asistencias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="history-report-start">Desde</Label>
                      <Input id="history-report-start" type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="history-report-end">Hasta</Label>
                      <Input id="history-report-end" type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReportOpen(false)}>Cancelar</Button>
                  <Button disabled={isReporting} onClick={() => void exportReport()}>
                    {isReporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Descargar CSV
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={restoreOpen}
              onOpenChange={(open) => {
                if (isRestoring) return;
                setRestoreOpen(open);
                if (!open) resetRestore();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 justify-center rounded-xl">
                  <FileUp className="mr-2 h-4 w-4" />
                  Restaurar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Restaurar respaldo
                  </DialogTitle>
                  <DialogDescription>
                    Los registros existentes se omiten automáticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Label htmlFor="history-restore-file" className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-5 text-center">
                    {isAnalyzing ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" /> : <FileUp className="mb-2 h-6 w-6 text-primary" />}
                    <span className="font-black uppercase">{isAnalyzing ? 'Analizando...' : 'Seleccionar JSON'}</span>
                    <span className="mt-1 text-xs font-normal text-muted-foreground">Máximo 15 MB</span>
                  </Label>
                  <Input id="history-restore-file" type="file" accept=".json,application/json" className="sr-only" disabled={isAnalyzing || isRestoring} onChange={(event) => void handleFile(event)} />

                  {preview && (
                    <>
                      <p className="truncate rounded-xl border bg-muted/30 p-3 text-sm font-bold">{fileName}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {([
                          ['alumnos', 'Alumnos'],
                          ['pagos', 'Pagos'],
                          ['asistencias', 'Asistencias'],
                        ] as [Category, string][]).map(([category, label]) => (
                          <label key={category} className={cn('cursor-pointer rounded-xl border p-4', selection[category] ? 'border-primary/40 bg-primary/5' : 'opacity-60')}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black uppercase">{label}</span>
                              <Checkbox checked={selection[category]} onCheckedChange={(checked) => setSelection((previous) => ({ ...previous, [category]: checked === true }))} />
                            </div>
                            <p className="mt-3 text-2xl font-black text-primary">{preview[category].nuevos}</p>
                            <p className="text-xs text-muted-foreground">nuevos</p>
                            <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
                              <p>{preview[category].duplicados} duplicados</p>
                              <p>{preview[category].invalidos} inválidos</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" disabled={isRestoring} onClick={() => setRestoreOpen(false)}>Cancelar</Button>
                  <Button disabled={!preview || isRestoring} onClick={() => void restore()}>
                    {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="h-12 justify-center rounded-xl"
              disabled={isBackingUp}
              onClick={() => void downloadBackup()}
            >
              {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isBackingUp ? 'Preparando...' : 'Respaldo'}
            </Button>
          </div>
          <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground md:px-6">
            Estas herramientas están agrupadas aquí para mantener limpio el panel principal.
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
