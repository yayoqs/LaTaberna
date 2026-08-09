/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.2.1
   Propósito: Precargas adaptadas al nuevo modelo.
              Corrección: Hallazgo 14 — verificar existencia del
              documento antes de actualizar en Appwrite.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { Auth } from '../../auth.js';
import { CommandBus } from '../../lib/command-bus.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { mostrarToast } from '../../utils.js';

const PrecargaControl = (() => {
  const _precargas = new Map();
  let _activado = false;
  let _desuscripcionPrecarga = null;
  let _desuscripcionBadge = null;

  function _onPrecargaEnviada(data) {
    if (!data?.id || !data.mesa || !Array.isArray(data.items)) {
      Logger.warn('[PrecargaControl] Payload inválido:', data);
      return;
    }
    _precargas.set(data.id, { mesa: data.mesa, items: data.items, data });
    EventBus.emit('precarga:nueva', { mesa: data.mesa, cantidad: data.items.length, precargaId: data.id });
    Logger.info(`[PrecargaControl] Precarga ${data.id} para mesa ${data.mesa}`);
  }

  async function _onBadgeClick(payload) {
    const precarga = _precargas.get(payload.precargaId);
    if (!precarga) { Logger.warn('[PrecargaControl] Precarga no encontrada'); return; }

    EventBus.emit('precarga:items_listos', { mesa: payload.mesa, items: precarga.items, precargaId: payload.precargaId });

    const resultado = await CommandBus.ejecutar({ type: 'precarga:revisar', datos: { precargaId: payload.precargaId, revisadoPor: 'Garzón' } });
    if (resultado.exito) {
      mostrarToast('success', `Precarga cargada en mesa ${payload.mesa}.`);
      _precargas.delete(payload.precargaId);
    } else {
      mostrarToast('error', 'No se pudo actualizar la precarga.');
      Logger.error('[PrecargaControl] Error:', resultado.error);
    }
  }

  async function _documentoExiste(coleccion, id) {
    try {
      const resultado = await DBAppwrite.listar(coleccion, { filtro: `$id=${id}`, limite: 1 });
      return resultado && resultado.length > 0;
    } catch (e) {
      Logger.warn('[PrecargaControl] No se pudo verificar existencia del documento:', e);
      return false;
    }
  }

  function activar() {
    if (_activado) return;
    _activado = true;

    CommandBus.registrar('precarga:revisar', async (datos) => {
      try {
        const userId = await Auth.obtenerIdUsuarioAppwrite();
        const permisos = userId ? [`read("user:${userId}")`, `update("user:${userId}")`] : null;

        // Hallazgo 14: verificar existencia antes de actualizar
        const existe = await _documentoExiste('pedidos', datos.precargaId);
        if (!existe) {
          Logger.warn('[PrecargaControl] Documento no encontrado en Appwrite:', datos.precargaId);
          return { exito: false, error: 'El documento no existe en Appwrite' };
        }

        await DBAppwrite.actualizar('pedidos', datos.precargaId, {
          estado: 'revisado',
          revisadoPor: datos.revisadoPor
        }, permisos);
        EventBus.emit('precarga:revisada', { precargaId: datos.precargaId, revisadoPor: datos.revisadoPor, timestamp: Date.now() });
        return { exito: true };
      } catch (error) {
        Logger.error('[PrecargaControl] Error en comando:', error);
        return { exito: false, error: error.message };
      }
    });

    _desuscripcionPrecarga = EventBus.on('cliente:precarga_enviada', _onPrecargaEnviada);
    _desuscripcionBadge = EventBus.on('mesa:badge_click', _onBadgeClick);
    Logger.info('[PrecargaControl] v2.2.1 inicializado.');
  }

  function limpiar() {
    _desuscripcionPrecarga?.(); _desuscripcionPrecarga = null;
    _desuscripcionBadge?.(); _desuscripcionBadge = null;
    _activado = false;
  }

  activar();
  return { _precargas, activar, limpiar };
})();

export { PrecargaControl };