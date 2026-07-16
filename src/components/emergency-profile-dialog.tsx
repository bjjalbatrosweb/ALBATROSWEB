'use client';

import {
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import {
  useFirestore,
} from '@/firebase';

import React, { useEffect, useState } from 'react';
import {
  Camera,
  FileHeart,
  HeartPulse,
  Link2,
  Phone,
  ShieldAlert,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AlumnoEmergencia = {
  id: string;
  nombre: string;
  telefono?: string;
  sede: string;
  fotoUrl?: string;
  emergenciaToken?: string;
};

type FormularioEmergencia = {
  fotoUrl: string;
  fechaNacimiento: string;
  tipoSangre: string;
  alergias: string;
  condicionesMedicas: string;
  medicamentos: string;
  contactoNombre: string;
  contactoParentesco: string;
  contactoTelefono: string;
  indicaciones: string;
};

const FORMULARIO_VACIO: FormularioEmergencia = {
  fotoUrl: '',
  fechaNacimiento: '',
  tipoSangre: '',
  alergias: '',
  condicionesMedicas: '',
  medicamentos: '',
  contactoNombre: '',
  contactoParentesco: '',
  contactoTelefono: '',
  indicaciones: '',
};

function generarToken() {
  return crypto.randomUUID().replaceAll('-', '');
}

type Props = {
  alumno: AlumnoEmergencia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmergencyProfileDialog({
  alumno,
  open,
  onOpenChange,
}: Props) {
  const [formulario, setFormulario] =
    useState<FormularioEmergencia>(FORMULARIO_VACIO);
    const firestore = useFirestore();

  useEffect(() => {
    if (!alumno) {
      setFormulario(FORMULARIO_VACIO);
      return;
    }

    setFormulario({
      ...FORMULARIO_VACIO,
      fotoUrl: alumno.fotoUrl || '',
      contactoTelefono: alumno.telefono || '',
    });
  }, [alumno]);

  const actualizarCampo = (
    campo: keyof FormularioEmergencia,
    valor: string
  ) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const handleContinuar = async () => {
    if (!firestore || !alumno) {
      return;
    }
  
    try {
      const token =
        alumno.emergenciaToken ||
        generarToken();
  
      await updateDoc(
        doc(
          firestore,
          'Alumnos',
          alumno.id
        ),
        {
          fotoUrl:
            formulario.fotoUrl,
  
          emergenciaToken:
            token,
  
          emergencia: {
            fechaNacimiento:
              formulario.fechaNacimiento,
  
            tipoSangre:
              formulario.tipoSangre,
  
            alergias:
              formulario.alergias,
  
            condicionesMedicas:
              formulario.condicionesMedicas,
  
            medicamentos:
              formulario.medicamentos,
  
            contactoNombre:
              formulario.contactoNombre,
  
            contactoParentesco:
              formulario.contactoParentesco,
  
            contactoTelefono:
              formulario.contactoTelefono,
  
            indicaciones:
              formulario.indicaciones,
  
            activo: true,
  
            actualizadoEn:
              serverTimestamp(),
          },
        }
      );
  
      alert(
        'Ficha guardada correctamente.'
      );
  
      onOpenChange(false);
    } catch (error) {
      console.error(error);
  
      alert(
        'No se pudo guardar la ficha.'
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-primary/20 bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase italic tracking-tighter text-primary">
            <FileHeart className="h-6 w-6" />
            Ficha de emergencia
          </DialogTitle>

          <DialogDescription>
            Información médica y contacto de emergencia de{' '}
            <strong>{alumno?.nombre || 'el alumno'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-3">
          <section className="grid gap-4 rounded-xl border border-primary/10 bg-background/30 p-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />

              <h2 className="font-black uppercase italic">
                Fotografía
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-[130px_1fr]">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-secondary/30">
                {formulario.fotoUrl ? (
                  <img
                    src={formulario.fotoUrl}
                    alt={alumno?.nombre || 'Alumno'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-14 w-14 text-muted-foreground/30" />
                )}
              </div>

              <div className="grid content-center gap-2">
                <Label htmlFor="foto-url">
                  URL de la fotografía
                </Label>

                <Input
                  id="foto-url"
                  value={formulario.fotoUrl}
                  onChange={(event) =>
                    actualizarCampo(
                      'fotoUrl',
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                />

                <p className="text-xs text-muted-foreground">
                  En esta primera versión usaremos una URL. Más adelante
                  podemos añadir carga directa de imágenes.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-primary/10 bg-background/30 p-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />

              <h2 className="font-black uppercase italic">
                Información médica
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fecha-nacimiento">
                  Fecha de nacimiento
                </Label>

                <Input
                  id="fecha-nacimiento"
                  type="date"
                  value={formulario.fechaNacimiento}
                  onChange={(event) =>
                    actualizarCampo(
                      'fechaNacimiento',
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipo-sangre">
                  Tipo de sangre
                </Label>

                <Select
                  value={formulario.tipoSangre}
                  onValueChange={(valor) =>
                    actualizarCampo('tipoSangre', valor)
                  }
                >
                  <SelectTrigger id="tipo-sangre">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="DESCONOCIDO">
                      Desconocido
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alergias">
                Alergias
              </Label>

              <Input
                id="alergias"
                value={formulario.alergias}
                onChange={(event) =>
                  actualizarCampo(
                    'alergias',
                    event.target.value
                  )
                }
                placeholder="Ej. Penicilina, alimentos, ninguna..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="condiciones">
                Condiciones médicas
              </Label>

              <Input
                id="condiciones"
                value={formulario.condicionesMedicas}
                onChange={(event) =>
                  actualizarCampo(
                    'condicionesMedicas',
                    event.target.value
                  )
                }
                placeholder="Ej. Asma, diabetes, epilepsia..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="medicamentos">
                Medicamentos importantes
              </Label>

              <Input
                id="medicamentos"
                value={formulario.medicamentos}
                onChange={(event) =>
                  actualizarCampo(
                    'medicamentos',
                    event.target.value
                  )
                }
                placeholder="Ej. Inhalador, insulina, ninguno..."
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-primary/10 bg-background/30 p-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />

              <h2 className="font-black uppercase italic">
                Contacto de emergencia
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contacto-nombre">
                  Nombre
                </Label>

                <Input
                  id="contacto-nombre"
                  value={formulario.contactoNombre}
                  onChange={(event) =>
                    actualizarCampo(
                      'contactoNombre',
                      event.target.value
                    )
                  }
                  placeholder="Nombre completo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="parentesco">
                  Parentesco
                </Label>

                <Input
                  id="parentesco"
                  value={formulario.contactoParentesco}
                  onChange={(event) =>
                    actualizarCampo(
                      'contactoParentesco',
                      event.target.value
                    )
                  }
                  placeholder="Padre, madre, tutor..."
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contacto-telefono">
                Teléfono
              </Label>

              <Input
                id="contacto-telefono"
                type="tel"
                value={formulario.contactoTelefono}
                onChange={(event) =>
                  actualizarCampo(
                    'contactoTelefono',
                    event.target.value
                  )
                }
                placeholder="9991234567"
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-primary/10 bg-background/30 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />

              <h2 className="font-black uppercase italic">
                Indicaciones adicionales
              </h2>
            </div>

            <textarea
              value={formulario.indicaciones}
              onChange={(event) =>
                actualizarCampo(
                  'indicaciones',
                  event.target.value
                )
              }
              placeholder="Indicaciones relevantes en caso de emergencia..."
              className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </section>

          <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 p-4">
  <div className="flex items-center gap-2 text-primary">
    <Link2 className="h-5 w-5" />

    <p className="font-black uppercase italic">
      Enlace NFC
    </p>
  </div>

  {alumno?.emergenciaToken ? (
    <>
      <Input
        readOnly
        className="mt-4"
        value={`${window.location.origin}/emergencia/${alumno.emergenciaToken}`}
      />

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(
            `${window.location.origin}/emergencia/${alumno.emergenciaToken}`
          );

          alert('URL copiada.');
        }}
      >
        Copiar URL
      </Button>
    </>
  ) : (
    <p className="mt-2 text-sm text-muted-foreground">
      Guarda la ficha por primera vez para generar el enlace NFC.
    </p>
  )}
</div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            className="font-black uppercase"
            onClick={handleContinuar}
          >
            Revisar información
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

