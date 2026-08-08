import { createHash, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

export type LadoJiujitsu = "rojo" | "azul";
export type FaseJiujitsu =
  | "preparacion"
  | "combate"
  | "decision"
  | "finalizado";

export const ACCIONES_IBJJF = {
  derribo: { puntos: 2, nombre: "Derribo" },
  barrida: { puntos: 2, nombre: "Barrida" },
  rodilla_vientre: { puntos: 2, nombre: "Rodilla al abdomen" },
  pase_guardia: { puntos: 3, nombre: "Pase de guardia" },
  montada: { puntos: 4, nombre: "Montada" },
  espalda: { puntos: 4, nombre: "Control de espalda" },
} as const;

export function hashTokenJiujitsu(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenJiujitsuValido(token: unknown, stored: unknown) {
  if (typeof token !== "string" || typeof stored !== "string") return false;
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizarCompetidor(
  value: unknown,
  nombrePredeterminado: string,
) {
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

export function tiempoRestanteJiujitsu(
  data: FirebaseFirestore.DocumentData,
  now = Date.now(),
) {
  let ms = Math.max(0, Number(data.restanteMs) || 0);
  const inicio =
    data.iniciadoEn instanceof Timestamp ? data.iniciadoEn.toMillis() : 0;
  if (data.corriendo === true && inicio) {
    ms = Math.max(0, ms - (now - inicio));
  }
  return ms;
}

export function resolverGanadorJiujitsu(
  data: FirebaseFirestore.DocumentData,
): LadoJiujitsu | "empate" {
  const puntosRojo = Number(data.puntosRojo) || 0;
  const puntosAzul = Number(data.puntosAzul) || 0;
  if (puntosRojo !== puntosAzul) {
    return puntosRojo > puntosAzul ? "rojo" : "azul";
  }

  const ventajasRojo = Number(data.ventajasRojo) || 0;
  const ventajasAzul = Number(data.ventajasAzul) || 0;
  if (ventajasRojo !== ventajasAzul) {
    return ventajasRojo > ventajasAzul ? "rojo" : "azul";
  }

  const penalizacionesRojo = Number(data.penalizacionesRojo) || 0;
  const penalizacionesAzul = Number(data.penalizacionesAzul) || 0;
  if (penalizacionesRojo !== penalizacionesAzul) {
    return penalizacionesRojo < penalizacionesAzul ? "rojo" : "azul";
  }

  return "empate";
}

export function serializarCombateJiujitsu(
  data: FirebaseFirestore.DocumentData,
  id: string,
) {
  const restanteMs = tiempoRestanteJiujitsu(data);
  return {
    id,
    rojo: normalizarCompetidor(data.rojo, "ROJO"),
    azul: normalizarCompetidor(data.azul, "AZUL"),
    puntosRojo: Number(data.puntosRojo) || 0,
    puntosAzul: Number(data.puntosAzul) || 0,
    ventajasRojo: Number(data.ventajasRojo) || 0,
    ventajasAzul: Number(data.ventajasAzul) || 0,
    penalizacionesRojo: Number(data.penalizacionesRojo) || 0,
    penalizacionesAzul: Number(data.penalizacionesAzul) || 0,
    fase: String(data.fase || "preparacion") as FaseJiujitsu,
    restanteMs,
    duracionMs: Number(data.duracionMs) || 300000,
    corriendo: data.corriendo === true && restanteMs > 0,
    terminado: data.fase === "finalizado",
    requiereDecision: data.fase === "decision",
    controlesActivos: Math.max(1, Math.min(4, Number(data.controlesActivos) || 1)),
    ganador: String(data.ganador || ""),
    resultadoTipo: String(data.resultadoTipo || ""),
    categoria: String(data.categoria || ""),
    cinturon: String(data.cinturon || ""),
    modalidad: data.modalidad === "nogi" ? "No-Gi" : "Gi",
    sede: String(data.sede || ""),
    ultimoEvento: data.ultimoEvento || null,
    creadoEn:
      data.creadoEn instanceof Timestamp
        ? data.creadoEn.toDate().toISOString()
        : null,
  };
}
