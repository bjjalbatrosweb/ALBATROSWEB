'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Esta ruta sirve como redireccionamiento interno para evitar conflictos
 * de rutas paralelas con /recompensas en la raíz.
 */
export default function RecompensaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/recompensas');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
