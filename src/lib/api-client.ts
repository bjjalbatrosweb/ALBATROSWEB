import {
  reportFirebaseApiFailure,
  reportFirebaseFailure,
} from "@/lib/firebase-health";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

type ApiResponse<T> = {
  response: Response;
  data: T;
};

export async function apiRequest<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 10_000,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) {
      const message = (data as { mensaje?: unknown })?.mensaje;
      reportFirebaseApiFailure(response.status, message, "api");
    }
    return { response, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      reportFirebaseFailure(error, "api");
      throw new ApiRequestError(
        "El servidor tardó más de 10 segundos. Revisa tu conexión y vuelve a intentarlo.",
      );
    }
    if (error instanceof TypeError) {
      reportFirebaseFailure(error, "api");
      throw new ApiRequestError(
        "No hay conexión con el servidor. Revisa internet y vuelve a intentarlo.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function apiErrorMessage(
  status: number,
  serverMessage?: unknown,
  fallback = "No se pudo completar la operación.",
) {
  if (typeof serverMessage === "string" && serverMessage.trim()) {
    return serverMessage;
  }

  if (status === 401) {
    return "La sesión expiró. Vuelve a iniciar sesión.";
  }
  if (status === 403) {
    return "Tu cuenta no administra esta sede o está inactiva.";
  }
  if (status === 404) {
    return "No se encontró el alumno o recurso solicitado.";
  }
  if (status === 409) {
    return "La operación ya fue registrada o el alumno está inactivo.";
  }
  if (status === 503) {
    return "El servidor no está disponible temporalmente. Intenta de nuevo en unos segundos.";
  }

  return fallback;
}
