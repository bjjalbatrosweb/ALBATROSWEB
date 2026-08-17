# Notificaciones automáticas de pago — archivos mínimos

Este ZIP contiene únicamente los archivos nuevos o modificados para integrar las notificaciones de pago en el proyecto ALBATROS que fue revisado.

## Instalar

1. Haz una copia de seguridad de tu proyecto.
2. Copia el contenido de este ZIP en la raíz del proyecto, conservando las carpetas y reemplazando los archivos existentes cuando se solicite.
3. En Firebase, genera la clave pública en **Configuración del proyecto > Cloud Messaging > Certificados Web Push**.
4. En Vercel, crea esta variable para Production, Preview y Development:

   `NEXT_PUBLIC_FIREBASE_VAPID_KEY=TU_CLAVE_PUBLICA`

5. Vuelve a desplegar la web en Vercel.
6. Desde la raíz del proyecto ejecuta:

   ```bash
   npm --prefix functions install
   firebase use albatros-5de2d
   firebase deploy --only firestore:rules,functions:recordatoriosPagoVencido
   ```

## Archivos incluidos

- `firebase.json`
- `firestore.rules`
- `public/sw.js`
- `src/app/(app)/mi-academia/page.tsx`
- `src/app/api/notificaciones/dispositivo/route.ts`
- `src/lib/athlete-push-notifications.ts`
- `functions/index.js`
- `functions/payment-reminders.js`
- `functions/package.json`
- `functions/package-lock.json`

No contiene `.env`, claves privadas, imágenes, `node_modules`, archivos compilados ni el resto de la web.
