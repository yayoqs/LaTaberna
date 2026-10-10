/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-fusion.js
   Versión: 1.2.1
   Propósito: Lógica de fusión y liberación de mesas virtuales.
              v1.2.1: A.56 (Regla 22 del brief). fusionarMesas y
                      liberarMesasFusionadas verifican el retorno
                      real de cada operación de Appwrite antes de
                      mutar memoria. Si una operación crítica
                      falla, se revierten las que ya se aplicaron
                      y se aborta sin tocar el Store ni emitir
                      eventos de éxito. Fin del patrón "log de
                      éxito sin verificar retorno" (§4.5 de la
                      regla de control de regresiones).
              v1.2.0: A.4: liberarMesasFusionadas restaura estado
                      'libre' y pedidoId '' de cada mesa original
                      en Appwrite.
              v1.1.x: versiones previas.
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

    // Consolidar items, total, comensales y pedidoId único.
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
    });

    const nombreVisible = (nombrePersonalizado && nombrePersonalizado.trim()) || todasOriginales.join('+');
    const rowId = _normalizarIdAppwrite(nombreVisible);

    const existe = this.mesas.some(m => String(m.numero) === rowId || String(m.numero) === nombreVisible);
    if (existe) {
      Logger.warn('[DBFusion] Ya existe una mesa con el identificador: ' + nombreVisible);
      return null;
    }

    const hayAppwrite = DBAppwrite && DBAppwrite.habilitado;

    // A.56: persistir ANTES de mutar memoria.
    // 1. Marcar cada mesa original como 'fusionada'. Si alguna
    //    falla, revertir las ya aplicadas y abortar.
    if (hayAppwrite) {
      const marcadas = [];
      for (const num of todasOriginales) {
        const resultado = await DBAppwrite.actualizar('mesas', String(num), { estado: 'fusionada' });

        if (!resultado) {
          Logger.error(
            '[DBFusion] No se pudo marcar la mesa original ' + num +
            ' como fusionada en Appwrite. Abortando fusión y revirtiendo.'
          );
          // Rollback de las que sí se marcaron
          for (const numRollback of marcadas) {
            await DBAppwrite.actualizar('mesas', String(numRollback), { estado: 'libre' })
              .catch(e => Logger.warn('[DBFusion] Rollback falló para mesa ' + numRollback + ':', e));
          }
          return null;
        }
        marcadas.push(num);
      }
    }

    // 2. Crear la mesa virtual. Si falla, revertir originales y abortar.
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

    if (hayAppwrite) {
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

      const creada = await DBAppwrite.crear('mesas', rowId, datosMesa);
      if (!creada) {
        Logger.error(
          '[DBFusion] No se pudo crear la mesa virtual en Appwrite. ' +
          'Revirtiendo mesas originales y abortando.'
        );
        for (const num of todasOriginales) {
          await DBAppwrite.actualizar('mesas', String(num), { estado: 'libre' })
            .catch(e => Logger.warn('[DBFusion] Rollback falló para mesa ' + num + ':', e));
        }
        return null;
      }
      Logger.info('[DBFusion] Mesa virtual persistida en Appwrite con rowId ' + rowId);
    }

    // 3. Todo persistido. Recién ahora se muta memoria.
    for (const num of todasOriginales) {
      const original = this.mesas.find(m => String(m.numero) === String(num) && !m.esVirtual);
      if (original) original.estado = 'fusionada';
    }

    // Eliminar mesas virtuales anteriores (si eran parte de la fusión)
    mesasSeleccionadas.forEach(m => {
      if (m.esVirtual) {
        const idx = this.mesas.findIndex(mesa => mesa.numero === m.numero);
        if (idx >= 0) this.mesas.splice(idx, 1);
      }
    });

    this.mesas.push(mesaVirtual);
    this.saveMesas();

    return mesaVirtual;
  };

  module.liberarMesasFusionadas = async function(mesaVirtual) {
    if (!mesaVirtual || !mesaVirtual.esVirtual || !mesaVirtual.mesasFusionadas) return;

    const hayAppwrite = DBAppwrite && DBAppwrite.habilitado;

    // A.56: persistir ANTES de mutar memoria.
    // 1. Eliminar la mesa virtual en Appwrite. Si falla, abortar:
    //    la memoria no debe divergir.
    if (hayAppwrite) {
      const rowIdVirtual = mesaVirtual._rowId || mesaVirtual.numero;
      const eliminada = await DBAppwrite.eliminar('mesas', String(rowIdVirtual));
      if (!eliminada) {
        Logger.error(
          '[DBFusion] No se pudo eliminar la mesa virtual ' + rowIdVirtual +
          ' en Appwrite. Abortando liberación.'
        );
        return;
      }
      Logger.info('[DBFusion] Mesa virtual ' + rowIdVirtual + ' eliminada en Appwrite.');
    }

    // 2. Restaurar cada original a 'libre'. Best-effort individual:
    //    si una falla, se loguea y se continúa. La memoria se
    //    actualiza igual para no bloquear el resto del flujo.
    if (hayAppwrite) {
      for (const num of mesaVirtual.mesasFusionadas) {
        const restaurada = await DBAppwrite.actualizar('mesas', String(num), {
          estado: 'libre',
          pedidoId: ''
        });
        if (!restaurada) {
          Logger.error(
            '[DBFusion] No se pudo restaurar la mesa original ' + num +
            ' en Appwrite. La mesa queda huérfana en estado fusionada.'
          );
        } else {
          Logger.info('[DBFusion] Mesa original ' + num + ' restaurada a libre en Appwrite.');
        }
      }
    }

    // 3. Mutar memoria.
    for (const num of mesaVirtual.mesasFusionadas) {
      const idx = this.mesas.findIndex(m => m.numero === num);
      if (idx >= 0) {
        this.mesas[idx] = mesaVacia(num);
      }
    }

    const idxVirtual = this.mesas.findIndex(m => m.numero === mesaVirtual.numero);
    if (idxVirtual >= 0) {
      this.mesas.splice(idxVirtual, 1);
    }

    this.saveMesas();
  };

  return module;
})();