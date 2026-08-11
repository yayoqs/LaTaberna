/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/completar-subcomanda.js
   Versión: 1.0.6
   Propósito: Marcar una subcomanda como completada.
              v1.0.6: corregida lógica de ambasListas para comandas
                      con un solo destino (ej. solo cocina).
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { DBAppwrite } from '../db-appwrite.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';

export function crearComandoCompletarSubcomanda(idOriginal, destino) {
  return {
    type: 'completarSubcomanda',
    datos: { idOriginal, destino }
  };
}

CommandBus.registrar('completarSubcomanda', async function(payload) {
  Logger.info('[completarSubcomanda] Comando registrado en CommandBus.');

  const datos = payload && payload.datos ? payload.datos : payload;
  const { idOriginal, destino } = datos;

  if (!idOriginal || !destino) {
    return { exito: false, error: 'Se requiere idOriginal y destino (cocina | barra).' };
  }
  if (!['cocina', 'barra'].includes(destino)) {
    return { exito: false, error: "Destino debe ser 'cocina' o 'barra'." };
  }

  try {
    const comandas = await DBAppwrite.listar('comandas');
    const comanda = comandas.find(c => c.id === idOriginal);

    if (!comanda) {
      Logger.warn(`[completarSubcomanda] Comanda ${idOriginal} no encontrada.`);
      return { exito: false, error: 'Comanda no encontrada.' };
    }

    let subcomandas = {};
    try {
      subcomandas = comanda.subcomandas
        ? (typeof comanda.subcomandas === 'string'
            ? JSON.parse(comanda.subcomandas)
            : comanda.subcomandas)
        : {};
    } catch (e) {
      Logger.warn('[completarSubcomanda] Error al parsear subcomandas:', e);
      subcomandas = {};
    }

    subcomandas[destino] = 'completada';

    // Si la comanda tiene un solo destino, ambasListas es true automáticamente.
    // Si tiene ambos, verifica que los dos estén completados.
    const destinosComanda = comanda.destino === 'ambos' ? ['cocina', 'barra'] : [comanda.destino];
    const ambasListas = destinosComanda.every(d => subcomandas[d] === 'completada');

    await DBAppwrite.actualizar('comandas', idOriginal, {
      subcomandas: JSON.stringify(subcomandas),
      estado: ambasListas ? 'completada' : comanda.estado
    });

    EventBus.emit('comanda:subcomanda_completada', {
      id: idOriginal,
      destino,
      ambasListas,
      pedidoId: comanda.pedidoId || null
    });

    if (ambasListas) {
      EventBus.emit('comanda:completada', {
        id: idOriginal,
        mesa: comanda.mesa,
        pedidoId: comanda.pedidoId || null
      });
      Logger.info(`[completarSubcomanda] Comanda ${idOriginal} completada.`);
    } else {
      Logger.debug(`[completarSubcomanda] ${destino} listo en ${idOriginal}.`);
    }

    return { exito: true, ambasListas, id: idOriginal };
  } catch (e) {
    Logger.error(`[completarSubcomanda] Error:`, e);
    return { exito: false, error: e.message };
  }
});