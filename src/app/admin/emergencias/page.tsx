'use client';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Copy,
  ExternalLink,
  FileHeart,
  FolderHeart,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  collection,
  query,
  where,
} from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmergencyProfileDialog } from '@/components/emergency-profile-dialog';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';

type Sede =
  | 'MMA'
  | 'CAUCEL'
  | 'JUAN_PABLO';

  type Alumno = {
    id: string;
    nombre: string;
    telefono?: string;
    rfid?: string;
    sede: Sede;
  
    fotoUrl?: string;
  
    emergenciaToken?: string;
  
    emergencia?: {
      fechaNacimiento?: string;
  
      tipoSangre?: string;
  
      alergias?: string;
  
      condicionesMedicas?: string;
  
      medicamentos?: string;
  
      contactoNombre?: string;
  
      contactoParentesco?: string;
  
      contactoTelefono?: string;
  
      indicaciones?: string;
  
      activo?: boolean;
    };
  };

const SEDES_VALIDAS: Sede[] = [
  'MMA',
  'CAUCEL',
  'JUAN_PABLO',
];

function normalizarSede(
  valor: unknown
): Sede {
  if (typeof valor !== 'string') {
    return 'MMA';
  }

  const sede = valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  return SEDES_VALIDAS.includes(
    sede as Sede
  )
    ? (sede as Sede)
    : 'MMA';
}

function obtenerIniciales(
  nombre: string
): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) =>
      parte
        .charAt(0)
        .toUpperCase()
    )
    .join('');
}

