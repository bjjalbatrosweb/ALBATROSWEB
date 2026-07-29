export type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
export type RolUsuario = 'admin' | 'profesor' | 'atleta';

export type PerfilAcceso = {
  rol: RolUsuario;
  activo: boolean;
  sede?: Sede | 'TODAS';
  sedes?: Sede[];
  alumnoId?: string;
  nombre?: string;
};

const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const ROLES_VALIDOS: RolUsuario[] = ['admin', 'profesor', 'atleta'];

export function normalizarPerfilAcceso(
  data: Record<string, unknown>,
): PerfilAcceso | null {
  const rol =
    typeof data.rol === 'string' ? data.rol.toLowerCase() : '';

  if (!ROLES_VALIDOS.includes(rol as RolUsuario)) return null;

  const sede =
    data.sede === 'TODAS' || SEDES_VALIDAS.includes(data.sede as Sede)
      ? (data.sede as Sede | 'TODAS')
      : undefined;
  const sedes = Array.isArray(data.sedes)
    ? data.sedes.filter((item): item is Sede =>
        SEDES_VALIDAS.includes(item as Sede),
      )
    : undefined;

  return {
    rol: rol as RolUsuario,
    activo: data.activo === true,
    sede,
    sedes,
    alumnoId:
      typeof data.alumnoId === 'string' ? data.alumnoId : undefined,
    nombre: typeof data.nombre === 'string' ? data.nombre : undefined,
  };
}

export function puedeAdministrarSede(
  perfil: PerfilAcceso,
  sede: Sede,
): boolean {
  if (!perfil.activo) return false;

  if (perfil.rol === 'admin') {
    return (
      perfil.sede === 'TODAS' ||
      perfil.sede === sede ||
      perfil.sedes?.includes(sede) === true
    );
  }

  return perfil.rol === 'profesor' && perfil.sede === sede;
}
