"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { recordAdminAudit } from "@/lib/admin-audit";
import {
  useAuth,
  useCollection,
  useFirestore,
  useMemoFirebase,
} from "@/firebase";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type TipoAviso = "general" | "horario" | "evento" | "urgente";

type Aviso = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: TipoAviso;
  sede: Sede;
  activo: boolean;
  venceEn?: Timestamp;
  creadoEn?: Timestamp;
};

function normalizarSede(valor: string | null): Sede {
  const sede = (valor || "MMA").trim().toUpperCase().replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)
    ? (sede as Sede)
    : "MMA";
}

const tipos: Record<
  TipoAviso,
  { etiqueta: string; icono: typeof Info; clase: string }
> = {
  general: {
    etiqueta: "General",
    icono: Info,
    clase: "border-blue-500/25 bg-blue-500/10 text-blue-500",
  },
  horario: {
    etiqueta: "Horario",
    icono: CalendarDays,
    clase: "border-violet-500/25 bg-violet-500/10 text-violet-500",
  },
  evento: {
    etiqueta: "Evento",
    icono: Megaphone,
    clase: "border-green-500/25 bg-green-500/10 text-green-500",
  },
  urgente: {
    etiqueta: "Urgente",
    icono: TriangleAlert,
    clase: "border-red-500/25 bg-red-500/10 text-red-500",
  },
};

export default function AdminAvisosPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [sede, setSede] = useState<Sede | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipo, setTipo] = useState<TipoAviso>("general");
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem("userSede")));
  }, []);

  const avisosQuery = useMemoFirebase(() => {
    if (!firestore || !sede) return null;
    return query(
      collection(firestore, "Anuncios"),
      where("sede", "==", sede),
    );
  }, [firestore, sede]);

  const { data: avisos, isLoading } = useCollection<Aviso>(avisosQuery);

  const avisosOrdenados = useMemo(
    () =>
      (avisos || [])
        .filter((aviso) => aviso.activo !== false)
        .sort(
          (a, b) =>
            (b.creadoEn?.toMillis?.() || 0) -
            (a.creadoEn?.toMillis?.() || 0),
        ),
    [avisos],
  );

  const crearAviso = async () => {
    if (!firestore || !sede || guardando) return;

    const tituloLimpio = titulo.trim();
    const mensajeLimpio = mensaje.trim();
    if (tituloLimpio.length < 3 || mensajeLimpio.length < 5) {
      toast({
        variant: "destructive",
        title: "Completa el aviso",
        description: "Escribe un título y un mensaje suficientemente claros.",
      });
      return;
    }

    try {
      setGuardando(true);
      const referencia = await addDoc(collection(firestore, "Anuncios"), {
        titulo: tituloLimpio,
        mensaje: mensajeLimpio,
        tipo,
        sede,
        activo: true,
        venceEn: vencimiento
          ? Timestamp.fromDate(new Date(`${vencimiento}T23:59:59`))
          : null,
        creadoEn: serverTimestamp(),
        creadoPor: auth.currentUser?.uid || "",
      });

      void recordAdminAudit(auth, {
        sede,
        action: "crear",
        entity: "anuncio",
        entityId: referencia.id,
        entityName: tituloLimpio,
        summary: `Se publicó el aviso ${tituloLimpio}.`,
        details: { tipo, vencimiento: vencimiento || "Sin vencimiento" },
      });

      setTitulo("");
      setMensaje("");
      setTipo("general");
      setVencimiento("");
      setDialogoAbierto(false);
      toast({
        title: "Aviso publicado",
        description: "Los atletas de esta sede podrán verlo en Mi Academia.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo publicar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarAviso = async (aviso: Aviso) => {
    if (!firestore || eliminandoId) return;
    if (!window.confirm(`¿Eliminar el aviso “${aviso.titulo}”?`)) return;

    try {
      setEliminandoId(aviso.id);
      await deleteDoc(doc(firestore, "Anuncios", aviso.id));
      toast({ title: "Aviso eliminado" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-xl shadow-primary/5 md:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/15">
              COMUNICACIÓN · {sede?.replace("_", " ")}
            </Badge>
            <h1 className="text-3xl font-black uppercase italic md:text-4xl">
              Avisos de la academia
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Publica novedades visibles únicamente para los atletas de esta
              sede.
            </p>
          </div>
          <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
            <DialogTrigger asChild>
              <Button type="button" size="lg" className="font-black uppercase">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo aviso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-black uppercase italic">
                  Publicar aviso
                </DialogTitle>
                <DialogDescription>
                  Se mostrará en Mi Academia para la sede actual.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notice-title">Título</Label>
                  <Input
                    id="notice-title"
                    value={titulo}
                    maxLength={90}
                    onChange={(event) => setTitulo(event.target.value)}
                    placeholder="Cambio de horario"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notice-message">Mensaje</Label>
                  <textarea
                    id="notice-message"
                    value={mensaje}
                    maxLength={600}
                    onChange={(event) => setMensaje(event.target.value)}
                    placeholder="Escribe la información para los atletas..."
                    className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-right text-[10px] text-muted-foreground">
                    {mensaje.length}/600
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={tipo}
                      onValueChange={(valor) => setTipo(valor as TipoAviso)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(tipos).map(([valor, datos]) => (
                          <SelectItem key={valor} value={valor}>
                            {datos.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notice-expiration">
                      Visible hasta (opcional)
                    </Label>
                    <Input
                      id="notice-expiration"
                      type="date"
                      value={vencimiento}
                      onChange={(event) => setVencimiento(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="w-full font-black uppercase"
                  disabled={guardando}
                  onClick={() => void crearAviso()}
                >
                  {guardando && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Publicar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {isLoading ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      ) : avisosOrdenados.length === 0 ? (
        <Card className="border-dashed border-primary/20 bg-card/35">
          <CardContent className="py-14 text-center text-muted-foreground">
            <Megaphone className="mx-auto mb-3 h-9 w-9" />
            No hay avisos activos para esta sede.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {avisosOrdenados.map((aviso) => {
            const configuracion = tipos[aviso.tipo] || tipos.general;
            const Icono = configuracion.icono;
            const vencimientoMs = aviso.venceEn?.toDate?.().getTime();
            const vencido =
              typeof vencimientoMs === "number" && vencimientoMs < Date.now();

            return (
              <Card
                key={aviso.id}
                className={`border-primary/10 bg-card/55 ${
                  vencido ? "opacity-55" : ""
                }`}
              >
                <CardContent className="flex gap-4 p-5">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${configuracion.clase}`}
                  >
                    <Icono className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black uppercase">{aviso.titulo}</p>
                      <Badge variant="outline">
                        {vencido ? "Vencido" : configuracion.etiqueta}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {aviso.mensaje}
                    </p>
                    {aviso.venceEn && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Visible hasta:{" "}
                        {aviso.venceEn.toDate().toLocaleDateString("es-MX")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={eliminandoId !== null}
                    onClick={() => void eliminarAviso(aviso)}
                  >
                    {eliminandoId === aviso.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
