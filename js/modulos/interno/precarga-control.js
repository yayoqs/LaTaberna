/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.1.4
   Propósito: Recepción de precargas, insignia, carga en comanda.
              Row Security. Desacoplado de Mesas y Comanda.
   Dependencias: EventBus, Logger, Auth, CommandBus, DBAppwrite, showToast
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { Auth } from '../../auth.js';
import { CommandBus } from '../../lib/command-bus.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { showToast } from '../../utils.js';

const PrecargaControl = (() => {
  const _precargas = new Map();

  function _onPrecargaEnviada(data) {
    if (!data || !data.id || !data.mesa || !Array.isArray(data.items)) {
      Logger.warn('[PrecargaControl] Payload inválido:', data);
      return;
    }
    const { id, mesa, items } = data;
    _precargas.set(id, { mesa, items, data });

    // Emitir evento para que Mesas muestre el badge
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

    // Emitir evento para que Comanda procese los ítems
    EventBus.emit('precarga:items_listos', {
      mesa: payload.mesa,
      items: precarga.items,
      precargaId: payload.precargaId
    });

    const mozo = 'Garzón'; // Se podría obtener desde otro lado si es necesario
    const resultado = await CommandBus.ejecutar({
      type: 'precarga:revisar',
      datos: { precargaId, revisadoPor: mozo }
    });

    if (resultado.exito) {
      showToast('success', `Precarga cargada en mesa ${mesa}.`);
      _precargas.delete(precargaId);
      Logger.info(`[PrecargaControl] Precarga ${precargaId} marcada como revisada.`);
    } else {
      showToast('error', 'No se pudo actualizar la precarga. Reintentá.');
      Logger.error('[PrecargaControl] Error al revisar precarga:', resultado.error);
    }
  }

  // ── Registrar comando con Row Security ──
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

  Logger.info('[PrecargaControl] Módulo inicializado (ES6 v2.1.4 — desacoplado).');

  return { _precargas };
})();

export { PrecargaControl };