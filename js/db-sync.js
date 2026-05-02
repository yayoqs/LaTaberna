/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v4 – incluye método público llamar)
   ================================================================ */
const DBSync = (function() {
  const module = {};

  // ⚠️ Reemplaza con tu URL actualizada después de implementar la Fase 2
  module.urlSheets = "https://script.google.com/macros/s/AKfycbwnuMnw0mF4XKX0gq1ilqdzgP1Hw67tXW-FHHYcWlU1HF6LmZFzg5fkznNSkE3-48J5_w/exec";

  module.syncQueue = [];

  module._cargarSyncQueueLocal = function() {
    const raw = localStorage.getItem('pubpos_sync_queue');
    this.syncQueue = raw ? JSON.parse(raw) : [];
  };

  module._saveSyncQueue = function() {
    localStorage.setItem('pubpos_sync_queue', JSON.stringify(this.syncQueue));
    EventBus.emit('sync:colaActualizada', this.syncQueue.length);
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
    showToast('info', '<i class="fas fa-cloud-upload-alt"></i> Cambios guardados localmente. Se sincronizarán cuando haya conexión.');
  };

  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    console.log(`[DB Sync] Procesando cola (${this.syncQueue.length} operaciones)...`);
    const queueCopy = [...this.syncQueue];
    this.syncQueue = [];
    this._saveSyncQueue();

    let exitos = 0, fallos = 0;
    for (const item of queueCopy) {
      try {
        await this._sendDataViaGet(item.action, item.payload);
        exitos++;
      } catch (e) {
        console.warn(`[DB Sync] Falló "${item.action}", re-encolando.`, e);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        } else {
          console.error(`[DB Sync] Descartando "${item.action}" tras 5 intentos.`);
        }
        fallos++;
      }
    }
    this._saveSyncQueue();
    if (exitos > 0 && fallos === 0) {
      showToast('success', `<i class="fas fa-check-circle"></i> ${exitos} operaciones sincronizadas con la nube.`);
    } else if (exitos > 0 && fallos > 0) {
      showToast('warning', `<i class="fas fa-exclamation-triangle"></i> ${exitos} operaciones enviadas, ${fallos} pendientes de reintento.`);
    } else if (exitos === 0 && fallos > 0) {
      showToast('error', `<i class="fas fa-exclamation-circle"></i> No se pudo conectar. Tus cambios se sincronizarán automáticamente más tarde.`);
    }
    EventBus.emit('sync:colaActualizada', this.syncQueue.length);
  };

  module._sendDataViaGet = async function(action, payload) {
    const data = { action, ...payload };
    const param = encodeURIComponent(JSON.stringify(data));
    const url = `${this.urlSheets}?json=${param}`;
    console.log(`[DB Sync] GET write -> ${url.substring(0, 150)}...`);
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const respData = await res.json();
    if (respData.error) throw new Error(respData.error);
    console.log(`[DB Sync] "${action}" completado con éxito.`);
    return respData;
  };

  // ── LECTURAS (GET normal) ──────────────────────────────────
  module._fetchProductos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getProductos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.productos)) {
        this.productos = data.productos.map(p => this._normalizarProducto(p));
        localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
        EventBus.emit('productos:cargados', this.productos);

        // 🔍 NUEVO: diagnóstico de imágenes
        const conImagen = this.productos.filter(p => p.imagen && p.imagen.trim() !== '').length;
        console.log(`[DB Sync] ${this.productos.length} productos sincronizados (${conImagen} con imagen).`);
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
      console.warn("[DB Sync] Error obteniendo mozos, manteniendo locales.", e.message);
    }
  };

  module._fetchIngredientes = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getInsumos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let ing = [];
      if (data && Array.isArray(data.insumos)) ing = data.insumos;
      else if (data && Array.isArray(data.ingredientes)) ing = data.ingredientes;
      if (ing.length) {
        this.ingredientes = ing.map(i => this._normalizarIngrediente(i));
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
      let recetas = [];
      if (data && Array.isArray(data.recetas)) recetas = data.recetas;
      if (recetas.length) {
        const mapa = new Map();
        recetas.forEach(row => {
          const prodId = row.productoId || row[0];
          const ingId = row.insumoId || row[1];
          const cant = row.cantidad || row[2];
          if (!prodId || !ingId) return;
          if (!mapa.has(prodId)) {
            mapa.set(prodId, { id: `rec_${prodId}`, productoId: prodId, ingredientes: [] });
          }
          mapa.get(prodId).ingredientes.push({ ingredienteId: ingId, cantidad: parseFloat(cant) });
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
    showToast('info', 'Sincronizando...');
    try {
      await Promise.all([
        this._fetchProductos(),
        this._fetchMozos(),
        this._fetchIngredientes(),
        this._fetchRecetas()
      ]);
      await this._procesarSyncQueue();
      showToast('success', 'Datos sincronizados');
      EventBus.emit('sincronizacion:completada');
    } catch (e) {
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error de conexión');
    }
  };

  // ── ESCRITURAS (ahora vía GET) ─────────────────────────────
  module.syncGuardarProducto = async function(producto) {
    const idx = this.productos.findIndex(p => p.id == producto.id);
    if (idx >= 0) this.productos[idx] = producto;
    else this.productos.push(producto);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);
    try {
      await this._sendDataViaGet('guardarProducto', { producto });
    } catch (e) {
      console.warn('[DB Sync] Error, encolando:', e);
      this._encolarOperacion('guardarProducto', { producto });
    }
  };

  module.syncEliminarProducto = async function(productoId) {
    this.productos = this.productos.filter(p => p.id != productoId);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);
    try {
      await this._sendDataViaGet('eliminarProducto', { productoId });
    } catch (e) {
      console.warn('[DB Sync] Error, encolando:', e);
      this._encolarOperacion('eliminarProducto', { productoId });
    }
  };

  module.syncGuardarMozo = async function(mozo) {
    const idx = this.mozos.findIndex(m => m.id === mozo.id);
    if (idx >= 0) this.mozos[idx] = mozo;
    else this.mozos.push(mozo);
    this.saveMozos();
    try {
      await this._sendDataViaGet('guardarMozo', { mozo });
    } catch (e) {
      console.warn('[DB Sync] Offline, encolando mozo.');
      this._encolarOperacion('guardarMozo', { mozo });
    }
  };

  module.syncGuardarPedido = async function(pedido) {
    try {
      await this._sendDataViaGet('guardarPedido', { pedido });
    } catch (e) {
      console.warn('[DB Sync] Offline, pedido encolado.');
      this._encolarOperacion('guardarPedido', { pedido });
    }
  };

  module.syncGuardarIngrediente = async function(ingrediente) {
    const idx = this.ingredientes.findIndex(i => i.id == ingrediente.id);
    if (idx >= 0) this.ingredientes[idx] = ingrediente;
    else this.ingredientes.push(ingrediente);
    this.saveIngredientes();
    try {
      await this._sendDataViaGet('guardarIngrediente', { ingrediente });
    } catch (e) {
      console.warn('[DB Sync] Error, encolando ingrediente:', e);
      this._encolarOperacion('guardarIngrediente', { ingrediente });
    }
  };

  module.syncEliminarIngrediente = async function(ingredienteId) {
    this.ingredientes = this.ingredientes.filter(i => i.id != ingredienteId);
    this.saveIngredientes();
    try {
      await this._sendDataViaGet('eliminarIngrediente', { ingredienteId });
    } catch (e) {
      console.warn('[DB Sync] Error, encolando eliminación:', e);
      this._encolarOperacion('eliminarIngrediente', { ingredienteId });
    }
  };

  module.syncGuardarReceta = async function(receta) {
    let recetaLocal = this.recetas.find(r => r.productoId == receta.productoId);
    if (!recetaLocal) {
      recetaLocal = { id: receta.id, productoId: receta.productoId, ingredientes: [] };
      this.recetas.push(recetaLocal);
    }
    const ingIdx = recetaLocal.ingredientes.findIndex(ing => ing.ingredienteId == receta.insumoId);
    if (ingIdx >= 0) recetaLocal.ingredientes[ingIdx].cantidad = receta.cantidad;
    else recetaLocal.ingredientes.push({ ingredienteId: receta.insumoId, cantidad: receta.cantidad });
    this.saveRecetas();
    try {
      await this._sendDataViaGet('guardarReceta', { receta });
    } catch (e) {
      console.warn('[DB Sync] Error, encolando receta:', e);
      this._encolarOperacion('guardarReceta', { receta });
    }
  };

  module.getPendingSyncCount = function() {
    return this.syncQueue.length;
  };

  // ── MÉTODO GENÉRICO PARA NUEVAS ACCIONES ──────────────────
  module.llamar = async function(action, payload) {
    try {
      const data = { action, ...payload };
      const param = encodeURIComponent(JSON.stringify(data));
      const url = `${this.urlSheets}?json=${param}`;
      console.log(`[DB Sync] Llamada genérica -> ${action}`);
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const respData = await res.json();
      if (respData.error) throw new Error(respData.error);
      console.log(`[DB Sync] "${action}" completado con éxito.`);
      return respData;
    } catch (e) {
      console.warn(`[DB Sync] Error en llamada "${action}":`, e);
      throw e;
    }
  };

  return module;
})();