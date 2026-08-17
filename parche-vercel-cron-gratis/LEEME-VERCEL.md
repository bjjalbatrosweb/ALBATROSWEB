# Programador gratuito con Vercel Cron

Este parche reemplaza únicamente el programador de Cloud Functions. Firebase Cloud Messaging continúa enviando las notificaciones y Firestore conserva los dispositivos y el control de duplicados.

## 1. Copiar los archivos

Desde la raíz del proyecto, después de descomprimir este ZIP:

```bash
cp -rv parche-vercel-cron-gratis/* .
```

## 2. Variables de entorno en Vercel

En **Vercel > proyecto > Settings > Environment Variables**, conserva las variables existentes y agrega:

- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`: clave pública Web Push generada en Firebase.
- `CRON_SECRET`: secreto aleatorio para proteger la tarea. Puedes generarlo con `openssl rand -hex 32`.

La aplicación también necesita las credenciales de Firebase Admin que ya usa el backend:

- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Marca las variables para **Production, Preview y Development** y realiza un nuevo despliegue en Vercel.

## 3. Funcionamiento

- Vercel llama diariamente a `/api/cron/recordatorios-pago`.
- La programación `0 15 * * *` corresponde a las 09:00 de Mérida.
- Solo se avisa a alumnos activos, vencidos, sin pago del periodo y con un dispositivo autorizado.
- `RecordatoriosPago` impide enviar dos veces el recordatorio del mismo periodo.
- Ya no se despliega `functions:recordatoriosPagoVencido` ni es necesario activar Blaze.

## 4. Prueba manual opcional

La siguiente llamada puede enviar notificaciones reales a todos los alumnos vencidos que cumplan las condiciones:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU_DOMINIO/api/cron/recordatorios-pago
```

Antes de probar, activa las notificaciones con una cuenta de alumno de prueba.
