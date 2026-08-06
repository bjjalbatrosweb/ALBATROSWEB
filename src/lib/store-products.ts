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
] as const;

export type StoreProduct = (typeof STORE_PRODUCTS)[number];
export type StoreProductId = StoreProduct['id'];

export const DEFAULT_STORE_STOCK = 50;
export const DEFAULT_LOW_STOCK = 5;

export function storeInventoryId(sede: string, productoId: StoreProductId) {
  return `${sede}_${productoId}`;
}

export function storeProductById(productoId: string) {
  return STORE_PRODUCTS.find((product) => product.id === productoId) || null;
}
