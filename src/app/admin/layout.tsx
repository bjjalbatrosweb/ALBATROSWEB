"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
import {
  FolderHeart,
  GripVertical,
  Award,
  Bot,
  Check,
  ClipboardCheck,
  ClipboardList,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Map as MapIcon,
  Medal,
  Megaphone,
  MessageCircleMore,
  Network,
  Package,
  ScrollText,
  Shuffle,
  Smartphone,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Video,
  CalendarDays,
  RadioTower,
  Fingerprint,
  GraduationCap,
  QrCode,
  ReceiptText,
  RotateCcw,
  Settings2,
  Cpu,
  Database,
  DoorOpen,
  Dices,
  Music2,
  TriangleAlert,
  Wifi,
  WifiOff,
  Trophy,
  Crown,
  Wrench,
  Gauge,
  ChartNoAxesCombined,
  Disc3,
  CalendarClock,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { AdminAlertCenter } from "@/components/admin/admin-alert-center";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { OfflineSyncStatus } from "@/components/admin/offline-sync-status";
import { PwaNotificationControl } from "@/components/admin/pwa-notification-control";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
} from "@/lib/access-control";
import {
  getFirebaseHealth,
  reportBrowserNetworkStatus,
  reportFirebaseAvailable,
  reportFirebaseFailure,
  subscribeFirebaseHealth,
  type FirebaseHealthState,
} from "@/lib/firebase-health";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type DeviceStatus = {
  deviceId?: string;
  dispositivo?: string;
  ultimoContacto?: Timestamp;
  ultimoContactoMs?: number;
  puertaCerrada?: boolean;
  puertaBloqueada?: boolean;
  alarmaActiva?: boolean;
  rssi?: number | null;
};

type MenuPreferences = {
  top: string[];
  groups: string[];
  items: Record<string, string[]>;
};

type MenuDragData = {
  zone: string;
  key: string;
};

const EMPTY_MENU_PREFERENCES: MenuPreferences = {
  top: [],
  groups: [],
  items: {},
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseMenuPreferences(value: string | null): MenuPreferences {
  if (!value) return EMPTY_MENU_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<MenuPreferences>;
    const items =
      parsed.items && typeof parsed.items === "object"
        ? Object.fromEntries(
            Object.entries(parsed.items).map(([group, order]) => [
              group,
              stringArray(order),
            ]),
          )
        : {};
    return {
      top: stringArray(parsed.top),
      groups: stringArray(parsed.groups),
      items,
    };
  } catch {
    return EMPTY_MENU_PREFERENCES;
  }
}

function orderedByKey<T>(
  values: T[],
  order: string[],
  getKey: (value: T) => string,
) {
  const positions = new Map(order.map((key, index) => [key, index]));
  return [...values].sort((left, right) => {
    const leftPosition = positions.get(getKey(left));
    const rightPosition = positions.get(getKey(right));
    if (leftPosition === undefined && rightPosition === undefined) return 0;
    if (leftPosition === undefined) return 1;
    if (rightPosition === undefined) return -1;
    return leftPosition - rightPosition;
  });
}

