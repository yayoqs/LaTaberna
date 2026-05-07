/* ================================================================
   PubPOS — COMANDO: enviar-comanda.js (v2.1 – sync pedido a Sheets)
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

  // ── 1. Validaciones básicas ─────────────────────────────
  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) {
    throw new Error('No hay ítems pendientes para enviar');
  }

  // ── 2. Validación de stock ──────────────────────────────
  try {
    const inventarioSvc = Deps.obtener('inventarioService');
    const resultadoStock = inventarioSvc.validarStockParaItems(itemsPendientes);
    if (!resultadoStock.ok) {
      const faltantes = resultadoStock.faltantes
        .map(f => `${f.ingrediente} (faltan ${f.faltante} ${f.unidad})`)
        .join(', ');
      showToast('warning', `⚠️ Stock bajo: ${faltantes}. La comanda se enviará igual.`);
      Logger.warn(`[EnviarComanda] Stock bajo detectado: ${faltantes}`);
      if (typeof PedidoManager.registrar === 'function') {
        PedidoManager.registrar('inventario:alerta_faltante', {
          mesa: mesa.numero,
          items: itemsPendientes.map(it => it.nombre),
          faltantes: resultadoStock.faltantes
        });
      }
    }
  } catch (e) {
    Logger.warn('[EnviarComanda] No se pudo validar stock:', e.message);
  }

  // ── 3. Separar por destino ───────────────────────────────
  const cocinaItems = itemsPendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
  const barraItems  = itemsPendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
  if (!cocinaItems.length && !barraItems.length) {
    throw new Error('Los ítems no tienen un destino válido');
  }

  // ── 4. Función interna para crear una comanda ────────────
  const _crearComanda = (items, destinoKds) => {
    items.forEach(it => {
      it.enviado = true;
      it.enviadoA = destinoKds;
      it.enviadoTs = Date.now();
    });

    const comanda = {
      id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      mesa: mesa.numero,
      mozo: mozo,
      destino: destinoKds,
      items: items.map(it => ({ ...it })),
      observaciones: observaciones || '',
      estado: 'nueva',
      ts: Date.now()
    };

    if (typeof DB !== 'undefined' && DB.comandas) {
      DB.comandas.push(comanda);
    }
    Logger.debug(`[EnviarComanda] Comanda creada para ${destinoKds}`, comanda);
    return comanda;
  };

  // ── 5. Crear comandas (según lo que haya) ──────────────────
  const comandasCreadas = [];
  const ticketsGenerados = { cocina: null, barra: null };

  if (cocinaItems.length && barraItems.length) {
    const comCocina = _crearComanda(cocinaItems, 'cocina');
    const comBarra  = _crearComanda(barraItems,  'barra');
    comandasCreadas.push(comCocina, comBarra);

    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.cocina = Tickets.generarComanda(comCocina, 'cocina');
      ticketsGenerados.barra  = Tickets.generarComanda(comBarra,  'barra');
    }
  } else if (cocinaItems.length) {
    const comCocina = _crearComanda(cocinaItems, 'cocina');
    comandasCreadas.push(comCocina);
    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.cocina = Tickets.generarComanda(comCocina, 'cocina');
    }
  } else if (barraItems.length) {
    const comBarra = _crearComanda(barraItems, 'barra');
    comandasCreadas.push(comBarra);
    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.barra = Tickets.generarComanda(comBarra, 'barra');
    }
  }

  // ── 6. Actualizar estado de la mesa ──────────────────────
  if (mesa.estado === 'libre') {
    mesa.estado = 'ocupada';
  }
  if (typeof DB !== 'undefined' && DB.saveMesas) {
    DB.saveMesas();
  }

  // ── 7. Actualizar pedido asociado (y sincronizar con Sheets) ──
  if (mesa.pedidoId && typeof DB !== 'undefined' && DB.actualizarPedido) {
    try {
      const pedidoActualizado = await DB.actualizarPedido(mesa.pedidoId, {
        estado: 'en_proceso',
        items: JSON.stringify(mesa.items),
        total: calcularTotal(mesa.items),
        mozo: mesa.mozo,
        comensales: mesa.comensales,
        observaciones: mesa.observaciones
      });
      Logger.debug(`[EnviarComanda] Pedido ${mesa.pedidoId} actualizado localmente.`);

      // Sincronizar el pedido actualizado con Google Sheets
      if (pedidoActualizado && typeof DB.syncGuardarPedido === 'function') {
        try {
          // Aseguramos que items sea string
          const pedidoParaSync = {
            ...pedidoActualizado,
            items: Array.isArray(pedidoActualizado.items)
              ? JSON.stringify(pedidoActualizado.items)
              : pedidoActualizado.items
          };
          await DB.syncGuardarPedido(pedidoParaSync);
          Logger.info(`[EnviarComanda] Pedido ${mesa.pedidoId} sincronizado con Sheets.`);
        } catch (syncError) {
          Logger.warn(`[EnviarComanda] Error al sincronizar pedido con Sheets. Encolado.`, syncError);
          if (typeof DB._encolarOperacion === 'function') {
            DB._encolarOperacion('guardarPedido', { pedido: pedidoActualizado });
          }
          showToast('warning', 'Comanda enviada, pero no se pudo actualizar la hoja de cálculo. Se reintentará.');
        }
      }
    } catch (e) {
      Logger.warn('[EnviarComanda] No se pudo actualizar pedido:', e);
    }
  }

  // ── 8. Persistir comandas y notificar ────────────────────
  if (typeof DB !== 'undefined' && DB.saveComandas) {
    DB.saveComandas(); // dispara Store y EventBus
  }

  comandasCreadas.forEach(c => EventBus.emit('comanda:enviada', c));
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });

  Logger.info(`[EnviarComanda] ${comandasCreadas.length} comanda(s) enviada(s).`);

  return {
    comandas: comandasCreadas,
    ticketsHTML: ticketsGenerados
  };
}

CommandBus.registrar('enviarComanda', handleEnviarComanda);

window.crearComandoEnviarComanda = crearComandoEnviarComanda;