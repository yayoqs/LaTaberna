/* ================================================================
   PubPOS — MÓDULO: db-sync.js
   Propósito: Sincronización con Google Sheets mediante App Script.
   Cambios 2026-04-23:
     • Eliminado el proxy CORS "cors-anywhere" porque ya no es necesario
       si el backend incluye doOptions() para el preflight.
     • Resuelto el conflicto de fusión que dejaba marcas <<<<<<< HEAD.
     • Se mantiene la lógica de cola de operaciones offline.
   Nota pedagógica: El fetch directo a https://script.google.com/macros/s/...
   funciona si el web app está desplegado con acceso "Cualquiera" y 
   el backend responde a OPTIONS. Sin ello, verás errores CORS.
   ================================================================ */

const DBSync = (function() {
  const module = {};

  // ⚠️ Cambia esta URL por la de tu propio despliegue si es necesario
  module.urlSheets = "https://script.google.com/macros/s/AKfycbxq0q2id31wOpQWs3WazhTZSNIjpPAxcJ7mGZZyxlcgvhUTS2A6Kv0bjSvgcHYIWGn8OQ/exec";

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
          headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch(`${this.urlSheets}?action=getInsumos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let ingredientes = [];
      if (data && Array.isArray(data.insumos)) {
        ingredientes = data.insumos;
      } else if (data && Array.isArray(data.ingredientes)) {
        ingredientes = data.ingredientes;
      }
      if (ingredientes.length) {
        this.ingredientes = ingredientes.map(i => this._normalizarIngrediente(i));
        this.saveIngredientes();
        console.log(`[DB Sync] ${this.ingredientes.length} ingredientes sincronizados.`);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo insumos, usando caché.", e.message);
    }
  };

  module._fetchRecetas = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getRecetas`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let recetasPlanas = [];
      if (data && Array.isArray(data.recetas)) {
        recetasPlanas = data.recetas;
      }
      if (recetasPlanas.length) {
        const mapa = new Map();
        recetasPlanas.forEach(row => {
          const prodId = row.productoId || row[0];
          const ingId = row.insumoId || row[1];
          const cant = row.cantidad || row[2];
          if (!prodId || !ingId) return;
          if (!mapa.has(prodId)) {
            mapa.set(prodId, { id: `rec_${prodId}`, productoId: prodId, ingredientes: [] });
          }
          mapa.get(prodId).ingredientes.push({
            ingredienteId: ingId,
            cantidad: parseFloat(cant)
          });
        });
        this.recetas = Array.from(mapa.values());
        this.saveRecetas();
        console.log(`[DB Sync] ${this.recetas.length} recetas sincronizadas.`);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo recetas.", e.message);
    }
  };

  module.sincronizarTodo = async function() {
    showToast('info', '<i class="fas fa-sync-alt fa-spin"></i> Sincronizando...');
    try {
      await Promise.all([
        this._fetchProductos(),
        this._fetchMozos(),
        this._fetchIngredientes(),
        this._fetchRecetas()
      ]);
      await this._procesarSyncQueue();
      showToast('success', '<i class="fas fa-check-circle"></i> Datos sincronizados');
      EventBus.emit('sincronizacion:completada');
    } catch (e) {
      console.error("[DB Sync] Error:", e);
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error de conexión');
    }
  };

  module.syncGuardarProducto = async function(producto) {
    const idx = this.productos.findIndex(p => p.id === producto.id);
    if (idx >= 0) this.productos[idx] = producto;
    else this.productos.push(producto);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
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

  module.syncGuardarMozo = async function(mozo) {
    const idx = this.mozos.findIndex(m => m.id === mozo.id);
    if (idx >= 0) this.mozos[idx] = mozo;
    else this.mozos.push(mozo);
    this.saveMozos();

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardarMozo', mozo })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Mozo guardado en la nube');
    } catch (e) {
      console.warn('[DB Sync] Offline, mozo encolado.');
      showToast('warning', '⚠️ Sin conexión. Se guardará localmente.');
      this._encolarOperacion('guardarMozo', { mozo });
    }
  };

  module.syncGuardarPedido = async function(pedido) {
    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardarPedido', pedido })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      console.log('[DB Sync] Pedido guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Offline, pedido encolado.');
      this._encolarOperacion('guardarPedido', { pedido });
    }
  };

  return module;
})();