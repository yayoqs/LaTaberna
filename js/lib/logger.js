/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/logger.js
   Versión: 1.0.2
   Propósito: Sistema de logging con niveles (DEBUG, INFO, WARN, ERROR)
              y captura global de errores no manejados (ErrorHandler).
              Sin dependencias externas (usa console y showToast).
   ================================================================ */

import { showToast } from '../utils.js';

export const Logger = (() => {
  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 99 };
  let MIN_LEVEL = LEVELS.DEBUG;
  let COLLECT = false;
  const _logBuffer = [];

  function setLevel(level) {
    if (LEVELS.hasOwnProperty(level)) {
      MIN_LEVEL = LEVELS[level];
    } else {
      console.warn('[Logger] Nivel inválido:', level);
    }
  }

  function setCollect(active = true) {
    COLLECT = active;
    if (!active) _logBuffer.length = 0;
  }

  function getLogs() { return [..._logBuffer]; }
  function clear() { _logBuffer.length = 0; }

  function debug(message, ...args) { _log(LEVELS.DEBUG, 'DEBUG', message, args); }
  function info(message, ...args)  { _log(LEVELS.INFO, 'INFO', message, args); }
  function warn(message, ...args)  { _log(LEVELS.WARN, 'WARN', message, args); }
  function error(message, ...args) { _log(LEVELS.ERROR, 'ERROR', message, args); }

  function _log(level, levelName, message, args) {
    if (level < MIN_LEVEL) return;
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] [${levelName}] ${message}`;
    switch (level) {
      case LEVELS.DEBUG: console.debug(formattedMsg, ...args); break;
      case LEVELS.INFO:  console.log(formattedMsg, ...args); break;
      case LEVELS.WARN:  console.warn(formattedMsg, ...args); break;
      case LEVELS.ERROR: console.error(formattedMsg, ...args); break;
    }
    if (COLLECT) _logBuffer.push({ timestamp, level: levelName, message, args });
  }

  return { setLevel, setCollect, getLogs, clear, debug, info, warn, error };
})();

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

ErrorHandler.init();