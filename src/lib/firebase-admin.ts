import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/*
 * El cliente de la web usa este proyecto. No se debe tomar
 * GOOGLE_CLOUD_PROJECT del entorno de Firebase Studio, porque puede apuntar al
 * proyecto temporal del workspace y hacer que los tokens válidos de ALBATROS
 * aparezcan como "sesión inválida".
 */
const ALBATROS_PROJECT_ID = 'albatros-5de2d';

const adminApp =
  getApps().find((app) => app.name === 'albatros-admin') ??
  initializeApp({
    credential: applicationDefault(),
    projectId: ALBATROS_PROJECT_ID,
  }, 'albatros-admin');

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
