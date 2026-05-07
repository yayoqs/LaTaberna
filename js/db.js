/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador v2.3 – serializar items)
   ================================================================
   Cambios:
   - En cerrarPedido, antes de llamar a syncGuardarPedido, se
     serializa "items" a JSON string si es un array.
   - Se añaden explícitamente los campos requeridos por el backend
     (id, mesa, estado, items, total, mozo, etc.) para evitar
     discrepancias.
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

  combined.init = async function() {
    try {
      console.log("[DB] Iniciando carga de datos...");
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
      this._fetchMozos().catch(e => console.warn("[DB] Mozos remotos no disponibles", e));
      this._fetchIngredientes().catch(e => console.warn("[DB] Ingredientes remotos no disponibles", e));
      this._fetchRecetas().catch(e => console.warn("[DB] Recetas remotas no disponibles", e));

      await this._procesarSyncQueue();

      console.log("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      console.error("[DB] Error crítico en init:", e);
      this._mostrarErrorCarga();
      return false;
    }
  };

  combined._mostrarErrorCarga = function() {
    EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
  };

  // ── MÉTODOS DE PEDIDO ──────────────────────────────────
  combined.crearPedidoMesa = function(numeroMesa, mozo, comensales) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoMesa) {
      return PedidoManager.crearPedidoMesa(numeroMesa, mozo, comensales);
    }
    return this.crearPedido(numeroMesa, mozo, comensales);
  };

  combined.agregarItemAPedido = function(pedidoId, item) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.agregarItemAPedido) {
      return PedidoManager.agregarItemAPedido(pedidoId, item);
    }
    return false;
  };

  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) {
      console.warn(`[DB] Pedido ${id} no encontrado.`);
      return null;
    }

    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      console.warn(`[DB] El pedido ${id} ya está cerrado.`);
      return pedido;
    }

    // ── Descontar stock local ──────────────────────────────
    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      console.warn("[DB] Error descontando stock local:", e);
    }

    // ── Descuento de stock online (encola si falla) ────────
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
      console.warn("[DB] No se pudo descontar stock online, encolando.");
      this._encolarOperacion('procesarVenta', {
        items: JSON.parse(pedido.items || '[]').map(it => ({ productoId: it.prodId, cantidad: it.qty }))
      });
    }

    // ── Actualizar estado local ────────────────────────────
    const pedidoActualizado = this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });

    // ── Sincronizar estado con Sheets ──────────────────────
    if (pedidoActualizado) {
      // Preparar objeto con los campos exactos que espera el backend
      const pedidoParaSync = {
        id: pedidoActualizado.id,
        mesa: pedidoActualizado.mesa,
        mozo: pedidoActualizado.mozo || 'Sin mozo',
        comensales: pedidoActualizado.comensales || 1,
        estado: pedidoActualizado.estado,
        items: Array.isArray(pedidoActualizado.items) 
                 ? JSON.stringify(pedidoActualizado.items) 
                 : pedidoActualizado.items,   // asegurar string JSON
        total: pedidoActualizado.total,
        created_at: pedidoActualizado.created_at,
        updated_at: pedidoActualizado.updated_at
      };

      try {
        await this.syncGuardarPedido(pedidoParaSync);
        console.log(`[DB] Pedido ${id} sincronizado con Sheets como cerrado.`);
      } catch (e) {
        console.warn(`[DB] Error al sincronizar cierre del pedido ${id}. Encolando.`);
        this._encolarOperacion('guardarPedido', { pedido: pedidoParaSync });
      }
    }

    return pedidoActualizado;
  };

  // ── MÉTODOS DE DELIVERY ────────────────────────────────
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

  combined.enviarPedidoDeliveryACocina = function(deliveryId) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.enviarPedidoDeliveryACocina) {
      return PedidoManager.enviarPedidoDeliveryACocina(deliveryId);
    }
    return false;
  };

  combined.actualizarPedidoDelivery = function(id, cambios) {
    const idx = this.pedidosDelivery.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.pedidosDelivery[idx] = { ...this.pedidosDelivery[idx], ...cambios };
      this.savePedidosDelivery();
    }
    return this.pedidosDelivery[idx] || null;
  };

  combined.eliminarPedidoDelivery = function(id) {
    this.pedidosDelivery = this.pedidosDelivery.filter(p => p.id !== id);
    this.savePedidosDelivery();
  };

  return combined;
})();

window.DB = DB;