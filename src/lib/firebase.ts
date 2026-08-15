import { initializeApp, getApps, getApp } from 'firebase/app';

import { getFirestore } from 'firebase/firestore';

import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const storage = getStorage(app);
