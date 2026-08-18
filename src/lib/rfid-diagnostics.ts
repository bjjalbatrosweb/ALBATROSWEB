export type RfidDiagnosticSite = "MMA" | "CAUCEL" | "JUAN_PABLO";

export type RfidDiagnosticStudent = {
  id: string;
  nombre?: unknown;
  sede?: unknown;
  rfid?: unknown;
  rfids?: unknown;
};

export type RfidDiagnosticIndex = {
  id: string;
  alumnoId?: unknown;
  sede?: unknown;
};

export type RfidDiagnosticDetail = {
  rfid: string;
  alumnos?: string[];
  detalle: string;
};

export type RfidDiagnosticReport = {
  ok: true;
  sede: RfidDiagnosticSite;
  generadoEn: string;
  resumen: {
    rfidsActivos: number;
    indicesSede: number;
    vinculadosCorrectos: number;
    huerfanos: number;
    sinIndice: number;
    conflictos: number;
    duplicados: number;
    totalProblemas: number;
  };
  problemas: {
    huerfanos: RfidDiagnosticDetail[];
    sinIndice: RfidDiagnosticDetail[];
    conflictos: RfidDiagnosticDetail[];
    duplicados: RfidDiagnosticDetail[];
  };
};

type Owner = {
  id: string;
  nombre: string;
  sede: RfidDiagnosticSite | null;
};

const SEDES_VALIDAS: RfidDiagnosticSite[] = [
  "MMA",
  "CAUCEL",
  "JUAN_PABLO",
];

export function normalizeRfidDiagnosticValue(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    : "";
}

export function normalizeRfidDiagnosticSite(
  value: unknown,
): RfidDiagnosticSite | null {
  if (typeof value !== "string") return null;
  const site = value.trim().toUpperCase().replace(/\s+/g, "_");
  return SEDES_VALIDAS.includes(site as RfidDiagnosticSite)
    ? (site as RfidDiagnosticSite)
    : null;
}

function studentRfids(student: RfidDiagnosticStudent): string[] {
  const candidates = [
    ...(Array.isArray(student.rfids) ? student.rfids : []),
    student.rfid,
  ];
  return Array.from(
    new Set(candidates.map(normalizeRfidDiagnosticValue).filter(Boolean)),
  );
}

