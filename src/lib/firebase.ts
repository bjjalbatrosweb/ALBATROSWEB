import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase proporcionada
const firebaseConfig = {
  apiKey: "AIzaSyCvwaqwP5gVostBRCzNhLzHJrkMbqDoYuw",
  authDomain: "albatros-5de2d.firebaseapp.com",
  databaseURL: "https://albatros-5de2d-default-rtdb.firebaseio.com",
  projectId: "albatros-5de2d",
  storageBucket: "albatros-5de2d.firebasestorage.app",
  messagingSenderId: "893648271452",
  appId: "1:893648271452:web:4a7f6cbb7d9c70fa960e99"
};

// Inicializar Firebase (evita inicializaciones duplicadas)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Exportar Firestore como db
export const db = getFirestore(app);
