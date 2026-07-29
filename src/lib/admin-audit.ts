import type { Auth } from 'firebase/auth';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from 'firebase/firestore';
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
    const user = auth.currentUser;
    if (!user) return;

    const details = entry.details || {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    Object.entries(details).forEach(([key, value]) => {
      if (key.endsWith('Anterior')) {
        before[key.slice(0, -8)] = value;
      } else if (key.endsWith('Nuevo')) {
        after[key.slice(0, -5)] = value;
      }
    });

    await addDoc(
      collection(
        getFirestore(auth.app),
        'Auditoria',
        entry.sede,
        'movimientos',
      ),
      {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || '',
        entityName: entry.entityName || '',
        summary: entry.summary.slice(0, 240),
        reason: entry.summary.slice(0, 300),
        details,
        before: Object.keys(before).length ? before : null,
        after: Object.keys(after).length ? after : null,
        sede: entry.sede,
        actorUid: user.uid,
        actorName: user.displayName || user.email || 'Usuario',
        actorEmail: user.email || '',
        createdAt: serverTimestamp(),
      },
    );
  } catch (error) {
    // Un fallo del historial nunca debe deshacer la operación administrativa.
    console.error('No se pudo registrar la auditoría:', error);
  }
}
