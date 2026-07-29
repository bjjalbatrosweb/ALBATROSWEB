import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp =
  getApps().find((app) => app.name === 'albatros-admin') ??
  initializeApp({
    credential: applicationDefault(),
    projectId:
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'albatros-5de2d',
  }, 'albatros-admin');

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
