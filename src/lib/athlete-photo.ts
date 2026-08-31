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

export const ATHLETE_PHOTO_MAX_INPUT_BYTES = 12 * 1024 * 1024;
export const ATHLETE_PHOTO_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type PhotoFileMetadata = { type: string; size: number };

export function athletePhotoValidationError(file: PhotoFileMetadata): string {
  if (!(ATHLETE_PHOTO_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return "Usa una fotografía JPG, PNG o WebP.";
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "El archivo seleccionado está vacío.";
  }

  if (file.size > ATHLETE_PHOTO_MAX_INPUT_BYTES) {
    return "La fotografía no puede superar 12 MB.";
  }

  return "";
}

export async function prepareAthletePhoto(file: File): Promise<Blob> {
  const validationError = athletePhotoValidationError(file);
  if (validationError) throw new Error(validationError);

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No fue posible leer la fotografía."));
      element.src = objectUrl;
    });
    const maximumSide = 1200;
    const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Tu navegador no pudo preparar la fotografía.");

    context.fillStyle = "#111111";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("No fue posible comprimir la fotografía.")),
        "image/jpeg",
        0.86,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
