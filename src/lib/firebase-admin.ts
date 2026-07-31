import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/*
 * El cliente de la web usa este proyecto. No se debe tomar
 * GOOGLE_CLOUD_PROJECT del entorno de Firebase Studio, porque puede apuntar al
 * proyecto temporal del workspace y hacer que los tokens válidos de ALBATROS
 * aparezcan como "sesión inválida".
 */
const ALBATROS_PROJECT_ID = 'albatros-5de2d';
const adminClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  '\n',
);

/*
 * Vercel no proporciona credenciales de Google automáticamente. Cuando las
 * variables existen usamos la cuenta de servicio; en entornos de Google se
 * mantiene applicationDefault como alternativa.
 */
const adminCredential =
  adminClientEmail && adminPrivateKey
    ? cert({
        projectId: ALBATROS_PROJECT_ID,
        clientEmail: adminClientEmail,
        privateKey: adminPrivateKey,
      })
    : applicationDefault();

const adminApp =
  getApps().find((app) => app.name === 'albatros-admin') ??
  initializeApp({
    credential: adminCredential,
    projectId: ALBATROS_PROJECT_ID,
  }, 'albatros-admin');

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