export default function EmergenciasPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const [
    userSede,
    setUserSede,
  ] = useState<Sede | null>(
    null
  );

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState<Alumno | null>(
    null
  );

  const [
    isEmergencyDialogOpen,
    setIsEmergencyDialogOpen,
  ] = useState(false);

  useEffect(() => {
    const sedeGuardada =
      localStorage.getItem(
        'userSede'
      );

    if (!sedeGuardada) {
      router.push(
        '/login-profesor'
      );

      return;
    }

    setUserSede(
      normalizarSede(
        sedeGuardada
      )
    );
  }, [router]);

  const alumnosQuery =
    useMemoFirebase(() => {
      if (
        !firestore ||
        !userSede
      ) {
        return null;
      }

      return query(
        collection(
          firestore,
          'Alumnos'
        ),
        where(
          'sede',
          '==',
          userSede
        )
      );
    }, [
      firestore,
      userSede,
    ]);

  const {
    data: alumnos,
    isLoading,
  } = useCollection<Alumno>(
    alumnosQuery
  );

  const alumnosFiltrados =
    useMemo(() => {
      const lista =
        alumnos ?? [];

      const termino =
        searchTerm
          .trim()
          .toLowerCase();

      return [...lista]
        .sort((a, b) =>
          (
            a.nombre || ''
          ).localeCompare(
            b.nombre || '',
            'es'
          )
        )
        .filter(
          (alumno) => {
            if (!termino) {
              return true;
            }

            return (
              alumno.nombre
                ?.toLowerCase()
                .includes(
                  termino
                ) ||
              alumno.telefono
                ?.toLowerCase()
                .includes(
                  termino
                ) ||
              alumno.rfid
                ?.toLowerCase()
                .includes(
                  termino
                )
            );
          }
        );
    }, [
      alumnos,
      searchTerm,
    ]);

  const handleEditarFicha = (
    alumno: Alumno
  ) => {
    setSelectedStudent(
      alumno
    );

    setIsEmergencyDialogOpen(
      true
    );
  };

  const obtenerUrlEmergencia = (
    token: string
  ): string => {
    if (typeof window === 'undefined') {
      return `/emergencia/${token}`;
    }
  
    return `${window.location.origin}/emergencia/${token}`;
  };
  
  const copiarUrlEmergencia = async (
    alumno: Alumno
  ) => {
    if (!alumno.emergenciaToken) {
      return;
    }
  
    const url = obtenerUrlEmergencia(
      alumno.emergenciaToken
    );
  
    try {
      await navigator.clipboard.writeText(url);
  
      alert(
        `URL copiada:\n${url}`
      );
    } catch (error) {
      console.error(
        'No se pudo copiar la URL:',
        error
      );
  
      alert(
        'No fue posible copiar la URL.'
      );
    }
  };
  
  const abrirFichaEmergencia = (
    alumno: Alumno
  ) => {
    if (!alumno.emergenciaToken) {
      return;
    }
  
    const url = obtenerUrlEmergencia(
      alumno.emergenciaToken
    );
  
    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleDialogChange = (
    open: boolean
  ) => {
    setIsEmergencyDialogOpen(
      open
    );

    if (!open) {
      setSelectedStudent(
        null
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 text-[10px] font-black uppercase italic text-primary"
            >
              <MapPin className="h-3 w-3" />

              Sede:{' '}
              {userSede ||
                '...'}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <FolderHeart className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-primary">
                Archivero de
                Emergencias
              </h1>

              <p className="text-muted-foreground">
                Fichas médicas,
                contactos y enlaces
                NFC de los alumnos.
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

          <Input
            value={
              searchTerm
            }
            onChange={(
              event
            ) =>
              setSearchTerm(
                event.target
                  .value
              )
            }
            placeholder="Buscar alumno, teléfono o RFID..."
            className="pl-9"
          />
        </div>
      </header>

      <Card className="border-primary/10 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-lg font-black uppercase italic">
              <ShieldCheck className="h-5 w-5 text-primary" />

              Alumnos de la sede
            </span>

            <Badge
              variant="secondary"
              className="font-black"
            >
              {
                alumnosFiltrados.length
              }
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ...Array(6),
              ].map(
                (
                  _,
                  index
                ) => (
                  <Skeleton
                    key={
                      index
                    }
                    className="h-48 w-full rounded-xl"
                  />
                )
              )}
            </div>
          ) : alumnosFiltrados.length ===
            0 ? (
            <div className="rounded-xl border border-dashed border-primary/20 py-16 text-center">
              <UserRound className="mx-auto h-12 w-12 text-muted-foreground/30" />

              <p className="mt-4 font-black uppercase italic text-muted-foreground">
                No se encontraron
                alumnos
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {alumnosFiltrados.map(
                (
                  alumno
                ) => (
                  <Card
                    key={
                      alumno.id
                    }
                    className="overflow-hidden border-primary/10 bg-background/30 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg"
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-secondary/40">
                        {alumno.fotoUrl ? (
                          <Image
                            src={
                              alumno.fotoUrl
                            }
                            alt={
                              alumno.nombre
                            }
                            fill
                            sizes="80px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-black italic text-primary/50">
                            {obtenerIniciales(
                              alumno.nombre
                            )}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-black uppercase italic">
                          {
                            alumno.nombre
                          }
                        </h2>

                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {alumno.telefono ||
                            'Sin teléfono'}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black uppercase"
                          >
                            {
                              alumno.sede
                            }
                          </Badge>

                          <Badge
                            variant={
                              alumno.emergenciaToken
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-[9px] font-black uppercase"
                          >
                            {alumno.emergenciaToken
                              ? 'Ficha creada'
                              : 'Sin ficha'}
                          </Badge>
                        </div>

                        <div className="mt-4 space-y-2">
  <Button
    type="button"
    className="w-full font-black uppercase tracking-wider"
    onClick={() =>
      handleEditarFicha(alumno)
    }
  >
    <FileHeart className="mr-2 h-4 w-4" />

    {alumno.emergenciaToken
      ? 'Editar ficha'
      : 'Crear ficha'}
  </Button>

  {alumno.emergenciaToken && (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        className="font-black uppercase text-[10px]"
        onClick={() => {
          void copiarUrlEmergencia(
            alumno
          );
        }}
      >
        <Copy className="mr-2 h-3.5 w-3.5" />
        Copiar URL
      </Button>

      <Button
        type="button"
        variant="outline"
        className="font-black uppercase text-[10px]"
        onClick={() =>
          abrirFichaEmergencia(
            alumno
          )
        }
      >
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        Abrir ficha
      </Button>
    </div>
  )}
</div>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <EmergencyProfileDialog
        alumno={
          selectedStudent
        }
        open={
          isEmergencyDialogOpen
        }
        onOpenChange={
          handleDialogChange
        }
      />
    </div>
  );
}
