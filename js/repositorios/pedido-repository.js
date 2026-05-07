/* ================================================================
   PubPOS — REPOSITORIO: pedido-repository.js (v1.4 – await faltante)
   ================================================================ */
const PedidoRepository = {
  async crearPedidoMesa(datos) { throw new Error('No implementado'); },
  async obtenerPorId(id)   { throw new Error('No implementado'); },
  async cerrarPedido(id, datosCierre) { throw new Error('No implementado'); },
  async obtenerTodos()     { throw new Error('No implementado'); }
};

const PedidoRepositoryLocal = (() => {

  async function crearPedidoMesa(datos) {
    if (!window.DB || !DB.crearPedido) {
      throw new Error('DB.core no disponible');
    }

    // 1. Validar reglas de negocio con el agregado
    let agregado;
    try {
      const comensalesCant = crearCantidad(datos.comensales || 1);
      if (!comensalesCant) throw new Error('Comensales inválidos');
      agregado = new PedidoAgregado(
        'ped_' + Date.now(),
        datos.mesa,
        datos.mozo || 'Sin mozo',
        comensalesCant
      );
    } catch (e) {
      throw new Error('Reglas de negocio: ' + e.message);
    }

    const pedidoJSON = agregado.toJSON();

    // 2. Crear pedido en localStorage (DB.core) ← ¡AGREGAR await!
    const pedidoLocal = await DB.crearPedido(
      pedidoJSON.mesa,
      pedidoJSON.mozo,
      pedidoJSON.comensales
    );
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    // 3. Normalizar objeto para Sheets
    const pedidoParaSync = {
      id:          pedidoLocal.id,
      mesa:        pedidoLocal.mesa,
      mozo:        pedidoLocal.mozo || 'Sin mozo',
      comensales:  pedidoLocal.comensales || 1,
      estado:      pedidoLocal.estado || 'abierta',
      items:       Array.isArray(pedidoLocal.items)
                     ? JSON.stringify(pedidoLocal.items)
                     : (pedidoLocal.items || '[]'),
      total:       pedidoLocal.total || 0,
      created_at:  pedidoLocal.created_at,
      updated_at:  pedidoLocal.created_at
    };

    console.log('🛰️ [PedidoRepo] Objeto enviado a Sheets:', JSON.stringify(pedidoParaSync, null, 2));

    // 4. Sincronizar con Google Sheets
    if (typeof DB.syncGuardarPedido === 'function') {
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[PedidoRepo] Pedido sincronizado con Sheets.');
      } catch (e) {
        Logger.warn('[PedidoRepo] Error al sincronizar con Sheets. Encolado.', e);
        showToast('warning', 'Sin conexión. El pedido se guardó localmente.');
      }
    } else {
      Logger.warn('[PedidoRepo] DB.syncGuardarPedido no disponible.');
      showToast('warning', 'Falta módulo de sincronización.');
    }

    return pedidoLocal;
  }

  async function obtenerPorId(id) {
    if (!window.DB || !DB.pedidos) return null;
    return DB.pedidos.find(p => p.id === id) || null;
  }

  async function cerrarPedido(id, datosCierre) {
    if (!window.DB || typeof DB.cerrarPedido !== 'function') {
      throw new Error('DB.cerrarPedido no disponible');
    }
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
    crearPedidoMesa,
    obtenerPorId,
    cerrarPedido,
    obtenerTodos
  };
})();

window.PedidoRepository = PedidoRepository;
window.PedidoRepositoryLocal = PedidoRepositoryLocal;