import type { Sede } from '@/lib/access-control';

const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

export function normalizarSedePago(value: unknown): Sede | null {
  if (typeof value !== 'string') return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, '_') as Sede;
  return SEDES.includes(sede) ? sede : null;
}

export function normalizarRfidPago(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    : '';
}

export function periodoPagoValido(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
