/* ================================================================
   PubPOS — REPOSITORIO: pedido-repository.js (v1.1 – normalizado)
   Propósito: Adaptador local que persiste pedidos en localStorage
              y los sincroniza con Google Sheets.
              Ahora se asegura de que el objeto enviado esté completo
              y con el formato que el backend espera (items como string).
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

    // 1. Guardar en localStorage
    const pedidoLocal = DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    // 2. Normalizar objeto para Sheets
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
      updated_at:  pedidoLocal.created_at  // recién creado
    };

    // 3. Sincronizar con Google Sheets (con manejo de error)
    if (typeof DB.syncGuardarPedido === 'function') {
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
      } catch (e) {
        console.warn('[PedidoRepo] Error al sincronizar con Sheets (encolado):', e);
        // La cola offline se encarga de reintentar
      }
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