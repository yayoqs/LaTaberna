/* ================================================================
   PubPOS — MÓDULO: logger.js (Sistema centralizado de logging)
   Propósito: Reemplazar los console.log/error dispersos por un
              sistema con niveles, filtros y almacenamiento opcional.
              Facilita la depuración, permite silenciar logs en
              producción y habilita futuras integraciones (envío a
              servidor, visualización de bitácora, etc.).
   ================================================================ */

const Logger = (() => {
  // Niveles de severidad (orden de prioridad)
  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 99 };

  // Nivel mínimo: solo se imprimirán mensajes con nivel >= MIN_LEVEL
  let MIN_LEVEL = LEVELS.DEBUG;

  // Si es true, guarda todos los logs en un array (memoria)
  let COLLECT = false;
  const _logBuffer = [];

  // ── API PÚBLICA ──────────────────────────────────────────

  /**
   * Configura el nivel mínimo de logs que se mostrarán.
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'NONE'} level
   */
  function setLevel(level) {
    if (LEVELS.hasOwnProperty(level)) {
      MIN_LEVEL = LEVELS[level];
    } else {
      console.warn('[Logger] Nivel inválido:', level);
    }
  }

  /**
   * Activa/desactiva la recolección de logs en memoria.
   */
  function setCollect(active = true) {
    COLLECT = active;
    if (!active) _logBuffer.length = 0; // limpiar buffer
  }

  /**
   * Retorna una copia de los logs acumulados.
   */
  function getLogs() {
    return [..._logBuffer];
  }

  /**
   * Limpia el buffer de logs.
   */
  function clear() {
    _logBuffer.length = 0;
  }

  // ── MÉTODOS POR NIVEL ────────────────────────────────────

  function debug(message, ...args) {
    _log(LEVELS.DEBUG, 'DEBUG', message, args);
  }

  function info(message, ...args) {
    _log(LEVELS.INFO, 'INFO', message, args);
  }

  function warn(message, ...args) {
    _log(LEVELS.WARN, 'WARN', message, args);
  }

  function error(message, ...args) {
    _log(LEVELS.ERROR, 'ERROR', message, args);
  }

  // ── INTERNO ──────────────────────────────────────────────
  function _log(level, levelName, message, args) {
    if (level < MIN_LEVEL) return;

    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] [${levelName}] ${message}`;

    // Siempre usamos console según nivel, pero se podría cambiar
    switch (level) {
      case LEVELS.DEBUG: console.debug(formattedMsg, ...args); break;
      case LEVELS.INFO:  console.log(formattedMsg, ...args); break;
      case LEVELS.WARN:  console.warn(formattedMsg, ...args); break;
      case LEVELS.ERROR: console.error(formattedMsg, ...args); break;
    }

    if (COLLECT) {
      _logBuffer.push({ timestamp, level: levelName, message, args });
    }
  }

  return {
    setLevel,
    setCollect,
    getLogs,
    clear,
    debug,
    info,
    warn,
    error
  };
})();

/* ── ErrorHandler (captura global de errores) ────────────────
   Se registra aquí mismo para no perder errores tempranos.
   Usa Logger.error() para mantener consistencia. */
const ErrorHandler = (() => {
  function init() {
    window.addEventListener('error', (event) => {
      const mensaje = event.message || 'Error inesperado';
      Logger.error(`[Global Error] ${mensaje}`, { filename: event.filename, lineno: event.lineno });
      showToast('error', `<i class="fas fa-bug"></i> ${mensaje}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const mensaje = (event.reason && event.reason.message) || 'Error en operación asíncrona';
      Logger.error(`[Unhandled Rejection] ${mensaje}`, event.reason);
      showToast('error', `<i class="fas fa-exclamation-triangle"></i> ${mensaje}`);
    });
  }

  return { init };
})();

// ── Inicialización automática ──────────────────────────────
// Se ejecuta al cargar el script, reemplazando los manejadores
// genéricos que estaban en bootstrap.js
ErrorHandler.init();

window.Logger = Logger;
window.ErrorHandler = ErrorHandler;