/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador)
   Cambios respecto a la versión anterior:
   • En cerrarPedido() se agregó una validación para evitar el
     doble descuento de inventario si el pedido ya está cerrado.
     Esto actúa como red de seguridad, incluso aunque Cobro.js ya
     unificó el flujo de cierre.
   • Se mantienen las delegaciones a PedidoManager para crear pedidos
     de mesa y delivery, pero ahora PedidoManager ya no tiene el
     método conflictivo cerrarPedidoMesa.
   • Todo lo demás permanece igual (consultas, guardado, etc.).
   ================================================================ */

var DB = (function() {
  const core = DBCore;
  const sync = DBSync;
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

  // ── MÉTODOS DE PEDIDO (DELEGADOS AL PEDIDOMANAGER SI EXISTE) ──
  combined.crearPedidoMesa = function(numeroMesa, mozo, comensales) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoMesa) {
      return PedidoManager.crearPedidoMesa(numeroMesa, mozo, comensales);
    }
    // fallback al método original de core
    return this.crearPedido(numeroMesa, mozo, comensales);
  };

  combined.agregarItemAPedido = function(pedidoId, item) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.agregarItemAPedido) {
      return PedidoManager.agregarItemAPedido(pedidoId, item);
    }
    return false;
  };

  /* ── CIERRE DE PEDIDO (MEJORADO) ──────────────────────────
     Ahora valida si el pedido ya está cerrado para que,
     incluso si se llama varias veces, solo se descuente stock
     la primera vez. Esto evita inconsistencias en el inventario
     en caso de un doble envío accidental desde la UI.
     Sigue siendo el único punto donde se descuenta stock y se
     sincroniza con Google Sheets.
  ─────────────────────────────────────────────────────────── */
  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) {
      console.warn(`[DB] Pedido ${id} no encontrado.`);
      return null;
    }

    // ⛔ Protección contra doble cierre
    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      console.warn(`[DB] El pedido ${id} ya está cerrado. Se omite descuento de stock.`);
      return pedido; // Retornamos el pedido tal cual, sin modificar nada.
    }

    // ── Descontar stock localmente (recetas) ──────────────
    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      console.warn("[DB] Error descontando stock local:", e);
    }

    // ── Sincronizar con Google Sheets ─────────────────────
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

    // ── Actualizar estado del pedido ──────────────────────
    return this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });
  };

  // ── MÉTODOS DE DELIVERY (DELEGADOS AL PEDIDOMANAGER) ──────
  combined.crearPedidoDelivery = function(datos) {
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoDelivery) {
      return PedidoManager.crearPedidoDelivery(datos);
    }
    // fallback
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