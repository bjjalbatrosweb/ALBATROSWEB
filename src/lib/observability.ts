type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;
function safeValue(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'string') return value.slice(0, 500);
  return value;
}
export function logServerEvent(level: LogLevel, event: string, context: LogContext = {}) {
  console[level](JSON.stringify({ event, timestamp: new Date().toISOString(), ...Object.fromEntries(Object.entries(context).map(([key, value]) => [key, safeValue(value)])) }));
}
export function requestId(request: Request) {
  return (request.headers.get('x-cloud-trace-context')?.split('/')[0] || request.headers.get('x-request-id') || crypto.randomUUID()).slice(0, 128);
}
