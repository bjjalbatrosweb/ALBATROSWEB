/**
 * Convierte enlaces compartidos habituales en una URL que el navegador pueda
 * utilizar directamente como imagen. Los datos antiguos se conservan: si el
 * proveedor no se reconoce, solo se limpia el espacio exterior.
 */
export function normalizeAthletePhotoUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  const url = value.trim();
  if (!url) return "";

  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  const driveId = driveFile?.[1] || getGoogleDriveQueryId(url);

  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname === "www.dropbox.com") {
      parsed.searchParams.delete("dl");
      parsed.searchParams.set("raw", "1");
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
}

function getGoogleDriveQueryId(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "drive.google.com") return "";

    if (
      parsed.pathname === "/open" ||
      parsed.pathname === "/uc" ||
      parsed.pathname === "/thumbnail"
    ) {
      return parsed.searchParams.get("id")?.trim() || "";
    }
  } catch {
    return "";
  }

  return "";
}
