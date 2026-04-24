/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v2.1 – con eliminación y mejora en guardado)
   ================================================================ */
const DBSync = (function() {
  const module = {};

  module.urlSheets = "https://script.google.com/macros/s/AKfycbyWd997tbxDrxUEf-JvpVHF0M8MCgMB78AKnPXsFwWJ22fi4rl4MJsNhlFzYGyZLEc76g/exec";

  module.syncQueue = [];

  module._cargarSyncQueueLocal = function() {
    const raw = localStorage.getItem('pubpos_sync_queue');
    this.syncQueue = raw ? JSON.parse(raw) : [];
  };

  module._saveSyncQueue = function() {
    localStorage.setItem('pubpos_sync_queue', JSON.stringify(this.syncQueue));
  };

  module._encolarOperacion = function(action, payload) {
    this.syncQueue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36)}`,
      action,
      payload,
      intentos: 0,
      creado: new Date().toISOString()
    });
    this._saveSyncQueue();
    console.log(`[DB Sync] Operación "${action}" encolada.`);
  };

  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    console.log(`[DB Sync] Procesando cola (${this.syncQueue.length} operaciones)...`);
    const queueCopy = [...this.syncQueue];
    this.syncQueue = [];
    this._saveSyncQueue();

    for (const item of queueCopy) {
      try {
        const res = await fetch(this.urlSheets, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: item.action, ...item.payload })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        console.log(`[DB Sync] "${item.action}" sincronizado.`);
      } catch (e) {
        console.warn(`[DB Sync] Falló "${item.action}", re-encolando.`, e);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        } else {
          console.error(`[DB Sync] Descartando "${item.action}" después de 5 intentos.`);
        }
      }
    }
    this._saveSyncQueue();
  };

  module._fetchProductos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getProductos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.productos)) {
        this.productos = data.productos.map(p => this._normalizarProducto(p));
        localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
        EventBus.emit('productos:cargados', this.productos);
        console.log(`[DB Sync] ${this.productos.length} productos sincronizados.`);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo productos, usando caché local.", e.message);
      const cache = localStorage.getItem('pubpos_cache_prod');
      this.productos = cache ? JSON.parse(cache).map(p => this._normalizarProducto(p)) : [];
    }
  };

  module._fetchMozos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getMozos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.mozos)) {
        this.mozos = data.mozos.map(m => this._normalizarMozo(m));
        this.saveMozos();
        EventBus.emit('mozos:cargados', this.mozos);
        console.log(`[DB Sync] ${this.mozos.length} mozos sincronizados.`);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo mozos, se mantendrán los locales.", e.message);
    }
  };

  module._fetchIngredientes = async function() {
    // ... (sin cambios)
  };

  module._fetchRecetas = async function() {
    // ... (sin cambios)
  };

  module.sincronizarTodo = async function() {
    // ... (sin cambios)
  };

  /**
   * Guarda un producto (crea o actualiza). Ahora con comparación flexible de ID.
   */
  module.syncGuardarProducto = async function(producto) {
    console.log('[DB Sync] Guardando producto:', producto);
    // Buscar usando == para cubrir string/number
    const idx = this.productos.findIndex(p => p.id == producto.id);
    if (idx >= 0) {
      this.productos[idx] = producto;
      console.log('[DB Sync] Producto actualizado localmente.');
    } else {
      this.productos.push(producto);
      console.warn('[DB Sync] Producto nuevo (no encontrado en array local). ¿ID correcto?');
    }
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'guardarProducto', producto })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Producto guardado en la nube');
      console.log('[DB Sync] Producto guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      showToast('warning', '⚠️ Sin conexión. Se guardará localmente.');
      this._encolarOperacion('guardarProducto', { producto });
    }
  };

  /**
   * Elimina un producto por ID en el backend y en el array local.
   */
  module.syncEliminarProducto = async function(productoId) {
    console.log('[DB Sync] Eliminando producto:', productoId);
    // Eliminar localmente
    this.productos = this.productos.filter(p => p.id != productoId);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'eliminarProducto', productoId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Producto eliminado de la nube');
      console.log('[DB Sync] Producto eliminado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Error eliminando, se encolará:', e);
      showToast('warning', '⚠️ Sin conexión. Se eliminará solo localmente.');
      this._encolarOperacion('eliminarProducto', { productoId });
    }
  };

  module.syncGuardarMozo = async function(mozo) { /* ... sin cambios */ };
  module.syncGuardarPedido = async function(pedido) { /* ... sin cambios */ };

  // Asegurarse de incluir las demás funciones (_fetchIngredientes, _fetchRecetas, etc.) que están en el original.
  // (No las reescribo por brevedad, pero debes conservarlas)

  return module;
})();