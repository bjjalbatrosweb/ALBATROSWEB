import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const LOCATIONS: Record<
  Sede,
  { latitude: number; longitude: number; label: string }
> = {
  MMA: { latitude: 20.9674, longitude: -89.5926, label: "Mérida" },
  CAUCEL: { latitude: 21.015, longitude: -89.72, label: "Ciudad Caucel" },
  JUAN_PABLO: {
    latitude: 20.965,
    longitude: -89.67,
    label: "Juan Pablo II",
  },
};

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(sede) ? sede : null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const sede = normalizarSede(new URL(request.url).searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);
    const location = LOCATIONS[sede];
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
      timezone: "America/Merida",
      forecast_days: "1",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${query.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 900 },
      },
    );
    if (!response.ok) throw new Error(`WEATHER_${response.status}`);

    const data = (await response.json()) as {
      current?: Record<string, unknown>;
      current_units?: Record<string, unknown>;
    };
    const current = data.current || {};
    const temperature = finiteNumber(current.temperature_2m);
    const apparentTemperature = finiteNumber(current.apparent_temperature);
    const humidity = finiteNumber(current.relative_humidity_2m);
    const weatherCode = finiteNumber(current.weather_code);
    const windSpeed = finiteNumber(current.wind_speed_10m);
    if (temperature === null || weatherCode === null) {
      throw new Error("WEATHER_INVALID_RESPONSE");
    }

    return NextResponse.json(
      {
        ok: true,
        sede,
        ubicacion: location.label,
        temperatura: temperature,
        sensacion: apparentTemperature,
        humedad: humidity,
        viento: windSpeed,
        codigo: weatherCode,
        esDia: Number(current.is_day) === 1,
        observadoEn:
          typeof current.time === "string"
            ? current.time
            : new Date().toISOString(),
        fuente: "Open-Meteo",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("DOJANG_ASSISTANT_WEATHER_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo consultar el clima exterior." },
      { status: 502 },
    );
  }
}
