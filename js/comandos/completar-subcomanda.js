/* ================================================================
   LaTaberna - PubPOS — COMANDO JS
   Archivo: js/comandos/completar-subcomanda.js
   Versión: 1.0.1
   Propósito: Marcar una subcomanda (cocina/barra) como completada.
              Ahora expone función creadora.
   Dependencias: CommandBus, DBAppwrite, EventBus, Logger
   ================================================================ */

(function() {
  if (typeof CommandBus === 'undefined') {
    console.warn('[completarSubcomanda] CommandBus no disponible.');
    return;
  }

  // Función creadora
  function crearComandoCompletarSubcomanda(idOriginal, destino) {
    return {
      type: 'completarSubcomanda',
      datos: { idOriginal, destino }
    };
  }

  CommandBus.registrar('completarSubcomanda', async function(payload) {
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
        subcomandas = {};
      }

      subcomandas[destino] = 'completada';

      const ambasListas =
        subcomandas.cocina === 'completada' &&
        subcomandas.barra === 'completada';

      await DBAppwrite.actualizar('comandas', idOriginal, {
        subcomandas: JSON.stringify(subcomandas),
        estado: ambasListas ? 'completada' : comanda.estado
      });

      EventBus.emit('comanda:subcomanda_completada', {
        id: idOriginal,
        destino,
        ambasListas
      });

      if (ambasListas) {
        EventBus.emit('comanda:completada', {
          id: idOriginal,
          mesa: comanda.mesa
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

  // Exponer función creadora globalmente
  window.crearComandoCompletarSubcomanda = crearComandoCompletarSubcomanda;

  Logger.info('[completarSubcomanda] Comando registrado en CommandBus.');
})();