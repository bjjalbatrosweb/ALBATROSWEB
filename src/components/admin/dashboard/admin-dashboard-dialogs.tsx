"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  CreditCard,
  DollarSign,
  Download,
  Loader2,
  Pencil,
  Phone,
  Target,
  Trash2,
  Trophy,
  Users,
  Weight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DISCIPLINAS_ALBATROS,
  type AdminAlumno,
  type ComparacionMensual,
  type EditableAlumno,
  type Pago,
  type PaymentMethod,
  type Sede,
} from "@/components/admin/dashboard/admin-dashboard-model";

type AttendanceDataMap = Record<string, { count: number; history: Date[] }>;

type AdminDashboardDialogsProps = {
  userSede: Sede | null;
  attendanceStudent: AdminAlumno | null;
  setAttendanceStudent: Dispatch<SetStateAction<AdminAlumno | null>>;
  manualAttendanceDate: string;
  setManualAttendanceDate: Dispatch<SetStateAction<string>>;
  manualAttendanceTime: string;
  setManualAttendanceTime: Dispatch<SetStateAction<string>>;
  isSavingManualAttendance: boolean;
  handleAddManualAttendance: () => Promise<void>;
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: Dispatch<SetStateAction<boolean>>;
  editingStudent: EditableAlumno | null;
  setEditingStudent: Dispatch<SetStateAction<EditableAlumno | null>>;
  isUpdatingStudent: boolean;
  deletingRfid: string | null;
  handleDeleteStudentRfid: (rfid: string) => Promise<void>;
  handleUpdateStudent: () => Promise<void>;
  paymentStudent: AdminAlumno | null;
  setPaymentStudent: Dispatch<SetStateAction<AdminAlumno | null>>;
  paymentAmount: string;
  setPaymentAmount: Dispatch<SetStateAction<string>>;
  paymentPeriod: string;
  setPaymentPeriod: Dispatch<SetStateAction<string>>;
  paymentDate: string;
  setPaymentDate: Dispatch<SetStateAction<string>>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: Dispatch<SetStateAction<PaymentMethod>>;
  isSavingPayment: boolean;
  handleConfirmPayment: () => Promise<void>;
  historyStudent: AdminAlumno | null;
  setHistoryStudent: Dispatch<SetStateAction<AdminAlumno | null>>;
  paymentHistory: Pago[];
  setPaymentHistory: Dispatch<SetStateAction<Pago[]>>;
  isLoadingPaymentHistory: boolean;
  handleStartEditPayment: (payment: Pago) => void;
  handleDeletePayment: (payment: Pago) => Promise<void>;
  editingPayment: Pago | null;
  setEditingPayment: Dispatch<SetStateAction<Pago | null>>;
  editPaymentAmount: string;
  setEditPaymentAmount: Dispatch<SetStateAction<string>>;
  editPaymentPeriod: string;
  setEditPaymentPeriod: Dispatch<SetStateAction<string>>;
  editPaymentDate: string;
  setEditPaymentDate: Dispatch<SetStateAction<string>>;
  editPaymentMethod: PaymentMethod;
  setEditPaymentMethod: Dispatch<SetStateAction<PaymentMethod>>;
  isUpdatingPayment: boolean;
  handleUpdatePayment: () => Promise<void>;
  isMonthlyComparisonOpen: boolean;
  setIsMonthlyComparisonOpen: Dispatch<SetStateAction<boolean>>;
  isLoadingMonthlyComparison: boolean;
  monthlyComparison: ComparacionMensual[];
  maxRecaudacionComparacion: number;
  maxAsistenciasComparacion: number;
  receiptPayment: Pago | null;
  setReceiptPayment: Dispatch<SetStateAction<Pago | null>>;
  obtenerFechaPago: (payment: Pago) => Date;
  enviarReciboWhatsApp: (payment: Pago) => void;
  imprimirRecibo: (payment: Pago) => void;
  profileStudent: AdminAlumno | null;
  setProfileStudent: Dispatch<SetStateAction<AdminAlumno | null>>;
  profilePayments: Pago[];
  setProfilePayments: Dispatch<SetStateAction<Pago[]>>;
  isLoadingProfilePayments: boolean;
  attendanceDataMap: AttendanceDataMap;
  getStatusBadge: (student: AdminAlumno) => ReactNode;
  abrirWhatsApp: (
    student: AdminAlumno,
    type: "retraso" | "proximo" | "general",
  ) => Promise<boolean>;
  handleOpenEditDialog: (student: AdminAlumno) => void;
  openEmergencyProfile: (student: AdminAlumno) => void;
};

