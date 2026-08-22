import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bot,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Dices,
  Disc3,
  DoorOpen,
  Fingerprint,
  FolderHeart,
  Gauge,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  Medal,
  Megaphone,
  MessageCircleMore,
  MonitorDot,
  Music2,
  Network,
  Package,
  QrCode,
  RadioTower,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Target,
  Trophy,
  UserCheck,
  Users,
  Video,
  Wrench,
  Crown,
  Puzzle,
} from "lucide-react";

export type AdminNavTone =
  | "red"
  | "cyan"
  | "emerald"
  | "amber"
  | "violet"
  | "blue"
  | "orange"
  | "rose"
  | "slate";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: AdminNavTone;
  items: AdminNavItem[];
};

export const ADMIN_GROUP_TONE_STYLES: Record<
  AdminNavTone,
  {
    border: string;
    surface: string;
    icon: string;
    text: string;
    active: string;
    glow: string;
    chip: string;
  }
> = {
  red: {
    border: "border-red-400/25",
    surface: "bg-red-500/[0.07]",
    icon: "bg-red-500/15 text-red-300 ring-red-400/20",
    text: "text-red-200",
    active: "bg-red-500/20 text-red-100 ring-red-400/25",
    glow: "from-red-500/20",
    chip: "border-red-400/25 bg-red-500/10 text-red-200",
  },
  cyan: {
    border: "border-cyan-400/25",
    surface: "bg-cyan-500/[0.07]",
    icon: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/20",
    text: "text-cyan-200",
    active: "bg-cyan-500/20 text-cyan-100 ring-cyan-400/25",
    glow: "from-cyan-500/20",
    chip: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
  },
  emerald: {
    border: "border-emerald-400/25",
    surface: "bg-emerald-500/[0.07]",
    icon: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
    text: "text-emerald-200",
    active: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/25",
    glow: "from-emerald-500/20",
    chip: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  },
  amber: {
    border: "border-amber-400/25",
    surface: "bg-amber-500/[0.07]",
    icon: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
    text: "text-amber-200",
    active: "bg-amber-500/20 text-amber-100 ring-amber-400/25",
    glow: "from-amber-500/20",
    chip: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  },
  violet: {
    border: "border-violet-400/25",
    surface: "bg-violet-500/[0.07]",
    icon: "bg-violet-500/15 text-violet-300 ring-violet-400/20",
    text: "text-violet-200",
    active: "bg-violet-500/20 text-violet-100 ring-violet-400/25",
    glow: "from-violet-500/20",
    chip: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  },
  blue: {
    border: "border-blue-400/25",
    surface: "bg-blue-500/[0.07]",
    icon: "bg-blue-500/15 text-blue-300 ring-blue-400/20",
    text: "text-blue-200",
    active: "bg-blue-500/20 text-blue-100 ring-blue-400/25",
    glow: "from-blue-500/20",
    chip: "border-blue-400/25 bg-blue-500/10 text-blue-200",
  },
  orange: {
    border: "border-orange-400/25",
    surface: "bg-orange-500/[0.07]",
    icon: "bg-orange-500/15 text-orange-300 ring-orange-400/20",
    text: "text-orange-200",
    active: "bg-orange-500/20 text-orange-100 ring-orange-400/25",
    glow: "from-orange-500/20",
    chip: "border-orange-400/25 bg-orange-500/10 text-orange-200",
  },
  rose: {
    border: "border-rose-400/25",
    surface: "bg-rose-500/[0.07]",
    icon: "bg-rose-500/15 text-rose-300 ring-rose-400/20",
    text: "text-rose-200",
    active: "bg-rose-500/20 text-rose-100 ring-rose-400/25",
    glow: "from-rose-500/20",
    chip: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  },
  slate: {
    border: "border-slate-400/25",
    surface: "bg-slate-500/[0.07]",
    icon: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
    text: "text-slate-100",
    active: "bg-slate-500/20 text-white ring-slate-400/25",
    glow: "from-slate-400/20",
    chip: "border-slate-400/25 bg-slate-500/10 text-slate-200",
  },
};

export const ADMIN_PRIMARY_LINKS: AdminNavItem[] = [
  {
    href: "/admin/recepcion",
    label: "Recepción",
    description: "Atención diaria, pagos y asistencia.",
    icon: UserCheck,
  },
  {
    href: "/admin/dashboard",
    label: "Panel de Control",
    description: "Indicadores, alumnos y operación general.",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/emergencias",
    label: "Archivero",
    description: "Perfiles y datos de emergencia.",
    icon: FolderHeart,
  },
  {
    href: "/admin/hub",
    label: "Hub",
    description: "Todos los módulos organizados en un solo lugar.",
    icon: LayoutGrid,
  },
];

