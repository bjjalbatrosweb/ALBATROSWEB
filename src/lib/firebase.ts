import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Inicialización de Firebase para entornos de servidor (Route Handlers).
 * Se utiliza el SDK de cliente configurado para ejecutarse en el servidor de Next.js.
 */
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
