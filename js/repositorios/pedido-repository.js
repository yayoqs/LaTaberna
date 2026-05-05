/* ================================================================
   PubPOS — MÓDULO: pedido-repository.js
   Propósito: Define el puerto (interfaz) para la persistencia de
              pedidos y una implementación local que guarda en
              localStorage y sincroniza con Google Sheets.
   ================================================================ */

/**
 * Puerto (interfaz) del Repositorio de Pedidos.
 * Define los métodos que cualquier adaptador debe implementar.
 */
const PedidoRepository = {
  /**
   * Crea un nuevo pedido de mesa.
   * @param {object} datos - { mesa, mozo, comensales, items?, total? }
   * @returns {Promise<object>} El pedido creado.
   */
  async crearPedidoMesa(datos) {
    throw new Error('Método no implementado');
  },

  /**
   * Obtiene un pedido por su ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  },

  /**
   * Cierra un pedido (actualiza estado y guarda pago).
   * @param {string} id
   * @param {object} datosCierre - { formaPago, total, descuento }
   * @returns {Promise<object>}
   */
  async cerrarPedido(id, datosCierre) {
    throw new Error('Método no implementado');
  },

  /**
   * Obtiene todos los pedidos del turno actual.
   * @returns {Promise<Array>}
   */
  async obtenerTodos() {
    throw new Error('Método no implementado');
  }
};

/* ── ADAPTADOR LOCAL (localStorage + Sync) ────────────────── */
const PedidoRepositoryLocal = (() => {
  // Implementa la interfaz PedidoRepository usando DB (core + sync)

  async function crearPedidoMesa(datos) {
    if (!window.DB || !DB.crearPedido) {
      throw new Error('DB.core no disponible');
    }

    // Crear en localStorage (core)
    const pedido = DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedido) {
      throw new Error('No se pudo crear el pedido localmente');
    }

    // Sincronizar con Google Sheets (si está disponible)
    if (typeof DB.syncGuardarPedido === 'function') {
      DB.syncGuardarPedido(pedido).catch(err => {
        console.warn('[PedidoRepo] No se pudo sincronizar con Sheets:', err);
      });
    }

    return pedido;
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
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    // Llamar al método del orquestador que descuenta stock, sincroniza, etc.
    await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0);
    return DB.pedidos.find(p => p.id === id); // retorna el pedido actualizado
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