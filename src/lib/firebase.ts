import { initializeApp, getApps, getApp } from 'firebase/app';

import { getFirestore } from 'firebase/firestore';

import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCvwaqwP5gVostBRCzNhLzHJrkMbqDoYuw',

  authDomain: 'albatros-5de2d.firebaseapp.com',

  databaseURL:
    'https://albatros-5de2d-default-rtdb.firebaseio.com',

  projectId: 'albatros-5de2d',

  storageBucket:
    'albatros-5de2d.firebasestorage.app',

  messagingSenderId:
    '893648271452',

  appId:
    '1:893648271452:web:4a7f6cbb7d9c70fa960e99',
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const storage = getStorage(app);