export const ADMIN_TOOL_GROUPS: AdminNavGroup[] = [
  {
    id: "operaciones",
    label: "Operación diaria",
    description: "Control en vivo, instalaciones y accesos.",
    icon: RadioTower,
    tone: "red",
    items: [
      { href: "/admin/centro-operativo", label: "Centro operativo", description: "Estado general de la sede en tiempo real.", icon: Gauge },
      { href: "/admin/clase-activa", label: "Control de clase", description: "Sesión activa, asistencia y tatami.", icon: RadioTower },
      { href: "/admin/reservas", label: "Reservas y cupo", description: "Agenda, capacidad y lugares disponibles.", icon: CalendarDays },
      { href: "/admin/puerta", label: "Control de puerta", description: "Apertura y estado del acceso principal.", icon: DoorOpen },
      { href: "/admin/biometria", label: "Gestión biométrica", description: "Registro y administración de credenciales.", icon: Fingerprint },
      { href: "/admin/historial", label: "Historial", description: "Actividad y eventos administrativos.", icon: ScrollText },
    ],
  },
  {
    id: "atletas",
    label: "Atletas y accesos",
    description: "Expedientes, progreso, asistencia y retorno.",
    icon: ClipboardList,
    tone: "cyan",
    items: [
      { href: "/admin/gestion-atletas", label: "Gestión de atletas", description: "Expedientes y seguimiento individual.", icon: ClipboardList },
      { href: "/admin/grados", label: "Grados", description: "Promociones, niveles y progresión.", icon: Award },
      { href: "/admin/accesos-atletas", label: "Accesos", description: "Permisos y estado de entrada.", icon: KeyRound },
      { href: "/admin/pases-invitados", label: "Pases para invitados", description: "Accesos temporales y códigos de invitación.", icon: QrCode },
      { href: "/admin/asistencia-nfc", label: "Registrar asistencia", description: "Captura rápida mediante RFID o NFC.", icon: Smartphone },
      { href: "/admin/conciliar-asistencia", label: "Conciliar asistencia", description: "Compara presentes en clase contra RFID y registro manual.", icon: ClipboardCheck },
      { href: "/admin/arbol-habilidades", label: "Árbol de habilidades", description: "Progreso técnico individual por disciplina.", icon: Network },
      { href: "/admin/estado-fisico", label: "Estado físico", description: "Composición, medidas y pruebas físicas.", icon: Gauge },
      { href: "/admin/seguimiento-regreso", label: "Seguimiento de regreso", description: "Recupera atletas con baja asistencia.", icon: UserCheck },
    ],
  },
  {
    id: "clase",
    label: "Entrenamiento",
    description: "Planeación, dinámica y análisis de clase.",
    icon: Music2,
    tone: "emerald",
    items: [
      { href: "/admin/clase", label: "Música y cronograma", description: "Temporizador, bloques y ambiente de clase.", icon: Music2 },
      { href: "/admin/puzzle", label: "Puzzle", description: "Dinámicas visuales de reacción, movilidad y golpeo.", icon: Puzzle },
      { href: "/admin/retos", label: "Reto semanal", description: "Objetivos y desafíos para la comunidad.", icon: Target },
      { href: "/admin/evaluaciones", label: "Evaluación técnica", description: "Criterios y seguimiento del desempeño.", icon: ClipboardCheck },
      { href: "/admin/entrenamiento", label: "Planificador", description: "Diseña sesiones y cargas de trabajo.", icon: Dices },
      { href: "/admin/equipos", label: "Equipos y estaciones", description: "Grupos, circuitos y rotaciones.", icon: Users },
      { href: "/admin/sparring", label: "Emparejamiento", description: "Parejas equilibradas para sparring.", icon: Shuffle },
      { href: "/admin/ruleta-parejas", label: "Ruleta de parejas", description: "Selección dinámica y aleatoria.", icon: Disc3 },
      { href: "/admin/replay", label: "Replay técnico", description: "Revisión visual de acciones y secuencias.", icon: Video },
    ],
  },
  {
    id: "disciplinas",
    label: "Disciplinas",
    description: "Controles especializados por arte marcial.",
    icon: Trophy,
    tone: "amber",
    items: [
      { href: "/admin/taekwondo", label: "Dojang Live", description: "Marcadores y combates de Taekwondo.", icon: Trophy, section: "Taekwondo" },
      { href: "/admin/taekwondo/examen", label: "Examen", description: "Convocatorias y evaluación de grados.", icon: Award, section: "Taekwondo" },
      { href: "/admin/jiujitsu", label: "Jiu-Jitsu Live", description: "Mesas, controles y combates en vivo.", icon: ShieldCheck, section: "Jiu-Jitsu" },
    ],
  },
  {
    id: "caja",
    label: "Caja y finanzas",
    description: "Cobros, ingresos, egresos e inventario.",
    icon: ReceiptText,
    tone: "violet",
    items: [
      { href: "/admin/finanzas", label: "Ingresos y egresos", description: "Resumen financiero y movimientos.", icon: ChartNoAxesCombined },
      { href: "/admin/dia-de-pago", label: "Día de pago", description: "Operación y seguimiento de cobranza.", icon: CalendarClock },
      { href: "/admin/pagar", label: "Solicitudes de pago", description: "Generación de solicitudes mediante RFID.", icon: QrCode },
      { href: "/admin/compras", label: "Compras e inventario", description: "Productos, consumibles y existencias.", icon: ReceiptText },
    ],
  },
  {
    id: "comunicaciones",
    label: "Comunidad",
    description: "Avisos, calendario, encuestas y prospectos.",
    icon: Megaphone,
    tone: "blue",
    items: [
      { href: "/admin/avisos", label: "Avisos", description: "Comunicados para atletas y equipo.", icon: Megaphone },
      { href: "/admin/encuestas-clase", label: "Encuestas de clase", description: "Retroalimentación después de entrenar.", icon: ClipboardCheck },
      { href: "/admin/calendarios", label: "Calendario", description: "Programación visible para la comunidad.", icon: CalendarDays },
      { href: "/admin/prospectos-whatsapp", label: "Prospectos WhatsApp", description: "Seguimiento de interesados y conversaciones.", icon: MessageCircleMore },
      { href: "/admin/solicitudes-clase-prueba", label: "Clases de prueba", description: "Solicitudes enviadas desde el modo kiosco.", icon: UserCheck },
    ],
  },
  {
    id: "academia",
    label: "Academia y recursos",
    description: "Herramientas, equipo y mantenimiento de sede.",
    icon: GraduationCap,
    tone: "orange",
    items: [
      { href: "/admin/dados", label: "Dados de entrenamiento", description: "Generador de dinámicas y ejercicios.", icon: Dices },
      { href: "/admin/dojang-assistant", label: "Dojang Assistant", description: "Asistente operativo para decisiones rápidas.", icon: Bot },
      { href: "/admin/mapa", label: "Mapa vivo", description: "Distribución y actividad dentro de la academia.", icon: MapIcon },
      { href: "/admin/equipo", label: "Equipamiento y préstamos", description: "Salidas, devoluciones y estado del material.", icon: Package },
      { href: "/admin/checklist-operativo", label: "Apertura y cierre", description: "Rutinas operativas verificables.", icon: ClipboardCheck },
      { href: "/admin/mantenimiento", label: "Mantenimiento preventivo", description: "Revisiones, alertas y tareas de cuidado.", icon: Wrench },
    ],
  },
  {
    id: "torneo",
    label: "Competencia y logros",
    description: "Torneos, reconocimientos y resultados.",
    icon: Medal,
    tone: "rose",
    items: [
      { href: "/admin/llaves", label: "Llaves y podio", description: "Brackets y posiciones del torneo.", icon: Network },
      { href: "/admin/competencia", label: "Pasaporte competitivo", description: "Preparación y seguimiento de competidores.", icon: Medal },
      { href: "/admin/diplomas", label: "Diplomas", description: "Reconocimientos y documentos de logro.", icon: Award },
      { href: "/admin/muro-logros", label: "Muro de logros TV", description: "Presentación visual de resultados destacados.", icon: Crown },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    description: "Configuración técnica y dispositivos.",
    icon: Cpu,
    tone: "slate",
    items: [
      { href: "/admin/firmware", label: "Firmware ESP32", description: "Versiones y actualización de dispositivos.", icon: Cpu },
      { href: "/admin/monitor", label: "Monitor", description: "Errores agrupados del ESP32 y la interfaz.", icon: MonitorDot },
    ],
  },
];

export const ADMIN_TOOL_COUNT = ADMIN_TOOL_GROUPS.reduce(
  (total, group) => total + group.items.length,
  0,
);
