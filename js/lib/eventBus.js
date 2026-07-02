/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/eventBus.js
   Versión: 1.2.0
   Propósito: Bus de eventos pub/sub. on() ahora devuelve función
              de desuscripción para limpieza funcional.
   ================================================================ */

import { Logger } from './logger.js';

export const EventBus = (() => {
  const eventos = {};

  /**
   * Registra un callback para un tipo de evento.
   * @param {string} eventType - Nombre del evento.
   * @param {function} callback - Función que recibirá los datos del evento.
   * @returns {function} Función de limpieza: al llamarla, desuscribe el callback.
   */
  function on(eventType, callback) {
    const nombre = _nombreEvento(eventType);
    if (!nombre) {
      Logger.error('[EventBus] Tipo de evento inválido:', eventType);
      return () => {}; // devuelve función vacía para evitar errores
    }
    if (!eventos[nombre]) eventos[nombre] = [];
    eventos[nombre].push(callback);

    // Retornar función de limpieza
    return () => off(nombre, callback);
  }

  function emit(event, datos) {
    let nombre;
    let payload;

    if (typeof event === 'string') {
      nombre = event;
      payload = datos;
    } else if (typeof event === 'object' && event !== null) {
      nombre = _nombreEvento(event);
      payload = event;
    } else {
      Logger.error('[EventBus] Formato de evento no soportado:', event);
      return;
    }

    if (!eventos[nombre]) return;

    eventos[nombre].forEach(cb => {
      try {
        cb(payload);
      } catch (e) {
        Logger.error(`[EventBus] Error en handler de "${nombre}":`, e);
      }
    });
  }

  function off(eventType, callback) {
    const nombre = _nombreEvento(eventType);
    if (!nombre || !eventos[nombre]) return;
    eventos[nombre] = eventos[nombre].filter(cb => cb !== callback);
  }

  function listar() {
    Logger.debug('EventBus registros:', Object.keys(eventos).map(k => `${k}: ${eventos[k].length} handlers`));
  }

  function _nombreEvento(eventType) {
    if (typeof eventType === 'string') return eventType;
    if (typeof eventType === 'function') return eventType.name;
    if (typeof eventType === 'object' && eventType !== null) {
      return eventType.tipo || eventType.constructor?.name;
    }
    return null;
  }

  return { on, off, emit, listar };
})();