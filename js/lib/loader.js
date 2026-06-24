/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/lib/loader.js
   Versión: 1.0.0
   Propósito: Verifica que las dependencias globales estén disponibles antes de ejecutar Bootstrap. Si hay faltantes críticos, recarga la página.
   Dependencias: js/utils.js (showToast)
   ================================================================ */
var Loader = (function() {
  var DEPENDENCIAS = [
    // Utilidades globales de utils.js
    { nombre: '$id',             archivo: 'js/utils.js' },
    { nombre: 'fmtMoney',        archivo: 'js/utils.js' },
    { nombre: 'showToast',       archivo: 'js/utils.js' },
    { nombre: 'calcularTotal',   archivo: 'js/utils.js' },
    { nombre: 'fmtHoraCorta',    archivo: 'js/utils.js' },
    // Módulos del núcleo
    { nombre: 'Logger',          archivo: 'js/lib/logger.js' },
    { nombre: 'EventBus',        archivo: 'js/lib/eventBus.js' },
    { nombre: 'Store',           archivo: 'js/lib/store.js' },
    { nombre: 'CommandBus',      archivo: 'js/lib/command-bus.js' },
    { nombre: 'Deps',            archivo: 'js/lib/deps.js' },
    { nombre: 'Appwrite',        archivo: 'js/appwrite.min.js' },
    { nombre: 'DBAppwrite',      archivo: 'js/db-appwrite.js' },
    { nombre: 'DBShim',          archivo: 'js/db-shim.js' },
    { nombre: 'DB',              archivo: 'js/db.js' }
  ];

  var MAX_INTENTOS = 10;
  var intento = 0;
  var callbackListo = null;

  function verificar() {
    var faltantes = [];
    for (var i = 0; i < DEPENDENCIAS.length; i++) {
      var dep = DEPENDENCIAS[i];
      if (typeof window[dep.nombre] === 'undefined') {
        faltantes.push(dep.nombre);
      }
    }

    if (faltantes.length === 0) {
      console.log('[Loader] Todas las dependencias listas.');
      if (callbackListo) callbackListo();
      return;
    }

    intento++;
    if (intento > MAX_INTENTOS) {
      console.error('[Loader] Faltan: ' + faltantes.join(', ') + '. Recargando.');
      if (typeof showToast === 'function') {
        showToast('error', 'Error al cargar recursos. Recargando...');
      }
      setTimeout(function() { location.reload(); }, 1500);
      return;
    }

    console.warn('[Loader] Intento ' + intento + ': faltan ' + faltantes.join(', '));
    setTimeout(verificar, 500);
  }

  /**
   * Inicia la verificación y ejecuta el callback cuando todo esté listo.
   * @param {function} cb - función a ejecutar cuando las dependencias estén listas
   */
  function cuandoListo(cb) {
    callbackListo = cb;
    verificar();
  }

  return { cuandoListo: cuandoListo };
})();

window.Loader = Loader;