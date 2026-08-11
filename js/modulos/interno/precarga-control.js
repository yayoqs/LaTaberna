/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO JS (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.2.2
   Propósito: Control de precargas del cliente. Escucha eventos de
              precarga y permite al mesero revisarlas y cargarlas
              en el pedido activo.
              v2.2.2: Adaptado al modelo unificado de pedidos.
                      Busca el pedido con estado=precarga asociado
                      a la mesa si el precargaId no coincide.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { CommandBus } from '../../lib/command-bus.js';
import { Store } from '../../lib/store.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { DB } from '../../db.js';
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
      // Buscar el pedido de precarga: primero por ID directo, luego por mesa + estado + origen
      let pedidoPrecarga = null;
      const todosPedidos = await DBAppwrite.listar('pedidos');
      
      // Buscar por ID directo (compatibilidad con IDs reales de Appwrite)
      pedidoPrecarga = todosPedidos.find(p => p.id === precargaId);
      
      // Si no se encuentra por ID, buscar por mesa + estado precarga + origen cliente
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

      // Marcar como revisado
      await DBAppwrite.actualizar('pedidos', pedidoPrecarga.id, {
        estado: 'revisado',
        nombre_comensal: datos.nombre_comensal || pedidoPrecarga.nombre_comensal,
        revisadoPor: revisadoPor
      });

      Logger.info('[PrecargaControl] Precarga ' + pedidoPrecarga.id + ' marcada como revisada.');

      // Emitir evento con los ítems para cargar en el pedido activo
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

      // Limpiar caché local
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