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
export const ATHLETE_PHOTO_MAX_STORED_BYTES = 180 * 1024;

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
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Tu navegador no pudo preparar la fotografía.");

    const sourceSide = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - sourceSide) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSide) / 2);
    const attempts = [
      { side: 512, quality: 0.8 },
      { side: 448, quality: 0.72 },
      { side: 384, quality: 0.64 },
      { side: 320, quality: 0.56 },
    ];

    for (const attempt of attempts) {
      const side = Math.min(attempt.side, sourceSide);
      canvas.width = side;
      canvas.height = side;
      context.fillStyle = "#111111";
      context.fillRect(0, 0, side, side);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSide,
        sourceSide,
        0,
        0,
        side,
        side,
      );

      const blob = await canvasToJpeg(canvas, attempt.quality);
      if (blob.size <= ATHLETE_PHOTO_MAX_STORED_BYTES) return blob;
    }

    throw new Error(
      "La fotografía sigue siendo demasiado pesada después de comprimirla. Prueba con otra imagen.",
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("No fue posible preparar la fotografía."));
    reader.onerror = () => reject(new Error("No fue posible preparar la fotografía."));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("No fue posible comprimir la fotografía.")),
      "image/jpeg",
      quality,
    );
  });
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
