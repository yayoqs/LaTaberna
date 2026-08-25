/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-fusion.js
   Versión: 1.1.4
   Propósito: Lógica de fusión y liberación de mesas virtuales.
              v1.1.4: liberarMesasFusionadas ahora es asíncrona y
                      elimina la mesa virtual en Appwrite.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { mesaVacia } from './db-core.js';
import { DBAppwrite } from './db-appwrite.js';
import { Auth } from './auth.js';

export const DBFusion = (function() {
  const module = {};

  function _normalizarIdAppwrite(texto) {
    if (!texto || typeof texto !== 'string') return 'mesa_virtual';
    let id = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N');
    id = id.trim().substring(0, 36).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (/^[._-]/.test(id)) id = 'm' + id.substring(0, 35);
    return id || 'mesa_virtual';
  }

  module.fusionarMesas = async function(numeros, mozo, nombrePersonalizado) {
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

    let todasOriginales = [];
    mesasSeleccionadas.forEach(m => {
      if (m.esVirtual && m.mesasFusionadas) {
        todasOriginales.push(...m.mesasFusionadas);
      } else {
        todasOriginales.push(m.numero);
      }
    });
    todasOriginales = [...new Set(todasOriginales)].sort((a, b) => a - b);

    // Marcar las originales como fusionadas localmente y en Appwrite
    for (const num of todasOriginales) {
      const original = this.mesas.find(m => String(m.numero) === String(num) && !m.esVirtual);
      if (original) original.estado = 'fusionada';

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          await DBAppwrite.actualizar('mesas', String(num), { estado: 'fusionada' });
          Logger.info('[DBFusion] Mesa original ' + num + ' marcada como fusionada en Appwrite.');
        } catch (e) {
          Logger.warn('[DBFusion] Error al marcar mesa original ' + num + ' en Appwrite:', e);
        }
      }
    }

    let itemsConsolidados = [];
    let totalConsolidado = 0;
    let comensalesTotales = 0;
    let pedidoIdUnico = null;

    mesasSeleccionadas.forEach(m => {
      comensalesTotales += (m.comensales || 1);

      if (m.pedidoId && this.pedidos) {
        const pedido = this.pedidos.find(p => p.id === m.pedidoId);
        if (pedido) {
          if (!pedidoIdUnico) pedidoIdUnico = pedido.id;

          try {
            const itemsPedido = typeof pedido.items === 'string'
              ? JSON.parse(pedido.items)
              : (pedido.items || []);
            itemsConsolidados.push(...itemsPedido);
          } catch (e) {
            Logger.warn('[DBFusion] Error al parsear items del pedido ' + pedido.id + ':', e);
          }

          totalConsolidado += (pedido.total || 0);
        }
      }

      if (m.esVirtual) {
        const idx = this.mesas.findIndex(mesa => mesa.numero === m.numero);
        if (idx >= 0) this.mesas.splice(idx, 1);
      }
    });

    const nombreVisible = (nombrePersonalizado && nombrePersonalizado.trim()) || todasOriginales.join('+');
    const rowId = _normalizarIdAppwrite(nombreVisible);

    const existe = this.mesas.some(m => String(m.numero) === rowId || String(m.numero) === nombreVisible);
    if (existe) {
      Logger.warn('[DBFusion] Ya existe una mesa con el identificador: ' + nombreVisible);
      return null;
    }

    const mesaVirtual = {
      numero: nombreVisible,
      _rowId: rowId,
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

    if (DBAppwrite && DBAppwrite.habilitado) {
      try {
        const local = Auth.obtenerLocalActivo ? Auth.obtenerLocalActivo() : null;
        const datosMesa = {
          numero: mesaVirtual.numero,
          estado: mesaVirtual.estado,
          pedidoId: mesaVirtual.pedidoId || '',
          comensales: mesaVirtual.comensales,
          zona: mesaVirtual.zona || 'salon',
          esVirtual: true,
          mesasFusionadas: JSON.stringify(todasOriginales),
          espacioId: local ? local.id : ''
        };
        await DBAppwrite.crear('mesas', rowId, datosMesa);
        Logger.info('[DBFusion] Mesa virtual persistida en Appwrite con rowId ' + rowId);
      } catch (e) {
        Logger.error('[DBFusion] Error al persistir mesa virtual en Appwrite:', e);
      }
    }

    EventBus.emit('mesas:guardadas', this.mesas);
    return mesaVirtual;
  };

  module.liberarMesasFusionadas = async function(mesaVirtual) {
    if (!mesaVirtual.esVirtual || !mesaVirtual.mesasFusionadas) return;

    // Eliminar mesa virtual en Appwrite
    if (DBAppwrite && DBAppwrite.habilitado) {
      const rowIdVirtual = mesaVirtual._rowId || mesaVirtual.numero;
      try {
        await DBAppwrite.eliminar('mesas', String(rowIdVirtual));
        Logger.info('[DBFusion] Mesa virtual ' + rowIdVirtual + ' eliminada en Appwrite.');
      } catch (e) {
        Logger.warn('[DBFusion] No se pudo eliminar mesa virtual en Appwrite:', e);
      }
    }

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