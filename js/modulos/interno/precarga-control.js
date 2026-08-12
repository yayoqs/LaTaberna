/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO JS (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.2.3
   Propósito: Control de precargas del cliente. Escucha eventos de
              precarga y permite al mesero revisarlas y cargarlas
              en el pedido activo.
              v2.2.3: Eliminada importación no utilizada de DB
                      (deuda técnica OT-1).
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { CommandBus } from '../../lib/command-bus.js';
import { Store } from '../../lib/store.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { mostrarToast } from '../../utils.js';

export const PrecargaControl = (() => {
  let _precargasCache = [];

  function _onPrecargaEnviada(data) {
    Logger.info('[PrecargaControl] Precarga recibida:', data);
    _precargasCache.push(data);
    EventBus.emit('precarga:nueva', {
      mesa: data.mesa,
      cantidad: _precargasCache.filter(p => p.mesa === data.mesa).length,
      precargaId: data.id || data.precargaId
    });
  }

  async function _revisarPrecarga(datos) {
    const { precargaId, mesa, revisadoPor } = datos;
    Logger.info('[PrecargaControl] Revisando precarga:', precargaId, 'mesa:', mesa);

    try {
      let pedidoPrecarga = null;
      const todosPedidos = await DBAppwrite.listar('pedidos');
      
      pedidoPrecarga = todosPedidos.find(p => p.id === precargaId);
      
      if (!pedidoPrecarga) {
        pedidoPrecarga = todosPedidos.find(p => 
          p.mesa === String(mesa) && 
          p.estado === 'precarga' && 
          p.origen === 'cliente' &&
          p.id_usuario === datos.id_usuario
        );
      }
      
      if (!pedidoPrecarga) {
        Logger.warn('[PrecargaControl] No se encontró el pedido de precarga para mesa ' + mesa);
        mostrarToast('warning', 'No se encontró la precarga. Es posible que ya haya sido revisada.');
        return { exito: false, error: 'Precarga no encontrada.' };
      }

      await DBAppwrite.actualizar('pedidos', pedidoPrecarga.id, {
        estado: 'revisado',
        nombre_comensal: datos.nombre_comensal || pedidoPrecarga.nombre_comensal,
        revisadoPor: revisadoPor
      });

      Logger.info('[PrecargaControl] Precarga ' + pedidoPrecarga.id + ' marcada como revisada.');

      let items = [];
      try {
        items = typeof pedidoPrecarga.items === 'string' 
          ? JSON.parse(pedidoPrecarga.items) 
          : (pedidoPrecarga.items || []);
      } catch (e) {
        Logger.warn('[PrecargaControl] Error al parsear items de la precarga:', e);
      }

      EventBus.emit('precarga:items_listos', {
        mesa: mesa,
        items: items,
        precargaId: pedidoPrecarga.id
      });

      _precargasCache = _precargasCache.filter(p => p.id !== precargaId && p.precargaId !== precargaId);

      return { exito: true, precargaId: pedidoPrecarga.id };
    } catch (e) {
      Logger.error('[PrecargaControl] Error al revisar precarga:', e);
      return { exito: false, error: e.message };
    }
  }

  function activar() {
    EventBus.on('cliente:precarga_enviada', _onPrecargaEnviada);
    CommandBus.registrar('precarga:revisar', _revisarPrecarga);
    Logger.info('[PrecargaControl] Módulo activado.');
  }

  return { activar };
})();