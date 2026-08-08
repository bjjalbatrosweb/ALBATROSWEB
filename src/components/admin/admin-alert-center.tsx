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
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

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
import { useFirestore } from "@/firebase";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type Student = {
  id: string;
  nombre?: string;
  telefono?: string;
  diaPago?: number;
  montoPago?: number;
  estadoPago?: string;
  periodoUltimoPago?: string;
  fechaUltimoPago?: unknown;
  activo?: boolean;
  rfid?: string;
  rfids?: string[];
};
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

const EMPTY_ALERTS: AlertGroups = {
  purchases: [],
  paymentRequests: [],
  overdue: [],
  rfid: [],
  lowAttendance: [],
  incomplete: [],
  device: [],
};

function normalizedSite(): Sede | null {
  const value = (localStorage.getItem("userSede") || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const valid: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
  return valid.includes(value as Sede) ? (value as Sede) : null;
}

function currentPeriod() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromUnknown(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AdminAlertCenter() {
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState<AlertGroups>(EMPTY_ALERTS);

  const totalAlerts = Object.values(alerts).reduce(
    (total, group) => total + group.length,
    0,
  );

  const loadAlerts = async () => {
    const site = normalizedSite();
    if (!site || isLoading) return;

    try {
      setIsLoading(true);
      setError("");

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        studentsSnapshot,
        attendanceSnapshot,
        linkingSnapshot,
        purchasesSnapshot,
        paymentsSnapshot,
        deviceSnapshot,
      ] = await Promise.all([
        getDocs(
          query(collection(firestore, "Alumnos"), where("sede", "==", site)),
        ),
        getDocs(
          query(
            collection(firestore, "Asistencias"),
            where("sede", "==", site),
            where("fecha", ">=", Timestamp.fromDate(startOfMonth)),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "VinculacionesRFID"),
            where("sede", "==", site),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "SolicitudesCompra"),
            where("sede", "==", site),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "SolicitudesPago"),
            where("sede", "==", site),
          ),
        ),
        getDoc(doc(firestore, "DispositivosAcceso", site)),
      ]);

      const students = studentsSnapshot.docs.map((document) => ({
        id: document.id,
        ...(document.data() as Omit<Student, "id">),
      }));
      const activeStudents = students.filter(
        (student) => student.activo !== false,
      );
      const period = currentPeriod();
      const today = new Date().getDate();
      const attendanceDays = new Map<string, Set<string>>();

      attendanceSnapshot.docs.forEach((document) => {
        const data = document.data();
        const date = dateFromUnknown(data.fecha);
        const studentId = String(data.alumnoId || "");
        if (!date || !studentId) return;

        const days = attendanceDays.get(studentId) || new Set<string>();
        days.add(dateKey(date));
        attendanceDays.set(studentId, days);
      });

      const overdue = activeStudents
        .filter((student) => {
          const lastPaymentDate = dateFromUnknown(student.fechaUltimoPago);
          const lastPaymentPeriod = lastPaymentDate
            ? `${lastPaymentDate.getFullYear()}-${String(
                lastPaymentDate.getMonth() + 1,
              ).padStart(2, "0")}`
            : "";
          const oldPaidRecord =
            student.estadoPago === "Pagado" &&
            !student.periodoUltimoPago &&
            !lastPaymentPeriod;
          const paidCurrentMonth =
            student.estadoPago === "Pagado" &&
            (student.periodoUltimoPago === period ||
              lastPaymentPeriod === period ||
              oldPaidRecord);

          return (
            !paidCurrentMonth &&
            today > Math.max(1, Number(student.diaPago || 1))
          );
        })
        .map((student) => ({
          id: student.id,
          title: student.nombre || "Alumno sin nombre",
          detail: `Venció el día ${student.diaPago || 1} · $${Number(
            student.montoPago || 0,
          ).toLocaleString("es-MX")}`,
        }));

      const studentsWithoutRfid = activeStudents
        .filter(
          (student) =>
            !String(student.rfid || "").trim() &&
            (!Array.isArray(student.rfids) ||
              student.rfids.filter(Boolean).length === 0),
        )
        .map((student) => ({
          id: `student-${student.id}`,
          title: student.nombre || "Alumno sin nombre",
          detail: "No tiene tarjeta RFID/NFC vinculada",
        }));
      const pendingLinks = linkingSnapshot.docs
        .filter((document) => {
          const state = String(document.data().estado || "").toLowerCase();
          return ![
            "completada",
            "completado",
            "vinculada",
            "vinculado",
          ].includes(state);
        })
        .map((document) => {
          const data = document.data();
          const student = students.find(
            (item) => item.id === String(data.alumnoId || ""),
          );
          return {
            id: `link-${document.id}`,
            title: student?.nombre || "Vinculación pendiente",
            detail: `Solicitud ${String(data.estado || "pendiente")}`,
          };
        });

      const minimumAttendance =
        today <= 7 ? 1 : today <= 15 ? 2 : today <= 23 ? 4 : 6;
      const lowAttendance = activeStudents
        .filter(
          (student) =>
            (attendanceDays.get(student.id)?.size || 0) < minimumAttendance,
        )
        .map((student) => {
          const count = attendanceDays.get(student.id)?.size || 0;
          return {
            id: student.id,
            title: student.nombre || "Alumno sin nombre",
            detail: `${count} ${
              count === 1 ? "día registrado" : "días registrados"
            } este mes · mínimo sugerido ${minimumAttendance}`,
          };
        });

      const incomplete = activeStudents
        .map((student) => {
          const missing = [
            !String(student.nombre || "").trim() ? "nombre" : "",
            !String(student.telefono || "").replace(/\D/g, "")
              ? "teléfono"
              : "",
            !Number.isInteger(Number(student.diaPago)) ||
            Number(student.diaPago) < 1 ||
            Number(student.diaPago) > 31
              ? "día de pago"
              : "",
            !Number.isFinite(Number(student.montoPago)) ||
            Number(student.montoPago) <= 0
              ? "monto"
              : "",
          ].filter(Boolean);

          return missing.length > 0
            ? {
                id: student.id,
                title: student.nombre || "Alumno sin nombre",
                detail: `Falta: ${missing.join(", ")}`,
              }
            : null;
        })
        .filter((item): item is AlertItem => item !== null);

      const purchases = purchasesSnapshot.docs
        .filter(
          (document) =>
            !["entregada", "cobrada", "cancelada"].includes(
              String(document.data().estado || "pendiente_cobro"),
            ),
        )
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            title: String(data.folio || document.id.slice(-8).toUpperCase()),
            detail: `${String(data.nombre || "Alumno")} · ${String(data.estado || "pendiente_cobro").replace(/_/g, " ")}`,
            href: `/admin/compras?buscar=${encodeURIComponent(String(data.folio || document.id.slice(-8).toUpperCase()))}`,
          };
        });

      const paymentRequests = paymentsSnapshot.docs
        .filter(
          (document) =>
            String(document.data().estado || "pendiente") === "pendiente",
        )
        .map((document) => {
          const data = document.data();
          const name = String(data.nombre || "Alumno");
          return {
            id: document.id,
            title: name,
            detail: `Periodo ${String(data.periodo || "sin periodo")} · $${Number(data.monto || 0).toLocaleString("es-MX")}`,
            href: `/admin/pagar?buscar=${encodeURIComponent(name)}`,
          };
        });

      const deviceData = deviceSnapshot.exists() ? deviceSnapshot.data() : null;
      const lastDeviceContact = dateFromUnknown(deviceData?.ultimoContacto);
      const deviceOnline = lastDeviceContact
        ? Date.now() - lastDeviceContact.getTime() <= 5 * 60 * 1000
        : false;
      const device: AlertItem[] = deviceOnline
        ? []
        : [
            {
              id: `device-${site}`,
              title: "ESP32 sin conexión",
              detail: lastDeviceContact
                ? `Última señal: ${lastDeviceContact.toLocaleString("es-MX")}`
                : "No hay señales registradas para esta sede",
              href: "/admin/firmware",
            },
          ];

      setAlerts({
        purchases,
        paymentRequests,
        overdue,
        rfid: [...studentsWithoutRfid, ...pendingLinks],
        lowAttendance,
        incomplete,
        device,
      });
      setHasLoaded(true);
    } catch {
      setError("No se pudieron consultar los pendientes de esta sede.");
    } finally {
      setIsLoading(false);
    }
  };

  const alertSections = [
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
      description: "Dispositivos sin señal durante más de cinco minutos",
      icon: WifiOff,
      color: "text-red-500",
    },
  ];

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
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadAlerts()}
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
            ) : error ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">
                {error}
              </div>
            ) : totalAlerts === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/5 text-center">
                <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
                <p className="font-black uppercase text-emerald-500">
                  Todo en orden
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se encontraron pendientes administrativos.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {alertSections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <div
                        key={section.key}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3"
                      >
                        <Icon className={`h-4 w-4 ${section.color}`} />
                        <p className="mt-2 text-2xl font-black">
                          {alerts[section.key].length}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          {section.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Accordion type="multiple" className="space-y-2">
                  {alertSections.map((section) => {
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
                            <Icon
                              className={`h-5 w-5 shrink-0 ${section.color}`}
                            />
                            <div className="min-w-0">
                              <p className="font-black uppercase">
                                {section.label}
                              </p>
                              <p className="truncate text-xs font-normal text-muted-foreground">
                                {section.description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-1">
                              {items.length}
                            </Badge>
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
                                    <p className="text-sm font-bold">
                                      {item.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {item.detail}
                                    </p>
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
