/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/managers/turno-manager.js
   Versión: 1.1.1
   Propósito: Cierre de turno, respaldo en Google Drive y reseteo del sistema.
              Desacoplado de UI (emite eventos) y corregida referencia a syncQueue.
              Corrección: migración var→let/const.
   ================================================================ */

import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { mostrarToast } from '../utils.js';
import { mesaVacia } from '../db-core.js';

export const TurnoManager = (() => {

  function _getTurnoActual() {
    const raw = localStorage.getItem('pubpos_turno_actual');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function _getAuditLog(turnoId) {
    const raw = localStorage.getItem('pubpos_audit_' + turnoId);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  async function cerrarTurno() {
    const turno = _getTurnoActual();
    if (!turno || turno.estado !== 'abierto') {
      Logger.warn('[TurnoManager] No hay un turno abierto para cerrar.');
      return { exito: false, mensaje: 'No hay un turno abierto para cerrar.' };
    }

    const auditLog = _getAuditLog(turno.id);

    const datosTurno = {
      turnoId: turno.id,
      inicio: turno.inicio,
      cierre: new Date().toISOString(),
      pedidos: DB.pedidos || [],
      pedidosDelivery: DB.pedidosDelivery || [],
      auditLog: auditLog,
      mesas: DB.mesas ? DB.mesas.filter(m => m.estado !== 'libre') : [],
      syncQueue: DB.syncQueue || []
    };

    Logger.info(`[TurnoManager] Cerrando turno ${turno.id}...`);

    let urlArchivo = null;
    try {
      if (DB.llamar) {
        mostrarToast('info', '<i class="fas fa-cloud-upload-alt fa-spin"></i> Subiendo cierre de turno...');
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
      mostrarToast('error', `No se pudo subir el cierre: ${mensajeError}. Se guardó un respaldo local.`);
    }

    try {
      _resetearLocalStorage(turno);
      Logger.info('[TurnoManager] Sistema local reseteado.');
    } catch (e) {
      Logger.error('[TurnoManager] Error al resetear:', e);
      return { exito: false, mensaje: 'El archivo se subió, pero hubo un error al resetear el sistema local.' };
    }

    localStorage.setItem('pubpos_turno_actual', JSON.stringify({ ...turno, estado: 'cerrado' }));

    EventBus.emit('turno:cerrado', { timestamp: new Date().toISOString() });

    return {
      exito: true,
      mensaje: 'Turno cerrado correctamente.',
      urlArchivo: urlArchivo
    };
  }

  function _resetearLocalStorage(turno) {
    if (DB.mesas) {
      DB.mesas.forEach(m => {
        if (!m.esVirtual) {
          const idx = DB.mesas.findIndex(x => x.numero === m.numero);
          if (idx >= 0) DB.mesas[idx] = mesaVacia(m.numero);
        }
      });
      DB.mesas = DB.mesas.filter(m => !m.esVirtual);
      DB.saveMesas();
      EventBus.emit('mesas:guardadas', DB.mesas);
    }

    if (DB.pedidos) {
      DB.pedidos = [];
      DB.savePedidos();
      EventBus.emit('pedidos:guardados', []);
    }

    if (DB.pedidosDelivery) {
      DB.pedidosDelivery = [];
      DB.savePedidosDelivery();
      EventBus.emit('pedidosDelivery:guardados', []);
    }

    if (DB.comandas) {
      DB.comandas = [];
      DB.saveComandas();
      EventBus.emit('comandas:guardadas', []);
    }

    localStorage.removeItem('pubpos_audit_' + turno.id);
  }

  function obtenerEstado() {
    return _getTurnoActual();
  }

  EventBus.on('turno:solicitar_cierre', async () => {
    const resultado = await cerrarTurno();
    if (resultado.exito) {
      EventBus.emit('turno:cerrado', { timestamp: new Date().toISOString() });
    }
  });

  return {
    cerrarTurno,
    obtenerEstado
  };
})();