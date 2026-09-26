import { createHmac } from "node:crypto";

const PIN_PATTERN = /^\d{4}$/;

export function normalizeKioskPin(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidKioskPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function kioskPinDigest(pin: string): string {
  const secret =
    process.env.KIOSK_PIN_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    "albatros-kiosk-pin-v1-albatros-5de2d";

  return createHmac("sha256", secret).update(`pin:${pin}`).digest("hex");
}
