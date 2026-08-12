/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-fusion.js
   Versión: 1.1.0
   Propósito: Lógica de fusión y liberación de mesas virtuales.
              v1.1.0: consolida ítems, total y comensales desde los
                      pedidos activos (DB.pedidos) en lugar de leer
                      propiedades eliminadas de Mesas. Incluye
                      sanitización de nombres de mesa virtual.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { mesaVacia } from './db-core.js';

export const DBFusion = (function() {
  const module = {};

  /**
   * Sanitiza un nombre de mesa para que cumpla con las restricciones de Appwrite.
   * Reglas: a-z, A-Z, 0-9, punto, guion, guion bajo. Máximo 36 caracteres.
   * @param {string} nombre - Nombre a sanitizar
   * @returns {string} Nombre sanitizado
   */
  function _sanitizarNombreMesa(nombre) {
    if (!nombre || typeof nombre !== 'string') return '';
    let sanitizado = nombre.trim().substring(0, 36);
    sanitizado = sanitizado.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (sanitizado.startsWith('.') || sanitizado.startsWith('-') || sanitizado.startsWith('_')) {
      sanitizado = 'm' + sanitizado.substring(0, 35);
    }
    return sanitizado || 'mesa_virtual';
  }

  /**
   * Fusiona varias mesas en una mesa virtual.
   * @param {number[]} numeros - Números de las mesas a fusionar
   * @param {string} mozo - Mozo asignado a la mesa virtual
   * @param {string} [nombrePersonalizado] - Nombre opcional para la mesa virtual
   * @returns {object|null} La mesa virtual creada o null si falla
   */
  module.fusionarMesas = function(numeros, mozo, nombrePersonalizado) {
    const mesasSeleccionadas = numeros.map(num => this.getMesa(num)).filter(m => m);
    if (mesasSeleccionadas.length !== numeros.length) {
      Logger.warn('[DBFusion] Algunas mesas no existen.');
      return null;
    }

    const estadosPermitidos = ['libre', 'ocupada', 'esperando'];
    if (!mesasSeleccionadas.every(m => estadosPermitidos.includes(m.estado))) {
      Logger.warn('[DBFusion] Solo se pueden fusionar mesas libres, ocupadas o esperando.');
      return null;
    }

    // Recolectar todas las mesas originales involucradas
    let todasOriginales = [];
    mesasSeleccionadas.forEach(m => {
      if (m.esVirtual && m.mesasFusionadas) {
        todasOriginales.push(...m.mesasFusionadas);
      } else {
        todasOriginales.push(m.numero);
      }
    });
    todasOriginales = [...new Set(todasOriginales)].sort((a,b) => a-b);

    // Marcar las originales como fusionadas
    todasOriginales.forEach(num => {
      const original = this.mesas.find(m => m.numero === num && !m.esVirtual);
      if (original) original.estado = 'fusionada';
    });

    // Consolidar ítems, total y comensales desde los pedidos activos
    let itemsConsolidados = [];
    let totalConsolidado = 0;
    let comensalesTotales = 0;
    let pedidoIdUnico = null;

    mesasSeleccionadas.forEach(m => {
      // Sumar comensales
      comensalesTotales += (m.comensales || 1);

      if (m.pedidoId && this.pedidos) {
        const pedido = this.pedidos.find(p => p.id === m.pedidoId);
        if (pedido) {
          // Establecer el pedidoId para la mesa virtual (usa el primero encontrado)
          if (!pedidoIdUnico) pedidoIdUnico = pedido.id;

          // Consolidar ítems
          try {
            const itemsPedido = typeof pedido.items === 'string'
              ? JSON.parse(pedido.items)
              : (pedido.items || []);
            itemsConsolidados.push(...itemsPedido);
          } catch (e) {
            Logger.warn('[DBFusion] Error al parsear items del pedido ' + pedido.id + ':', e);
          }

          // Consolidar total
          totalConsolidado += (pedido.total || 0);
        }
      }

      // Eliminar mesas virtuales intermedias
      if (m.esVirtual) {
        const idx = this.mesas.findIndex(mesa => mesa.numero === m.numero);
        if (idx >= 0) this.mesas.splice(idx, 1);
      }
    });

    // Determinar el identificador de la mesa virtual
    let numeroVirtual;

    if (nombrePersonalizado && nombrePersonalizado.trim() !== '') {
      const nombre = nombrePersonalizado.trim();

      // Validar que no exista otra mesa con ese identificador
      const existe = this.mesas.some(m => String(m.numero) === nombre);
      if (existe) {
        Logger.warn('[DBFusion] Ya existe una mesa con el identificador: ' + nombre);
        return null;
      }

      numeroVirtual = nombre;
    } else {
      // Formato automático: "1+2"
      numeroVirtual = todasOriginales.join('+');
    }

    // Sanitizar el nombre para cumplir con restricciones de Appwrite
    const numeroVirtualSanitizado = _sanitizarNombreMesa(numeroVirtual);
    if (numeroVirtualSanitizado !== numeroVirtual) {
      Logger.info('[DBFusion] Nombre de mesa virtual sanitizado: "' + numeroVirtual + '" → "' + numeroVirtualSanitizado + '"');
    }

    const mesaVirtual = {
      numero: numeroVirtualSanitizado,
      estado: itemsConsolidados.length > 0 ? 'ocupada' : 'libre',
      pedidoId: pedidoIdUnico,
      items: itemsConsolidados,
      mozo: mozo,
      comensales: comensalesTotales,
      abiertaEn: Date.now(),
      observaciones: '',
      mesasFusionadas: todasOriginales,
      esVirtual: true,
      total: totalConsolidado,
      zona: mesasSeleccionadas[0].zona || 'salon'
    };

    this.mesas.push(mesaVirtual);
    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    return mesaVirtual;
  };

  /**
   * Libera las mesas que estaban fusionadas en una mesa virtual.
   * @param {object} mesaVirtual - La mesa virtual a liberar
   */
  module.liberarMesasFusionadas = function(mesaVirtual) {
    if (!mesaVirtual.esVirtual || !mesaVirtual.mesasFusionadas) return;

    mesaVirtual.mesasFusionadas.forEach(num => {
      const idx = this.mesas.findIndex(m => m.numero === num);
      if (idx >= 0) {
        this.mesas[idx] = mesaVacia(num);
      }
    });

    const idxVirtual = this.mesas.findIndex(m => m.numero === mesaVirtual.numero);
    if (idxVirtual >= 0) {
      this.mesas.splice(idxVirtual, 1);
    }

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
  };

  return module;
})();