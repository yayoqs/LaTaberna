/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/managers/turno-manager.js
   Versión: 1.3.1
   Propósito: Cierre de turno, respaldo en Google Drive y reseteo del sistema.
              v1.3.0: guarda anti doble cierre con clave de idempotencia.
              v1.3.1: elimina la emisión duplicada de turno:cerrado
                      dentro del listener de turno:solicitar_cierre.
   Dependencias:
     · js/lib/eventBus.js
     · js/lib/logger.js
     · js/db.js
     · js/utils.js
     · js/db-core.js
   ================================================================ */

import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { mostrarToast } from '../utils.js';
import { mesaVacia } from '../db-core.js';

export const TurnoManager = (() => {

  let _cerrandoTurno = false;
  const _clavesProcesadas = new Set();

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

  async function cerrarTurno(opciones = {}) {
    if (_cerrandoTurno) {
      Logger.warn('[TurnoManager] cerrarTurno ignorado: ya hay un cierre en curso.');
      return { exito: false, mensaje: 'Ya hay un cierre de turno en curso.' };
    }

    const turno = _getTurnoActual();
    if (!turno || turno.estado !== 'abierto') {
      Logger.warn('[TurnoManager] No hay un turno abierto para cerrar.');
      return { exito: false, mensaje: 'No hay un turno abierto para cerrar.' };
    }

    // Idempotencia
    const clave = opciones.claveIdempotencia || null;
    if (clave) {
      if (_clavesProcesadas.has(clave)) {
        Logger.info('[TurnoManager] Cierre ya procesado para clave ' + clave);
        return { exito: true, mensaje: 'Turno ya cerrado previamente.' };
      }
      _clavesProcesadas.add(clave);
    }

    _cerrandoTurno = true;
    try {
      const auditLog = _getAuditLog(turno.id);

      const datosTurno = {
        turnoId: turno.id,
        inicio: turno.inicio,
        cierre: new Date().toISOString(),
        observaciones: opciones.observaciones || '',
        pedidos: DB.pedidos || [],
        auditLog: auditLog,
        mesas: DB.mesas ? DB.mesas.filter(m => m.estado !== 'libre') : []
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
    } finally {
      _cerrandoTurno = false;
    }
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
    await cerrarTurno();
  });

  return {
    cerrarTurno,
    obtenerEstado
  };
})();