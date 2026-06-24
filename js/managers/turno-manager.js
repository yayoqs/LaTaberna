/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/managers/turno-manager.js
   Versión: 1.0.0
   Propósito: Cierre de turno, respaldo en Google Drive y reseteo del sistema.
   Dependencias: js/managers/pedido-manager.js, js/lib/logger.js, js/db.js, js/utils.js (showToast), js/lib/eventBus.js, js/ui/mesas.js, js/ui/kds.js, js/ui/caja.js, js/ui/reparto.js, js/db-core.js (mesaVacia)
   ================================================================ */
const TurnoManager = (() => {

  /**
   * Cierra el turno actual, guarda respaldo en Drive y resetea el sistema.
   * @returns {Promise<{exito: boolean, mensaje: string, urlArchivo?: string}>}
   */
  async function cerrarTurno() {
    if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
      return { exito: false, mensaje: 'Sistema de turnos no disponible.' };
    }
    const turno = PedidoManager.getTurnoActual();
    if (!turno || turno.estado !== 'abierto') {
      return { exito: false, mensaje: 'No hay un turno abierto para cerrar.' };
    }

    const datosTurno = {
      turnoId: turno.id,
      inicio: turno.inicio,
      cierre: new Date().toISOString(),
      pedidos: (typeof DB !== 'undefined' && DB.pedidos) ? DB.pedidos : [],
      pedidosDelivery: (typeof DB !== 'undefined' && DB.pedidosDelivery) ? DB.pedidosDelivery : [],
      auditLog: (typeof PedidoManager.getAuditLog === 'function') ? PedidoManager.getAuditLog() : [],
      mesas: (typeof DB !== 'undefined' && DB.mesas) ? DB.mesas.filter(m => m.estado !== 'libre') : [],
      syncQueue: (typeof DB !== 'undefined' && DB.syncQueue) ? DB.syncQueue : []
    };

    Logger.info(`[TurnoManager] Cerrando turno ${turno.id}...`);

    let urlArchivo = null;
    try {
      if (typeof DB !== 'undefined' && typeof DB.llamar === 'function') {
        showToast('info', '<i class="fas fa-cloud-upload-alt fa-spin"></i> Subiendo cierre de turno...');
        const respuesta = await DB.llamar('guardarCierreTurno', {
          turnoId: turno.id,
          datos: datosTurno
        });
        if (respuesta && !respuesta.error) {
          urlArchivo = respuesta.urlArchivo || respuesta.fileUrl || null;
          Logger.info(`[TurnoManager] Archivo guardado en Drive: ${urlArchivo}`);
        } else {
          throw new Error(respuesta.error || 'Respuesta inesperada del servidor');
        }
      }
    } catch (error) {
      Logger.error('[TurnoManager] Error al subir el cierre:', error);
      let mensajeError = error.message;
      if (mensajeError === 'Failed to fetch') {
        mensajeError = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
      }
      const backupKey = 'pubpos_backup_fallback_' + turno.id;
      localStorage.setItem(backupKey, JSON.stringify(datosTurno));
      showToast('error', `No se pudo subir el cierre: ${mensajeError}. Se guardó un respaldo local.`);
    }

    try {
      _resetearLocalStorage();
      Logger.info('[TurnoManager] Sistema local reseteado.');
    } catch (e) {
      Logger.error('[TurnoManager] Error al resetear:', e);
      return { exito: false, mensaje: 'El archivo se subió, pero hubo un error al resetear el sistema local.' };
    }

    if (typeof PedidoManager.init === 'function') {
      const nuevoTurno = PedidoManager.init();
      Logger.info(`[TurnoManager] Nuevo turno iniciado: ${nuevoTurno.id}`);
    }

    return {
      exito: true,
      mensaje: 'Turno cerrado correctamente.',
      urlArchivo: urlArchivo
    };
  }

  function _resetearLocalStorage() {
    if (typeof DB !== 'undefined' && DB.mesas) {
      DB.mesas.forEach(m => {
        if (!m.esVirtual) {
          const idx = DB.mesas.findIndex(x => x.numero === m.numero);
          if (idx >= 0) DB.mesas[idx] = mesaVacia(m.numero);
        }
      });
      DB.mesas = DB.mesas.filter(m => !m.esVirtual);
      DB.saveMesas();
    }

    if (typeof DB !== 'undefined' && DB.pedidos) {
      DB.pedidos = [];
      DB.savePedidos();
    }

    if (typeof DB !== 'undefined' && DB.pedidosDelivery) {
      DB.pedidosDelivery = [];
      DB.savePedidosDelivery();
    }

    if (typeof DB !== 'undefined' && DB.comandas) {
      DB.comandas = [];
      DB.saveComandas();
    }

    if (typeof DB !== 'undefined' && DB.syncQueue) {
      DB.syncQueue = [];
      if (typeof DB._saveSyncQueue === 'function') {
        DB._saveSyncQueue();
      }
    }

    const turno = PedidoManager.getTurnoActual();
    if (turno) {
      localStorage.removeItem('pubpos_audit_' + turno.id);
    }

    localStorage.setItem('pubpos_turno_actual', JSON.stringify({ ...turno, estado: 'cerrado' }));

    if (window.Mesas) Mesas.render();
    if (window.KDS) KDS.refresh();
    if (window.Caja) Caja.render();
    if (window.Reparto) Reparto.render();

    EventBus.emit('turno:cerrado', { timestamp: new Date().toISOString() });
  }

  /**
   * Devuelve el estado del turno actual sin modificarlo.
   * @returns {object|null}
   */
  function obtenerEstado() {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.getTurnoActual) {
      return PedidoManager.getTurnoActual();
    }
    const raw = localStorage.getItem('pubpos_turno_actual');
    return raw ? JSON.parse(raw) : null;
  }

  return {
    cerrarTurno,
    obtenerEstado
  };
})();

window.TurnoManager = TurnoManager;