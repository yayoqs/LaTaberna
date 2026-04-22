/* ================================================================
   PubPOS — MÓDULO: db-sync.js
   Propósito: Sincronización con Google Sheets y cola de operaciones.
   ================================================================ */

const DBSync = (function() {
  const module = {};

  module.urlSheets = "https://script.google.com/macros/s/AKfycbyoQcXzfsbAxbsNBelgzSFITlDKwapEyg1Ir6I72yzEFmpaCWfbnJ2aM2aqaQ5mJhd45Q/exec";
  module.syncQueue = [];

  /* ── COLA DE SINCRONIZACIÓN ──────────────────────────────── */
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
    console.log(`[DB] Operación "${action}" encolada.`);
  };

  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    console.log(`[DB] Procesando cola (${this.syncQueue.length})...`);
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
        console.log(`[DB] "${item.action}" sincronizado.`);
      } catch (e) {
        console.warn(`[DB] Fallo "${item.action}", reencolando.`);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        }
      }
    }
    this._saveSyncQueue();
  };

  /* ── FETCH A SHEETS ──────────────────────────────────────── */
  module._fetchProductos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getProductos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.productos)) {
        this.productos = data.productos.map(p => this._normalizarProducto(p));
        localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
        EventBus.emit('productos:cargados', this.productos);
        console.log(`[DB] ${this.productos.length} productos cargados.`);
      }
    } catch (e) {
      console.warn("[DB] Error fetching productos, usando caché:", e.message);
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
      }
    } catch (e) {
      console.warn("[DB] Error fetching mozos:", e.message);
    }
  };

  module.sincronizarTodo = async function() {
    showToast('info', '<i class="fas fa-sync-alt fa-spin"></i> Sincronizando...');
    try {
      await Promise.all([
        this._fetchProductos(),
        this._fetchMozos(),
        this._fetchIngredientes ? this._fetchIngredientes() : Promise.resolve(),
        this._fetchRecetas ? this._fetchRecetas() : Promise.resolve()
      ]);
      showToast('success', '<i class="fas fa-check-circle"></i> Datos actualizados');
      EventBus.emit('sincronizacion:completada');
    } catch (e) {
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error de conexión');
    }
  };

  /* ── SINCRONIZACIÓN PÚBLICA ──────────────────────────────── */
  module.syncGuardarProducto = async function(producto) {
    const idx = this.productos.findIndex(p => p.id === producto.id);
    if (idx >= 0) {
      this.productos[idx] = producto;
    } else {
      this.productos.push(producto);
    }
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardarProducto', producto })
      });
      if (!res.ok) throw new Error('Error al guardar producto');
      console.log('[DB] Producto guardado en Sheets.');
    } catch (e) {
      console.warn('[DB] Offline, producto encolado.');
      this._encolarOperacion('guardarProducto', { producto });
    }
  };

  module.syncGuardarMozo = async function(mozo) {
    const idx = this.mozos.findIndex(m => m.id === mozo.id);
    if (idx >= 0) {
      this.mozos[idx] = mozo;
    } else {
      this.mozos.push(mozo);
    }
    this.saveMozos();

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardarMozo', mozo })
      });
      if (!res.ok) throw new Error('Error al guardar mozo');
      console.log('[DB] Mozo guardado en Sheets.');
    } catch (e) {
      console.warn('[DB] Offline, mozo encolado.');
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
      if (!res.ok) throw new Error('Error al guardar pedido');
      console.log('[DB] Pedido guardado en Sheets.');
    } catch (e) {
      console.warn('[DB] Offline, pedido encolado.');
      this._encolarOperacion('guardarPedido', { pedido });
    }
  };

  return module;
})();