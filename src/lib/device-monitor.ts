export const DEVICE_MONITOR_EVENT_LIMIT = 12;
export const DEVICE_MONITOR_MESSAGE_LIMIT = 160;

export type DeviceMonitorLevel = "info" | "warning" | "error" | "recovery";

export type DeviceMonitorEvent = {
  level: DeviceMonitorLevel;
  code: string;
  message: string;
  count: number;
  uptimeMs: number | null;
};

const LEVELS = new Set<DeviceMonitorLevel>([
  "info",
  "warning",
  "error",
  "recovery",
]);

function safeLine(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max)
    : "";
}

export function sanitizeDeviceMonitorEvents(
  value: unknown,
): DeviceMonitorEvent[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, DEVICE_MONITOR_EVENT_LIMIT).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const level = safeLine(item.level, 12).toLowerCase() as DeviceMonitorLevel;
    const code = safeLine(item.code, 40).toUpperCase();
    const message = safeLine(item.message, DEVICE_MONITOR_MESSAGE_LIMIT);
    if (!LEVELS.has(level) || !/^[A-Z0-9_]{3,40}$/.test(code) || !message)
      return [];

    const countValue = Number(item.count);
    const uptimeValue = Number(item.uptimeMs);
    return [
      {
        level,
        code,
        message,
        count: Number.isFinite(countValue)
          ? Math.max(1, Math.min(999, Math.trunc(countValue)))
          : 1,
        uptimeMs: Number.isFinite(uptimeValue)
          ? Math.max(0, Math.trunc(uptimeValue))
          : null,
      },
    ];
  });
}

