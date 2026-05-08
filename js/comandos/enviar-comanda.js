/* ================================================================
   PubPOS — COMANDO: enviar-comanda.js (v3.0 – delegación total al repo)
   ================================================================ */

function crearComandoEnviarComanda(datos) {
  return {
    type: 'enviarComanda',
    datos: {
      mesa: datos.mesa,
      mozo: datos.mozo,
      comensales: datos.comensales,
      observaciones: datos.observaciones || '',
      itemsPendientes: datos.itemsPendientes
    }
  };
}

async function handleEnviarComanda(comando) {
  const { mesa, mozo, comensales, observaciones, itemsPendientes } = comando.datos;

  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) throw new Error('No hay ítems pendientes');

  // Validación de stock
  try {
    const inventarioSvc = Deps.obtener('inventarioService');
    const resultadoStock = inventarioSvc.validarStockParaItems(itemsPendientes);
    if (!resultadoStock.ok) {
      const faltantes = resultadoStock.faltantes.map(f => `${f.ingrediente} (faltan ${f.faltante} ${f.unidad})`).join(', ');
      showToast('warning', `⚠️ Stock bajo: ${faltantes}. La comanda se enviará igual.`);
      Logger.warn(`[EnviarComanda] Stock bajo: ${faltantes}`);
      if (typeof PedidoManager.registrar === 'function') {
        PedidoManager.registrar('inventario:alerta_faltante', { mesa: mesa.numero, items: itemsPendientes.map(it => it.nombre), faltantes: resultadoStock.faltantes });
      }
    }
  } catch (e) {
    Logger.warn('[EnviarComanda] No se pudo validar stock:', e.message);
  }

  // Obtener repositorio
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.enviarComanda !== 'function') {
    throw new Error('El repositorio no soporta la operación enviarComanda');
  }

  // Delegar toda la persistencia
  let resultado;
  try {
    resultado = await repo.enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones);
  } catch (e) {
    throw new Error('Error al enviar comanda: ' + e.message);
  }

  // Actualizar estado de la mesa
  if (mesa.estado === 'libre') mesa.estado = 'ocupada';
  DB.saveMesas();

  // Notificar a otros módulos
  resultado.comandas.forEach(c => EventBus.emit('comanda:enviada', c));
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
  Logger.info(`[EnviarComanda] ${resultado.comandas.length} comanda(s) enviada(s).`);

  return resultado;
}

CommandBus.registrar('enviarComanda', handleEnviarComanda);
window.crearComandoEnviarComanda = crearComandoEnviarComanda;