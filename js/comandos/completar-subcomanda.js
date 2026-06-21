/* ================================================================
   PubPOS — COMANDO: completarSubcomanda (v1.0.1 – fix payload)
   Propósito: Marcar como completada una subcomanda (cocina/barra)
              de una comanda con destino 'ambos'.
              Si ambas están listas, la comanda principal se
              marca como 'completada'.
   ================================================================ */

(function() {
  if (typeof CommandBus === 'undefined') {
    console.warn('[completarSubcomanda] CommandBus no disponible.');
    return;
  }

  CommandBus.registrar('completarSubcomanda', async function(payload) {
    // Extraer los datos reales del objeto que envía CommandBus.ejecutar
    const datos = payload && payload.datos ? payload.datos : payload;
    const { idOriginal, destino } = datos;

    // Validación mínima
    if (!idOriginal || !destino) {
      return { exito: false, error: 'Se requiere idOriginal y destino (cocina | barra).' };
    }
    if (!['cocina', 'barra'].includes(destino)) {
      return { exito: false, error: "Destino debe ser 'cocina' o 'barra'." };
    }

    try {
      // 1. Obtener la comanda original desde Appwrite
      const comandas = await DBAppwrite.listar('comandas');
      const comanda = comandas.find(c => c.id === idOriginal);

      if (!comanda) {
        Logger.warn(`[completarSubcomanda] Comanda ${idOriginal} no encontrada.`);
        return { exito: false, error: 'Comanda no encontrada.' };
      }

      // 2. Parsear el campo 'subcomandas' (JSON) o inicializarlo
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

      // 3. Marcar el destino como completado
      subcomandas[destino] = 'completada';

      // 4. Determinar si ambas están completadas
      const ambasListas =
        subcomandas.cocina === 'completada' &&
        subcomandas.barra === 'completada';

      // 5. Actualizar en Appwrite
      await DBAppwrite.actualizar('comandas', idOriginal, {
        subcomandas: JSON.stringify(subcomandas),
        estado: ambasListas ? 'completada' : comanda.estado
      });

      // 6. Emitir eventos
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

  Logger.info('[completarSubcomanda] Comando registrado en CommandBus.');
})();