export type StoreProductGroup = 'agua' | 'energetica' | 'snack';

export const STORE_PRODUCTS = [
  {
    id: 'agua_600',
    nombre: 'Agua',
    detalle: '600 ml',
    precio: 10,
    grupo: 'agua',
    color: 'from-sky-500/25 to-blue-950/20',
    imagen: '/productos/agua-600.png',
  },
  {
    id: 'agua_1l',
    ipad: true,
    nombre: 'Agua',
    detalle: '1 litro',
    precio: 15,
    grupo: 'agua',
    color: 'from-cyan-500/25 to-blue-950/20',
    imagen: '/productos/agua-1l.png',
  },
  {
    id: 'amper_mango',
    nombre: 'Amper',
    detalle: 'Mango',
    precio: 22,
    grupo: 'energetica',
    color: 'from-orange-500/30 to-amber-950/20',
    imagen: '/productos/amper-mango.png',
  },
  {
    id: 'amper_blanco',
    nombre: 'Amper',
    detalle: 'Blanco',
    precio: 22,
    grupo: 'energetica',
    color: 'from-zinc-100/20 to-zinc-900/20',
    imagen: '/productos/amper-blanco.png',
  },
  {
    id: 'amper_azul',
    nombre: 'Amper',
    detalle: 'Azul',
    precio: 22,
    grupo: 'energetica',
    color: 'from-blue-500/30 to-indigo-950/20',
    imagen: '/productos/amper-azul.png',
  },
  {
    id: 'barra_proteina',
    nombre: 'Barra de proteína',
    detalle: 'Nature Valley',
    precio: 15,
    grupo: 'snack',
    color: 'from-emerald-500/25 to-green-950/20',
    imagen: '/productos/barra-proteina.png',
  },
  {
    id: 'chocolate',
    nombre: 'Chocolate',
    detalle: 'Crunch',
    precio: 15,
    grupo: 'snack',
    color: 'from-amber-800/35 to-stone-950/20',
    imagen: '/productos/chocolate-crunch.png',
  },
  {"id": "coca_cola", "nombre": "Coca-Cola", "detalle": "Personal", "precio": 25, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "https://f.fcdn.app/imgs/811582/www.sanroque.com.uy/sanruy/31e2/original/catalogo/103707_103707_1/2000-2000/coca-cola-600ml-coca-cola-600ml.jpg", "ipad": true},
  {"id": "refresco_lata", "nombre": "Refresco de lata", "detalle": "Sabores disponibles en recepción", "precio": 25, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "https://whatsapp.wingstopmexico.com/pub/media/catalog/category/Bebidas.jpg", "ipad": true},
  {"id": "agua_500", "nombre": "Agua embotellada", "detalle": "Medio litro", "precio": 10, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/agua-600.png", "ipad": true},
  {"id": "frutas_500", "nombre": "Agua de frutas", "detalle": "Medio litro", "precio": 25, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/agua-frutas.png", "ipad": true},
  {"id": "frutas_1l", "nombre": "Agua de frutas", "detalle": "1 litro", "precio": 35, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/agua-frutas.png", "ipad": true},
  {"id": "gatorade_1l", "nombre": "Gatorade", "detalle": "1 litro", "precio": 25, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/gatorade-1l-moras.png", "ipad": true},
  {"id": "gatorade_500", "nombre": "Gatorade", "detalle": "500 ml", "precio": 28, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "https://masonlineprod.vtexassets.com/arquivos/ids/300620/Bebida-Isot-nica-Gatorade-Sabor-Naranja-500ml-2-24436.jpg?v=638307561710770000", "ipad": true},
  {"id": "powerade_1l", "nombre": "Powerade", "detalle": "1 litro", "precio": 35, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/powerade-1l-ponche.png", "ipad": true},
  {"id": "powerade_500", "nombre": "Powerade", "detalle": "500 ml", "precio": 28, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/powerade-500-moras.png", "ipad": true},
  {"id": "fuze_tea", "nombre": "Fuze Tea", "detalle": "Té frío", "precio": 24, "grupo": "agua", "color": "from-sky-500/25 to-blue-950/20", "imagen": "https://hebmx.vtexassets.com/arquivos/ids/664650-800-800?aspect=true&height=800&v=638497898209630000&width=800", "ipad": true},
  {"id": "bolis_naturales", "nombre": "Bolis naturales", "detalle": "Sabores disponibles en recepción", "precio": 20, "grupo": "snack", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/bolis-naturales.png", "ipad": true},
  {"id": "bolis_sorbin", "nombre": "Bolis Sorbín", "detalle": "Sabores disponibles en recepción", "precio": 5, "grupo": "snack", "color": "from-sky-500/25 to-blue-950/20", "imagen": "/productos/ipad/bolis-saborin.png", "ipad": true},
] as const;

export type StoreProduct = (typeof STORE_PRODUCTS)[number];
export type StoreProductId = StoreProduct['id'];

// Un producto nuevo empieza agotado hasta que un administrador asigne
// sus existencias reales para la sede.
export const DEFAULT_STORE_STOCK = 0;
export const DEFAULT_LOW_STOCK = 5;

export function storeInventoryId(sede: string, productoId: StoreProductId) {
  return `${sede}_${productoId}`;
}

export function storeProductById(productoId: string) {
  return STORE_PRODUCTS.find((product) => product.id === productoId) || null;
}

// Migra únicamente las fotos anteriores del catálogo; conserva las fotos personalizadas.
const PREVIOUS_STORE_IMAGES: Partial<Record<StoreProductId, string>> = {
  "powerade_500": "https://chedrauimx.vtexassets.com/arquivos/ids/66424781-800-auto?aspect=true&height=auto&v=639106054788630000&width=800",
  "powerade_1l": "https://chedrauimx.vtexassets.com/arquivos/ids/65186560/7501055317653_00.jpg?v=639090535236070000",
  "bolis_sorbin": "https://www.cocinavital.mx/wp-content/uploads/2024/05/bolis-sabores.jpg",
  "bolis_naturales": "https://www.cocinavital.mx/wp-content/uploads/2024/05/bolis-sabores.jpg",
  "gatorade_1l": "https://www.benavides.com.mx/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/2/0/20250327_170658.JPG",
  "frutas_500": "https://albamar.com.gt/cdn/shop/files/bebidas-naturales_02_1024x1024%402x.jpg?v=1696888046",
  "frutas_1l": "https://albamar.com.gt/cdn/shop/files/bebidas-naturales_02_1024x1024%402x.jpg?v=1696888046"
};

export function storeProductImage(product: StoreProduct, savedImage: unknown): string {
  const saved = typeof savedImage === "string" ? savedImage : "";
  return !saved || saved === PREVIOUS_STORE_IMAGES[product.id] ? product.imagen : saved;
}
