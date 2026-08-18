import {
  normalizeRfidDiagnosticSite,
  normalizeRfidDiagnosticValue,
  type RfidDiagnosticIndex,
  type RfidDiagnosticSite,
  type RfidDiagnosticStudent,
} from "./rfid-diagnostics.ts";

export type RfidRepairPlan = {
  studentUpdates: Array<{
    studentId: string;
    rfids: string[];
    rfid: string;
  }>;
  indexUpserts: Array<{
    rfid: string;
    studentId: string;
    site: RfidDiagnosticSite;
    mode: "create" | "correct";
  }>;
  indexDeletes: Array<{
    indexId: string;
    reason: "orphan" | "noncanonical";
  }>;
  blockedDuplicates: Array<{
    rfid: string;
    studentIds: string[];
  }>;
};

function normalizedStudentRfids(student: RfidDiagnosticStudent): string[] {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(student.rfids) ? student.rfids : []),
        student.rfid,
      ]
        .map(normalizeRfidDiagnosticValue)
        .filter(Boolean),
    ),
  );
}

function currentRawRfids(student: RfidDiagnosticStudent): string[] {
  return Array.isArray(student.rfids)
    ? student.rfids.filter((value): value is string => typeof value === "string")
    : [];
}

export function buildRfidRepairPlan(
  students: RfidDiagnosticStudent[],
  indexes: RfidDiagnosticIndex[],
  site: RfidDiagnosticSite,
): RfidRepairPlan {
  const studentRfids = new Map<string, string[]>();
  const ownersByRfid = new Map<string, string[]>();

  students.forEach((student) => {
    const rfids = normalizedStudentRfids(student);
    studentRfids.set(student.id, rfids);
    rfids.forEach((rfid) => {
      ownersByRfid.set(
        rfid,
        Array.from(new Set([...(ownersByRfid.get(rfid) || []), student.id])),
      );
    });
  });

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const indexesByNormalizedRfid = new Map<string, RfidDiagnosticIndex[]>();
  indexes.forEach((index) => {
    const rfid = normalizeRfidDiagnosticValue(index.id);
    if (!rfid) return;
    indexesByNormalizedRfid.set(rfid, [
      ...(indexesByNormalizedRfid.get(rfid) || []),
      index,
    ]);
  });

  const blockedDuplicates = Array.from(ownersByRfid.entries())
    .filter(([, ownerIds]) => {
      if (ownerIds.length < 2) return false;
      return ownerIds.some(
        (ownerId) =>
          normalizeRfidDiagnosticSite(studentsById.get(ownerId)?.sede) === site,
      );
    })
    .map(([rfid, studentIds]) => ({ rfid, studentIds }))
    .sort((a, b) => a.rfid.localeCompare(b.rfid, "es"));
  const duplicateRfids = new Set(blockedDuplicates.map((item) => item.rfid));

  const studentUpdates = students
    .filter(
      (student) => normalizeRfidDiagnosticSite(student.sede) === site,
    )
    .flatMap((student) => {
      const normalized = studentRfids.get(student.id) || [];
      if (normalized.length === 0) return [];
      const raw = currentRawRfids(student);
      const rawPrimary =
        typeof student.rfid === "string" ? student.rfid.trim() : "";
      const alreadyNormalized =
        raw.length === normalized.length &&
        raw.every((value, index) => value === normalized[index]) &&
        rawPrimary === normalized[0];
      return alreadyNormalized
        ? []
        : [{ studentId: student.id, rfids: normalized, rfid: normalized[0] }];
    });

  const indexUpserts: RfidRepairPlan["indexUpserts"] = [];
  const indexDeletes: RfidRepairPlan["indexDeletes"] = [];
  const queuedDeletes = new Set<string>();

  ownersByRfid.forEach((ownerIds, rfid) => {
    if (ownerIds.length !== 1 || duplicateRfids.has(rfid)) return;
    const studentId = ownerIds[0];
    const student = studentsById.get(studentId);
    if (normalizeRfidDiagnosticSite(student?.sede) !== site) return;

    const relatedIndexes = indexesByNormalizedRfid.get(rfid) || [];
    const canonicalIndex = relatedIndexes.find((index) => index.id === rfid);
    const canonicalOwner =
      typeof canonicalIndex?.alumnoId === "string"
        ? canonicalIndex.alumnoId.trim()
        : "";
    const canonicalSite = normalizeRfidDiagnosticSite(canonicalIndex?.sede);
    const canonicalRfid = normalizeRfidDiagnosticValue(
      canonicalIndex?.rfid,
    );
    const indexIsCorrect = Boolean(
      canonicalIndex &&
        canonicalOwner === studentId &&
        canonicalSite === site &&
        canonicalRfid === rfid,
    );

    if (!indexIsCorrect) {
      indexUpserts.push({
        rfid,
        studentId,
        site,
        mode: canonicalIndex ? "correct" : "create",
      });
    }

    relatedIndexes.forEach((index) => {
      if (index.id !== rfid && !queuedDeletes.has(index.id)) {
        queuedDeletes.add(index.id);
        indexDeletes.push({ indexId: index.id, reason: "noncanonical" });
      }
    });
  });

  indexes.forEach((index) => {
    const rfid = normalizeRfidDiagnosticValue(index.id);
    if (!rfid || queuedDeletes.has(index.id)) return;
    const indexSite = normalizeRfidDiagnosticSite(index.sede);
    if (indexSite && indexSite !== site) return;
    if ((ownersByRfid.get(rfid) || []).length > 0) return;
    queuedDeletes.add(index.id);
    indexDeletes.push({ indexId: index.id, reason: "orphan" });
  });

  return {
    studentUpdates,
    indexUpserts,
    indexDeletes,
    blockedDuplicates,
  };
}
