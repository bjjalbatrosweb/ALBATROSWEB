import type { Auth } from 'firebase/auth';
import type { Sede } from '@/lib/access-control';

export type AuditAction =
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'activar'
  | 'desactivar'
  | 'registrar_pago'
  | 'editar_pago'
  | 'cancelar_pago'
  | 'agregar_asistencia'
  | 'eliminar_asistencia'
  | 'reiniciar_asistencias';

type AuditEntry = {
  sede: Sede;
  action: AuditAction;
  entity: 'alumno' | 'pago' | 'asistencia' | 'rfid';
  entityId?: string;
  entityName?: string;
  summary: string;
  details?: Record<string, unknown>;
};

export async function recordAdminAudit(
  auth: Auth,
  entry: AuditEntry,
): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const response = await fetch('/api/admin/auditoria', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      console.error('No se pudo registrar la auditoría:', response.status);
    }
  } catch (error) {
    // Un fallo del historial nunca debe deshacer la operación administrativa.
    console.error('No se pudo registrar la auditoría:', error);
  }
}
