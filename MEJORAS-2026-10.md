# Actualización de catálogo, pedidos y sitio público

Este paquete contiene archivos nuevos y modificados sobre el proyecto original, incluidas las mejoras anteriores de tienda iPad y las seis fotografías que compartiste. No modifica usuarios, pagos ni existencias de tu Firebase por sí solo.

## Instalación en Firebase Studio

Sube `actualizacion-tienda-ipad.zip` a la raíz del proyecto, junto a `package.json`. Conserva una copia de tus cambios locales antes de reemplazar archivos.

```bash
unzip -o actualizacion-tienda-ipad.zip
npm run check
firebase deploy --only firestore:indexes
```

Espera a que los índices nuevos estén habilitados en Firebase Console → Firestore → Índices, antes de probar las consultas nuevas. Si no tienes permisos para desplegar índices, debe hacerlo un administrador del proyecto. El paquete incluye `firestore.indexes.json` completo y conserva los índices anteriores.

Las fotos de productos se guardan mediante el servidor en la colección `FotosProductos`. No requieren habilitar Firebase Storage ni configurar un proveedor nuevo. Su lectura pública solo devuelve la fotografía, nunca datos del atleta; su escritura exige acceso del personal a la sede. El archivo de reglas incorpora una denegación explícita al SDK cliente para esa colección. Puedes publicarlo mediante tu proceso habitual de reglas; las reglas anteriores ya la deniegan por no existir un permiso para ella.

Publica la aplicación con tu flujo habitual de App Hosting/Hosting. Descomprimir este ZIP no publica la web.

Para completar enlaces absolutos de SEO y vistas previas de WhatsApp, configura `NEXT_PUBLIC_SITE_URL` con el origen real de tu web (por ejemplo, `https://tu-dominio.com`) en el entorno de compilación. No utilices la dirección de la previsualización de demostración. Sin esa variable, sitemap y robots usan el origen de la petición; se omiten los canonical e imágenes sociales absolutos que requieren el dominio confirmado.

## 1. Catálogo desde administración

Abre Administración → Compras → Inventario y selecciona la sede.

- Pulsa **Agregar producto**. El producto nuevo comienza inactivo y con cero existencias.
- Edita nombre, presentación, categoría, precio, existencias y mínimo.
- Marca **Mostrar en el iPad** para incluirlo en ese canal. El iPad actual opera en la sede MMA, como los demás módulos del kiosco.
- Sube una fotografía JPEG, PNG o WebP. El navegador prepara un JPEG de hasta 640 píxeles y el servidor acepta hasta 180 KB. Si una foto muy compleja supera el límite, usa una más pequeña.
- Pulsa **Guardar** después de editar o subir la foto y activa su venta con **Visible**. Desactivarla retira el producto del catálogo iPad sin borrar los pedidos históricos.

Los valores se guardan por sede en `InventarioTienda`. Los productos anteriores siguen funcionando sin migraciones ni duplicados. No hay borrado definitivo de productos: desactivarlos conserva la trazabilidad de los pedidos y las reservas de stock. El precio final y las existencias siempre se comprueban en el servidor dentro de una transacción.

## 2. Seguimiento de pedidos

Después de confirmar con PIN, el iPad muestra folio, total y estado: Recibido → Preparando → Listo para recoger → Cobrado y entregado, o Cancelado. El estado lo cambias desde Administración → Compras. Se consulta cada 10 segundos mientras está abierta la tienda y el pedido no tiene un estado final. Se pausa con la página oculta o sin conexión.

No se efectúa ningún cobro automático. Al salir, cambiar de apartado o vencer la inactividad se borran PIN, carrito y seguimiento. No se guardan datos del atleta en el navegador para consultar pedidos de sesiones anteriores.

El panel de pedidos consulta cambios cada 15 segundos cuando está visible; no vuelve a descargar el inventario en cada ciclo. Muestra los 100 pedidos más recientes; usa Actualizar para recargar. La edición de inventario no se interrumpe por esa consulta automática.

## 3. Clase de prueba

La portada destaca el acceso al formulario gratuito de MMA y muestra juntos disciplina, sede, horario y mensualidad publicada para Caucel. Se conservó la diferencia entre las dos sedes: el formulario de inscripción en línea solo admite MMA; para Caucel se ofrece consulta por WhatsApp. Hay un acceso flotante a la clase de prueba.

Los horarios y precios mostrados proceden del proyecto existente. Confírmalos con la operación antes de publicar. No se inventaron direcciones ni precios para Juan Pablo.

## 4. Menos lecturas y descargas

- Consulta ambiente del RFID: pasa de 3,5 a 6 segundos; en pantalla oculta espera 15 segundos. El modo activo del lector conserva su frecuencia rápida.
- Caché de eventos de 2,5 segundos por instancia, con una sola consulta concurrente, para compartir resultados entre pantallas.
- Historial de bienvenida: solo se descargan fechas y se reutilizan hasta un minuto por atleta, con límite de caché en memoria.
- Mi cuenta: consulta el pago del período directamente y por período, en vez de descargar 100 pagos. Ordena las últimas 500 asistencias y obtiene próximas clases por fecha. Si el historial llega al límite, lo indica en pantalla.
- Administración: actualización incremental de pedidos por `actualizadaEn`; sin recargar fotos ni inventario en cada consulta. Si se acumulan 100 cambios, recarga la lista reciente para conservar coherencia.

La caché se limita a cada instancia y no sustituye Firestore. No se midió el ahorro con tráfico real.

## 5. Operación diaria

Dashboard y Hub incorporan accesos destacados a recepción/asistencia, pagos pendientes, pedidos y alertas. El menú usa esas cuatro tareas como accesos iniciales y respeta las preferencias de quienes ya personalizaron su menú.

## 6. Búsqueda y enlaces compartidos

Se añadieron páginas para `/sedes/mma`, `/sedes/caucel` y `/sedes/juan-pablo`, metadatos Open Graph/Twitter, datos estructurados de la sede, `/sitemap.xml` y `/robots.txt`. Las páginas privadas, API y enlaces de emergencia no se incluyen en el sitemap. Las direcciones exactas de las sedes quedan pendientes de información confirmada; se ofrece contacto de la academia.

## Comprobaciones y límites

TypeScript y ESLint se verifican sobre esta actualización. La suite ejecutada contiene 222 pruebas: 219 pasan y continúan los 3 fallos previos por expectativas textuales de los scripts iPad. Las pruebas nuevas cubren catálogo dinámico, cambios por sede y conservación de fotografías propias.

Prueba de navegador con API simulada: producto nuevo, cantidades, total, confirmación con PIN, folio, transición Preparando → Listo y limpieza al cambiar de apartado. No se probaron usuarios administrativos, subidas contra Firestore real, hardware RFID ni despliegue Firebase. La compilación completa previa estaba bloqueada por la descarga de fuentes de Google en este entorno.

La previsualización publicada sigue siendo una demostración: no administra tu Firebase ni genera pedidos reales. El ZIP es el que incorpora los cambios al proyecto de Firebase Studio.

## Agrupación de visitas

El iPad muestra un único apartado **Visitas** en Hub y Lista. Dentro hay dos opciones independientes: **Clase de prueba** y **Pases temporales**. Cada una conserva su formulario y sus API. Al cambiar entre opciones se limpian los datos del formulario anterior. Los accesos directos a agendar una clase o a crear un pase desde Mi cuenta siguen abriendo la opción correspondiente dentro de Visitas.
