"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Loader2,
  PackageCheck,
  RefreshCw,
  ScanLine,
  UserRoundX,
  WifiOff,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/firebase";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type AlertItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};
type AlertGroups = {
  purchases: AlertItem[];
  paymentRequests: AlertItem[];
  overdue: AlertItem[];
  rfid: AlertItem[];
  lowAttendance: AlertItem[];
  incomplete: AlertItem[];
  device: AlertItem[];
};
type AlertResponse = {
  ok?: boolean;
  mensaje?: string;
  alerts?: AlertGroups;
  warnings?: string[];
  generatedAt?: string;
  cached?: boolean;
};

const EMPTY_ALERTS: AlertGroups = {
  purchases: [],
  paymentRequests: [],
  overdue: [],
  rfid: [],
  lowAttendance: [],
  incomplete: [],
  device: [],
};

const ALERT_SECTIONS = [
  {
    key: "purchases" as const,
    label: "Compras pendientes",
    description: "Pedidos pendientes de preparar, cobrar o entregar",
    icon: PackageCheck,
    color: "text-emerald-500",
  },
  {
    key: "paymentRequests" as const,
    label: "Solicitudes de pago",
    description: "Solicitudes públicas que esperan atención",
    icon: CreditCard,
    color: "text-amber-500",
  },
  {
    key: "overdue" as const,
    label: "Pagos vencidos",
    description: "Alumnos cuyo día de pago ya pasó",
    icon: CreditCard,
    color: "text-destructive",
  },
  {
    key: "rfid" as const,
    label: "RFID por resolver",
    description: "Alumnos sin tag o vinculaciones pendientes",
    icon: ScanLine,
    color: "text-amber-500",
  },
  {
    key: "lowAttendance" as const,
    label: "Baja asistencia",
    description: "Asistencia menor a la esperada este mes",
    icon: Clock3,
    color: "text-sky-500",
  },
  {
    key: "incomplete" as const,
    label: "Registros incompletos",
    description: "Información necesaria faltante",
    icon: UserRoundX,
    color: "text-violet-500",
  },
  {
    key: "device" as const,
    label: "Estado del ESP32",
    description: "Dispositivos sin señal durante más de ocho minutos",
    icon: WifiOff,
    color: "text-red-500",
  },
];

function normalizedSite(): Sede | null {
  const value = (localStorage.getItem("userSede") || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const valid: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
  return valid.includes(value as Sede) ? (value as Sede) : null;
}

export function AdminAlertCenter() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [wasCached, setWasCached] = useState(false);
  const [alerts, setAlerts] = useState<AlertGroups>(EMPTY_ALERTS);

  const totalAlerts = Object.values(alerts).reduce(
    (total, group) => total + group.length,
    0,
  );

  const loadAlerts = async (force = false) => {
    const site = normalizedSite();
    if (!site || !user || isLoading) {
      if (!site) setError("No se encontró una sede válida para esta sesión.");
      if (!user) setError("La sesión administrativa todavía no está lista.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/alertas?sede=${encodeURIComponent(site)}${force ? "&force=1" : ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const result = (await response.json().catch(() => ({}))) as AlertResponse;
      if (!response.ok || !result.ok || !result.alerts) {
        throw new Error(result.mensaje || "No se pudieron preparar las alertas.");
      }

      setAlerts(result.alerts);
      setWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setGeneratedAt(String(result.generatedAt || ""));
      setWasCached(result.cached === true);
      setHasLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron consultar los pendientes de esta sede.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open && !hasLoaded) void loadAlerts();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-primary"
          title="Centro de alertas administrativas"
          aria-label="Abrir centro de alertas"
        >
          <AlertTriangle className="h-4 w-4" />
          {hasLoaded && totalAlerts > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
              {totalAlerts > 99 ? "99+" : totalAlerts}
            </span>
          ) : !hasLoaded ? (
            <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-amber-500" />
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 p-5 pb-4 md:p-6">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Centro de alertas
              </DialogTitle>
              <DialogDescription className="mt-1">
                Pendientes administrativos de la sede actual.
              </DialogDescription>
              {generatedAt && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Actualizado {new Date(generatedAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {wasCached ? " · caché protegida" : " · datos nuevos"}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadAlerts(true)}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Actualizar
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[68vh]">
          <div className="space-y-4 p-5 md:p-6">
            {isLoading && !hasLoaded ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Analizando la sede...
              </div>
            ) : error && !hasLoaded ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                    No se reemplazaron los datos anteriores: {error}
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-black uppercase">Actualización parcial</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {totalAlerts === 0 && warnings.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/5 text-center">
                    <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
                    <p className="font-black uppercase text-emerald-500">Todo en orden</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No se encontraron pendientes administrativos.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {ALERT_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        return (
                          <div
                            key={section.key}
                            className="rounded-xl border border-border/70 bg-muted/20 p-3"
                          >
                            <Icon className={`h-4 w-4 ${section.color}`} />
                            <p className="mt-2 text-2xl font-black">{alerts[section.key].length}</p>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">
                              {section.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <Accordion type="multiple" className="space-y-2">
                      {ALERT_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const items = alerts[section.key];
                        return (
                          <AccordionItem
                            key={section.key}
                            value={section.key}
                            className="overflow-hidden rounded-xl border border-border/70 px-4"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex min-w-0 items-center gap-3 text-left">
                                <Icon className={`h-5 w-5 shrink-0 ${section.color}`} />
                                <div className="min-w-0">
                                  <p className="font-black uppercase">{section.label}</p>
                                  <p className="truncate text-xs font-normal text-muted-foreground">
                                    {section.description}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-1">{items.length}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              {items.length === 0 ? (
                                <p className="pb-2 text-sm text-muted-foreground">
                                  Sin pendientes en esta categoría.
                                </p>
                              ) : (
                                <div className="divide-y divide-border/60 pb-2">
                                  {items.slice(0, 20).map((item) => (
                                    <Link
                                      key={item.id}
                                      href={item.href || "/admin/dashboard"}
                                      onClick={() => setIsOpen(false)}
                                      className="flex items-start justify-between gap-3 py-3"
                                    >
                                      <div>
                                        <p className="text-sm font-bold">{item.title}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                                      </div>
                                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                                    </Link>
                                  ))}
                                  {items.length > 20 && (
                                    <p className="pt-3 text-xs text-muted-foreground">
                                      Y {items.length - 20} pendientes más.
                                    </p>
                                  )}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border/70 p-4 md:px-6">
          <Button asChild className="font-black uppercase">
            <Link href="/admin/dashboard" onClick={() => setIsOpen(false)}>
              Ir a la base de alumnos
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
