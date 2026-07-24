/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-shim.js
   Versión: 1.0.6
   Propósito: Compatibilidad con Google Apps Script.
              Uso de let/const en lugar de var.
   ================================================================ */

import { Logger } from './lib/logger.js';

export const DBShim = (function() {
  const module = {};

  // URL del Google Apps Script para respaldo de cierre de turno
  module.urlSheets = 'https://script.google.com/macros/s/AKfycbyApBQuGK7vBpwNVQAbvpQqqQd8xfrd_Hunwtb8hdjyeewlYQAyZpolUOWYYqPNN3MUTw/exec';

  /**
   * Llama a una función del Google Apps Script.
   * Si la red falla, registra el error y devuelve un objeto vacío.
   * @param {string} action
   * @param {object} payload
   * @returns {Promise<object>}
   */
  module.llamar = async function(action, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, 10000);
    try {
      const data = Object.assign({}, payload, { action: action });
      const url = module.urlSheets;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data),
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Error del servidor: ' + res.status);
      const respData = await res.json();
      if (respData.error) throw new Error(respData.error);
      return respData;
    } catch (e) {
      clearTimeout(timeoutId);
      Logger.warn('[DBShim] No se pudo contactar con Google Sheets:', e.message);
      return {};
    }
  };

  module._encolarOperacion = function() {};
  module._procesarSyncQueue = async function() {};
  module._saveSyncQueue = function() {};
  module._cargarSyncQueueLocal = function() { return []; };

  return module;
})();