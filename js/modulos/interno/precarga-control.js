/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO JS (ES6)
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 2.3.3
   Propósito: Control de precargas del cliente.

   v2.3.3: B1.9 — Reactivación de `revisadoPor` en el update a
           Appwrite. La columna fue agregada a laTaberna_Pedidos
           por Célula A (A.72), tipo varchar size 100, no
           obligatoria. Se persiste quién revisó la precarga.

   v2.3.2: Adapter para CommandBus. El handler interno espera
           { precargaId, mesa, revisadoPor } directo; CommandBus
           pasa { type, datos }. Se envuelve con
           _revisarPrecargaViaCommandBus.

   v2.3.1: Payload sin `revisadoPor` (columna inexistente en
           ese momento).

   v2.3.0: B1.6 (estado 'abierta'), B1.7 (listener
           precarga:cargar_en_comanda).

   v2.2.4: Muestra toast al fallar operaciones.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { CommandBus } from '../../lib/command-bus.js';
import { Store } from '../../lib/store.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Auth } from '../../auth.js';
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

  /**
   * B1.7: listener para el botón "Cargar" de mesa-detalles.
   */
  function _onCargarEnComanda(datos) {
    if (!datos || !datos.precargaId) {
      Logger.warn('[PrecargaControl] precarga:cargar_en_comanda sin precargaId.');
      return;
    }
    Logger.info('[PrecargaControl] Cargar en comanda solicitado:', datos.precargaId);

    _revisarPrecarga({
      precargaId: datos.precargaId,
      mesa: datos.mesa,
      revisadoPor: Auth.obtenerNombre?.() || 'mesero'
    });
  }

  /**
   * Handler interno. Espera un objeto { precargaId, mesa, ... }
   * directo. NO recibe el envoltorio de CommandBus. El adapter
   * `_revisarPrecargaViaCommandBus` hace la traducción.
   */
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
        Logger.warn('[PrecargaControl] No se encontró el pedido de precarga para mesa ' + mesa + ' (precargaId: ' + precargaId + ')');
        mostrarToast('warning', 'No se encontró la precarga. Es posible que ya haya sido revisada.');
        return { exito: false, error: 'Precarga no encontrada.' };
      }

      // v2.3.3: B1.9 — `revisadoPor` reactivado. Columna agregada
      // por Célula A (A.72), varchar size 100, no obligatoria.
      const payload = {
        estado: 'abierta',
        revisadoPor: revisadoPor || ''
      };
      if (datos.nombre_comensal || pedidoPrecarga.nombre_comensal) {
        payload.nombre_comensal = datos.nombre_comensal || pedidoPrecarga.nombre_comensal;
      }

      const actualizado = await DBAppwrite.actualizar('pedidos', pedidoPrecarga.id, payload);

      if (!actualizado) {
        mostrarToast('error', 'No se pudo actualizar la precarga en Appwrite.');
        return { exito: false, error: 'No se pudo actualizar la precarga.' };
      }

      Logger.info(
        '[PrecargaControl] Precarga ' + pedidoPrecarga.id +
        ' revisada por ' + (revisadoPor || 'desconocido') +
        ' (estado: abierta, revisadoPor persistido).'
      );

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
      mostrarToast('error', 'Error al revisar precarga: ' + (e.message || 'sin detalle'));
      return { exito: false, error: e.message };
    }
  }

  /**
   * v2.3.2: adapter para CommandBus. El bus pasa { type, datos }.
   * Este wrapper extrae datos y delega en _revisarPrecarga.
   */
  async function _revisarPrecargaViaCommandBus(command) {
    const datos = command?.datos ?? command;
    return _revisarPrecarga(datos);
  }

  function activar() {
    EventBus.on('cliente:precarga_enviada', _onPrecargaEnviada);
    EventBus.on('precarga:cargar_en_comanda', _onCargarEnComanda);
    CommandBus.registrar('precarga:revisar', _revisarPrecargaViaCommandBus);
    Logger.info('[PrecargaControl] Módulo activado (v2.3.3).');
  }

  return { activar };
})();