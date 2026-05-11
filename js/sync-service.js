/* ================================================================
   PubPOS — MÓDULO: sync-service.js (v1.1 – polling periódico + evento)
   ================================================================ */
const SyncService = (() => {
  const INTERVAL_MS = 60 * 1000; // 60 segundos
  let _intervalId = null;

  function iniciar() {
    if (_intervalId) {
      Logger.warn('[SyncService] Ya está iniciado.');
      return;
    }

    Logger.info('[SyncService] Iniciando sincronización periódica cada 60 seg.');

    // Primera sincronización a los 5 segundos de iniciar
    setTimeout(() => _procesar(), 5000);

    _intervalId = setInterval(() => {
      _procesar();
    }, INTERVAL_MS);
  }

  function detener() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
      Logger.info('[SyncService] Servicio detenido.');
    }
  }

  async function _procesar() {
    if (!navigator.onLine) {
      Logger.debug('[SyncService] Sin conexión, se omite sincronización.');
      return;
    }

    try {
      // 1. Procesar cola offline pendiente
      if (typeof DB !== 'undefined' && DB.syncQueue && DB.syncQueue.length > 0) {
        Logger.info(`[SyncService] Procesando cola (${DB.syncQueue.length} pendientes)...`);
        if (typeof DB._procesarSyncQueue === 'function') {
          await DB._procesarSyncQueue();
        }
      }

      // 2. Sincronización ligera para detectar cambios externos
      if (typeof DB !== 'undefined' && DB.sincronizarTodo) {
        await DB.sincronizarTodo();
      }

      // Emitir evento de sincronización exitosa
      EventBus.emit('sync:completada', Date.now());
    } catch (e) {
      Logger.error('[SyncService] Error en sincronización periódica:', e);
    }
  }

  return {
    iniciar,
    detener
  };
})();

window.SyncService = SyncService;