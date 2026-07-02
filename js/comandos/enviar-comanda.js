/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/enviar-comanda.js
   Versión: 1.0.2
   Propósito: Enviar comanda a cocina/barra con validación de stock.
              Con imports explícitos.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { showToast } from '../utils.js';

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

async function handleEnviarComanda(comando) {
  const { mesa, mozo, comensales, observaciones, itemsPendientes, overrideStock } = comando.datos;

  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) throw new Error('No hay ítems pendientes');

  const bloquearStock = (DB.config?.bloquearStockInsuficiente !== false);

  let resultadoStock = { ok: true, faltantes: [] };
  try {
    const inventarioSvc = Deps.obtener('inventarioService');
    resultadoStock = inventarioSvc.validarStockParaItems(itemsPendientes);
  } catch (e) {
    Logger.warn('[EnviarComanda] No se pudo validar stock:', e.message);
  }

  if (!resultadoStock.ok && bloquearStock && !overrideStock) {
    const faltantes = resultadoStock.faltantes.map(f =>
      `${f.ingrediente} (faltan ${f.faltante} ${f.unidad})`
    ).join(', ');
    const error = new Error('STOCK_INSUFICIENTE');
    error.faltantes = resultadoStock.faltantes;
    error.mensaje = `Stock insuficiente: ${faltantes}`;
    throw error;
  }

  if (!resultadoStock.ok) {
    const faltantes = resultadoStock.faltantes.map(f =>
      `${f.ingrediente} (faltan ${f.faltante} ${f.unidad})`
    ).join(', ');
    showToast('warning', `⚠️ Stock bajo: ${faltantes}. La comanda se enviará igual.`);
    Logger.warn(`[EnviarComanda] Stock bajo (override): ${faltantes}`);
    if (typeof PedidoManager.registrar === 'function') {
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

  let resultado;
  try {
    resultado = await repo.enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones);
  } catch (e) {
    throw new Error('Error al enviar comanda: ' + e.message);
  }

  if (mesa.estado === 'libre') mesa.estado = 'ocupada';
  DB.saveMesas();

  resultado.comandas.forEach(c => EventBus.emit('comanda:enviada', c));
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
  Logger.info(`[EnviarComanda] ${resultado.comandas.length} comanda(s) enviada(s).`);

  return resultado;
}

CommandBus.registrar('enviarComanda', handleEnviarComanda);