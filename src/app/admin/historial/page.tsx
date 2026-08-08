"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import {
  Activity,
  CalendarClock,
  DatabaseZap,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, useFirestore } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";

type Movement = {
  id: string;
  action: string;
  entity: string;
  entityName?: string;
  summary: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  createdAt: string | null;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type DuplicatePreview = {
  gruposDuplicados: number;
  registrosAEliminar: number;
  grupos: Array<{
    alumnoId: string;
    nombre: string;
    fecha: string;
    cantidad: number;
    conservarId: string;
    eliminarIds: string[];
  }>;
};

const ACTION_LABELS: Record<string, string> = {
  crear: "Creación",
  editar: "Edición",
  eliminar: "Eliminación",
  activar: "Reactivación",
  desactivar: "Baja temporal",
  registrar_pago: "Pago registrado",
  editar_pago: "Pago corregido",
  cancelar_pago: "Pago cancelado",
  agregar_asistencia: "Asistencia agregada",
  eliminar_asistencia: "Asistencia eliminada",
  reiniciar_asistencias: "Asistencias reiniciadas",
};

export default function AdminHistoryPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("todos");
  const [nextCursor, setNextCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [duplicatePreview, setDuplicatePreview] =
    useState<DuplicatePreview | null>(null);
  const [duplicateError, setDuplicateError] = useState("");
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const sede =
    typeof window === "undefined" ? "" : localStorage.getItem("userSede") || "";

  const loadHistory = useCallback(
    async (
      cursor: QueryDocumentSnapshot<DocumentData> | null = null,
      append = false,
    ) => {
      if (!firestore || !sede) return;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      try {
        const baseQuery = query(
          collection(firestore, "Auditoria", sede, "movimientos"),
          orderBy("createdAt", "desc"),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(51),
        );
        const snapshot = await getDocs(baseQuery);
        const pageDocuments = snapshot.docs.slice(0, 50);
        const newMovements = pageDocuments.map((document) => {
          const data = document.data();
          const date = data.createdAt?.toDate?.();
          return {
            id: document.id,
            ...data,
            createdAt: date ? date.toISOString() : null,
          } as Movement;
        });
        setMovements((current) =>
          append ? [...current, ...newMovements] : newMovements,
        );
        setNextCursor(
          snapshot.docs.length > 50
            ? pageDocuments[pageDocuments.length - 1] || null
            : null,
        );
      } finally {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
      }
    },
    [firestore, sede],
  );

  useEffect(() => {
    void loadHistory(null, false);
  }, [loadHistory]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");

    return movements.filter((movement) => {
      if (entityFilter !== "todos" && movement.entity !== entityFilter) {
        return false;
      }

      if (!term) return true;

      return [
        movement.summary,
        movement.entityName,
        movement.actorName,
        movement.actorEmail,
      ].some((value) => value?.toLocaleLowerCase("es").includes(term));
    });
  }, [entityFilter, movements, search]);

  const analizarDuplicados = async (confirmar = false) => {
    if (!sede) return;

    if (
      confirmar &&
      !window.confirm(
        `Se conservará la asistencia más antigua de cada día y se eliminarán ${duplicatePreview?.registrosAEliminar || 0} duplicados. ¿Continuar?`,
      )
    ) {
      return;
    }

    confirmar ? setIsCleaningDuplicates(true) : setIsCheckingDuplicates(true);
    setDuplicateError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró. Vuelve a iniciar sesión.");

      const { response, data } = await apiRequest<
        DuplicatePreview & {
          ok?: boolean;
          mensaje?: string;
          registrosEliminados?: number;
        }
      >("/api/admin/asistencias/duplicados", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sede, confirmar }),
      });

      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudieron analizar los duplicados.",
          ),
        );
      }

      if (confirmar) {
        setDuplicatePreview(null);
        await loadHistory(null, false);
      } else {
        setDuplicatePreview(data);
      }
    } catch (error) {
      setDuplicateError(
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setIsCheckingDuplicates(false);
      setIsCleaningDuplicates(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-card">
        <div className="flex flex-col gap-5 border-b border-border/70 p-5 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
                Control administrativo
              </p>
              <h1 className="mt-1 text-2xl font-black uppercase italic md:text-3xl">
                Historial de movimientos
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Historial paginado de cambios registrados en la sede {sede}.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadHistory(null, false)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_220px] md:p-7">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar alumno, movimiento o usuario..."
              className="pl-10"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de registro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los movimientos</SelectItem>
              <SelectItem value="alumno">Alumnos</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="asistencia">Asistencias</SelectItem>
              <SelectItem value="rfid">RFID / NFC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <details className="group overflow-hidden rounded-3xl border border-border/70 bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 md:p-7">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary">
              <DatabaseZap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black uppercase italic">
                Mantenimiento de asistencias
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Herramienta exclusiva del administrador para detectar
                duplicados.
              </p>
            </div>
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-primary">
            Abrir
          </span>
        </summary>
        <div className="space-y-4 border-t border-border/70 p-5 md:p-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isCheckingDuplicates || isCleaningDuplicates}
              onClick={() => void analizarDuplicados(false)}
            >
              {isCheckingDuplicates ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Analizar duplicados
            </Button>
            {duplicatePreview && duplicatePreview.registrosAEliminar > 0 && (
              <Button
                type="button"
                variant="destructive"
                disabled={isCleaningDuplicates}
                onClick={() => void analizarDuplicados(true)}
              >
                {isCleaningDuplicates ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar {duplicatePreview.registrosAEliminar} duplicados
              </Button>
            )}
          </div>

          {duplicateError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {duplicateError}
            </p>
          )}

          {duplicatePreview && (
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="font-bold">
                {duplicatePreview.registrosAEliminar === 0
                  ? "No se encontraron asistencias duplicadas."
                  : `${duplicatePreview.gruposDuplicados} días afectados · ${duplicatePreview.registrosAEliminar} registros para eliminar.`}
              </p>
              {duplicatePreview.grupos.length > 0 && (
                <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                  {duplicatePreview.grupos.map((grupo) => (
                    <div
                      key={`${grupo.alumnoId}-${grupo.fecha}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {grupo.nombre} · {grupo.fecha}
                      </span>
                      <Badge variant="secondary">
                        {grupo.cantidad} registros
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Cargando historial...
          </CardContent>
        </Card>
      ) : filteredMovements.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
            <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-bold">Todavía no hay movimientos que mostrar.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los nuevos cambios administrativos aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredMovements.map((movement) => (
            <Card
              key={movement.id}
              className="transition-colors hover:border-primary/35"
            >
              <CardHeader className="space-y-3 p-5 md:flex md:flex-row md:items-center md:justify-between md:space-y-0">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-primary/30 text-primary"
                    >
                      {ACTION_LABELS[movement.action] || movement.action}
                    </Badge>
                    <Badge variant="secondary" className="uppercase">
                      {movement.entity}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">
                    {movement.summary}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Realizado por {movement.actorName}
                    {movement.actorEmail ? ` · ${movement.actorEmail}` : ""}
                  </p>
                  {movement.reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Motivo: {movement.reason}
                    </p>
                  )}
                  {(movement.before || movement.after) && (
                    <details className="mt-3 rounded-xl border border-border/70 bg-background/40 p-3 text-xs">
                      <summary className="cursor-pointer font-black uppercase text-primary">
                        Ver valores anteriores y nuevos
                      </summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                          {JSON.stringify(movement.before || {}, null, 2)}
                        </pre>
                        <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                          {JSON.stringify(movement.after || {}, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {movement.createdAt
                    ? new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(movement.createdAt))
                    : "Registrando..."}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && nextCursor && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={isLoadingMore}
            onClick={() => void loadHistory(nextCursor, true)}
          >
            {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cargar 50 movimientos más
          </Button>
        </div>
      )}
    </div>
  );
}
