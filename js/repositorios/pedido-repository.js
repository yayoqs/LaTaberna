/* ================================================================
   PubPOS — REPOSITORIO: pedido-repository.js (v1.5 – JSDoc completo)
   Propósito: Adaptador local que persiste pedidos en localStorage
              y los sincroniza con Google Sheets.
   ================================================================ */

/**
 * Interfaz del repositorio de pedidos.
 */
const PedidoRepository = {
  /** @param {object} datos */
  async crearPedidoMesa(datos) { throw new Error('No implementado'); },
  /** @param {string} id */
  async obtenerPorId(id) { throw new Error('No implementado'); },
  /** @param {string} id @param {object} datosCierre */
  async cerrarPedido(id, datosCierre) { throw new Error('No implementado'); },
  /** Obtiene todos los pedidos del turno */
  async obtenerTodos() { throw new Error('No implementado'); }
};

const PedidoRepositoryLocal = (() => {

  /**
   * Crea un pedido de mesa y lo sincroniza con Sheets.
   * @param {object} datos - { mesa, mozo, comensales }
   * @returns {Promise<object>} El pedido creado
   */
  async function crearPedidoMesa(datos) {
    if (!window.DB || !DB.crearPedido) {
      throw new Error('DB.core no disponible');
    }

    const pedidoLocal = await DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

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

    if (typeof DB.syncGuardarPedido === 'function') {
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[PedidoRepo] Pedido sincronizado con Sheets.');
      } catch (e) {
        Logger.warn('[PedidoRepo] Error al sincronizar con Sheets. Encolado.', e);
      }
    } else {
      Logger.warn('[PedidoRepo] DB.syncGuardarPedido no disponible.');
    }

    return pedidoLocal;
  }

  /**
   * Obtiene un pedido por su ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async function obtenerPorId(id) {
    if (!window.DB || !DB.pedidos) return null;
    return DB.pedidos.find(p => p.id === id) || null;
  }

  /**
   * Cierra un pedido (delega en DB.cerrarPedido).
   * @param {string} id
   * @param {object} datosCierre
   * @returns {Promise<object>}
   */
  async function cerrarPedido(id, datosCierre) {
    if (!window.DB || typeof DB.cerrarPedido !== 'function') {
      throw new Error('DB.cerrarPedido no disponible');
    }
    const pedido = DB.pedidos.find(p => p.id === id);
    if (!pedido) throw new Error('Pedido no encontrado');

    await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0);
    return DB.pedidos.find(p => p.id === id);
  }

  /**
   * Obtiene todos los pedidos del turno.
   * @returns {Promise<Array>}
   */
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