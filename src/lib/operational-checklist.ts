export type OperationalTemplateId =
  | "apertura"
  | "cierre"
  | "evento"
  | "torneo";

export type OperationalTask = {
  id: string;
  title: string;
  critical: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  note?: string;
};

export type OperationalChecklist = {
  id: string;
  date: string;
  site: string;
  title: string;
  template: OperationalTemplateId;
  shift: string;
  responsible: string;
  status: "active" | "completed";
  notes: string;
  incidents: string;
  nextShift: string;
  tasks: OperationalTask[];
  createdAt: string;
  completedAt?: string;
};

export type OperationalTemplate = {
  id: OperationalTemplateId;
  name: string;
  description: string;
  tasks: Array<{ title: string; critical: boolean }>;
};

export const OPERATIONAL_TEMPLATES: OperationalTemplate[] = [
  {
    id: "apertura",
    name: "Apertura de sede",
    description: "Preparación segura antes de recibir atletas.",
    tasks: [
      { title: "Revisar accesos, puertas y cerraduras", critical: true },
      { title: "Confirmar salidas de emergencia despejadas", critical: true },
      { title: "Probar recepción, RFID/NFC y conexión", critical: true },
      { title: "Revisar tatami, piso y zona de entrenamiento", critical: true },
      { title: "Comprobar botiquín y números de emergencia", critical: true },
      { title: "Encender iluminación, ventilación y música", critical: false },
      { title: "Preparar recepción y avisos del día", critical: false },
    ],
  },
  {
    id: "cierre",
    name: "Cierre de sede",
    description: "Entrega ordenada y segura al terminar la jornada.",
    tasks: [
      { title: "Confirmar salida de atletas y personal", critical: true },
      { title: "Verificar puertas, ventanas y accesos", critical: true },
      { title: "Revisar estado de ESP32, puerta y alarma", critical: true },
      { title: "Apagar equipos, iluminación y ventilación", critical: true },
      { title: "Confirmar devolución de equipo prestado", critical: false },
      { title: "Registrar incidencias, pagos y pendientes", critical: false },
      { title: "Limpiar tatami y áreas de uso común", critical: false },
    ],
  },
  {
    id: "evento",
    name: "Evento especial",
    description: "Control previo y entrega de eventos internos.",
    tasks: [
      { title: "Confirmar responsable y lista de participantes", critical: true },
      { title: "Despejar rutas de entrada y evacuación", critical: true },
      { title: "Preparar botiquín, hidratación y contactos", critical: true },
      { title: "Probar pantallas, audio y cronograma", critical: false },
      { title: "Asignar estaciones y responsables", critical: false },
      { title: "Publicar avisos e indicaciones del evento", critical: false },
      { title: "Registrar cierre, resultados e incidencias", critical: false },
    ],
  },
  {
    id: "torneo",
    name: "Torneo",
    description: "Lista operativa para competencias y marcadores en vivo.",
    tasks: [
      { title: "Validar competidores, categorías y pesaje", critical: true },
      { title: "Confirmar árbitros y personal médico", critical: true },
      { title: "Probar marcadores, pantallas y conexión", critical: true },
      { title: "Revisar tatamis y perímetros de seguridad", critical: true },
      { title: "Preparar llaves, mesas y llamados", critical: false },
      { title: "Confirmar premiación y registro de resultados", critical: false },
      { title: "Documentar incidencias y entrega final", critical: false },
    ],
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOperationalChecklist(input: {
  template: OperationalTemplateId;
  date: string;
  site: string;
  responsible: string;
  shift: string;
  now?: string;
}): OperationalChecklist {
  const template = OPERATIONAL_TEMPLATES.find(
    (candidate) => candidate.id === input.template,
  );

  if (!template) throw new Error("Plantilla operativa no encontrada.");

  const now = input.now ?? new Date().toISOString();
  return {
    id: createId(`${input.date}-${input.template}`),
    date: input.date,
    site: input.site,
    title: template.name,
    template: template.id,
    shift: input.shift.trim(),
    responsible: input.responsible.trim(),
    status: "active",
    notes: "",
    incidents: "",
    nextShift: "",
    tasks: template.tasks.map((task, index) => ({
      id: `${input.template}-${index + 1}`,
      title: task.title,
      critical: task.critical,
      completed: false,
    })),
    createdAt: now,
  };
}

export function toggleOperationalTask(
  checklist: OperationalChecklist,
  taskId: string,
  completedBy: string,
  now = new Date().toISOString(),
): OperationalChecklist {
  return {
    ...checklist,
    tasks: checklist.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const completed = !task.completed;
      return {
        ...task,
        completed,
        completedAt: completed ? now : undefined,
        completedBy: completed ? completedBy.trim() || "Sin especificar" : undefined,
      };
    }),
  };
}

export function checklistProgress(checklist: OperationalChecklist) {
  const total = checklist.tasks.length;
  const completed = checklist.tasks.filter((task) => task.completed).length;
  return {
    total,
    completed,
    pending: total - completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function pendingCriticalTasks(checklist: OperationalChecklist) {
  return checklist.tasks.filter((task) => task.critical && !task.completed);
}

export function canCloseChecklist(checklist: OperationalChecklist) {
  return pendingCriticalTasks(checklist).length === 0;
}

export function completeChecklist(
  checklist: OperationalChecklist,
  now = new Date().toISOString(),
): OperationalChecklist {
  if (!canCloseChecklist(checklist)) {
    throw new Error("Completa las tareas críticas antes de cerrar el turno.");
  }

  return { ...checklist, status: "completed", completedAt: now };
}

export function buildShiftHandoffSummary(checklist: OperationalChecklist) {
  const progress = checklistProgress(checklist);
  const pending = checklist.tasks.filter((task) => !task.completed);
  const lines = [
    `${checklist.title} · ${checklist.site} · ${checklist.date}`,
    `Turno: ${checklist.shift || "Sin especificar"}`,
    `Responsable: ${checklist.responsible || "Sin especificar"}`,
    `Estado: ${checklist.status === "completed" ? "Cerrado" : "En curso"}`,
    `Avance: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
  ];

  if (pending.length > 0) {
    lines.push(
      "Pendientes:",
      ...pending.map((task) => `- ${task.critical ? "[CRÍTICA] " : ""}${task.title}`),
    );
  } else {
    lines.push("Pendientes: ninguno");
  }

  lines.push(
    `Incidencias: ${checklist.incidents.trim() || "ninguna"}`,
    `Para el siguiente turno: ${checklist.nextShift.trim() || "sin pendientes adicionales"}`,
    `Notas: ${checklist.notes.trim() || "sin notas"}`,
  );

  return lines.join("\n");
}
