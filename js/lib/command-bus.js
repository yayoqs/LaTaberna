/* ================================================================
   PubPOS — MÓDULO: command-bus.js
   Propósito: Bus de comandos centralizado para CQRS. Registra handlers
              y ejecuta comandos de manera desacoplada.
   ================================================================ */
const CommandBus = (() => {
  const handlers = new Map();

  /**
   * Registra un handler para un tipo de comando específico.
   * @param {string} commandType - El nombre del comando (ej. 'crearPedidoMesa')
   * @param {function} handler - Función que recibe el comando y ejecuta la lógica.
   */
  function registrar(commandType, handler) {
    if (handlers.has(commandType)) {
      console.warn(`[CommandBus] Ya existe un handler para "${commandType}". Será reemplazado.`);
    }
    handlers.set(commandType, handler);
    console.log(`[CommandBus] Handler registrado para comando "${commandType}".`);
  }

  /**
   * Ejecuta un comando.
   * @param {object} command - El comando a ejecutar. Debe tener una propiedad 'type'.
   * @returns {Promise<{ exito: boolean, data?: any, error?: string }>}
   */
  async function ejecutar(command) {
    if (!command || !command.type) {
      console.error('[CommandBus] Comando inválido:', command);
      return { exito: false, error: 'Comando inválido o sin tipo definido.' };
    }

    const handler = handlers.get(command.type);
    if (!handler) {
      console.error(`[CommandBus] No hay handler registrado para el comando "${command.type}".`);
      return { exito: false, error: `Handler no encontrado para ${command.type}` };
    }

    console.log(`[CommandBus] Ejecutando comando "${command.type}"...`);
    try {
      const resultado = await handler(command);
      console.log(`[CommandBus] Comando "${command.type}" ejecutado con éxito.`, resultado);
      return { exito: true, data: resultado };
    } catch (error) {
      console.error(`[CommandBus] Error al ejecutar "${command.type}":`, error);
      return { exito: false, error: error.message };
    }
  }

  return {
    registrar,
    ejecutar
  };
})();

window.CommandBus = CommandBus;