function moveMenuKey(order: string[], source: string, target: string) {
  if (source === target) return order;
  const sourceIndex = order.indexOf(source);
  const originalTargetIndex = order.indexOf(target);
  if (sourceIndex < 0 || originalTargetIndex < 0) return order;
  const next = order.filter((key) => key !== source);
  const targetIndex = next.indexOf(target);
  const insertIndex =
    sourceIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
  next.splice(insertIndex, 0, source);
  return next;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [exitIntent, setExitIntent] = useState<"home" | "logout" | null>(null);
  const [currentSite, setCurrentSite] = useState<Sede | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceStatusReady, setDeviceStatusReady] = useState(false);
  const [statusClock, setStatusClock] = useState(Date.now());
  const [restartIntent, setRestartIntent] = useState(false);
  const [isRestartingDevice, setIsRestartingDevice] = useState(false);
  const toolsDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [deviceCardOpen, setDeviceCardOpen] = useState(false);
  const [firebaseHealth, setFirebaseHealth] =
    useState<FirebaseHealthState>(getFirebaseHealth);
  const [menuPreferences, setMenuPreferences] = useState<MenuPreferences>(
    EMPTY_MENU_PREFERENCES,
  );
  const [menuEditMode, setMenuEditMode] = useState(false);
  const [draggedMenu, setDraggedMenu] = useState<MenuDragData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeFirebaseHealth(setFirebaseHealth);
    const handleNetwork = () => reportBrowserNetworkStatus();
    window.addEventListener("online", handleNetwork);
    window.addEventListener("offline", handleNetwork);
    reportBrowserNetworkStatus();
    return () => {
      unsubscribe();
      window.removeEventListener("online", handleNetwork);
      window.removeEventListener("offline", handleNetwork);
    };
  }, []);

  /*
   * Firebase Authentication confirma la sesión y el documento usuarios/{uid}
   * determina el rol y las sedes permitidas. localStorage solo conserva la
   * sede elegida; nunca concede permisos por sí mismo.
   */
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      localStorage.removeItem("userSede");
      localStorage.removeItem("userRole");
      setIsSessionReady(false);
      setCurrentSite(null);
      router.replace("/login-profesor");
      return;
    }

    let cancelled = false;

    const verificarAcceso = async () => {
      try {
        const sedeGuardada = localStorage.getItem("userSede") as Sede | null;
        const perfilSnapshot = await getDoc(
          doc(firestore, "usuarios", user.uid),
        );
        if (!perfilSnapshot.metadata.fromCache)
          reportFirebaseAvailable("sesión");
        const perfil = perfilSnapshot.exists()
          ? normalizarPerfilAcceso(perfilSnapshot.data())
          : null;

        if (
          !cancelled &&
          sedeGuardada &&
          perfil &&
          puedeAdministrarSede(perfil, sedeGuardada)
        ) {
          localStorage.setItem("userRole", perfil.rol);
          setCurrentSite(sedeGuardada);
          setIsSessionReady(true);
          return;
        }

        if (!cancelled) {
          localStorage.removeItem("userSede");
          localStorage.removeItem("userRole");
          setIsSessionReady(false);
          await signOut(auth);
          router.replace("/login-profesor");
        }
      } catch (error) {
        reportFirebaseFailure(error, "sesión");
      }
    };

    void verificarAcceso();

    return () => {
      cancelled = true;
    };
  }, [auth, firestore, isUserLoading, router, user]);

  useEffect(() => {
    if (!isSessionReady || !currentSite) return;

    setDeviceStatusReady(false);
    const unsubscribe = onSnapshot(
      doc(firestore, "DispositivosAcceso", currentSite),
      (snapshot) => {
        if (!snapshot.metadata.fromCache)
          reportFirebaseAvailable("estado ESP32");
        setDeviceStatus(
          snapshot.exists() ? (snapshot.data() as DeviceStatus) : null,
        );
        setDeviceStatusReady(true);
        setStatusClock(Date.now());
      },
      (error) => {
        reportFirebaseFailure(error, "estado ESP32");
        setDeviceStatusReady(true);
      },
    );

    return unsubscribe;
  }, [currentSite, firestore, isSessionReady]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setStatusClock(Date.now()),
      15_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    toolsDetailsRef.current?.removeAttribute("open");
    setDeviceCardOpen(false);
    setMenuEditMode(false);
    setDraggedMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!user?.uid) {
      setMenuPreferences(EMPTY_MENU_PREFERENCES);
      return;
    }
    try {
      setMenuPreferences(
        parseMenuPreferences(
          localStorage.getItem(`adminMenuOrder:v2:${user.uid}`),
        ),
      );
    } catch {
      setMenuPreferences(EMPTY_MENU_PREFERENCES);
    }
  }, [user?.uid]);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      localStorage.removeItem("userSede");
      localStorage.removeItem("userRole");
      await signOut(auth);
      router.replace("/login-profesor");
    } finally {
      setIsSigningOut(false);
    }
  };

  const confirmExit = async () => {
    if (exitIntent === "home") {
      setExitIntent(null);
      router.push("/");
      return;
    }

    if (exitIntent === "logout") {
      setExitIntent(null);
      await handleSignOut();
    }
  };

  const requestDeviceRestart = async () => {
    if (
      !user ||
      !currentSite ||
      !deviceStatus?.deviceId ||
      !deviceOnline ||
      isRestartingDevice
    )
      return;

    try {
      setIsRestartingDevice(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/dispositivo/reiniciar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sede: currentSite,
          deviceId: deviceStatus.deviceId,
          confirmar: true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.mensaje || "No se pudo enviar la orden.");

      setRestartIntent(false);
      toast({
        title: "Reinicio solicitado",
        description:
          "El ESP32 recibirá la orden en un máximo aproximado de 2 minutos. No se generó ninguna lectura RFID.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se reinició el ESP32",
        description:
          error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setIsRestartingDevice(false);
    }
  };

  const lastContactMs =
    deviceStatus?.ultimoContacto?.toMillis?.() ||
    (Number.isFinite(Number(deviceStatus?.ultimoContactoMs))
      ? Number(deviceStatus?.ultimoContactoMs)
      : 0);
  const secondsSinceContact = lastContactMs
    ? Math.max(0, Math.floor((statusClock - lastContactMs) / 1000))
    : null;
  // El firmware reporta cada 2 minutos. Entre cinco y ocho minutos se muestra
  // como señal atrasada; sólo después se declara desconectado. El campo
  // numérico evita falsos negativos si Firestore serializa el Timestamp.
  const deviceDelayed =
    secondsSinceContact !== null &&
    secondsSinceContact > 300 &&
    secondsSinceContact <= 480;
  const deviceOnline =
    secondsSinceContact !== null && secondsSinceContact <= 480;
  const deviceLabel = !deviceStatusReady
    ? "Comprobando"
    : deviceDelayed
      ? "ESP32 con señal atrasada"
      : deviceOnline
      ? "ESP32 conectado"
      : "ESP32 sin conexión";
  const lastContactLabel =
    secondsSinceContact === null
      ? "Sin señales registradas"
      : secondsSinceContact < 60
        ? `Última señal hace ${secondsSinceContact} s`
        : `Última señal hace ${Math.floor(secondsSinceContact / 60)} min`;
  const firebaseOfflineMode = [
    "quota-exhausted",
    "offline",
    "degraded",
  ].includes(firebaseHealth.status);
  const firebaseNeedsAttention =
    firebaseOfflineMode || firebaseHealth.status === "permission-denied";
  const firebaseQuotaLabel =
    firebaseHealth.status === "operational"
      ? "Cuota disponible"
      : firebaseHealth.status === "quota-exhausted"
        ? "Cuota agotada"
        : firebaseHealth.status === "offline"
          ? "Sin internet"
          : firebaseHealth.status === "degraded"
            ? "Firebase inestable"
            : firebaseHealth.status === "permission-denied"
              ? "Revisar permisos"
              : "Comprobando cuota";
  const firebaseStatusClasses =
    firebaseHealth.status === "operational"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : firebaseNeedsAttention
        ? "border-red-500/30 bg-red-500/10 text-red-400"
        : "border-amber-500/30 bg-amber-500/10 text-amber-400";
  const firebaseAgeSeconds = Math.max(
    0,
    Math.floor((statusClock - firebaseHealth.changedAt) / 1000),
  );
  const firebaseCheckLabel =
    firebaseAgeSeconds < 60
      ? `Actualizado hace ${firebaseAgeSeconds} s`
      : `Actualizado hace ${Math.floor(firebaseAgeSeconds / 60)} min`;

  if (isUserLoading || !isSessionReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-4 dark">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Verificando sesión...
          </span>
        </div>
        {firebaseOfflineMode && (
          <div
            role="alert"
            className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-red-50"
          >
            <p className="flex items-center gap-2 font-black uppercase">
              <TriangleAlert className="h-5 w-5 text-red-400" />
              {firebaseQuotaLabel} · modo offline
            </p>
            <p className="mt-2 text-sm text-red-100/70">
              {firebaseHealth.message} La sesión se abrirá cuando Firebase pueda
              confirmar los permisos.
            </p>
          </div>
        )}
      </div>
    );
  }

  const enlaces = [
    {
      href: "/admin/recepcion",
      label: "Recepción",
      icon: UserCheck,
    },
    {
      href: "/admin/dashboard",
      label: "Panel de Control",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/emergencias",
      label: "Archivero",
      icon: FolderHeart,
    },
  ];

  const gruposHerramientas = [
    {
      id: "disciplinas",
      label: "Disciplinas",
      icon: Trophy,
      items: [
        {
          href: "/admin/taekwondo",
          label: "Dojang Live",
          icon: Trophy,
          section: "Taekwondo",
        },
        {
          href: "/admin/taekwondo/examen",
          label: "Examen",
          icon: Award,
          section: "Taekwondo",
        },
        {
          href: "/admin/jiujitsu",
          label: "Jiu-Jitsu Live",
          icon: ShieldCheck,
          section: "Jiu-Jitsu",
        },
      ],
    },
    {
      id: "clase",
      label: "Clase",
      icon: Music2,
      items: [
        {
          href: "/admin/clase",
          label: "Música y cronograma",
          icon: Music2,
        },
        {
          href: "/admin/retos",
          label: "Reto semanal",
          icon: Target,
        },
        {
          href: "/admin/evaluaciones",
          label: "Evaluación técnica",
          icon: ClipboardCheck,
        },
        {
          href: "/admin/entrenamiento",
          label: "Planificador",
          icon: Dices,
        },
        {
          href: "/admin/equipos",
          label: "Equipo y estaciones",
          icon: Users,
        },
        {
          href: "/admin/sparring",
          label: "Emparejamiento",
          icon: Shuffle,
        },
        {
          href: "/admin/ruleta-parejas",
          label: "Ruleta de parejas",
          icon: Disc3,
        },
        {
          href: "/admin/replay",
          label: "Replay técnico",
          icon: Video,
        },
      ],
    },
    {
      id: "atletas",
      label: "Atletas",
      icon: ClipboardList,
      items: [
        {
          href: "/admin/gestion-atletas",
          label: "Gestión",
          icon: ClipboardList,
        },
        {
          href: "/admin/grados",
          label: "Grados",
          icon: Award,
        },
        { href: "/admin/accesos-atletas", label: "Accesos", icon: KeyRound },
        {
          href: "/admin/pases-invitados",
          label: "Pases para invitados",
          icon: QrCode,
        },
        {
          href: "/admin/asistencia-nfc",
          label: "Registrar asistencia",
          icon: Smartphone,
        },
        {
          href: "/admin/seguimiento-regreso",
          label: "Seguimiento de regreso",
          icon: UserCheck,
        },
      ],
    },
    {
      id: "operaciones",
      label: "Operaciones",
      icon: RadioTower,
      items: [
        {
          href: "/admin/centro-operativo",
          label: "Centro operativo",
          icon: Gauge,
        },
        {
          href: "/admin/clase-activa",
          label: "Control de clase",
          icon: RadioTower,
        },
        {
          href: "/admin/reservas",
          label: "Reservas y cupo",
          icon: CalendarDays,
        },
        {
          href: "/admin/puerta",
          label: "Control de puerta",
          icon: DoorOpen,
        },
        {
          href: "/admin/biometria",
          label: "Gestión biométrica",
          icon: Fingerprint,
        },
        { href: "/admin/historial", label: "Historial", icon: ScrollText },
      ],
    },
    {
      id: "comunicaciones",
      label: "Comunicaciones",
      icon: Megaphone,
      items: [
        { href: "/admin/avisos", label: "Avisos", icon: Megaphone },
        {
          href: "/admin/encuestas-clase",
          label: "Encuestas de clase",
          icon: ClipboardCheck,
        },
        {
          href: "/admin/calendarios",
          label: "Calendario",
          icon: CalendarDays,
        },
        {
          href: "/admin/prospectos-whatsapp",
          label: "Prospectos WhatsApp",
          icon: MessageCircleMore,
        },
      ],
    },
    {
      id: "caja",
      label: "Caja",
      icon: ReceiptText,
      items: [
        {
          href: "/admin/finanzas",
          label: "Ingresos y egresos",
          icon: ChartNoAxesCombined,
        },
        {
          href: "/admin/dia-de-pago",
          label: "Día de pago",
          icon: CalendarClock,
        },
        { href: "/admin/pagar", label: "Solicitudes de pago", icon: QrCode },
        {
          href: "/admin/compras",
          label: "Compras e inventario",
          icon: ReceiptText,
        },
      ],
    },
    {
      id: "academia",
      label: "Academia",
      icon: GraduationCap,
      items: [
        {
          href: "/admin/dados",
          label: "Dados de entrenamiento",
          icon: Dices,
        },
        {
          href: "/admin/dojang-assistant",
          label: "Dojang Assistant",
          icon: Bot,
        },
        {
          href: "/admin/mapa",
          label: "Mapa vivo",
          icon: MapIcon,
        },
        {
          href: "/admin/equipo",
          label: "Equipamiento y préstamos",
          icon: Package,
        },
        {
          href: "/admin/checklist-operativo",
          label: "Apertura y cierre",
          icon: ClipboardCheck,
        },
        {
          href: "/admin/mantenimiento",
          label: "Mantenimiento preventivo",
          icon: Wrench,
        },
      ],
    },
    {
      id: "torneo",
      label: "Torneo",
      icon: Medal,
      items: [
        {
          href: "/admin/llaves",
          label: "Llaves y podio",
          icon: Network,
        },
        {
          href: "/admin/competencia",
          label: "Pasaporte competitivo",
          icon: Medal,
        },
        {
          href: "/admin/diplomas",
          label: "Diplomas y reconocimientos",
          icon: Award,
        },
        {
          href: "/admin/muro-logros",
          label: "Muro de logros TV",
          icon: Crown,
        },
      ],
    },
    {
      id: "sistema",
      label: "Sistema",
      icon: Cpu,
      items: [{ href: "/admin/firmware", label: "Firmware ESP32", icon: Cpu }],
    },
  ];

  const enlacesOrdenados = orderedByKey(
    enlaces,
    menuPreferences.top,
    (enlace) => enlace.href,
  );
  const gruposOrdenados = orderedByKey(
    gruposHerramientas,
    menuPreferences.groups,
    (grupo) => grupo.id,
  ).map((grupo) => ({
    ...grupo,
    items: orderedByKey(
      grupo.items,
      menuPreferences.items[grupo.id] || [],
      (enlace) => enlace.href,
    ),
  }));
  const herramientas = gruposOrdenados.flatMap((grupo) => grupo.items);

  const persistMenuPreferences = (next: MenuPreferences) => {
    setMenuPreferences(next);
    if (user?.uid) {
      try {
        localStorage.setItem(
          `adminMenuOrder:v2:${user.uid}`,
          JSON.stringify(next),
        );
      } catch {
        // El orden permanece en memoria si el navegador bloquea localStorage.
      }
    }
  };

  const reorderMenu = (zone: string, source: string, target: string) => {
    if (source === target) return;
    if (zone === "top") {
      persistMenuPreferences({
        ...menuPreferences,
        top: moveMenuKey(
          enlacesOrdenados.map((enlace) => enlace.href),
          source,
          target,
        ),
      });
      return;
    }
    if (zone === "groups") {
      persistMenuPreferences({
        ...menuPreferences,
        groups: moveMenuKey(
          gruposOrdenados.map((grupo) => grupo.id),
          source,
          target,
        ),
      });
      return;
    }
    if (!zone.startsWith("items:")) return;
    const groupId = zone.slice("items:".length);
    const group = gruposOrdenados.find((item) => item.id === groupId);
    if (!group) return;
    persistMenuPreferences({
      ...menuPreferences,
      items: {
        ...menuPreferences.items,
        [groupId]: moveMenuKey(
          group.items.map((item) => item.href),
          source,
          target,
        ),
      },
    });
  };

  const beginMenuDrag = (
    event: React.DragEvent<HTMLElement>,
    zone: string,
    key: string,
  ) => {
    if (!menuEditMode) return;
    const payload = { zone, key };
    setDraggedMenu(payload);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-albatros-menu",
      JSON.stringify(payload),
    );
  };

  const dropMenuItem = (
    event: React.DragEvent<HTMLElement>,
    zone: string,
    target: string,
  ) => {
    if (!menuEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    let payload = draggedMenu;
    try {
      const transferred = event.dataTransfer.getData(
        "application/x-albatros-menu",
      );
      if (transferred) payload = JSON.parse(transferred) as MenuDragData;
    } catch {
      payload = draggedMenu;
    }
    if (payload?.zone === zone) reorderMenu(zone, payload.key, target);
    setDraggedMenu(null);
  };

  const resetMenuOrder = () => {
    setMenuPreferences(EMPTY_MENU_PREFERENCES);
    if (user?.uid) {
      try {
        localStorage.removeItem(`adminMenuOrder:v2:${user.uid}`);
      } catch {
        // No se requiere ninguna escritura remota para restablecer el menú.
      }
    }
    toast({
      title: "Orden restablecido",
      description: "Los menús volvieron a su organización original.",
    });
  };

  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Barra superior del panel administrativo */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[1920px] items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setExitIntent("home")}
              className="shrink-0 rounded-xl p-1 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Salir al menú principal"
              title="Ir al menú principal"
            >
              <Logo className="justify-start gap-1.5 [&_h1]:hidden xl:[&_h1]:block xl:[&_h1]:text-lg 2xl:[&_h1]:text-xl" />
            </button>

            <nav className="flex min-w-0 flex-1 items-center justify-evenly gap-0.5 overflow-x-auto [scrollbar-width:none] lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {enlacesOrdenados.map((enlace) => {
                const Icono = enlace.icon;
                const activo = pathname === enlace.href;

                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    draggable={menuEditMode}
                    aria-grabbed={
                      menuEditMode
                        ? draggedMenu?.key === enlace.href
                        : undefined
                    }
                    onDragStart={(event) =>
                      beginMenuDrag(event, "top", enlace.href)
                    }
                    onDragOver={(event) => {
                      if (menuEditMode && draggedMenu?.zone === "top")
                        event.preventDefault();
                    }}
                    onDrop={(event) => dropMenuItem(event, "top", enlace.href)}
                    onDragEnd={() => setDraggedMenu(null)}
                    onClick={(event) => {
                      if (menuEditMode) event.preventDefault();
                    }}
                    title={enlace.label}
                    aria-label={enlace.label}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-[11px] font-black uppercase tracking-[0.06em] transition-all lg:h-auto lg:w-auto lg:px-2.5 lg:py-2.5 2xl:px-3 ${menuEditMode ? "cursor-grab ring-1 ring-dashed ring-amber-400/50 active:cursor-grabbing" : ""} ${draggedMenu?.key === enlace.href ? "opacity-40" : ""} ${
                      activo
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {menuEditMode && (
                      <GripVertical className="hidden h-3.5 w-3.5 text-amber-400 lg:block" />
                    )}
                    <Icono className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{enlace.label}</span>
                  </Link>
                );
              })}
              <details
                ref={toolsDetailsRef}
                className="group relative shrink-0"
              >
                <summary
                  className={`flex h-10 w-10 cursor-pointer list-none items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-[11px] font-black uppercase tracking-[0.06em] transition-colors lg:h-auto lg:w-auto lg:px-2.5 lg:py-2.5 2xl:px-3 ${
                    herramientas.some((enlace) => pathname === enlace.href)
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  <span className="hidden whitespace-nowrap lg:inline">
                    Más herramientas
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="fixed inset-x-3 top-[4.75rem] z-[100] grid max-h-[calc(100vh-6rem)] gap-0.5 overflow-y-auto rounded-xl border border-white/10 bg-[#18191d]/[.98] p-1.5 shadow-2xl backdrop-blur-xl [scrollbar-width:none] lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+8px)] lg:max-h-[min(72vh,38rem)] lg:min-w-72 [&::-webkit-scrollbar]:hidden">
                  <div className="mb-1 rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
                          Personalizar menú
                        </p>
                        <p className="mt-0.5 text-[9px] leading-tight text-white/70">
                          {menuEditMode
                            ? "Arrastra categorías, herramientas o accesos de la barra."
                            : "El orden se guarda únicamente en este dispositivo."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuEditMode((current) => !current);
                          setDraggedMenu(null);
                        }}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${menuEditMode ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-300" : "border-white/15 text-white/65 hover:bg-white/10 hover:text-white"}`}
                        title={
                          menuEditMode ? "Terminar edición" : "Editar orden"
                        }
                        aria-label={
                          menuEditMode ? "Terminar edición" : "Editar orden"
                        }
                      >
                        {menuEditMode ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Settings2 className="h-4 w-4" />
                        )}
                      </button>
                      {menuEditMode && (
                        <button
                          type="button"
                          onClick={resetMenuOrder}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 text-white/65 hover:bg-white/10 hover:text-white"
                          title="Restablecer orden"
                          aria-label="Restablecer orden"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {gruposOrdenados.map((grupo) => {
                    const IconoGrupo = grupo.icon;
                    const grupoActivo = grupo.items.some(
                      (enlace) => pathname === enlace.href,
                    );

                    return (
                      <details
                        key={grupo.id}
                        className={`group/submenu ${menuEditMode ? "cursor-grab rounded-lg ring-1 ring-dashed ring-amber-400/35 active:cursor-grabbing" : ""} ${draggedMenu?.key === grupo.id ? "opacity-40" : ""}`}
                        open={menuEditMode || grupoActivo || undefined}
                        draggable={menuEditMode}
                        onDragStart={(event) =>
                          beginMenuDrag(event, "groups", grupo.id)
                        }
                        onDragOver={(event) => {
                          if (menuEditMode && draggedMenu?.zone === "groups")
                            event.preventDefault();
                        }}
                        onDrop={(event) =>
                          dropMenuItem(event, "groups", grupo.id)
                        }
                        onDragEnd={() => setDraggedMenu(null)}
                      >
                        <summary
                          className={`flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition-colors ${
                            grupoActivo
                              ? "bg-primary/[0.08] text-primary"
                              : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {menuEditMode && (
                            <GripVertical className="h-4 w-4 shrink-0 text-amber-400" />
                          )}
                          <IconoGrupo className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{grupo.label}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/submenu:rotate-180" />
                        </summary>

                        <div className="grid gap-0.5 px-1 pb-1">
                          {grupo.items.map((enlace, index) => {
                            const Icono = enlace.icon;
                            const activo = pathname === enlace.href;
                            const section =
                              "section" in enlace &&
                              typeof enlace.section === "string"
                                ? enlace.section
                                : undefined;
                            const previousItem =
                              index > 0 ? grupo.items[index - 1] : undefined;
                            const previousSection =
                              previousItem && "section" in previousItem
                                ? typeof previousItem.section === "string"
                                  ? previousItem.section
                                  : undefined
                                : undefined;

                            return (
                              <React.Fragment key={enlace.href}>
                                {section && section !== previousSection && (
                                  <div className="px-2 pb-0.5 pt-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/70 first:pt-1">
                                    {section}
                                  </div>
                                )}
                                <Link
                                  href={enlace.href}
                                  draggable={menuEditMode}
                                  aria-grabbed={
                                    menuEditMode
                                      ? draggedMenu?.key === enlace.href
                                      : undefined
                                  }
                                  onDragStart={(event) => {
                                    event.stopPropagation();
                                    beginMenuDrag(
                                      event,
                                      `items:${grupo.id}`,
                                      enlace.href,
                                    );
                                  }}
                                  onDragOver={(event) => {
                                    event.stopPropagation();
                                    if (
                                      menuEditMode &&
                                      draggedMenu?.zone === `items:${grupo.id}`
                                    )
                                      event.preventDefault();
                                  }}
                                  onDrop={(event) =>
                                    dropMenuItem(
                                      event,
                                      `items:${grupo.id}`,
                                      enlace.href,
                                    )
                                  }
                                  onDragEnd={(event) => {
                                    event.stopPropagation();
                                    setDraggedMenu(null);
                                  }}
                                  onClick={(event) => {
                                    if (menuEditMode) {
                                      event.preventDefault();
                                      return;
                                    }
                                    toolsDetailsRef.current?.removeAttribute(
                                      "open",
                                    );
                                  }}
                                  className={`group/item flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition-all ${menuEditMode ? "cursor-grab ring-1 ring-dashed ring-amber-400/30 active:cursor-grabbing" : ""} ${draggedMenu?.key === enlace.href ? "opacity-40" : ""} ${
                                    activo
                                      ? "bg-primary/[0.12] text-primary"
                                      : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                                  }`}
                                >
                                  {menuEditMode && (
                                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                  )}
                                  <span
                                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${activo ? "bg-primary text-white" : "bg-white/[0.05] text-white/70 group-hover/item:text-white"}`}
                                  >
                                    <Icono className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="min-w-0 flex-1 leading-tight">
                                    {enlace.label}
                                  </span>
                                </Link>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-2 lg:ml-auto">
            <AdminGlobalSearch />
            <Popover open={deviceCardOpen} onOpenChange={setDeviceCardOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 rounded-full border p-2 text-[11px] font-black uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${firebaseOfflineMode ? "border-red-500/40 bg-red-500/10 text-red-400" : !deviceStatusReady || deviceDelayed ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : deviceOnline ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}
                  title={`${deviceLabel} · Firebase: ${firebaseQuotaLabel}`}
                  aria-label={`${deviceLabel}. ${lastContactLabel}. Firebase: ${firebaseQuotaLabel}. Ver detalles`}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    {deviceOnline && !deviceDelayed && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                    )}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${!deviceStatusReady || deviceDelayed ? "bg-amber-400" : deviceOnline ? "bg-green-500" : "bg-red-500"}`}
                    />
                  </span>
                  {deviceOnline ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  <span className="relative ml-0.5">
                    <Database
                      className={`h-3.5 w-3.5 ${firebaseHealth.status === "operational" ? "text-emerald-400" : firebaseNeedsAttention ? "text-red-400" : "text-amber-400"}`}
                    />
                    {firebaseNeedsAttention && (
                      <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-red-400 ring-2 ring-background" />
                    )}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={12}
                className="w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl"
              >
                <div
                  className={`border-b px-5 py-4 ${deviceDelayed ? "border-amber-500/20 bg-amber-500/[0.07]" : deviceOnline ? "border-green-500/20 bg-green-500/[0.07]" : "border-red-500/20 bg-red-500/[0.07]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Control de acceso
                      </p>
                      <h2 className="mt-1 font-black uppercase">
                        {deviceLabel}
                      </h2>
                    </div>
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-full ${deviceDelayed ? "bg-amber-500/15 text-amber-400" : deviceOnline ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                    >
                      {deviceOnline ? (
                        <Wifi className="h-5 w-5" />
                      ) : (
                        <WifiOff className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-b border-border/70 bg-popover px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${firebaseStatusClasses}`}
                    >
                      {firebaseNeedsAttention ? (
                        <TriangleAlert className="h-5 w-5" />
                      ) : (
                        <Database className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          Firebase · cuota
                        </p>
                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${firebaseStatusClasses}`}
                        >
                          {firebaseQuotaLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {firebaseHealth.message}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground/70">
                        {firebaseCheckLabel}. Firebase no proporciona al panel
                        un porcentaje oficial de cuota restante.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border/60 text-sm">
                  {[
                    [
                      "Dispositivo",
                      deviceStatus?.dispositivo ||
                        deviceStatus?.deviceId ||
                        "Sin registrar",
                    ],
                    ["Sede", currentSite?.replace("_", " ") || "Sin sede"],
                    ["Último contacto", lastContactLabel],
                    [
                      "Señal WiFi",
                      typeof deviceStatus?.rssi === "number"
                        ? `${deviceStatus.rssi} dBm`
                        : "Sin dato",
                    ],
                    [
                      "Puerta",
                      deviceStatus?.puertaCerrada === true
                        ? "Cerrada"
                        : deviceStatus?.puertaCerrada === false
                          ? "Abierta"
                          : "Sin dato",
                    ],
                    [
                      "Alarma",
                      deviceStatus?.alarmaActiva === true
                        ? "Activa"
                        : deviceStatus?.alarmaActiva === false
                          ? "Normal"
                          : "Sin dato",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 bg-popover px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-1 truncate font-bold" title={value}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-4">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      setDeviceCardOpen(false);
                      setRestartIntent(true);
                    }}
                    disabled={
                      !deviceOnline ||
                      !deviceStatus?.deviceId ||
                      isRestartingDevice
                    }
                  >
                    <RotateCcw
                      className={`mr-2 h-4 w-4 ${isRestartingDevice ? "animate-spin" : ""}`}
                    />
                    {deviceOnline ? "Reiniciar ESP32" : "ESP32 sin conexión"}
                  </Button>
                  <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                    El reinicio requiere confirmación y no abre la puerta ni
                    registra asistencias.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
            <AdminAlertCenter />
            <div className="[&_button]:px-2 [&_button_span]:hidden [&_svg]:m-0">
              <PwaNotificationControl />
            </div>

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setExitIntent("logout")}
              disabled={isSigningOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="hidden sm:inline-flex"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {firebaseOfflineMode && (
        <div
          role="alert"
          className="border-b border-red-500/25 bg-red-950/35 px-4 py-3 text-red-50"
        >
          <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-400">
                <TriangleAlert className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider">
                  {firebaseQuotaLabel} · modo offline activo
                </p>
                <p className="mt-1 text-xs leading-relaxed text-red-100/65">
                  Altas de alumnos, fichas de emergencia y cambios RFID
                  compatibles quedarán guardados en este dispositivo. Otras
                  funciones pueden esperar hasta que Firebase se recupere.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeviceCardOpen(true)}
              className="shrink-0 rounded-lg border border-red-400/25 px-3 py-2 text-xs font-black uppercase text-white hover:bg-white/10"
            >
              Ver estado
            </button>
          </div>
        </div>
      )}

      <AlertDialog
        open={exitIntent !== null}
        onOpenChange={(open) => {
          if (!open && !isSigningOut) setExitIntent(null);
        }}
      >
        <AlertDialogContent className="max-w-md border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic">
              ¿Quieres salir?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {exitIntent === "logout"
                ? "Se cerrará tu sesión administrativa y tendrás que iniciar sesión nuevamente."
                : "Saldrás del panel administrativo y volverás al menú principal. Tu sesión permanecerá activa."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Quedarme
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmExit();
              }}
              disabled={isSigningOut}
              className="font-black uppercase"
            >
              {isSigningOut && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={restartIntent}
        onOpenChange={(open) => {
          if (!open && !isRestartingDevice) setRestartIntent(false);
        }}
      >
        <AlertDialogContent className="max-w-md border-amber-500/25">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              ¿Reiniciar el ESP32?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Se enviará una orden única al dispositivo{" "}
                <strong>{deviceStatus?.deviceId}</strong> de la sede{" "}
                {currentSite?.replace("_", " ")}.
              </span>
              <span className="block">
                No registra asistencias, no abre la puerta y no ejecuta una
                lectura RFID. El control de acceso estará fuera de servicio
                durante unos segundos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestartingDevice}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void requestDeviceRestart();
              }}
              disabled={isRestartingDevice || !deviceOnline}
              className="bg-amber-600 font-black uppercase text-white hover:bg-amber-700"
            >
              {isRestartingDevice && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar reinicio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="flex-1 container mx-auto p-4 md:p-8">{children}</main>
      <OfflineSyncStatus />
    </div>
  );
}