function names(owners: Owner[]): string[] {
  return Array.from(new Set(owners.map((owner) => owner.nombre))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function sortedDetails(details: RfidDiagnosticDetail[]) {
  return details.sort((a, b) => a.rfid.localeCompare(b.rfid, "es"));
}

export function buildRfidDiagnosticReport(
  students: RfidDiagnosticStudent[],
  indexes: RfidDiagnosticIndex[],
  site: RfidDiagnosticSite,
): RfidDiagnosticReport {
  const ownersByRfid = new Map<string, Owner[]>();

  students.forEach((student) => {
    const owner: Owner = {
      id: student.id,
      nombre:
        typeof student.nombre === "string" && student.nombre.trim()
          ? student.nombre.trim()
          : student.id,
      sede: normalizeRfidDiagnosticSite(student.sede),
    };

    studentRfids(student).forEach((rfid) => {
      ownersByRfid.set(rfid, [...(ownersByRfid.get(rfid) || []), owner]);
    });
  });

  const indexesByRfid = new Map<string, RfidDiagnosticIndex[]>();
  indexes.forEach((index) => {
    const rfid = normalizeRfidDiagnosticValue(index.id);
    if (!rfid) return;
    indexesByRfid.set(rfid, [...(indexesByRfid.get(rfid) || []), index]);
  });

  const activeRfids = new Set<string>();
  ownersByRfid.forEach((owners, rfid) => {
    if (owners.some((owner) => owner.sede === site)) activeRfids.add(rfid);
  });

  const siteIndexes = indexes.filter((index) => {
    const indexSite = normalizeRfidDiagnosticSite(index.sede);
    if (indexSite === site) return true;
    if (indexSite) return false;

    const rfid = normalizeRfidDiagnosticValue(index.id);
    const owners = ownersByRfid.get(rfid) || [];
    return owners.length === 0 || owners.some((owner) => owner.sede === site);
  });
  const orphanRfids = new Set<string>();
  siteIndexes.forEach((index) => {
    const rfid = normalizeRfidDiagnosticValue(index.id);
    if (rfid && !(ownersByRfid.get(rfid)?.length)) orphanRfids.add(rfid);
  });

  const correctRfids = new Set<string>();
  const missingIndexRfids = new Set<string>();
  const conflictRfids = new Set<string>();

  activeRfids.forEach((rfid) => {
    const currentOwners = (ownersByRfid.get(rfid) || []).filter(
      (owner) => owner.sede === site,
    );
    const currentOwnerIds = new Set(currentOwners.map((owner) => owner.id));
    const rfidIndexes = indexesByRfid.get(rfid) || [];

    if (rfidIndexes.length === 0) {
      missingIndexRfids.add(rfid);
      return;
    }

    const hasCorrectIndex = rfidIndexes.some((index) => {
      const indexOwner =
        typeof index.alumnoId === "string" ? index.alumnoId.trim() : "";
      return (
        index.id === rfid &&
        currentOwnerIds.has(indexOwner) &&
        normalizeRfidDiagnosticSite(index.sede) === site
      );
    });

    if (hasCorrectIndex) correctRfids.add(rfid);
    else conflictRfids.add(rfid);
  });

  siteIndexes.forEach((index) => {
    const rfid = normalizeRfidDiagnosticValue(index.id);
    if (!rfid || orphanRfids.has(rfid)) return;
    const indexOwner =
      typeof index.alumnoId === "string" ? index.alumnoId.trim() : "";
    const owners = ownersByRfid.get(rfid) || [];
    if (
      index.id !== rfid ||
      !indexOwner ||
      !owners.some((owner) => owner.id === indexOwner)
    ) {
      conflictRfids.add(rfid);
    }
  });

  const duplicateRfids = new Set<string>();
  ownersByRfid.forEach((owners, rfid) => {
    const uniqueOwners = new Set(owners.map((owner) => owner.id));
    if (
      uniqueOwners.size > 1 &&
      (owners.some((owner) => owner.sede === site) ||
        (indexesByRfid.get(rfid) || []).some(
          (index) => normalizeRfidDiagnosticSite(index.sede) === site,
        ))
    ) {
      duplicateRfids.add(rfid);
    }
  });

  const orphanDetails = sortedDetails(
    Array.from(orphanRfids).map((rfid) => ({
      rfid,
      detalle: "El índice existe, pero ningún alumno conserva este RFID.",
    })),
  );
  const missingIndexDetails = sortedDetails(
    Array.from(missingIndexRfids).map((rfid) => {
      const owners = (ownersByRfid.get(rfid) || []).filter(
        (owner) => owner.sede === site,
      );
      return {
        rfid,
        alumnos: names(owners),
        detalle: "El alumno tiene el RFID, pero falta su índice TarjetasRFID.",
      };
    }),
  );
  const conflictDetails = sortedDetails(
    Array.from(conflictRfids).map((rfid) => ({
      rfid,
      alumnos: names(ownersByRfid.get(rfid) || []),
      detalle:
        "El índice tiene un UID no normalizado, apunta a otro alumno, otra sede o no tiene propietario.",
    })),
  );
  const duplicateDetails = sortedDetails(
    Array.from(duplicateRfids).map((rfid) => ({
      rfid,
      alumnos: names(ownersByRfid.get(rfid) || []),
      detalle: "El mismo RFID aparece guardado en más de un alumno.",
    })),
  );

  return {
    ok: true,
    sede: site,
    generadoEn: new Date().toISOString(),
    resumen: {
      rfidsActivos: activeRfids.size,
      indicesSede: siteIndexes.length,
      vinculadosCorrectos: correctRfids.size,
      huerfanos: orphanRfids.size,
      sinIndice: missingIndexRfids.size,
      conflictos: conflictRfids.size,
      duplicados: duplicateRfids.size,
      totalProblemas:
        orphanRfids.size +
        missingIndexRfids.size +
        conflictRfids.size +
        duplicateRfids.size,
    },
    problemas: {
      huerfanos: orphanDetails,
      sinIndice: missingIndexDetails,
      conflictos: conflictDetails,
      duplicados: duplicateDetails,
    },
  };
}
