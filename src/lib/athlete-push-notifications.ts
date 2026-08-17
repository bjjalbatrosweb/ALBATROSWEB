'use client';

import { getApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from 'firebase/messaging';

export const ATHLETE_NOTIFICATION_PREFERENCE_KEY =
  'albatrosNotificacionesAtleta';

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

async function serviceWorkerRegistration() {
  const current = await navigator.serviceWorker.getRegistration('/');
  if (current) return current;

  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
}

async function messagingReady() {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !(await isSupported())
  ) {
    throw new Error('Este navegador no permite notificaciones push.');
  }

  if (!vapidKey) {
    throw new Error(
      'Las notificaciones todavía no están configuradas por la academia.',
    );
  }

  const registration = await serviceWorkerRegistration();
  const messaging = getMessaging(getApp());
  return { messaging, registration };
}

async function sendTokenToServer(
  user: User,
  token: string,
  method: 'POST' | 'DELETE',
) {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/notificaciones/dispositivo', {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, consentimiento: method === 'POST' }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    mensaje?: string;
  };

  if (!response.ok) {
    throw new Error(
      result.mensaje || 'No se pudo guardar la suscripción del dispositivo.',
    );
  }
}

async function currentToken() {
  const { messaging, registration } = await messagingReady();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('El navegador no generó una suscripción de notificaciones.');
  }

  return { messaging, token };
}

export async function enableAthletePushNotifications(user: User) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    localStorage.setItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY, 'false');
    throw new Error('El navegador no concedió permiso para las notificaciones.');
  }

  const { token } = await currentToken();
  await sendTokenToServer(user, token, 'POST');
  localStorage.setItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY, 'true');
}

export async function syncAthletePushNotifications(user: User) {
  if (
    Notification.permission !== 'granted' ||
    localStorage.getItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY) !== 'true'
  ) {
    return false;
  }

  const { token } = await currentToken();
  await sendTokenToServer(user, token, 'POST');
  return true;
}

export async function disableAthletePushNotifications(user: User) {
  try {
    if (Notification.permission === 'granted') {
      const { messaging, token } = await currentToken();
      await sendTokenToServer(user, token, 'DELETE');
      await deleteToken(messaging);
    }
  } finally {
    localStorage.setItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY, 'false');
  }
}

export async function listenForAthletePushNotifications() {
  const { messaging, registration } = await messagingReady();

  return onMessage(messaging, async (payload) => {
    const title = payload.data?.title || 'ALBATROS';
    const body = payload.data?.body || 'Tienes una nueva notificación.';
    const url = payload.data?.url || '/mi-academia';

    await registration.showNotification(title, {
      body,
      icon: '/milogo.png',
      badge: '/milogo.png',
      lang: 'es-MX',
      tag: payload.data?.tag || 'albatros-notification',
      data: { url },
    });
  });
}
