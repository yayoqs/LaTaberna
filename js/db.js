/* ================================================================
   PubPOS — MÓDULO: db.js (Orquestador)
   Propósito: Reúne todos los submódulos y coordina la inicialización.
   ================================================================ */

var DB = (function() {
  // Combinar todos los submódulos
  const core = DBCore;
  const sync = DBSync;
  const inventario = DBInventario;
  const fusion = DBFusion;

  // Mezclar propiedades (cuidado con sobrescribir métodos, pero están separados)
  const combined = {
    ...core,
    ...sync,
    ...inventario,
    ...fusion
  };

  // URL de Google Sheets (se toma de db-sync, pero la exponemos por si otros módulos la necesitan)
  combined.urlSheets = sync.urlSheets;

  // ── INICIALIZACIÓN PRINCIPAL ─────────────────────────────────
  combined.init = async function() {
    try {
      console.log("[DB] Iniciando carga de datos...");
      // Cargar desde localStorage
      this._cargarConfigLocal();
      this._inicializarMesas();
      this._cargarComandasLocal();
      this._cargarPedidosLocal();
      this._cargarMozosLocal();
      this._cargarIngredientesLocal();
      this._cargarRecetasLocal();
      this._cargarMovimientosLocal();
      this._cargarSyncQueueLocal();

      // Sincronizar con Google Sheets (si hay conexión)
      await this._fetchProductos();
      this._fetchMozos().catch(e => console.warn("[DB] Mozos remotos no disponibles", e));
      this._fetchIngredientes().catch(e => console.warn("[DB] Ingredientes remotos no disponibles", e));
      this._fetchRecetas().catch(e => console.warn("[DB] Recetas remotas no disponibles", e));

      // Procesar operaciones pendientes de la cola offline
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

  // ── CIERRE DE PEDIDO (descuenta stock y sincroniza venta) ─────
  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) return null;

    // 1. Descontar stock localmente (si tiene recetas)
    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      console.warn("[DB] Error descontando stock local:", e);
    }

    // 2. Notificar a Google Sheets para que también descuente (o encolar)
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

    // 3. Actualizar estado del pedido a cerrado
    return this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });
  };

  return combined;
})();

window.DB = DB;