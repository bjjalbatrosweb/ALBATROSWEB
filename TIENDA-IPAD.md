# Lee primero MEJORAS-2026-10.md para la instalación y las funciones actuales.

# Tienda en modo iPad

Actualización sobre el proyecto que compartiste. No está desplegada en Firebase.

## Instalar la actualización

1. Descomprime `actualizacion-tienda-ipad.zip` en la raíz del mismo proyecto de Firebase Studio, conservando las carpetas y reemplazando los archivos indicados. No reemplaces tu proyecto por una carpeta vacía: este ZIP contiene solo los archivos nuevos o modificados.
2. Ejecuta `npm run check`.
3. Opcional: ejecuta `python3 scripts/download-store-images.py` para descargar las fotografías a `public/productos/ipad` en lugar de depender de servidores externos. Si una fuente ya no está disponible, el script lo informa y conserva su URL. Revisa o sustituye esas fotografías antes de publicar.
4. En Administración → Compras, configura existencias reales para los nuevos productos y guarda el inventario de MMA. Verifica los precios antes de habilitar la venta. El sistema conserva los precios e imágenes que ya tengas guardados como personalizaciones del inventario; los valores del menú son los valores iniciales del catálogo.
5. Prueba `/ipad` → Kiosco → Tienda. Envía un pedido con un PIN de atleta activo de MMA. Comprueba que llegue al panel administrativo y prueba preparar, entregar y cancelar.
6. Publica desde tu proceso habitual de Firebase. No se modificaron credenciales ni reglas de Firebase. Al volver a abrir el modo iPad, el service worker incorpora la versión 18 y los archivos de tienda.

## Catálogo iPad y precios iniciales (MXN)

| Producto | Presentación | Precio |
| --- | --- | ---: |
| Coca-Cola | Personal; el menú no especifica volumen | 25 |
| Refresco de lata | Sabores disponibles | 25 |
| Agua embotellada | Medio litro | 10 |
| Agua embotellada | 1 litro | 15 |
| Agua de frutas | Medio litro | 25 |
| Agua de frutas | 1 litro | 35 |
| Gatorade | 1 litro | 25 |
| Gatorade | 500 ml | 28 |
| Powerade | 1 litro | 35 |
| Powerade | 500 ml | 28 |
| Fuze Tea | El menú no especifica volumen | 24 |
| Bolis naturales | Sabores disponibles | 20 |
| Bolis Sorbín | Sabores disponibles | 5 |

Gatorade de un litro toma el precio corregido en rojo de la fotografía: $25. Los productos anteriores conservan sus identificadores y siguen en la tienda general; el iPad muestra estos trece.

## Funcionamiento

La tarjeta Tienda está en Hub y Lista. Incluye filtros de bebidas y bolis, catálogo, existencias, carrito, total y un acceso rápido al pedido. Los agotados no pueden añadirse. Los precios y las reservas de stock se calculan en el servidor mediante la API existente de compras. La API acepta PIN de atleta para el canal iPad, restringido a MMA, y conserva el flujo RFID para los clientes anteriores.

Se crea una solicitud pendiente de cobro, con origen `kiosco_ipad`. La recepción sigue cobrando y entregando por el mismo panel. No se registran pagos automáticos. El PIN no se guarda en Firestore, localStorage ni en el pedido. Al cambiar de apartado, salir o vencer la inactividad se limpian PIN y carrito. La respuesta de un envío anterior no vuelve a mostrar datos después de limpiar la sesión. Si se pierde la respuesta del servidor, el botón permite reintentar con el mismo identificador para evitar duplicar esa solicitud.

Los productos nuevos comienzan sin existencias, siguiendo la política que ya tenía tu tienda. No se inventó stock ni se escribió en producción.

## Imágenes

Las seis imágenes aportadas por el usuario están incluidas como archivos locales en `public/productos/ipad`: Powerade 500 ml, Powerade 1 L, Gatorade 1 L, bolis saborín, bolis naturales y agua de frutas. La última foto se usa para las presentaciones de 500 ml y 1 L. Los precios y las presentaciones no cambian. El paquete original de bolis se muestra como imagen del producto vendido por unidad a $5.

Las URLs antiguas guardadas por el catálogo se sustituyen por las nuevas fotos al consultar inventario. Las imágenes que hayas personalizado por tu cuenta se conservan. Las demás fotos del catálogo siguen siendo externas; el script opcional puede descargarlas.

Fuentes consultadas:

- Coca-Cola: https://www.sanroque.com.uy/catalogo/coca-cola-600ml_103707_103707
- Latas: https://whatsapp.wingstopmexico.com/bebidas
- Gatorade 1 L: https://www.benavides.com.mx/gatorade-bebida-isotonica-sabor-naranja-1-l
- Gatorade 500 ml: https://www.masonline.com.ar/bebida-isotonica-naranja-gatorade-500-cc-2/p
- Powerade 1 L: https://www.chedraui.com.mx/bebida-hidratante-powerade-moras-1l-3092536/p
- Powerade 500 ml: https://www.chedraui.com.mx/bebida-hidratante-powerade-moras-500ml-3093994/p
- Fuze Tea: https://www.heb.com.mx/fuze-te-sabor-durazno-1-l-712565/p
- Agua de frutas: https://albamar.com.gt/products/bebida-natural-mediana
- Bolis: https://www.cocinavital.mx/blog-de-cocina/tips-de-cocina/descubre-como-evitar-la-cristalizacion-en-tus-helados-y-bolis-caseros/2024/05/

Las fuentes anteriores corresponden a la primera versión. Las fotos de los siete productos indicados arriba han sido reemplazadas por los seis archivos del usuario, sin retoques.

## Validación

- TypeScript y ESLint: pasan.
- Dos pruebas nuevas: contrato de precios y preservación de identificadores, pasan.
- Navegador Chromium, respuestas de API simuladas: navegación Hub/Lista, carrito, total, agotados, envío por PIN, limpieza de datos y reintento con el mismo ID. Vistas 1024×768 y 768×1024. No se verificó un iPad físico ni Firebase real.
- Las 217 pruebas anteriores conservan el mismo resultado: 214 pasan y los 3 fallos previos del iPad permanecen. No se corrigieron comportamientos ajenos a esta actualización.
- La compilación completa estaba bloqueada por la descarga de fuentes de Google en este entorno; no se confirmó el despliegue.
