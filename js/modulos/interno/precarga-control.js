/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.1.6
   Propósito: Recepción de precargas, insignia, carga en comanda.
              Log de inicialización movido a función activar().
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

  function _onPrecargaEnviada(data) {
    if (!data || !data.id || !data.mesa || !Array.isArray(data.items)) {
      Logger.warn('[PrecargaControl] Payload inválido:', data);
      return;
    }
    const { id, mesa, items } = data;
    _precargas.set(id, { mesa, items, data });

    EventBus.emit('precarga:nueva', {
      mesa: data.mesa,
      cantidad: data.items.length,
      precargaId: data.id
    });

    Logger.info(`[PrecargaControl] Precarga ${id} recibida para mesa ${mesa} con ${items.length} ítems.`);
  }

  async function _onBadgeClick(payload) {
    const { mesa, precargaId } = payload;
    const precarga = _precargas.get(precargaId);
    if (!precarga) {
      Logger.warn('[PrecargaControl] Precarga no encontrada:', precargaId);
      return;
    }

    EventBus.emit('precarga:items_listos', {
      mesa: payload.mesa,
      items: precarga.items,
      precargaId: payload.precargaId
    });

    const mozo = 'Garzón';
    const resultado = await CommandBus.ejecutar({
      type: 'precarga:revisar',
      datos: { precargaId, revisadoPor: mozo }
    });

    if (resultado.exito) {
      mostrarToast('success', `Precarga cargada en mesa ${mesa}.`);
      _precargas.delete(precargaId);
      Logger.info(`[PrecargaControl] Precarga ${precargaId} marcada como revisada.`);
    } else {
      mostrarToast('error', 'No se pudo actualizar la precarga. Reintentá.');
      Logger.error('[PrecargaControl] Error al revisar precarga:', resultado.error);
    }
  }

  function activar() {
    if (_activado) return;
    _activado = true;

    CommandBus.registrar('precarga:revisar', async (datos) => {
      const { precargaId, revisadoPor } = datos;
      try {
        const userId = await Auth.getAppwriteUserId();
        const permisos = userId ? [
          `read("user:${userId}")`,
          `update("user:${userId}")`,
          `delete("user:${userId}")`,
          `read("team:garzones")`,
          `update("team:garzones")`
        ] : null;
        await DBAppwrite.actualizar('precargas_cliente', precargaId, {
          estado: 'revisado',
          revisadoPor
        }, permisos);
        EventBus.emit('precarga:revisada', { precargaId, revisadoPor, timestamp: Date.now() });
        return { exito: true };
      } catch (error) {
        Logger.error('[PrecargaControl] Error al ejecutar precarga:revisar:', error);
        return { exito: false, error: error.message };
      }
    });

    EventBus.on('cliente:precarga_enviada', _onPrecargaEnviada);
    EventBus.on('mesa:badge_click', _onBadgeClick);

    Logger.info('[PrecargaControl] Módulo inicializado (ES6 v2.1.6).');
  }

  activar();

  return { _precargas, activar };
})();

export { PrecargaControl };