/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador v2.5 – logging unificado + JSDoc)
   ================================================================ */
var DB = (function() {
  const core = DBCore;
  const sync = window.DBSync;
  const inventario = DBInventario;
  const fusion = DBFusion;

  const combined = {
    ...core,
    ...sync,
    ...inventario,
    ...fusion
  };

  combined.urlSheets = sync.urlSheets;

  /**
   * Inicializa la base de datos: carga configuración, mesas, pedidos
   * locales y luego sincroniza con Google Sheets.
   * @returns {Promise<boolean>} true si la inicialización fue exitosa
   */
  combined.init = async function() {
    try {
      Logger.info("[DB] Iniciando carga de datos...");
      this._cargarConfigLocal();
      this._inicializarMesas();
      this._cargarComandasLocal();
      this._cargarPedidosLocal();
      this._cargarMozosLocal();
      this._cargarIngredientesLocal();
      this._cargarRecetasLocal();
      this._cargarMovimientosLocal();
      this._cargarSyncQueueLocal();
      this._cargarPedidosDeliveryLocal();

      await this._fetchProductos();
      this._fetchMozos().catch(e => Logger.warn("[DB] Mozos remotos no disponibles", e));
      this._fetchIngredientes().catch(e => Logger.warn("[DB] Ingredientes remotos no disponibles", e));
      this._fetchRecetas().catch(e => Logger.warn("[DB] Recetas remotas no disponibles", e));
      this._fetchPedidos().catch(e => Logger.warn("[DB] Pedidos remotos no disponibles", e));

      await this._procesarSyncQueue();

      Logger.info("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      Logger.error("[DB] Error crítico en init:", e);
      this._mostrarErrorCarga();
      return false;
    }
  };

  combined._mostrarErrorCarga = function() {
    EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
  };

  /**
   * Crea un pedido de mesa delegando en PedidoManager si está disponible.
   * @param {number} numeroMesa
   * @param {string} mozo
   * @param {number} comensales
   * @returns {Promise<object>} El pedido creado
   */
  combined.crearPedidoMesa = function(numeroMesa, mozo, comensales) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoMesa) {
      return PedidoManager.crearPedidoMesa(numeroMesa, mozo, comensales);
    }
    return this.crearPedido(numeroMesa, mozo, comensales);
  };

  /**
   * Agrega un ítem a un pedido. Actualmente delegado a PedidoManager si existe.
   * @param {string} pedidoId
   * @param {object} item
   * @returns {boolean}
   */
  combined.agregarItemAPedido = function(pedidoId, item) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.agregarItemAPedido) {
      return PedidoManager.agregarItemAPedido(pedidoId, item);
    }
    return false;
  };

  /**
   * Cierra un pedido: descuenta stock, sincroniza y cambia estado a 'cerrada'.
   * @param {string} id - ID del pedido
   * @param {string} formaPago
   * @param {number} total
   * @param {number} descuento
   * @returns {Promise<object|null>} El pedido actualizado o null si falla
   */
  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) {
      Logger.warn(`[DB] Pedido ${id} no encontrado.`);
      return null;
    }

    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      Logger.warn(`[DB] El pedido ${id} ya está cerrado.`);
      return pedido;
    }

    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      Logger.warn("[DB] Error descontando stock local:", e);
    }

    try {
      const items = JSON.parse(pedido.items || '[]');
      await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'procesarVenta',
          items: items.map(it => ({ productoId: it.prodId, cantidad: it.qty }))
        })
      });
    } catch (e) {
      Logger.warn("[DB] No se pudo descontar stock online, encolando.");
      this._encolarOperacion('procesarVenta', {
        items: JSON.parse(pedido.items || '[]').map(it => ({ productoId: it.prodId, cantidad: it.qty }))
      });
    }

    const pedidoActualizado = this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });

    if (pedidoActualizado) {
      const pedidoParaSync = {
        id: pedidoActualizado.id,
        mesa: pedidoActualizado.mesa,
        mozo: pedidoActualizado.mozo || 'Sin mozo',
        comensales: pedidoActualizado.comensales || 1,
        estado: pedidoActualizado.estado,
        items: Array.isArray(pedidoActualizado.items)
                 ? JSON.stringify(pedidoActualizado.items)
                 : pedidoActualizado.items,
        total: pedidoActualizado.total,
        created_at: pedidoActualizado.created_at,
        updated_at: pedidoActualizado.updated_at
      };

      try {
        await this.syncGuardarPedido(pedidoParaSync);
        Logger.info(`[DB] Pedido ${id} sincronizado con Sheets como cerrado.`);
      } catch (e) {
        Logger.warn(`[DB] Error al sincronizar cierre del pedido ${id}. Encolando.`);
        this._encolarOperacion('guardarPedido', { pedido: pedidoParaSync });
      }
    }

    return pedidoActualizado;
  };

  /**
   * Crea un pedido de delivery, delegando en PedidoManager si existe.
   * @param {object} datos
   * @returns {object} El pedido de delivery creado
   */
  combined.crearPedidoDelivery = function(datos) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoDelivery) {
      return PedidoManager.crearPedidoDelivery(datos);
    }
    const nuevo = this._normalizarPedidoDelivery({
      ...datos,
      id: 'deliv_' + Date.now(),
      created_at: new Date().toISOString()
    });
    this.pedidosDelivery.push(nuevo);
    this.savePedidosDelivery();
    return nuevo;
  };

  /**
   * Envía un pedido de delivery a cocina, delegando en PedidoManager.
   * @param {string} deliveryId
   * @returns {boolean}
   */
  combined.enviarPedidoDeliveryACocina = function(deliveryId) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.enviarPedidoDeliveryACocina) {
      return PedidoManager.enviarPedidoDeliveryACocina(deliveryId);
    }
    return false;
  };

  /**
   * Actualiza un pedido de delivery.
   * @param {string} id
   * @param {object} cambios
   * @returns {object|null}
   */
  combined.actualizarPedidoDelivery = function(id, cambios) {
    const idx = this.pedidosDelivery.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.pedidosDelivery[idx] = { ...this.pedidosDelivery[idx], ...cambios };
      this.savePedidosDelivery();
    }
    return this.pedidosDelivery[idx] || null;
  };

  /**
   * Elimina un pedido de delivery.
   * @param {string} id
   */
  combined.eliminarPedidoDelivery = function(id) {
    this.pedidosDelivery = this.pedidosDelivery.filter(p => p.id !== id);
    this.savePedidosDelivery();
  };

  return combined;
})();

window.DB = DB;