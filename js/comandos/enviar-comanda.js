/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/enviar-comanda.js
   Versión: 1.1.0
   Propósito: Enviar comanda a cocina/barra con validación de stock.
              v1.1.0: A.37: acumula fallidos por item y emite
                      'inventario:descuento_incompleto' si hubo.
                      A.36: pasa item.opciones al motor de descuento.
              v1.0.8: A.27: stocksModificados se popula con cada
                      descuento aplicado.
                      A.28: import de DBAppwrite agregado.
                      A.26: verifica el retorno de
                      consumirInsumosDeProducto y hace rollback si falla.
              v1.0.7: A.19: descuento de stock al enviar comanda con
                      rollback en caso de fallo. Maneja items de
                      tipo 'insumo' (insumo vendible) y 'producto'.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DBInventario } from '../db-inventario.js';
import { mostrarToast } from '../utils.js';
import { PedidoManager } from '../managers/pedido-manager.js';

export function crearComandoEnviarComanda(datos) {
  return {
    type: 'enviarComanda',
    datos: {
      mesa: datos.mesa,
      mozo: datos.mozo,
      comensales: datos.comensales,
      observaciones: datos.observaciones || '',
      itemsPendientes: datos.itemsPendientes,
      overrideStock: datos.overrideStock || false
    }
  };
}

async function ejecutarEnviarComanda(comando) {
  const { mesa, mozo, comensales, observaciones, itemsPendientes, overrideStock } = comando.datos;

  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) throw new Error('No hay ítems pendientes');

  const bloquearStock = (DB.config?.bloquearStockInsuficiente !== false);

  let resultadoStock = { ok: true, faltantes: [] };
  try {
    const inventarioSvc = Deps.obtener('inventarioService');
    resultadoStock = await inventarioSvc.validarStockParaArticulos(itemsPendientes);
  } catch (e) {
    Logger.warn('[EnviarComanda] No se pudo validar stock:', e.message);
  }

  if (!resultadoStock.ok && bloquearStock && !overrideStock) {
    const faltantes = resultadoStock.faltantes.map(f =>
      `${f.insumo} (faltan ${f.faltante} ${f.unidad})`
    ).join(', ');
    const error = new Error('STOCK_INSUFICIENTE');
    error.faltantes = resultadoStock.faltantes;
    error.mensaje = `Stock insuficiente: ${faltantes}`;
    throw error;
  }

  if (!resultadoStock.ok) {
    const faltantes = resultadoStock.faltantes.map(f =>
      `${f.insumo} (faltan ${f.faltante} ${f.unidad})`
    ).join(', ');
    mostrarToast('warning', `⚠️ Stock bajo: ${faltantes}. La comanda se enviará igual.`);
    Logger.warn(`[EnviarComanda] Stock bajo (override): ${faltantes}`);
    if (typeof PedidoManager !== 'undefined' && typeof PedidoManager.registrar === 'function') {
      PedidoManager.registrar('inventario:alerta_faltante', {
        mesa: mesa.numero,
        items: itemsPendientes.map(it => it.nombre),
        faltantes: resultadoStock.faltantes
      });
    }
  }

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.enviarComanda !== 'function') {
    throw new Error('El repositorio no soporta la operación enviarComanda');
  }

  // ── Descuento de stock con rollback y acumulación de fallos ──
  const stocksModificados = [];
  const fallidosAcumulados = [];
  const exitososAcumulados = [];

  async function _descontarStock() {
    for (const item of itemsPendientes) {
      const tipo = item.tipo || 'producto';
      const qty = Number(item.qty) || 1;
      const opciones = Array.isArray(item.opciones) ? item.opciones : [];

      let resultado;
      try {
        if (tipo === 'insumo') {
          resultado = await DBInventario.consumirInsumosDeProducto(
            { tipo: 'insumo', id: item.prodId || item.id, qty },
            qty,
            'Envío de comanda'
          );
        } else {
          resultado = await DBInventario.consumirInsumosDeProducto(
            { tipo: 'producto', id: item.prodId || item.id, qty, opciones },
            qty,
            'Envío de comanda'
          );
        }
      } catch (e) {
        Logger.error(`[EnviarComanda] Error estructural al descontar stock de ${item.nombre}:`, e);
        throw e;
      }

      // A.37: error estructural aborta el envío
      if (!resultado || resultado.ok === false) {
        const error = new Error(
          `No se pudo descontar stock del item ${item.nombre}: ${resultado?.error || 'desconocido'}`
        );
        throw error;
      }

      // A.36/A.37: acumular exitosos (para rollback) y fallidos (para evento)
      if (Array.isArray(resultado.exitosos) && resultado.exitosos.length > 0) {
        stocksModificados.push(...resultado.exitosos);
        exitososAcumulados.push(...resultado.exitosos);
      }
      if (Array.isArray(resultado.fallidos) && resultado.fallidos.length > 0) {
        fallidosAcumulados.push(...resultado.fallidos);
      }
    }
  }

  async function _rollbackStock() {
    if (!stocksModificados.length) return;
    Logger.warn('[EnviarComanda] Haciendo rollback de stock de ' + stocksModificados.length + ' insumo(s)...');
    for (const cambio of stocksModificados) {
      try {
        if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
          await DBAppwrite.incrementarCampo('insumos', cambio.insumoId, 'stock', cambio.cantidad);
        }
      } catch (e) {
        Logger.error('[EnviarComanda] Error en rollback de stock:', e);
      }
    }
  }

  try {
    await _descontarStock();
  } catch (e) {
    try { await _rollbackStock(); } catch {}
    const error = new Error('No se pudo descontar stock. La comanda no fue enviada.');
    error.causa = e.message;
    throw error;
  }

  // ── Crear comandas ──
  let resultado;
  try {
    resultado = await repo.enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones);
  } catch (e) {
    try { await _rollbackStock(); } catch {}
    throw new Error('Error al enviar comanda: ' + e.message);
  }

  if (mesa.estado === 'libre') mesa.estado = 'ocupada';
  DB.saveMesas();

  resultado.comandas.forEach(c => {
    c.pedidoId = mesa.pedidoId || null;
    c.subcomandas = c.subcomandas || {};
    EventBus.emit('comanda:enviada', c);
  });
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
  Logger.info(`[EnviarComanda] ${resultado.comandas.length} comanda(s) enviada(s).`);

  // A.37: emitir evento si hubo descuentos incompletos
  if (fallidosAcumulados.length > 0) {
    const payload = {
      pedidoId: mesa.pedidoId || null,
      insumosFallidos: fallidosAcumulados,
      insumosOk: exitososAcumulados,
      total: fallidosAcumulados.length
    };
    Logger.warn(`[EnviarComanda] Descuento incompleto: ${fallidosAcumulados.length} fallo(s), ${exitososAcumulados.length} ok.`);
    EventBus.emit('inventario:descuento_incompleto', payload);
  }

  return resultado;
}

CommandBus.registrar('enviarComanda', ejecutarEnviarComanda);