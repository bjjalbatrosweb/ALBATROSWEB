/**
 * Este archivo ha sido desactivado para evitar conflictos de rutas con /src/app/recompensas/page.tsx.
 * La página de Recompensas es ahora una sección independiente y pública.
 */
import { redirect } from 'next/navigation';

export default function RecompensasRedirect() {
  redirect('/recompensas');
  return null;
}
