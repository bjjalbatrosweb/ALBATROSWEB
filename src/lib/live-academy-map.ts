export type AcademyZoneType =
  | "recepcion"
  | "tatami"
  | "striking"
  | "fuerza"
  | "espera"
  | "salida";

export type AcademyZoneStatus = "abierta" | "restringida" | "cerrada";

export type AcademyZone = {
  id: string;
  name: string;
  type: AcademyZoneType;
  capacity: number;
  activity: string;
  status: AcademyZoneStatus;
  athleteIds: string[];
};

export type AcademyMapState = {
  version: 1;
  zones: AcademyZone[];
  updatedAt: string;
};

export const ZONE_STATUS_LABELS: Record<AcademyZoneStatus, string> = {
  abierta: "Abierta",
  restringida: "Restringida",
  cerrada: "Cerrada",
};

export const ZONE_TYPE_LABELS: Record<AcademyZoneType, string> = {
  recepcion: "Recepción",
  tatami: "Tatami",
  striking: "Striking",
  fuerza: "Acondicionamiento",
  espera: "Espera",
  salida: "Salida / descanso",
};

export function createDefaultAcademyMap(): AcademyMapState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    zones: [
      {
        id: "recepcion",
        name: "Recepción",
        type: "recepcion",
        capacity: 8,
        activity: "Ingreso y registro",
        status: "abierta",
        athleteIds: [],
      },
      {
        id: "tatami-principal",
        name: "Tatami principal",
        type: "tatami",
        capacity: 24,
        activity: "Clase activa",
        status: "abierta",
        athleteIds: [],
      },
      {
        id: "zona-striking",
        name: "Zona de striking",
        type: "striking",
        capacity: 14,
        activity: "Técnica y costales",
        status: "abierta",
        athleteIds: [],
      },
      {
        id: "zona-fuerza",
        name: "Área funcional",
        type: "fuerza",
        capacity: 12,
        activity: "Fuerza y movilidad",
        status: "abierta",
        athleteIds: [],
      },
      {
        id: "espera",
        name: "Espera / vestidores",
        type: "espera",
        capacity: 10,
        activity: "Preparación",
        status: "abierta",
        athleteIds: [],
      },
      {
        id: "salida",
        name: "Descanso y salida",
        type: "salida",
        capacity: 10,
        activity: "Recuperación",
        status: "abierta",
        athleteIds: [],
      },
    ],
  };
}

export function cleanAcademyMap(state: AcademyMapState, presentIds: string[]) {
  const allowed = new Set(presentIds);
  const assigned = new Set<string>();
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    zones: state.zones.map((zone) => ({
      ...zone,
      athleteIds: zone.athleteIds.filter((id) => {
        if (!allowed.has(id) || assigned.has(id)) return false;
        assigned.add(id);
        return true;
      }),
    })),
  };
}

export function moveAthleteToZone(
  state: AcademyMapState,
  athleteId: string,
  zoneId: string | null,
) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    zones: state.zones.map((zone) => ({
      ...zone,
      athleteIds: [
        ...zone.athleteIds.filter((id) => id !== athleteId),
        ...(zone.id === zoneId ? [athleteId] : []),
      ],
    })),
  };
}

export function unassignedAthleteIds(state: AcademyMapState, presentIds: string[]) {
  const assigned = new Set(state.zones.flatMap((zone) => zone.athleteIds));
  return presentIds.filter((id) => !assigned.has(id));
}

export function occupancyPercent(zone: AcademyZone) {
  if (zone.capacity <= 0) return 0;
  return Math.round((zone.athleteIds.length / zone.capacity) * 100);
}
