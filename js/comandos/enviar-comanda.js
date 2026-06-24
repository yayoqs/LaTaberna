/* ================================================================
   LaTaberna - PubPOS — COMANDO JS
   Archivo: js/comandos/enviar-comanda.js
   Versión: 1.0.0
   Propósito: Enviar comanda a cocina/barra con validación de stock y soporte para override de bloqueo.
   Dependencias: CommandBus, Deps, EventBus, PedidoManager, InventarioService, DB, Logger, showToast
   ================================================================ */

function crearComandoEnviarComanda(datos) {
  return {
    type: 'enviarComanda',
    datos: {
      mesa: datos.mesa,
      mozo: datos.mozo,
      comensales: datos.comensales,
      observaciones: datos.observaciones || '',
      itemsPendientes: datos.itemsPendientes,
      overrideStock: datos.overrideStock || false   // ← nuevo flag
    }
  };
}

async function handleEnviarComanda(comando) {
  const { mesa, mozo, comensales, observaciones, itemsPendientes, overrideStock } = comando.datos;

  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) throw new Error('No hay ítems pendientes');

  // ── 0. Leer configuración de bloqueo ─────────────────
  const bloquearStock = (DB.config?.bloquearStockInsuficiente !== false); // true por defecto

  // ── 1. Validación de stock ──────────────────────────
  let resultadoStock = { ok: true, faltantes: [] };
  try {
    const inventarioSvc = Deps.obtener('inventarioService');
    resultadoStock = inventarioSvc.validarStockParaItems(itemsPendientes);
  } catch (e) {
    Logger.warn('[EnviarComanda] No se pudo validar stock:', e.message);
  }

  if (!resultadoStock.ok && bloquearStock && !overrideStock) {
    // Bloqueamos y devolvemos un error especial con los faltantes
    const faltantes = resultadoStock.faltantes.map(f =>
      `${f.ingrediente} (faltan ${f.faltante} ${f.unidad})`
    ).join(', ');
    const error = new Error('STOCK_INSUFICIENTE');
    error.faltantes = resultadoStock.faltantes;
    error.mensaje = `Stock insuficiente: ${faltantes}`;
    throw error;
  }

  if (!resultadoStock.ok) {
    // Log de advertencia si se ignoró el bloqueo
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

  // ── 2. Obtener repositorio ──────────────────────────
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.enviarComanda !== 'function') {
    throw new Error('El repositorio no soporta la operación enviarComanda');
  }

  // ── 3. Delegar toda la persistencia ─────────────────
  let resultado;
  try {
    resultado = await repo.enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones);
  } catch (e) {
    throw new Error('Error al enviar comanda: ' + e.message);
  }

  // ── 4. Actualizar estado de la mesa ─────────────────
  if (mesa.estado === 'libre') mesa.estado = 'ocupada';
  DB.saveMesas();

  // ── 5. Notificar a otros módulos ────────────────────
  resultado.comandas.forEach(c => EventBus.emit('comanda:enviada', c));
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
  Logger.info(`[EnviarComanda] ${resultado.comandas.length} comanda(s) enviada(s).`);

  return resultado;
}

CommandBus.registrar('enviarComanda', handleEnviarComanda);
window.crearComandoEnviarComanda = crearComandoEnviarComanda;