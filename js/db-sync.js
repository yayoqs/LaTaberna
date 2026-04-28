/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v2.5)
   Propósito: Sincronización con Google Sheets mediante App Script.
   Mejoras: Cabeceras extra y logs para depuración.
   ================================================================ */
const DBSync = (function() {
  const module = {};

  // ⚠️ URL de la implementación web de Apps Script (reemplazar si se republica)
  module.urlSheets = "https://script.google.com/macros/s/AKfycbyyk5vXyImvuplXhzRM2i1u-2rR1VkOj7tcjCXgnqMbM24FycK-1ZuUVtpdv2jV2yEv1Q/exec";

  module.syncQueue = [];

  module._cargarSyncQueueLocal = function() {
    const raw = localStorage.getItem('pubpos_sync_queue');
    this.syncQueue = raw ? JSON.parse(raw) : [];
  };

  module._saveSyncQueue = function() {
    localStorage.setItem('pubpos_sync_queue', JSON.stringify(this.syncQueue));
    EventBus.emit('sync:colaActualizada', this.syncQueue.length);
  };

  /**
   * Encola una operación para sincronizar más tarde.
   */
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
    showToast('info', `<i class="fas fa-cloud-upload-alt"></i> Cambios guardados localmente. Se sincronizarán cuando haya conexión.`);
  };

  /**
   * Procesa la cola de sincronización.
   */
  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    console.log(`[DB Sync] Procesando cola (${this.syncQueue.length} operaciones)...`);
    const queueCopy = [...this.syncQueue];
    this.syncQueue = [];
    this._saveSyncQueue();

    let exitos = 0;
    let fallos = 0;

    for (const item of queueCopy) {
      try {
        const res = await this._postData(item.action, item.payload);
        exitos++;
      } catch (e) {
        console.warn(`[DB Sync] Falló "${item.action}", re-encolando.`, e);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        } else {
          console.error(`[DB Sync] Descartando "${item.action}" después de 5 intentos.`);
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

  /**
   * Función central para hacer POST al servidor con las cabeceras mejoradas.
   * ✅ Agregamos 'Accept: application/json' para garantizar respuesta JSON.
   */
  module._postData = async function(action, payload) {
    const url = this.urlSheets;
    const body = JSON.stringify({ action, ...payload });
    console.log(`[DB Sync] Enviando "${action}" → ${url}`);
    
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain',   // evita preflight CORS complejo
        'Accept': 'application/json'    // le pide al servidor que devuelva JSON
      },
      body: body
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${res.statusText})`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    console.log(`[DB Sync] "${action}" completado con éxito.`);
    return data;
  };

  /* ── FETCH DE DATOS (GET) ────────────────────────────────── */
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

  // ─── PRODUCTOS ──────────────────────────────────────────────
  module.syncGuardarProducto = async function(producto) {
    const idx = this.productos.findIndex(p => p.id == producto.id);
    if (idx >= 0) this.productos[idx] = producto;
    else this.productos.push(producto);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      await this._postData('guardarProducto', { producto });
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      this._encolarOperacion('guardarProducto', { producto });
    }
  };

  module.syncEliminarProducto = async function(productoId) {
    this.productos = this.productos.filter(p => p.id != productoId);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    try {
      await this._postData('eliminarProducto', { productoId });
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      this._encolarOperacion('eliminarProducto', { productoId });
    }
  };

  module.syncGuardarMozo = async function(mozo) {
    const idx = this.mozos.findIndex(m => m.id === mozo.id);
    if (idx >= 0) this.mozos[idx] = mozo;
    else this.mozos.push(mozo);
    this.saveMozos();

    try {
      await this._postData('guardarMozo', { mozo });
    } catch (e) {
      console.warn('[DB Sync] Offline, mozo encolado.');
      this._encolarOperacion('guardarMozo', { mozo });
    }
  };

  module.syncGuardarPedido = async function(pedido) {
    try {
      await this._postData('guardarPedido', { pedido });
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
      await this._postData('guardarIngrediente', { ingrediente });
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      this._encolarOperacion('guardarIngrediente', { ingrediente });
    }
  };

  module.syncEliminarIngrediente = async function(ingredienteId) {
    this.ingredientes = this.ingredientes.filter(i => i.id != ingredienteId);
    this.saveIngredientes();

    try {
      await this._postData('eliminarIngrediente', { ingredienteId });
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
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
    if (ingIdx >= 0) {
      recetaLocal.ingredientes[ingIdx].cantidad = receta.cantidad;
    } else {
      recetaLocal.ingredientes.push({ ingredienteId: receta.insumoId, cantidad: receta.cantidad });
    }
    this.saveRecetas();

    try {
      await this._postData('guardarReceta', { receta });
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      this._encolarOperacion('guardarReceta', { receta });
    }
  };

  module.getPendingSyncCount = function() {
    return this.syncQueue.length;
  };

  return module;
})();