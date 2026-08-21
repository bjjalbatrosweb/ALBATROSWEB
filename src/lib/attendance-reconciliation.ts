export type AttendanceReconciliation = {
  matched: string[];
  presentWithoutRecord: string[];
  recordedWithoutPresence: string[];
};

function uniqueIds(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function reconcileAttendance(
  physicallyPresentIds: readonly string[],
  recordedAttendanceIds: readonly string[],
): AttendanceReconciliation {
  const physicallyPresent = uniqueIds(physicallyPresentIds);
  const recordedAttendance = uniqueIds(recordedAttendanceIds);
  const presentSet = new Set(physicallyPresent);
  const recordedSet = new Set(recordedAttendance);

  return {
    matched: physicallyPresent.filter((id) => recordedSet.has(id)),
    presentWithoutRecord: physicallyPresent.filter((id) => !recordedSet.has(id)),
    recordedWithoutPresence: recordedAttendance.filter(
      (id) => !presentSet.has(id),
    ),
  };
}
