/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador)
   Propósito: Reúne todos los submódulos y coordina la inicialización.
   Cambio 2026-04-24: El POST para procesarVenta ahora usa
   Content-Type: text/plain para evitar el preflight CORS.
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

  combined.urlSheets = sync.urlSheets; // exponer la URL por si otros módulos la necesitan

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

  /**
   * Cierra un pedido y descuenta el stock correspondiente.
   * El POST a procesarVenta ahora usa 'text/plain' para evitar el preflight CORS.
   */
  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) return null;

    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      console.warn("[DB] Error descontando stock local:", e);
    }

    try {
      const items = JSON.parse(pedido.items || '[]');
      // ⚠️ Cambio importante: Content-Type: text/plain para evitar CORS preflight
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

    return this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });
  };

  return combined;
})();

window.DB = DB;