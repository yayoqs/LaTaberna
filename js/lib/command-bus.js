/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/command-bus.js
   Versión: 1.1.2
   Propósito: Bus de comandos centralizado (CQRS).
              Con import explícito.
   ================================================================ */

import { Logger } from './logger.js';

export const CommandBus = (() => {
  const handlers = new Map();

  function registrar(commandType, handler) {
    if (handlers.has(commandType)) {
      Logger.warn(`[CommandBus] Ya existe un handler para "${commandType}". Será reemplazado.`);
    }
    handlers.set(commandType, handler);
    Logger.info(`[CommandBus] Handler registrado para comando "${commandType}".`);
  }

  async function ejecutar(command) {
    if (!command || !command.type) {
      Logger.error('[CommandBus] Comando inválido:', command);
      return { exito: false, error: 'Comando inválido o sin tipo definido.' };
    }
    const handler = handlers.get(command.type);
    if (!handler) {
      Logger.error(`[CommandBus] No hay handler registrado para el comando "${command.type}".`);
      return { exito: false, error: `Handler no encontrado para ${command.type}` };
    }
    Logger.info(`[CommandBus] Ejecutando comando "${command.type}"...`);
    try {
      const resultado = await handler(command);
      Logger.info(`[CommandBus] Comando "${command.type}" ejecutado con éxito.`, resultado);
      return { exito: true, data: resultado };
    } catch (error) {
      Logger.error(`[CommandBus] Error al ejecutar "${command.type}":`, error);
      return { exito: false, error: error.message };
    }
  }

  return { registrar, ejecutar };
})();