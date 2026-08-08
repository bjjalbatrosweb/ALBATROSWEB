"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";

type SolicitudPago = {
  id: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  monto: number;
  periodo: string;
  estado: string;
  creadaEn: string | null;
};

function normalizarSede(value: string | null): Sede {
  const sede = String(value || "MMA")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)
    ? (sede as Sede)
    : "MMA";
}

function moneda(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SolicitudesPagoAdminPage() {
  const auth = useAuth();
  const [sede, setSede] = useState<Sede>("MMA");
  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem("userSede")));
    const incomingSearch = new URLSearchParams(window.location.search).get(
      "buscar",
    );
    if (incomingSearch) setBusqueda(incomingSearch);
  }, []);

  const solicitudesVisibles = useMemo(() => {
    const term = busqueda.trim().toLocaleLowerCase("es");
    if (!term) return solicitudes;
    return solicitudes.filter((solicitud) =>
      [
        solicitud.nombre,
        solicitud.periodo,
        solicitud.estado,
        solicitud.id,
      ].some((value) => String(value).toLocaleLowerCase("es").includes(term)),
    );
  }, [busqueda, solicitudes]);

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión administrativa expiró.");

      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        solicitudes?: SolicitudPago[];
      }>(`/api/admin/solicitudes-pago?sede=${encodeURIComponent(sede)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok || !data.ok) {
        throw new Error(apiErrorMessage(response.status, data.mensaje));
      }

      setSolicitudes(data.solicitudes || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar las solicitudes.",
      );
    } finally {
      setCargando(false);
    }
  }, [auth, sede]);

  useEffect(() => {
    if (!auth.currentUser) return;
    void cargarSolicitudes();
  }, [auth.currentUser, cargarSolicitudes]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-8 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge
            variant="outline"
            className="mb-3 border-red-500/30 text-red-500"
          >
            ADMINISTRACIÓN · {sede.replace("_", " ")}
          </Badge>
          <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">
            Solicitudes de pago
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aquí aparecen las solicitudes generadas desde el módulo público.
            Generarlas no registra un pago automáticamente.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={cargarSolicitudes}
          disabled={cargando}
        >
          {cargando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Actualizar
        </Button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="pl-9"
          placeholder="Buscar alumno, periodo o estado…"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-red-500" />
            Solicitudes recientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cargando && solicitudes.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          ) : solicitudes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Todavía no hay solicitudes en esta sede.
            </p>
          ) : solicitudesVisibles.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No hay solicitudes que coincidan con la búsqueda.
            </p>
          ) : (
            solicitudesVisibles.map((solicitud) => (
              <div
                key={solicitud.id}
                className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-black uppercase">{solicitud.nombre}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {solicitud.periodo} ·{" "}
                    {solicitud.creadaEn
                      ? new Date(solicitud.creadaEn).toLocaleString("es-MX")
                      : "Registrando fecha"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-black">{moneda(solicitud.monto)}</p>
                  <Badge
                    variant="outline"
                    className={
                      solicitud.estado === "pendiente"
                        ? "border-amber-500/40 text-amber-400"
                        : ""
                    }
                  >
                    {solicitud.estado}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        Esta pantalla requiere una sesión administrativa válida.
      </div>
    </main>
  );
}
