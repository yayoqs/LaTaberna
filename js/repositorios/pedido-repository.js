/* ================================================================
   PubPOS — REPOSITORIO: pedido-repository.js (v1.7 – método enviarComanda)
   ================================================================ */
const PedidoRepository = {
  async crearPedidoMesa(datos) { throw new Error('No implementado'); },
  async obtenerPorId(id)   { throw new Error('No implementado'); },
  async cerrarPedido(id, datosCierre) { throw new Error('No implementado'); },
  async obtenerTodos()     { throw new Error('No implementado'); },
  async abrirMesa(numeroMesa, mozo, comensales) { throw new Error('No implementado'); },
  async enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) { throw new Error('No implementado'); }
};

const PedidoRepositoryLocal = (() => {

  async function abrirMesa(numeroMesa, mozo, comensales) {
    if (!window.DB || !DB.getMesa) throw new Error('DB.core no disponible');

    const mesa = DB.getMesa(numeroMesa);
    if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
    if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

    mesa.estado = 'ocupada';
    mesa.abiertaEn = Date.now();
    mesa.mozo = mozo;
    mesa.comensales = comensales;
    mesa.items = [];
    mesa.observaciones = '';
    DB.saveMesas();

    const pedidoLocal = await DB.crearPedido(numeroMesa, mozo, comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    mesa.pedidoId = pedidoLocal.id;
    DB.saveMesas();

    const pedidoParaSync = {
      id:          pedidoLocal.id,
      mesa:        pedidoLocal.mesa,
      mozo:        pedidoLocal.mozo || 'Sin mozo',
      comensales:  pedidoLocal.comensales || 1,
      estado:      pedidoLocal.estado || 'abierta',
      items:       Array.isArray(pedidoLocal.items) ? JSON.stringify(pedidoLocal.items) : (pedidoLocal.items || '[]'),
      total:       pedidoLocal.total || 0,
      created_at:  pedidoLocal.created_at,
      updated_at:  pedidoLocal.created_at
    };

    if (typeof DB.syncGuardarPedido === 'function') {
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[PedidoRepo] Pedido sincronizado con Sheets.');
      } catch (e) {
        Logger.warn('[PedidoRepo] Error al sincronizar con Sheets. Encolado.', e);
      }
    }

    return pedidoLocal;
  }

  /**
   * Envía una comanda: crea las comandas en DB, actualiza el pedido y sincroniza.
   * @param {object} mesa
   * @param {Array} itemsPendientes
   * @param {string} mozo
   * @param {number} comensales
   * @param {string} observaciones
   * @returns {Promise<{comandas: Array, ticketsHTML: object}>}
   */
  async function enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) {
    if (!window.DB || !DB.comandas) throw new Error('DB.comandas no disponible');

    const cocinaItems = itemsPendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = itemsPendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
    if (!cocinaItems.length && !barraItems.length) throw new Error('Los ítems no tienen un destino válido');

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

      DB.comandas.push(comanda);
      return comanda;
    };

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
      if (typeof Tickets !== 'undefined') ticketsGenerados.cocina = Tickets.generarComanda(comCocina, 'cocina');
    } else if (barraItems.length) {
      const comBarra = _crearComanda(barraItems, 'barra');
      comandasCreadas.push(comBarra);
      if (typeof Tickets !== 'undefined') ticketsGenerados.barra = Tickets.generarComanda(comBarra, 'barra');
    }

    // Persistir comandas
    DB.saveComandas();
    // Despachar al Store por cada comanda
    if (typeof Store !== 'undefined') {
      comandasCreadas.forEach(c => Store.dispatch({ type: 'COMANDA_AGREGADA', payload: c }));
    }

    // Actualizar pedido y sincronizar con Sheets
    if (mesa.pedidoId && typeof DB.actualizarPedido === 'function') {
      try {
        const pedidoActualizado = await DB.actualizarPedido(mesa.pedidoId, {
          estado: 'en_proceso',
          items: JSON.stringify(mesa.items),
          total: calcularTotal(mesa.items),
          mozo: mesa.mozo,
          comensales: mesa.comensales,
          observaciones: mesa.observaciones
        });
        Logger.debug(`[PedidoRepo] Pedido ${mesa.pedidoId} actualizado localmente.`);

        if (pedidoActualizado && typeof DB.syncGuardarPedido === 'function') {
          try {
            const pedidoParaSync = {
              ...pedidoActualizado,
              items: Array.isArray(pedidoActualizado.items) ? JSON.stringify(pedidoActualizado.items) : pedidoActualizado.items
            };
            await DB.syncGuardarPedido(pedidoParaSync);
            Logger.info(`[PedidoRepo] Pedido ${mesa.pedidoId} sincronizado con Sheets.`);
          } catch (syncError) {
            Logger.warn('[PedidoRepo] Error al sincronizar pedido con Sheets. Encolado.', syncError);
            if (typeof DB._encolarOperacion === 'function') {
              DB._encolarOperacion('guardarPedido', { pedido: pedidoActualizado });
            }
            showToast('warning', 'Comanda enviada, pero no se pudo actualizar la hoja de cálculo. Se reintentará.');
          }
        }
      } catch (e) {
        Logger.warn('[PedidoRepo] No se pudo actualizar pedido:', e);
      }
    }

    return { comandas: comandasCreadas, ticketsHTML: ticketsGenerados };
  }

  async function crearPedidoMesa(datos) {
    if (!window.DB || !DB.crearPedido) throw new Error('DB.core no disponible');

    const pedidoLocal = await DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    const pedidoParaSync = {
      id:          pedidoLocal.id,
      mesa:        pedidoLocal.mesa,
      mozo:        pedidoLocal.mozo || 'Sin mozo',
      comensales:  pedidoLocal.comensales || 1,
      estado:      pedidoLocal.estado || 'abierta',
      items:       Array.isArray(pedidoLocal.items) ? JSON.stringify(pedidoLocal.items) : (pedidoLocal.items || '[]'),
      total:       pedidoLocal.total || 0,
      created_at:  pedidoLocal.created_at,
      updated_at:  pedidoLocal.created_at
    };

    if (typeof DB.syncGuardarPedido === 'function') {
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[PedidoRepo] Pedido sincronizado con Sheets.');
      } catch (e) {
        Logger.warn('[PedidoRepo] Error al sincronizar con Sheets. Encolado.', e);
      }
    }

    return pedidoLocal;
  }

  async function obtenerPorId(id) {
    if (!window.DB || !DB.pedidos) return null;
    return DB.pedidos.find(p => p.id === id) || null;
  }

  async function cerrarPedido(id, datosCierre) {
    if (!window.DB || typeof DB.cerrarPedido !== 'function') throw new Error('DB.cerrarPedido no disponible');
    const pedido = DB.pedidos.find(p => p.id === id);
    if (!pedido) throw new Error('Pedido no encontrado');

    await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0);
    return DB.pedidos.find(p => p.id === id);
  }

  async function obtenerTodos() {
    if (!window.DB || !DB.pedidos) return [];
    return DB.pedidos;
  }

  return {
    abrirMesa,
    enviarComanda,
    crearPedidoMesa,
    obtenerPorId,
    cerrarPedido,
    obtenerTodos
  };
})();

window.PedidoRepository = PedidoRepository;
window.PedidoRepositoryLocal = PedidoRepositoryLocal;