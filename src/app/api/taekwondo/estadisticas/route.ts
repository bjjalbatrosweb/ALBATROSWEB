import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import { normalizarAtleta } from "@/lib/taekwondo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sede = String(
      new URL(request.url).searchParams.get("sede") || "",
    ).toUpperCase();
    if (!["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede))
      return NextResponse.json(
        { ok: false, mensaje: "Sede inválida." },
        { status: 400 },
      );
    await requirePanelActorAccess(
      request,
      sede as "MMA" | "CAUCEL" | "JUAN_PABLO",
    );
    const fightsSnap = await adminDb
      .collection("CombatesTaekwondo")
      .where("sede", "==", sede)
      .limit(100)
      .get();
    const combates = await Promise.all(
      fightsSnap.docs.map(async (doc) => {
        const d = doc.data();
        const [eventsSnap, controlsSnap] = await Promise.all([
          doc.ref.collection("Eventos").get(),
          doc.ref.collection("Controles").get(),
        ]);
        const events: any[] = eventsSnap.docs
          .map((e) => ({ id: e.id, ...e.data() }))
          .filter((e: any) => e.tipo === "puntos" && e.deshecho !== true);
        const controlNames = new Map(
          controlsSnap.docs.map((c) => [
            c.id,
            String(c.data().nombre || "Juez"),
          ]),
        );
        const porLado = (lado: "rojo" | "azul") => {
          const own = events.filter((e: any) => e.lado === lado);
          const puntos = own.reduce(
            (s: number, e: any) => s + Number(e.puntos || 0),
            0,
          );
          const zonas = ["cabeza", "cuerpo", "penalizacion"].map((zona) => {
            const value = own
              .filter((e: any) => e.zona === zona)
              .reduce((s: number, e: any) => s + Number(e.puntos || 0), 0);
            return {
              zona,
              puntos: value,
              porcentaje: puntos ? Math.round((value / puntos) * 100) : 0,
            };
          });
          const tecnicas = Object.entries(
            own.reduce(
              (a: Record<string, number>, e: any) => ({
                ...a,
                [e.tecnica]: (a[e.tecnica] || 0) + Number(e.puntos || 0),
              }),
              {},
            ),
          ).map(([tecnica, value]) => ({
            tecnica,
            puntos: value,
            porcentaje: puntos ? Math.round((Number(value) / puntos) * 100) : 0,
          }));
          return {
            puntos,
            acciones: own.length,
            zonas,
            tecnicas,
            precisionConsenso: own.length
              ? Math.round(
                  (own.reduce(
                    (s: number, e: any) =>
                      s + Number(String(e.consenso || "0/1").split("/")[0]),
                    0,
                  ) /
                    own.length) *
                    100,
                ) / 100
              : 0,
          };
        };
        const minutos = Object.entries(
          events.reduce(
            (a: Record<string, number>, e: any) => ({
              ...a,
              [`R${e.round} M${e.minuto}`]:
                (a[`R${e.round} M${e.minuto}`] || 0) + Number(e.puntos || 0),
            }),
            {},
          ),
        )
          .map(([minuto, value]) => ({ minuto, puntos: value }))
          .sort((a, b) => b.puntos - a.puntos);
        const duracionMin = Math.max(
          1,
          (Number(d.rounds || 1) * Number(d.duracionRoundMs || 0)) / 60000,
        );
        const jueces = Object.entries(
          events
            .flatMap((e: any) =>
              Array.isArray(e.controladores) ? e.controladores : [],
            )
            .reduce(
              (a: Record<string, number>, controlId: string) => ({
                ...a,
                [controlId]: (a[controlId] || 0) + 1,
              }),
              {},
            ),
        )
          .map(([id, value]) => ({
            id,
            nombre: controlNames.get(id) || "Control",
            validaciones: value,
          }))
          .sort((a, b) => Number(b.validaciones) - Number(a.validaciones));
        return {
          id: doc.id,
          rojo: normalizarAtleta(d.rojo, "ROJO"),
          azul: normalizarAtleta(d.azul, "AZUL"),
          puntosRojo: Number(d.puntosRojo) || 0,
          puntosAzul: Number(d.puntosAzul) || 0,
          ganador: String(d.ganador || ""),
          round: Number(d.round) || 1,
          rounds: Number(d.rounds) || 1,
          fase: String(d.fase || ""),
          creadoEn:
            d.creadoEn instanceof Timestamp
              ? d.creadoEn.toDate().toISOString()
              : null,
          rojoStats: porLado("rojo"),
          azulStats: porLado("azul"),
          minutos,
          minutoMasActivo: minutos[0] || null,
          minutoMasFlojo: minutos.length
            ? [...minutos].sort((a, b) => a.puntos - b.puntos)[0]
            : null,
          cadencia: Math.round((events.length / duracionMin) * 100) / 100,
          eventos: events.length,
          jueces,
        };
      }),
    );
    const atletas = new Map<
      string,
      {
        id: string;
        nombre: string;
        fotoUrl: string;
        combates: number;
        victorias: number;
        puntos: number;
        recibidos: number;
        acciones: number;
        mesas: {
          id: string;
          fecha: string | null;
          lado: "rojo" | "azul";
          rival: string;
          puntos: number;
          recibidos: number;
          resultado: string;
        }[];
        tecnicaPuntos: Record<string, number>;
      }
    >();
    for (const c of combates.filter((combate) => combate.fase === "finalizado"))
      for (const lado of ["rojo", "azul"] as const) {
        const atleta = c[lado] || { id: lado, nombre: lado, fotoUrl: "" };
        const own = lado === "rojo" ? c.rojoStats : c.azulStats;
        const rival = lado === "rojo" ? c.azulStats : c.rojoStats;
        const current = atletas.get(atleta.id) || {
          id: atleta.id,
          nombre: atleta.nombre,
          fotoUrl: atleta.fotoUrl,
          combates: 0,
          victorias: 0,
          puntos: 0,
          recibidos: 0,
          acciones: 0,
          mesas: [],
          tecnicaPuntos: {},
        };
        current.combates++;
        current.puntos += own.puntos;
        current.recibidos += rival.puntos;
        current.acciones += own.acciones;
        current.mesas.push({
          id: c.id,
          fecha: c.creadoEn,
          lado,
          rival: lado === "rojo" ? c.azul.nombre : c.rojo.nombre,
          puntos: own.puntos,
          recibidos: rival.puntos,
          resultado:
            c.ganador === "empate"
              ? "empate"
              : c.ganador === lado
                ? "victoria"
                : "derrota",
        });
        own.tecnicas.forEach((tecnica) => {
          const puntos = Number(tecnica.puntos) || 0;
          current.tecnicaPuntos[tecnica.tecnica] =
            (current.tecnicaPuntos[tecnica.tecnica] || 0) + puntos;
        });
        if (c.ganador === lado) current.victorias++;
        atletas.set(atleta.id, current);
      }
    const ranking = Array.from(atletas.values())
      .map((a) => ({
        ...a,
        porcentajeVictorias: a.combates
          ? Math.round((a.victorias / a.combates) * 100)
          : 0,
        puntosPorCombate: a.combates
          ? Math.round((a.puntos / a.combates) * 10) / 10
          : 0,
        tecnicaPrincipal:
          Object.entries(a.tecnicaPuntos).sort(
            (x, y) => Number(y[1]) - Number(x[1]),
          )[0]?.[0] || "sin datos",
        tendencia: (() => {
          const ordenadas = [...a.mesas].sort((x, y) =>
            String(x.fecha).localeCompare(String(y.fecha)),
          );
          if (ordenadas.length < 2) return "sin datos";
          const corte = Math.max(1, Math.floor(ordenadas.length / 2));
          const primera = ordenadas.slice(0, corte);
          const reciente = ordenadas.slice(corte);
          const promedio = (items: typeof ordenadas) =>
            items.reduce((s, mesa) => s + mesa.puntos, 0) /
            Math.max(1, items.length);
          const cambio = promedio(reciente) - promedio(primera);
          return cambio > 0.5
            ? "mejorando"
            : cambio < -0.5
              ? "bajando"
              : "estable";
        })(),
      }))
      .sort((a, b) => b.victorias - a.victorias || b.puntos - a.puntos);
    return NextResponse.json({
      ok: true,
      resumen: {
        combates: combates.length,
        finalizados: combates.filter((c) => c.fase === "finalizado").length,
        puntos: combates.reduce(
          (s, c) => s + c.rojoStats.puntos + c.azulStats.puntos,
          0,
        ),
        acciones: combates.reduce((s, c) => s + c.eventos, 0),
      },
      ranking,
      combates: combates.sort((a, b) =>
        String(b.creadoEn).localeCompare(String(a.creadoEn)),
      ),
    });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    console.error("ERROR_ESTADISTICAS_TAEKWONDO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron calcular las estadísticas." },
      { status: 500 },
    );
  }
}
