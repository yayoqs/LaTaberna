/* ================================================================
   PubPOS — MÓDULO: turno-manager.js (v1 – Fase 2: Cierre de Turno)
   Propósito: Empaqueta los datos del turno actual, los sube a Drive
              como respaldo histórico y resetea el sistema para un
              nuevo turno limpio.
   ================================================================ */
const TurnoManager = (() => {

  /**
   * Cierra el turno actual, guarda el archivo en Drive y limpia el local.
   * @returns {Promise<{exito: boolean, mensaje: string, urlArchivo?: string}>}
   */
  async function cerrarTurno() {
    // ── 1. Verificar que exista un turno abierto ───────────────
    if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
      return { exito: false, mensaje: 'Sistema de turnos no disponible.' };
    }
    const turno = PedidoManager.getTurnoActual();
    if (!turno || turno.estado !== 'abierto') {
      return { exito: false, mensaje: 'No hay un turno abierto para cerrar.' };
    }

    // ── 2. Recopilar todos los datos del turno ────────────────
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

    console.log(`[TurnoManager] Cerrando turno ${turno.id}... ${datosTurno.pedidos.length} pedidos, ${datosTurno.auditLog.length} registros de auditoría.`);

    // ── 3. Subir el archivo a Google Drive ────────────────────
    let urlArchivo = null;
    try {
      if (typeof DB !== 'undefined' && typeof DB.llamar === 'function') {
        showToast('info', '<i class="fas fa-cloud-upload-alt fa-spin"></i> Subiendo cierre de turno a Drive...');
        const respuesta = await DB.llamar('guardarCierreTurno', {
          turnoId: turno.id,
          datos: datosTurno
        });
        if (respuesta.error) {
          throw new Error(respuesta.error);
        }
        urlArchivo = respuesta.urlArchivo || respuesta.fileUrl || null;
        console.log('[TurnoManager] Archivo guardado en Drive:', urlArchivo);
      } else {
        // Sin conexión con Drive, guardamos localmente como respaldo mínimo
        const backupKey = 'pubpos_backup_' + turno.id;
        localStorage.setItem(backupKey, JSON.stringify(datosTurno));
        console.warn('[TurnoManager] Sin conexión a Drive. Respaldo local guardado en:', backupKey);
      }
    } catch (error) {
      console.error('[TurnoManager] Error al subir el cierre a Drive:', error);
      // Guardar respaldo local para no perder los datos
      const backupKey = 'pubpos_backup_fallback_' + turno.id;
      localStorage.setItem(backupKey, JSON.stringify(datosTurno));
      return {
        exito: false,
        mensaje: `Error al subir el archivo: ${error.message}. Se guardó un respaldo local.`
      };
    }

    // ── 4. Resetear el sistema local ──────────────────────────
    try {
      _resetearLocalStorage();
      console.log('[TurnoManager] Sistema local reseteado.');
    } catch (e) {
      console.error('[TurnoManager] Error al resetear el sistema local:', e);
      return { exito: false, mensaje: 'El archivo se subió, pero hubo un error al resetear el sistema local.' };
    }

    // ── 5. Iniciar un nuevo turno ─────────────────────────────
    if (typeof PedidoManager.init === 'function') {
      const nuevoTurno = PedidoManager.init();
      console.log('[TurnoManager] Nuevo turno iniciado:', nuevoTurno.id);
    }

    return {
      exito: true,
      mensaje: 'Turno cerrado correctamente.',
      urlArchivo: urlArchivo
    };
  }

  /**
   * Limpia todos los datos del turno en localStorage.
   */
  function _resetearLocalStorage() {
    // Limpiar mesas: todas a estado 'libre' y sin pedidos
    if (typeof DB !== 'undefined' && DB.mesas) {
      DB.mesas.forEach(m => {
        if (!m.esVirtual) {
          const idx = DB.mesas.findIndex(x => x.numero === m.numero);
          if (idx >= 0) DB.mesas[idx] = mesaVacia(m.numero);
        }
      });
      // Eliminar mesas virtuales
      DB.mesas = DB.mesas.filter(m => !m.esVirtual);
      DB.saveMesas();
    }

    // Limpiar pedidos
    if (typeof DB !== 'undefined' && DB.pedidos) {
      DB.pedidos = [];
      DB.savePedidos();
    }

    // Limpiar delivery
    if (typeof DB !== 'undefined' && DB.pedidosDelivery) {
      DB.pedidosDelivery = [];
      DB.savePedidosDelivery();
    }

    // Limpiar comandas KDS
    if (typeof DB !== 'undefined' && DB.comandas) {
      DB.comandas = [];
      DB.saveComandas();
    }

    // Limpiar cola de sincronización
    if (typeof DB !== 'undefined' && DB.syncQueue) {
      DB.syncQueue = [];
      if (typeof DB._saveSyncQueue === 'function') {
        DB._saveSyncQueue();
      }
    }

    // Eliminar bitácora del turno actual
    const turno = PedidoManager.getTurnoActual();
    if (turno) {
      localStorage.removeItem('pubpos_audit_' + turno.id);
    }

    // Marcar turno como cerrado
    localStorage.setItem('pubpos_turno_actual', JSON.stringify({ ...turno, estado: 'cerrado' }));

    // Refrescar UI de mesas
    if (window.Mesas && typeof Mesas.render === 'function') {
      Mesas.render();
    }
    if (window.KDS && typeof KDS.refresh === 'function') {
      KDS.refresh();
    }
    if (window.Caja && typeof Caja.render === 'function') {
      Caja.render();
    }
    if (window.Reparto && typeof Reparto.render === 'function') {
      Reparto.render();
    }

    EventBus.emit('turno:cerrado', { timestamp: new Date().toISOString() });
    console.log('[TurnoManager] Evento turno:cerrado emitido.');
  }

  /**
   * Verifica el estado actual del turno sin modificarlo.
   * @returns {object|null} El objeto turno actual o null si no hay.
   */
  function obtenerEstado() {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.getTurnoActual) {
      return PedidoManager.getTurnoActual();
    }
    const raw = localStorage.getItem('pubpos_turno_actual');
    return raw ? JSON.parse(raw) : null;
  }

  /* ── API PÚBLICA ────────────────────────────────────────── */
  return {
    cerrarTurno,
    obtenerEstado
  };
})();

window.TurnoManager = TurnoManager;