export type BackupIntegrity = { algorithm: "SHA-256"; digest: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "integridad")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function backupDigest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function addBackupIntegrity<T extends Record<string, unknown>>(value: T): Promise<T & { integridad: BackupIntegrity }> {
  return { ...value, integridad: { algorithm: "SHA-256", digest: await backupDigest(value) } };
}

export async function verifyBackupIntegrity(value: Record<string, unknown>) {
  const integrity = value.integridad as Partial<BackupIntegrity> | undefined;
  if (!integrity) return { valid: true, legacy: true };
  if (integrity.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/.test(String(integrity.digest || ""))) return { valid: false, legacy: false };
  return { valid: (await backupDigest(value)) === integrity.digest, legacy: false };
}
