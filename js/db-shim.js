/* ================================================================
   Raíz — MÓDULO: db-shim.js (v1.0)
   Propósito: Compatibilidad con Google Apps Script para funciones
              que no migraron a Appwrite (eventos, perfil, cierre
              de turno). Proporciona urlSheets, llamar y versiones
              vacías de los métodos de sincronización antiguos.
   ================================================================ */
var DBShim = (function() {
  var module = {};

  // URL del Google Apps Script (debe coincidir con tu despliegue)
  module.urlSheets = 'https://script.google.com/macros/s/AKfycbylhfXpCU_RA49avGsxaK5SIpRVhrxfto0IRJ94R4QOcbfC8Z8AI2wdxGTb5z_wBV8VzQ/exec';

  /**
   * Llama a una función del Google Apps Script (eventos, perfil, cierre de turno).
   * @param {string} action
   * @param {object} payload
   * @returns {Promise<object>}
   */
  module.llamar = async function(action, payload) {
  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
  try {
    var data = Object.assign({}, payload, { action: action });
    var url = module.urlSheets; // Ya no usamos parámetros en la URL
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
    throw e;
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