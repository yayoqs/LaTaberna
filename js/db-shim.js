/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-shim.js
   Versión: 1.0.5
   Propósito: Compatibilidad con Google Apps Script.
              Solo expone el método llamar para respaldo de cierre
              de turno. Stubs vacíos eliminados.
   ================================================================ */

import { Logger } from './lib/logger.js';

export const DBShim = (function() {
  var module = {};

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
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
    try {
      var data = Object.assign({}, payload, { action: action });
      var url = module.urlSheets;
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data),
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Error del servidor: ' + res.status);
      var respData = await res.json();
      if (respData.error) throw new Error(respData.error);
      return respData;
    } catch (e) {
      clearTimeout(timeoutId);
      Logger.warn('[DBShim] No se pudo contactar con Google Sheets:', e.message);
      return {};
    }
  };

  // Métodos auxiliares requeridos por db.js (no-op, mantenidos para compatibilidad)
  module._encolarOperacion = function() {};
  module._procesarSyncQueue = async function() {};
  module._saveSyncQueue = function() {};
  module._cargarSyncQueueLocal = function() { return []; };

  return module;
})();