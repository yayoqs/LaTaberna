/* ================================================================
   Raíz — MÓDULO: sync-service.js (v2.0 – Realtime + polling fallback)
   Propósito: Mantiene los datos actualizados entre dispositivos.
              Si Appwrite está habilitado, usa Realtime (WebSockets)
              para sincronización instantánea. Si no, usa polling
              cada 60 segundos contra Google Sheets.
   ================================================================ */
var SyncService = (function() {
  var INTERVAL_MS = 60 * 1000; // 60 segundos para el fallback
  var _intervalId = null;
  var _realtimeActivo = false;

  /**
   * Inicia el servicio de sincronización. Si Appwrite está disponible,
   * se suscribe a eventos Realtime y no usa polling.
   */
  function iniciar() {
    if (_intervalId || _realtimeActivo) {
      Logger.warn('[SyncService] Ya está iniciado.');
      return;
    }

    // ¿Appwrite habilitado?
    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      Logger.info('[SyncService] Usando Appwrite Realtime para sincronización instantánea.');
      DBAppwrite.suscribirRealtime(function(coleccion, tipo) {
        Logger.debug('[SyncService] Cambio detectado via Realtime:', coleccion, tipo);
        
        if (coleccion === 'pedidos') {
          DBAppwrite.listar('pedidos').then(function(pedidos) {
            if (pedidos.length) {
              window.DB.pedidos = pedidos.map(function(p) {
                p.items = typeof p.items === 'string' ? p.items : JSON.stringify(p.items);
                return p;
              });
              window.DB.savePedidos();
              if (typeof Store !== 'undefined') {
                Store.dispatch({ type: 'PEDIDOS_INICIALIZAR', payload: window.DB.pedidos });
              }
              EventBus.emit('sincronizacion:completada');
            }
          }).catch(function(e) {
            Logger.warn('[SyncService] Error al listar pedidos:', e);
          });
        } else if (coleccion === 'comandas') {
          DBAppwrite.listar('comandas').then(function(comandas) {
            if (comandas.length) {
              window.DB.comandas = comandas.map(function(c) {
                c.items = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
                return c;
              });
              window.DB.saveComandas();
              // Emitir cada comanda individualmente para que KDS se actualice
              comandas.forEach(function(c) {
                if (typeof Store !== 'undefined') {
                  Store.dispatch({ type: 'COMANDA_AGREGADA', payload: c });
                }
              });
              EventBus.emit('comandas:guardadas', window.DB.comandas);
            }
          }).catch(function(e) {
            Logger.warn('[SyncService] Error al listar comandas:', e);
          });
        }
      });
      _realtimeActivo = true;
      return;
    }

    // Fallback: polling periódico con Google Sheets
    Logger.info('[SyncService] Iniciando sincronización periódica cada 60 seg.');
    setTimeout(function() { _procesar(); }, 5000);
    _intervalId = setInterval(function() { _procesar(); }, INTERVAL_MS);
  }

  /**
   * Detiene el servicio de sincronización.
   */
  function detener() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    _realtimeActivo = false;
    Logger.info('[SyncService] Servicio detenido.');
  }

  /**
   * Procesa la cola offline y sincroniza con Google Sheets.
   */
  async function _procesar() {
    if (!navigator.onLine) {
      Logger.debug('[SyncService] Sin conexión, se omite sincronización.');
      return;
    }

    try {
      // 1. Procesar cola offline pendiente
      if (typeof DB !== 'undefined' && DB.syncQueue && DB.syncQueue.length > 0) {
        Logger.info('[SyncService] Procesando cola (' + DB.syncQueue.length + ' pendientes)...');
        if (typeof DB._procesarSyncQueue === 'function') {
          await DB._procesarSyncQueue();
        }
      }

      // 2. Sincronización ligera para detectar cambios externos
      if (typeof DB !== 'undefined' && DB.sincronizarTodo) {
        await DB.sincronizarTodo();
      }

      EventBus.emit('sync:completada', Date.now());
    } catch (e) {
      Logger.error('[SyncService] Error en sincronización periódica:', e);
    }
  }

  return {
    iniciar: iniciar,
    detener: detener
  };
})();

window.SyncService = SyncService;