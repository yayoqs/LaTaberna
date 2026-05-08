/* ================================================================
   PubPOS — MÓDULO: eventBus.js (v2.1 – logging unificado + JSDoc)
   Propósito: Sistema de publicación/suscripción para desacoplar módulos.
              Soporta eventos basados en clases (tipados) y mantiene
              compatibilidad con suscriptores que usan strings.
   ================================================================ */

const EventBus = (() => {
  const eventos = {};

  /**
   * Registra un callback para un tipo de evento.
   * @param {string|Function} eventType - String del evento o clase del evento.
   * @param {function} callback - Función que recibirá los datos del evento.
   */
  function on(eventType, callback) {
    const nombre = _nombreEvento(eventType);
    if (!nombre) {
      Logger.error('[EventBus] Tipo de evento inválido:', eventType);
      return;
    }
    if (!eventos[nombre]) eventos[nombre] = [];
    eventos[nombre].push(callback);
  }

  /**
   * Emite un evento, notificando a todos los suscriptores.
   * @param {string|object} event - String del evento o instancia de una clase.
   * @param {any} [datos] - Datos adicionales (solo si el primer parámetro es string).
   */
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

  /**
   * Elimina un callback registrado.
   * @param {string|Function} eventType - String o clase del evento.
   * @param {function} callback - El callback exacto a eliminar.
   */
  function off(eventType, callback) {
    const nombre = _nombreEvento(eventType);
    if (!nombre || !eventos[nombre]) return;
    eventos[nombre] = eventos[nombre].filter(cb => cb !== callback);
  }

  /**
   * Lista los eventos registrados y cuántos handlers tiene cada uno.
   * Útil para depuración.
   */
  function listar() {
    Logger.debug('EventBus registros:', Object.keys(eventos).map(k => `${k}: ${eventos[k].length} handlers`));
  }

  // ── UTILIDAD PRIVADA ──────────────────────────────────────
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

window.EventBus = EventBus;