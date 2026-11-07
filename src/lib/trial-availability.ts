export type TrialAvailability = { fechas: string[]; diasSemana: number[] };
export function normalizeAvailability(value: Record<string, unknown> = {}): TrialAvailability {
 return {fechas:Array.isArray(value.fechas)?[...new Set(value.fechas.filter((day):day is string=>typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort():[],diasSemana:Array.isArray(value.diasSemana)?[...new Set(value.diasSemana.filter((day):day is number=>Number.isInteger(day)&&Number(day)>=0&&Number(day)<=6))].sort():[]};
}
export function isTrialDateBlocked(date: string, config: TrialAvailability) {
 return config.fechas.includes(date) || config.diasSemana.includes(new Date(date+'T12:00:00Z').getUTCDay());
}
