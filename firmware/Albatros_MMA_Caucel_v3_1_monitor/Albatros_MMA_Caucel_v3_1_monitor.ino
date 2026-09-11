#include <Arduino.h>
#include <ArduinoJson.h>

// Módulo de telemetría segura para el controlador MMA/Caucel 3.1.
// No almacena UID, nombres ni identificadores de alumnos.
const unsigned long INTERVALO_ENVIO_MONITOR = 600000;
const size_t MAX_EVENTOS_MONITOR = 10;

struct EventoMonitor {
  String codigo;
  String categoria;
  unsigned long ocurridoEnMs;
};

EventoMonitor eventosMonitor[MAX_EVENTOS_MONITOR];
size_t cantidadEventosMonitor = 0;
unsigned long ultimoEnvioMonitorMs = 0;

void registrarEventoMonitor(const String &codigo, const String &categoria) {
  if (codigo.length() == 0 || categoria.length() == 0) return;

  // Si el búfer está lleno conserva los eventos más recientes sin crecer
  // indefinidamente ni escribir datos personales.
  if (cantidadEventosMonitor == MAX_EVENTOS_MONITOR) {
    for (size_t indice = 1; indice < MAX_EVENTOS_MONITOR; indice++) {
      eventosMonitor[indice - 1] = eventosMonitor[indice];
    }
    cantidadEventosMonitor--;
  }

  eventosMonitor[cantidadEventosMonitor++] = {
    codigo.substring(0, 40),
    categoria.substring(0, 30),
    millis(),
  };
}

void agregarEventosMonitor(JsonObject monitor) {
  JsonArray eventos = monitor["eventos"].to<JsonArray>();
  for (size_t indice = 0; indice < cantidadEventosMonitor; indice++) {
    JsonObject item = eventos.add<JsonObject>();
    item["codigo"] = eventosMonitor[indice].codigo;
    item["categoria"] = eventosMonitor[indice].categoria;
    item["ocurridoEnMs"] = eventosMonitor[indice].ocurridoEnMs;
  }
}

void limpiarEventosMonitor() {
  cantidadEventosMonitor = 0;
}

bool debeEnviarMonitor(unsigned long ahoraMs) {
  return cantidadEventosMonitor > 0 &&
         ahoraMs - ultimoEnvioMonitorMs >= INTERVALO_ENVIO_MONITOR;
}

// Llamar después de analizar la respuesta JSON del endpoint heartbeat.
// Los eventos sólo se eliminan cuando el servidor confirma que persistió el
// bloque; una desconexión o respuesta parcial los conserva para el reintento.
void confirmarEnvioMonitor(JsonDocument &respuestaDoc) {
  if (respuestaDoc["monitorPersistido"] == true) {
    limpiarEventosMonitor();
    ultimoEnvioMonitorMs = millis();
  }
}

void setup() {
  ultimoEnvioMonitorMs = millis();
}

void loop() {
  // La integración principal debe llamar agregarEventosMonitor() al construir
  // el heartbeat y confirmarEnvioMonitor() después de recibir HTTP 2xx.
}
