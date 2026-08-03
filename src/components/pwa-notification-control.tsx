'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  disableAlbatrosNotifications,
  NOTIFICATION_PREFERENCE_KEY,
  notificationsSupported,
  requestAlbatrosNotifications,
  showAlbatrosNotification,
} from '@/lib/pwa-notifications';

export function PwaNotificationControl() {
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const supported = notificationsSupported();
    setIsSupported(supported);
    setIsEnabled(
      supported &&
        Notification.permission === 'granted' &&
        localStorage.getItem(NOTIFICATION_PREFERENCE_KEY) === 'true',
    );
  }, []);

  if (!isSupported) return null;

  const toggleNotifications = async () => {
    if (isRequesting) return;

    if (isEnabled) {
      disableAlbatrosNotifications();
      setIsEnabled(false);
      toast({
        title: 'Avisos desactivados',
        description:
          'La aplicación seguirá funcionando normalmente sin notificaciones.',
      });
      return;
    }

    try {
      setIsRequesting(true);
      const permission = await requestAlbatrosNotifications();

      if (permission === 'granted') {
        setIsEnabled(true);
        toast({
          title: 'Avisos activados',
          description: 'ALBATROS podrá mostrar alertas en este dispositivo.',
        });
        await showAlbatrosNotification('Avisos de ALBATROS activados', {
          body: 'Recibirás recordatorios administrativos importantes.',
          tag: 'albatros-notifications-enabled',
        });
      } else {
        setIsEnabled(false);
        toast({
          variant: 'destructive',
          title: 'Permiso no concedido',
          description:
            'Puedes habilitarlo después desde los permisos del navegador.',
        });
      }
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void toggleNotifications()}
      disabled={isRequesting}
      title={isEnabled ? 'Desactivar avisos' : 'Activar avisos de la aplicación'}
      aria-label={
        isEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'
      }
      className={isEnabled ? 'text-primary' : 'text-muted-foreground'}
    >
      {isRequesting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isEnabled ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
    </Button>
  );
}
