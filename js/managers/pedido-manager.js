/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/managers/pedido-manager.js
   Versión: 1.2.1
   Propósito: Gestor de pedidos de mesa, turnos y auditoría.
              Eliminado repo redundante en comando crearPedidoMesa.
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { CommandBus } from '../lib/command-bus.js';
import { Auth } from '../auth.js';
import { PedidoRepositoryLocal } from '../repositorios/pedido-repository.js';

export const PedidoManager = (() => {
  let turnoActual = null;
  let auditLog = [];
  let _pedidoRepo = null;

  function init(options = {}) {
    if (options.pedidoRepo) {
      _pedidoRepo = options.pedidoRepo;
    } else {
      _pedidoRepo = PedidoRepositoryLocal;
    }

    const turnoGuardado = localStorage.getItem('pubpos_turno_actual');
    if (turnoGuardado) {
      try {
        turnoActual = JSON.parse(turnoGuardado);
      } catch (e) {
        Logger.warn('[PedidoManager] Error al parsear turno guardado, se iniciará uno nuevo:', e);
        turnoActual = null;
      }
    }

    if (!turnoActual || turnoActual.estado === 'cerrado') {
      _iniciarNuevoTurno();
    }

    _cargarAuditLog();

    EventBus.emit('turno:iniciado', turnoActual);
    Logger.info(`[PedidoManager] Turno activo: ${turnoActual.id} (${auditLog.length} registros).`);
    return turnoActual;
  }

  function _iniciarNuevoTurno() {
    const ahora = new Date();
    const id = 'turno_' +
      ahora.getFullYear() +
      String(ahora.getMonth() + 1).padStart(2, '0') +
      String(ahora.getDate()).padStart(2, '0') + '_' +
      String(ahora.getHours()).padStart(2, '0') +
      String(ahora.getMinutes()).padStart(2, '0') +
      String(ahora.getSeconds()).padStart(2, '0');

    turnoActual = { id, inicio: ahora.toISOString(), estado: 'abierto' };
    localStorage.setItem('pubpos_turno_actual', JSON.stringify(turnoActual));
    auditLog = [];
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
  }

  function _cargarAuditLog() {
    if (!turnoActual) return;
    const raw = localStorage.getItem('pubpos_audit_' + turnoActual.id);
    if (raw) {
      try {
        auditLog = JSON.parse(raw);
      } catch (e) {
        Logger.warn('[PedidoManager] Error al parsear audit log, se inicializa vacío:', e);
        auditLog = [];
      }
    } else {
      auditLog = [];
    }
  }

  function _guardarAuditLog() {
    if (!turnoActual) return;
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
    EventBus.emit('audit:actualizado', { turnoId: turnoActual.id, total: auditLog.length });
  }

  function _registrarAuditoria(tipo, datos) {
    const entrada = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      timestamp: new Date().toISOString(),
      tipo, datos,
      usuario: Auth.obtenerNombre ? Auth.obtenerNombre() : 'sistema'
    };
    auditLog.push(entrada);
    _guardarAuditLog();
    Logger.debug(`[Audit] ${tipo}:`, datos);
  }

  async function crearPedidoMesa(numeroMesa, mozo, comensales) {
    try {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa, mozo, comensales }
      });
      if (resultado.exito) return resultado.data;
      Logger.error('[PedidoManager] Error vía CommandBus:', resultado.error);
      return null;
    } catch (e) {
      Logger.error('[PedidoManager] Error al crear pedido:', e);
      return null;
    }
  }

  function finalizarTurno() {
    EventBus.emit('turno:solicitar_cierre');
  }

  return {
    init,
    obtenerTurnoActual: () => turnoActual,
    obtenerAuditoria: () => auditLog,
    crearPedidoMesa,
    registrar: _registrarAuditoria,
    finalizarTurno
  };
})();