/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador)
   Propósito: Reunir los submódulos (core, sync, inventario, fusion)
              y exponer el objeto DB completo.
   ================================================================ */

var DB = (function() {
  // Combinar todos los submódulos en un solo objeto
  const core = DBCore;
  const sync = DBSync;
  const inventario = DBInventario;
  const fusion = DBFusion;

  // Mezclar propiedades (cuidado con sobrescribir métodos)
  const combined = {
    ...core,
    ...sync,
    ...inventario,
    ...fusion
  };

  // Ajustar referencias cruzadas (algunos métodos llaman a otros módulos)
  // Como todos están en el mismo objeto, las llamadas internas funcionarán.

  // Inicialización principal
  combined.init = async function() {
    try {
      console.log("[DB] Iniciando carga...");
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
      this._fetchMozos().catch(e => console.warn("[DB] Mozos remotos no disponibles"));
      this._fetchIngredientes().catch(e => console.warn("[DB] Ingredientes remotos no disponibles"));
      this._fetchRecetas().catch(e => console.warn("[DB] Recetas remotas no disponibles"));

      this._procesarSyncQueue();

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

  // Ajustar cerrarPedido para usar inventario y sync
  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) return null;

    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      console.warn("[DB] Error descontando stock:", e);
    }

    try {
      const items = JSON.parse(pedido.items || '[]');
      await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
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