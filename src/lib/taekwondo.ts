import { createHash, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

export type Lado = "rojo" | "azul";
export type Fase = "preparacion" | "combate" | "descanso" | "finalizado";

export const TECNICAS = {
  puno: { puntos: 1, zona: "cuerpo", nombre: "Puño" },
  cuerpo: { puntos: 2, zona: "cuerpo", nombre: "Patada al cuerpo" },
  cabeza: { puntos: 3, zona: "cabeza", nombre: "Patada a la cabeza" },
  giro_cuerpo: { puntos: 4, zona: "cuerpo", nombre: "Giro al cuerpo" },
  giro_cabeza: { puntos: 5, zona: "cabeza", nombre: "Giro a la cabeza" },
  gamjeom: { puntos: 1, zona: "penalizacion", nombre: "Gam-jeom" },
} as const;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenValido(token: unknown, stored: unknown) {
  if (typeof token !== "string" || typeof stored !== "string") return false;
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function umbral(controles: number) {
  return controles <= 1 ? 1 : controles === 2 ? 2 : controles === 3 ? 2 : 3;
}

export function normalizarAtleta(value: unknown, nombrePredeterminado: string) {
  if (typeof value === "string") {
    return {
      id: "",
      nombre: value.trim() || nombrePredeterminado,
      fotoUrl: "",
    };
  }

  if (value && typeof value === "object") {
    const atleta = value as Record<string, unknown>;
    return {
      id: typeof atleta.id === "string" ? atleta.id : "",
      nombre:
        typeof atleta.nombre === "string" && atleta.nombre.trim()
          ? atleta.nombre.trim()
          : nombrePredeterminado,
      fotoUrl:
        typeof atleta.fotoUrl === "string"
          ? atleta.fotoUrl
          : typeof atleta.imagenUrl === "string"
            ? atleta.imagenUrl
            : "",
    };
  }

  return { id: "", nombre: nombrePredeterminado, fotoUrl: "" };
}

export function restante(
  data: FirebaseFirestore.DocumentData,
  now = Date.now(),
) {
  let ms = Math.max(0, Number(data.restanteMs) || 0);
  const inicio =
    data.iniciadoEn instanceof Timestamp ? data.iniciadoEn.toMillis() : 0;
  if (data.corriendo && inicio) ms = Math.max(0, ms - (now - inicio));
  return ms;
}

export function serializarCombate(
  data: FirebaseFirestore.DocumentData,
  id: string,
) {
  const restanteMs = restante(data);
  const votos = Array.isArray(data.votosPendientes)
    ? data.votosPendientes.filter(
        (v: { at?: number }) => Date.now() - Number(v.at || 0) <= 2000,
      )
    : [];
  return {
    id,
    rojo: normalizarAtleta(data.rojo, "ROJO"),
    azul: normalizarAtleta(data.azul, "AZUL"),
    puntosRojo: Number(data.puntosRojo) || 0,
    puntosAzul: Number(data.puntosAzul) || 0,
    round: Number(data.round) || 1,
    rounds: Number(data.rounds) || 3,
    fase: String(data.fase || "preparacion") as Fase,
    restanteMs,
    duracionRoundMs: Number(data.duracionRoundMs) || 120000,
    descansoMs: Number(data.descansoMs) || 60000,
    corriendo: data.corriendo === true && restanteMs > 0,
    terminado: data.fase === "finalizado",
    controlesActivos: Math.max(
      1,
      Math.min(4, Number(data.controlesActivos) || 1),
    ),
    umbral: umbral(Number(data.controlesActivos) || 1),
    votosPendientes: votos.map(
      (v: { controladorId?: string; clave?: string; at?: number }) => ({
        controladorId: v.controladorId,
        clave: v.clave,
        at: v.at,
      }),
    ),
    ultimoEvento: data.ultimoEvento || null,
    ganador: String(data.ganador || ""),
    sede: String(data.sede || ""),
    creadoEn:
      data.creadoEn instanceof Timestamp
        ? data.creadoEn.toDate().toISOString()
        : null,
  };
}