export default function AdminDashboardDialogs(
  props: AdminDashboardDialogsProps,
) {
  const {
    userSede,
    attendanceStudent,
    setAttendanceStudent,
    manualAttendanceDate,
    setManualAttendanceDate,
    manualAttendanceTime,
    setManualAttendanceTime,
    isSavingManualAttendance,
    handleAddManualAttendance,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingStudent,
    setEditingStudent,
    isUpdatingStudent,
    deletingRfid,
    handleDeleteStudentRfid,
    handleUpdateStudent,
    paymentStudent,
    setPaymentStudent,
    paymentAmount,
    setPaymentAmount,
    paymentPeriod,
    setPaymentPeriod,
    paymentDate,
    setPaymentDate,
    paymentMethod,
    setPaymentMethod,
    isSavingPayment,
    handleConfirmPayment,
    historyStudent,
    setHistoryStudent,
    paymentHistory,
    setPaymentHistory,
    isLoadingPaymentHistory,
    handleStartEditPayment,
    handleDeletePayment,
    editingPayment,
    setEditingPayment,
    editPaymentAmount,
    setEditPaymentAmount,
    editPaymentPeriod,
    setEditPaymentPeriod,
    editPaymentDate,
    setEditPaymentDate,
    editPaymentMethod,
    setEditPaymentMethod,
    isUpdatingPayment,
    handleUpdatePayment,
    isMonthlyComparisonOpen,
    setIsMonthlyComparisonOpen,
    isLoadingMonthlyComparison,
    monthlyComparison,
    maxRecaudacionComparacion,
    maxAsistenciasComparacion,
    receiptPayment,
    setReceiptPayment,
    obtenerFechaPago,
    enviarReciboWhatsApp,
    imprimirRecibo,
    profileStudent,
    setProfileStudent,
    profilePayments,
    setProfilePayments,
    isLoadingProfilePayments,
    attendanceDataMap,
    getStatusBadge,
    abrirWhatsApp,
    handleOpenEditDialog,
    openEmergencyProfile,
  } = props;

  return (
    <>
          <Dialog
            open={attendanceStudent !== null}
            onOpenChange={(open) => {
              if (!open && !isSavingManualAttendance) {
                setAttendanceStudent(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Agregar asistencia manual</DialogTitle>
                <DialogDescription>
                  {attendanceStudent?.nombre || "Alumno seleccionado"} · solo se
                  permite registrar una asistencia por día.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="manual-attendance-date">Fecha</Label>
                  <Input
                    id="manual-attendance-date"
                    type="date"
                    value={manualAttendanceDate}
                    onChange={(event) =>
                      setManualAttendanceDate(event.target.value)
                    }
                    disabled={isSavingManualAttendance}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-attendance-time">Hora</Label>
                  <Input
                    id="manual-attendance-time"
                    type="time"
                    value={manualAttendanceTime}
                    onChange={(event) =>
                      setManualAttendanceTime(event.target.value)
                    }
                    disabled={isSavingManualAttendance}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingManualAttendance}
                  onClick={() => setAttendanceStudent(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={isSavingManualAttendance}
                  onClick={() => void handleAddManualAttendance()}
                >
                  {isSavingManualAttendance ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar asistencia"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              if (!open && !isUpdatingStudent) {
                setIsEditDialogOpen(false);
                setEditingStudent(null);
              }
            }}
          >
            <DialogContent className="max-h-[92vh] overflow-y-auto bg-card sm:max-w-[720px] border-primary/20">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic text-primary">
                  Editar Atleta
                </DialogTitle>
              </DialogHeader>

              {editingStudent && (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Nombre Completo</Label>

                    <Input
                      id="edit-name"
                      value={editingStudent.nombre}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          nombre: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Tarjetas RFID vinculadas
                    </Label>

                    <div className="space-y-2 rounded-md border border-primary/10 bg-background/50 p-3">
                      {(() => {
                        const tarjetas = Array.from(
                          new Set(
                            [
                              ...(editingStudent.rfids || []),
                              editingStudent.rfid || "",
                            ]
                              .map((codigo) => String(codigo).trim().toUpperCase())
                              .filter(Boolean),
                          ),
                        );

                        return tarjetas.length > 0 ? (
                          <div className="space-y-2">
                            {tarjetas.map((codigo) => (
                              <div
                                key={codigo}
                                className="flex min-h-10 items-center gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2"
                              >
                                <CreditCard className="h-4 w-4 shrink-0 text-emerald-500" />
                                <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {codigo}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingRfid !== null}
                                  onClick={() =>
                                    void handleDeleteStudentRfid(codigo)
                                  }
                                  className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-500/10 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                                  title={`Eliminar RFID ${codigo}`}
                                  aria-label={`Eliminar RFID ${codigo}`}
                                >
                                  {deletingRfid === codigo ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Sin tarjetas vinculadas
                          </span>
                        );
                      })()}

                      <p className="text-[11px] text-muted-foreground">
                        Usa la papelera para desvincular una tarjeta. Para agregar
                        otra, cierra esta ventana y pulsa el icono de cadena junto
                        al alumno.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-sede">Sede</Label>

                    <Select value={editingStudent.sede} disabled>
                      <SelectTrigger id="edit-sede">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="MMA">MMA</SelectItem>

                        <SelectItem value="CAUCEL">CAUCEL</SelectItem>

                        <SelectItem value="JUAN_PABLO">JUAN PABLO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                    <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">
                      Progreso deportivo
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-discipline">Disciplina</Label>
                        <Input
                          id="edit-discipline"
                          list="edit-disciplines-albatros"
                          placeholder="Selecciona o escribe una disciplina"
                          value={editingStudent.disciplina || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              disciplina: event.target.value,
                            })
                          }
                        />
                        <datalist id="edit-disciplines-albatros">
                          {DISCIPLINAS_ALBATROS.map((disciplina) => (
                            <option key={disciplina} value={disciplina} />
                          ))}
                        </datalist>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-grade">Grado / nivel</Label>
                        <Input
                          id="edit-grade"
                          placeholder="Cinta blanca, intermedio..."
                          value={editingStudent.grado || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              grado: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-promotion">Última promoción</Label>
                        <Input
                          id="edit-promotion"
                          type="date"
                          value={editingStudent.fechaPromocion || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              fechaPromocion: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-goal">Objetivo</Label>
                        <Input
                          id="edit-goal"
                          placeholder="Competir, bajar de peso..."
                          value={editingStudent.objetivo || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              objetivo: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-weight">Peso actual (kg)</Label>
                        <Input
                          id="edit-weight"
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingStudent.pesoActual}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              pesoActual: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-target-weight">
                          Peso objetivo (kg)
                        </Label>
                        <Input
                          id="edit-target-weight"
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingStudent.pesoObjetivo}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              pesoObjetivo: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-competition">
                          Próxima competencia
                        </Label>
                        <Input
                          id="edit-competition"
                          placeholder="Nombre del torneo"
                          value={editingStudent.proximaCompetencia || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              proximaCompetencia: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-competition-date">Fecha</Label>
                        <Input
                          id="edit-competition-date"
                          type="date"
                          value={editingStudent.fechaCompetencia || ""}
                          onChange={(event) =>
                            setEditingStudent({
                              ...editingStudent,
                              fechaCompetencia: event.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-phone">Teléfono</Label>

                      <Input
                        id="edit-phone"
                        value={editingStudent.telefono || ""}
                        onChange={(event) =>
                          setEditingStudent({
                            ...editingStudent,
                            telefono: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-payday">Día de Pago</Label>

                      <Input
                        id="edit-payday"
                        type="number"
                        min="1"
                        max="31"
                        value={editingStudent.diaPago}
                        onChange={(event) =>
                          setEditingStudent({
                            ...editingStudent,
                            diaPago: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-amount">Monto Pago ($)</Label>

                      <Input
                        id="edit-amount"
                        type="number"
                        min="0"
                        value={editingStudent.montoPago}
                        onChange={(event) =>
                          setEditingStudent({
                            ...editingStudent,
                            montoPago: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-status">Estado de Pago</Label>

                      <Select value={editingStudent.estadoPago} disabled>
                        <SelectTrigger id="edit-status">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="Falta de Pago">Pendiente</SelectItem>

                          <SelectItem value="Pagado">Pagado</SelectItem>

                          <SelectItem value="Retraso">Retraso</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Cambia el estado desde la tabla para registrar correctamente
                        el historial.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="edit-affiliate"
                      checked={editingStudent.esAfiliado}
                      onCheckedChange={(checked) =>
                        setEditingStudent({
                          ...editingStudent,
                          esAfiliado: checked === true,
                        })
                      }
                    />

                    <Label htmlFor="edit-affiliate" className="cursor-pointer">
                      ¿Es afiliado Albatros?
                    </Label>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  className="w-full font-bold uppercase tracking-widest"
                  onClick={handleUpdateStudent}
                  disabled={isUpdatingStudent}
                >
                  {isUpdatingStudent ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={paymentStudent !== null}
            onOpenChange={(open) => {
              if (!open && !isSavingPayment) {
                setPaymentStudent(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar pago</DialogTitle>
                <DialogDescription>
                  {paymentStudent
                    ? `Pago de ${paymentStudent.nombre}.`
                    : "Completa los datos del pago."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payment-amount">Monto recibido ($)</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payment-method">Método</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value: PaymentMethod) =>
                        setPaymentMethod(value)
                      }
                    >
                      <SelectTrigger id="payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payment-period">Mes correspondiente</Label>
                    <Input
                      id="payment-period"
                      type="month"
                      value={paymentPeriod}
                      onChange={(event) => setPaymentPeriod(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payment-date">Fecha del pago</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  className="w-full font-bold uppercase"
                  disabled={isSavingPayment}
                  onClick={handleConfirmPayment}
                >
                  {isSavingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Confirmar pago"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={historyStudent !== null}
            onOpenChange={(open) => {
              if (!open) {
                setHistoryStudent(null);
                setPaymentHistory([]);
              }
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Historial de pagos</DialogTitle>
                <DialogDescription>
                  {historyStudent?.nombre || "Alumno seleccionado"}
                </DialogDescription>
              </DialogHeader>

              {isLoadingPaymentHistory ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                  Todavía no hay pagos guardados en el historial.
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-3">
                    {paymentHistory.map((pago) => (
                      <div
                        key={pago.id}
                        className="rounded-lg border border-primary/10 bg-background/50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{pago.periodo}</p>
                            <p className="text-xs text-muted-foreground">
                              {pago.metodoPago}
                            </p>
                          </div>
                          <span className="font-black text-green-500">
                            ${Number(pago.monto || 0).toLocaleString("es-MX")}
                          </span>
                        </div>

                        <p className="mt-3 border-t border-primary/10 pt-3 text-xs text-muted-foreground">
                          Fecha:{" "}
                          {pago.fecha?.toDate
                            ? format(pago.fecha.toDate(), "dd/MM/yyyy", {
                                locale: es,
                              })
                            : "Sin fecha"}
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setReceiptPayment(pago)}
                          >
                            <DollarSign className="mr-2 h-3.5 w-3.5" />
                            Recibo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEditPayment(pago)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeletePayment(pago)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={editingPayment !== null}
            onOpenChange={(open) => {
              if (!open && !isUpdatingPayment) setEditingPayment(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar pago</DialogTitle>
                <DialogDescription>
                  Corrige los datos del pago. El historial y la recaudación se
                  actualizarán automáticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-amount">Monto pagado</Label>
                  <Input
                    id="edit-payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPaymentAmount}
                    onChange={(event) => setEditPaymentAmount(event.target.value)}
                    disabled={isUpdatingPayment}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-method">Método de pago</Label>
                  <Select
                    value={editPaymentMethod}
                    onValueChange={(value) =>
                      setEditPaymentMethod(value as PaymentMethod)
                    }
                    disabled={isUpdatingPayment}
                  >
                    <SelectTrigger id="edit-payment-method">
                      <SelectValue placeholder="Selecciona un método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-period">Periodo</Label>
                  <Input
                    id="edit-payment-period"
                    type="month"
                    value={editPaymentPeriod}
                    onChange={(event) => setEditPaymentPeriod(event.target.value)}
                    disabled={isUpdatingPayment}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-date">Fecha de pago</Label>
                  <Input
                    id="edit-payment-date"
                    type="date"
                    value={editPaymentDate}
                    onChange={(event) => setEditPaymentDate(event.target.value)}
                    disabled={isUpdatingPayment}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdatingPayment}
                  onClick={() => setEditingPayment(null)}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={() => void handleUpdatePayment()}
                >
                  {isUpdatingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar cambios"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isMonthlyComparisonOpen}
            onOpenChange={setIsMonthlyComparisonOpen}
          >
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Comparación de los últimos seis meses</DialogTitle>
                <DialogDescription>
                  Recaudación efectiva, asistencias únicas y nuevos alumnos ·{" "}
                  {userSede?.replace("_", " ") || "Sede actual"}
                </DialogDescription>
              </DialogHeader>

              {isLoadingMonthlyComparison ? (
                <div className="flex justify-center p-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : monthlyComparison.length === 0 ? (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                  No fue posible obtener datos para la comparación.
                </div>
              ) : (
                <ScrollArea className="max-h-[65vh] pr-4">
                  <div className="space-y-3">
                    {monthlyComparison.map((mes) => (
                      <div
                        key={mes.periodo}
                        className="rounded-lg border border-primary/10 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="font-black uppercase">{mes.etiqueta}</p>
                          <Badge variant="outline">
                            {mes.nuevosAlumnos}{" "}
                            {mes.nuevosAlumnos === 1
                              ? "nuevo alumno"
                              : "nuevos alumnos"}
                          </Badge>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                Recaudación
                              </span>
                              <strong className="text-green-500">
                                ${mes.recaudacion.toLocaleString("es-MX")}
                              </strong>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-green-500/10">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{
                                  width: `${Math.max(
                                    mes.recaudacion > 0 ? 3 : 0,
                                    (mes.recaudacion / maxRecaudacionComparacion) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                Asistencias
                              </span>
                              <strong className="text-blue-500">
                                {mes.asistencias}
                              </strong>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-blue-500/10">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.max(
                                    mes.asistencias > 0 ? 3 : 0,
                                    (mes.asistencias / maxAsistenciasComparacion) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={receiptPayment !== null}
            onOpenChange={(open) => {
              if (!open) setReceiptPayment(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              {receiptPayment && (
                <>
                  <DialogHeader>
                    <DialogTitle>Recibo de pago</DialogTitle>
                    <DialogDescription>
                      Comprobante interno · Folio {receiptPayment.id.toUpperCase()}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-xl border-2 border-primary/20 bg-background p-5">
                    <div className="flex items-start justify-between gap-4 border-b pb-4">
                      <div>
                        <p className="text-xl font-black">ALBATROS</p>
                        <p className="text-xs text-muted-foreground">
                          {receiptPayment.sede.replace("_", " ")}
                        </p>
                      </div>
                      <Badge className="bg-green-500/15 text-green-500">
                        PAGADO
                      </Badge>
                    </div>

                    <p className="my-5 text-4xl font-black text-green-500">
                      ${Number(receiptPayment.monto || 0).toLocaleString("es-MX")}
                    </p>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4 border-b pb-2">
                        <span className="text-muted-foreground">Alumno</span>
                        <strong className="text-right">
                          {receiptPayment.nombre}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b pb-2">
                        <span className="text-muted-foreground">Periodo</span>
                        <strong>{receiptPayment.periodo}</strong>
                      </div>
                      <div className="flex justify-between gap-4 border-b pb-2">
                        <span className="text-muted-foreground">Método</span>
                        <strong>{receiptPayment.metodoPago}</strong>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Fecha</span>
                        <strong>
                          {format(obtenerFechaPago(receiptPayment), "dd/MM/yyyy", {
                            locale: es,
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => enviarReciboWhatsApp(receiptPayment)}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      onClick={() => imprimirRecibo(receiptPayment)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Imprimir / PDF
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={profileStudent !== null}
            onOpenChange={(open) => {
              if (!open) {
                setProfileStudent(null);
                setProfilePayments([]);
              }
            }}
          >
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              {profileStudent && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/30">
                        {profileStudent.fotoUrl ? (
                          <Image
                            src={profileStudent.fotoUrl}
                            alt={profileStudent.nombre}
                            fill
                            sizes="64px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <Users className="h-7 w-7 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-black uppercase">
                          {profileStudent.nombre}
                        </DialogTitle>
                        <DialogDescription>
                          Ficha individual · {profileStudent.sede.replace("_", " ")}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase text-muted-foreground">
                          Asistencia mensual
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-black">
                          {attendanceDataMap[profileStudent.id]?.count || 0}
                        </p>
                        <Progress
                          className="mt-3 h-2"
                          value={Math.min(
                            ((attendanceDataMap[profileStudent.id]?.count || 0) /
                              12) *
                              100,
                            100,
                          )}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {Math.round(
                            Math.min(
                              ((attendanceDataMap[profileStudent.id]?.count || 0) /
                                12) *
                                100,
                              100,
                            ),
                          )}
                          % de la meta mensual
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase text-muted-foreground">
                          Estado de pago
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {getStatusBadge(profileStudent)}
                        <p className="mt-3 text-sm">
                          Día de pago: <strong>{profileStudent.diaPago}</strong>
                        </p>
                        <p className="text-sm">
                          Mensualidad:{" "}
                          <strong>
                            $
                            {Number(profileStudent.montoPago || 0).toLocaleString(
                              "es-MX",
                            )}
                          </strong>
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase text-muted-foreground">
                          Contacto
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {profileStudent.telefono || "Sin teléfono"}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full border-green-500/30 text-green-600 dark:text-green-400"
                          disabled={!profileStudent.telefono}
                          onClick={() => abrirWhatsApp(profileStudent, "general")}
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          WhatsApp
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Trophy className="h-4 w-4 text-primary" />
                          Progreso deportivo
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Datos de entrenamiento, objetivo y próxima meta.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const alumno = profileStudent;
                          setProfileStudent(null);
                          window.setTimeout(
                            () => handleOpenEditDialog(alumno),
                            220,
                          );
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Disciplina
                        </p>
                        <p className="mt-1 font-bold">
                          {profileStudent.disciplina || "Sin registrar"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {profileStudent.grado || "Grado pendiente"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          <Target className="h-3 w-3" />
                          Objetivo
                        </p>
                        <p className="mt-1 font-bold">
                          {profileStudent.objetivo || "Sin objetivo definido"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Promoción: {profileStudent.fechaPromocion || "Pendiente"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          <Weight className="h-3 w-3" />
                          Peso
                        </p>
                        <p className="mt-1 font-bold">
                          {profileStudent.pesoActual
                            ? `${profileStudent.pesoActual} kg`
                            : "Sin registrar"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Meta:{" "}
                          {profileStudent.pesoObjetivo
                            ? `${profileStudent.pesoObjetivo} kg`
                            : "Pendiente"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          Competencia
                        </p>
                        <p className="mt-1 font-bold">
                          {profileStudent.proximaCompetencia || "Sin programar"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {profileStudent.fechaCompetencia || "Fecha pendiente"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-primary/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CreditCard className="h-4 w-4" />
                          Tarjetas vinculadas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(profileStudent.rfids?.length
                          ? profileStudent.rfids
                          : profileStudent.rfid
                            ? [profileStudent.rfid]
                            : []
                        ).length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin tarjetas vinculadas.
                          </p>
                        ) : (
                          (profileStudent.rfids?.length
                            ? profileStudent.rfids
                            : [profileStudent.rfid as string]
                          ).map((codigo) => (
                            <div
                              key={codigo}
                              className="rounded-md bg-green-500/10 px-3 py-2 font-mono text-xs text-green-500"
                            >
                              {codigo}
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-primary/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CalendarDays className="h-4 w-4" />
                          Días asistidos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(attendanceDataMap[profileStudent.id]?.history || [])
                          .length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin asistencias este mes.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(
                              attendanceDataMap[profileStudent.id]?.history || []
                            ).map((fecha) => (
                              <Badge key={fecha.getTime()} variant="secondary">
                                {format(fecha, "dd MMM", { locale: es })}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-primary/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-4 w-4" />
                        Pagos anteriores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingProfilePayments ? (
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      ) : profilePayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Sin pagos guardados en el historial.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-primary/10 bg-secondary/10 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                Evolución de pagos
                              </p>
                              <Badge variant="outline">
                                Últimos {Math.min(profilePayments.length, 6)}
                              </Badge>
                            </div>
                            <div className="flex h-28 items-end gap-2">
                              {profilePayments
                                .slice(0, 6)
                                .reverse()
                                .map((pago) => {
                                  const maximo = Math.max(
                                    ...profilePayments
                                      .slice(0, 6)
                                      .map((item) => Number(item.monto || 0)),
                                    1,
                                  );
                                  const altura = Math.max(
                                    (Number(pago.monto || 0) / maximo) * 100,
                                    8,
                                  );

                                  return (
                                    <div
                                      key={`chart-${pago.id}`}
                                      className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                                      title={`${pago.periodo}: $${Number(
                                        pago.monto || 0,
                                      ).toLocaleString("es-MX")}`}
                                    >
                                      <span className="text-[9px] font-bold opacity-0 transition-opacity group-hover:opacity-100">
                                        $
                                        {Number(pago.monto || 0).toLocaleString(
                                          "es-MX",
                                        )}
                                      </span>
                                      <div
                                        className="w-full rounded-t-md bg-primary/75 transition-all duration-500 group-hover:bg-primary"
                                        style={{ height: `${altura}%` }}
                                      />
                                      <span className="max-w-full truncate text-[9px] text-muted-foreground">
                                        {typeof pago.periodo === "string"
                                          ? pago.periodo.slice(5) || pago.periodo
                                          : "—"}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {profilePayments.map((pago) => (
                              <div
                                key={pago.id}
                                className="flex items-center justify-between rounded-md border p-3"
                              >
                                <div>
                                  <p className="font-bold">{pago.periodo}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {pago.metodoPago}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-green-500">
                                    $
                                    {Number(pago.monto || 0).toLocaleString(
                                      "es-MX",
                                    )}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Abrir recibo"
                                    onClick={() => setReceiptPayment(pago)}
                                  >
                                    <DollarSign className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Editar pago"
                                    onClick={() => handleStartEditPayment(pago)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Cancelar pago"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => void handleDeletePayment(pago)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-red-500/20 bg-red-500/5">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Información de emergencia
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>
                          Tipo de sangre:{" "}
                          <strong>
                            {profileStudent.emergencia?.tipoSangre ||
                              "No registrado"}
                          </strong>
                        </p>
                        <p>
                          Contacto:{" "}
                          <strong>
                            {profileStudent.emergencia?.contactoNombre ||
                              "No registrado"}
                          </strong>
                        </p>
                        <p>
                          Teléfono de emergencia:{" "}
                          <strong>
                            {profileStudent.emergencia?.contactoTelefono ||
                              "No registrado"}
                          </strong>
                        </p>
                        <p>
                          Alergias:{" "}
                          <strong>
                            {profileStudent.emergencia?.alergias ||
                              "No registradas"}
                          </strong>
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          if (profileStudent.emergenciaToken) {
                            window.open(
                              `/emergencia/${profileStudent.emergenciaToken}`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          } else {
                            setProfileStudent(null);
                            openEmergencyProfile(profileStudent);
                          }
                        }}
                      >
                        {profileStudent.emergenciaToken
                          ? "Abrir ficha de emergencia"
                          : "Crear ficha en Archivero"}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </DialogContent>
          </Dialog>

    </>
  );
}
