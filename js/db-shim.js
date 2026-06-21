/* ================================================================
   Raíz — MÓDULO: db-shim.js (v1.1 – llamar tolerante a fallos)
   Propósito: Compatibilidad con Google Apps Script para funciones
              que no migraron a Appwrite (eventos, perfil, cierre
              de turno). Proporciona urlSheets, llamar y versiones
              vacías de los métodos de sincronización antiguos.
   ================================================================ */
var DBShim = (function() {
  var module = {};

  // URL del Google Apps Script (actualizada con CORS habilitado)
  module.urlSheets = 'https://script.google.com/macros/s/AKfycbyApBQuGK7vBpwNVQAbvpQqqQd8xfrd_Hunwtb8hdjyeewlYQAyZpolUOWYYqPNN3MUTw/exec';

  /**
   * Llama a una función del Google Apps Script (eventos, perfil, cierre de turno).
   * Si la red falla, devuelve un objeto vacío en lugar de propagar el error,
   * para no interrumpir la experiencia del usuario.
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

  // Métodos vacíos para evitar errores en llamadas remanentes
  module.syncGuardarPedido = async function() {};
  module.syncGuardarProducto = async function() {};
  module.syncEliminarProducto = async function() {};
  module.syncGuardarMozo = async function() {};
  module.syncGuardarIngrediente = async function() {};
  module.syncEliminarIngrediente = async function() {};
  module.syncGuardarReceta = async function() {};
  module._encolarOperacion = function() {};
  module._procesarSyncQueue = async function() {};
  module._saveSyncQueue = function() {};
  module._cargarSyncQueueLocal = function() { return []; };

  return module;
})();

window.DBShim = DBShim;