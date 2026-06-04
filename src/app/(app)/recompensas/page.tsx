"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RecompensasRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/recompensas');
  }, [router]);

  return null;
}
