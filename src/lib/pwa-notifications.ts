export const NOTIFICATION_PREFERENCE_KEY =
  'albatrosAdminNotificationsEnabled';
export const DAILY_NOTIFICATION_KEY = 'albatrosAdminLastDailyNotification';

export function notificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export function notificationsEnabled(): boolean {
  return (
    notificationsSupported() &&
    Notification.permission === 'granted' &&
    localStorage.getItem(NOTIFICATION_PREFERENCE_KEY) === 'true'
  );
}

export async function requestAlbatrosNotifications(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  localStorage.setItem(
    NOTIFICATION_PREFERENCE_KEY,
    String(permission === 'granted'),
  );

  return permission;
}

export function disableAlbatrosNotifications(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, 'false');
  }
}

export async function showAlbatrosNotification(
  title: string,
  options: NotificationOptions & { url?: string } = {},
): Promise<boolean> {
  if (!notificationsEnabled()) return false;

  const registration = await navigator.serviceWorker.ready;
  const { url = '/admin/dashboard', data, ...notificationOptions } = options;

  await registration.showNotification(title, {
    icon: '/milogo.png',
    badge: '/milogo.png',
    lang: 'es-MX',
    ...notificationOptions,
    data: {
      ...(data && typeof data === 'object' ? data : {}),
      url,
    },
  });

  return true;
}
