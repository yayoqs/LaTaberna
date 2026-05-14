/* ================================================================
   Raíz — MÓDULO: loader.js (v1.1)
   Propósito: Verificar que las dependencias globales esenciales
              estén disponibles antes de ejecutar los comandos y la UI.
   ================================================================ */
(function() {
  // Lista de módulos que DEBEN estar en window antes de seguir
  var DEPENDENCIAS = [
    { nombre: 'Logger',       archivo: 'js/lib/logger.js' },
    { nombre: 'EventBus',     archivo: 'js/lib/eventBus.js' },
    { nombre: 'Store',        archivo: 'js/lib/store.js' },
    { nombre: 'CommandBus',   archivo: 'js/lib/command-bus.js' },
    { nombre: 'Deps',         archivo: 'js/lib/deps.js' },
    { nombre: 'Appwrite',     archivo: 'js/appwrite.min.js' },
    { nombre: 'DBAppwrite',   archivo: 'js/db-appwrite.js' },
    { nombre: 'DB',           archivo: 'js/db.js' }
  ];

  var MAX_INTENTOS = 5;
  var intento = 0;

  function verificarDependencias() {
    var faltantes = [];
    for (var i = 0; i < DEPENDENCIAS.length; i++) {
      var dep = DEPENDENCIAS[i];
      if (typeof window[dep.nombre] === 'undefined') {
        faltantes.push(dep.nombre);
      }
    }

    if (faltantes.length === 0) {
      console.log('[Loader] Todas las dependencias están listas.');
      return;
    }

    intento++;
    if (intento > MAX_INTENTOS) {
      console.error('[Loader] Faltan dependencias después de ' + MAX_INTENTOS + ' intentos: ' + faltantes.join(', '));
      // Recargar la página para forzar una carga limpia
      if (typeof showToast === 'function') {
        showToast('error', 'Error al cargar la aplicación. Recargando...');
      }
      setTimeout(function() { location.reload(); }, 1500);
      return;
    }

    console.warn('[Loader] Intento ' + intento + ': faltan ' + faltantes.join(', '));
    setTimeout(verificarDependencias, 600);
  }

  // Empezar a verificar inmediatamente, porque los scripts ya deberían estar ejecutados
  verificarDependencias();
})();