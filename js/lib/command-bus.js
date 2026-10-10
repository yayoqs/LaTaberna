/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/command-bus.js
   Versión: 1.1.3
   Propósito: Bus de comandos centralizado (CQRS).
              v1.1.3: El wrapper respeta el campo `exito` del
              handler. Si el handler devuelve { exito: false },
              el wrapper propaga ese fallo en lugar de
              enmascararlo como exito: true.
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

      // Si el handler devuelve explícitamente exito: false,
      // propagamos el fallo en lugar de enmascararlo.
      if (resultado && typeof resultado === 'object' && resultado.exito === false) {
        Logger.warn(`[CommandBus] Comando "${command.type}" reportó fallo interno:`, resultado.error);
        return {
          exito: false,
          data: resultado,
          error: resultado.error || 'El handler reportó fallo sin detalle.'
        };
      }

      Logger.info(`[CommandBus] Comando "${command.type}" ejecutado con éxito.`, resultado);
      return { exito: true, data: resultado };
    } catch (error) {
      Logger.error(`[CommandBus] Error al ejecutar "${command.type}":`, error);
      return { exito: false, error: error.message };
    }
  }

  return { registrar, ejecutar };
})();