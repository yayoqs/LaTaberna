/* ================================================================
   PubPOS — MÓDULO: db-sync.js
   Propósito: Sincronización con Google Sheets y cola de operaciones offline.
   ================================================================ */

const DBSync = (function() {
  const module = {};

  // ──────────────────────────────────────────────────────────────
  // 1. CONFIGURACIÓN DE LA URL (¡CAMBIA ESTA URL POR LA TUYA!)
  // ──────────────────────────────────────────────────────────────
  // Obtén esta URL desde Google Apps Script: Implementar → Nueva implementación → App web
  // Debe terminar en /exec
  module.urlSheets = "https://script.google.com/macros/s/AKfycbycZ-xTSOp6Oh9Awr29y_3kEb-w-yOt5-ufU3RgsYCBTZQjFLa74v_U_Gqi50OCAuI7wg/exec";

  // Cola para operaciones cuando estamos offline
  module.syncQueue = [];

  // ──────────────────────────────────────────────────────────────
  // 2. PERSISTENCIA DE LA COLA (localStorage)
  // ──────────────────────────────────────────────────────────────
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
    console.log(`[DB Sync] Operación "${action}" encolada para cuando haya conexión.`);
  };

  // Intenta enviar todas las operaciones pendientes
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
        console.log(`[DB Sync] "${item.action}" sincronizado correctamente.`);
      } catch (e) {
        console.warn(`[DB Sync] Falló "${item.action}", re-encolando.`, e);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        } else {
          console.error(`[DB Sync] Descartando operación "${item.action}" después de 5 intentos.`);
        }
      }
    }
    this._saveSyncQueue();
  };

  // ──────────────────────────────────────────────────────────────
  // 3. SINCRONIZACIÓN DE PRODUCTOS
  // ──────────────────────────────────────────────────────────────
  module._fetchProductos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getProductos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // El backend puede devolver { productos: [...] }
      if (data && Array.isArray(data.productos)) {
        // Normalizamos cada producto para que tenga los campos esperados
        this.productos = data.productos.map(p => this._normalizarProducto(p));
        // Guardamos en localStorage como respaldo offline
        localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
        EventBus.emit('productos:cargados', this.productos);
        console.log(`[DB Sync] ${this.productos.length} productos sincronizados.`);
      } else {
        console.warn('[DB Sync] La respuesta de productos no tiene el formato esperado.', data);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo productos, usando caché local.", e.message);
      const cache = localStorage.getItem('pubpos_cache_prod');
      this.productos = cache ? JSON.parse(cache).map(p => this._normalizarProducto(p)) : [];
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. SINCRONIZACIÓN DE MOZOS
  // ──────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────
  // 5. SINCRONIZACIÓN DE INGREDIENTES (Insumos)
  // ──────────────────────────────────────────────────────────────
  // El backend puede devolver la propiedad "insumos" (como lo tienes en tu script)
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

  // ──────────────────────────────────────────────────────────────
  // 6. SINCRONIZACIÓN DE RECETAS (formato plano → anidado)
  // ──────────────────────────────────────────────────────────────
  // Tu backend devuelve una lista plana con columnas: productoId, insumoId, cantidad.
  // Aquí transformamos esa lista plana en el formato anidado que espera el frontend.
  module._fetchRecetas = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getRecetas`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let recetasPlanas = [];
      if (data && Array.isArray(data.recetas)) {
        recetasPlanas = data.recetas;
      } else if (data && Array.isArray(data.recetasPlanas)) {
        recetasPlanas = data.recetasPlanas;
      }

      if (recetasPlanas.length) {
        // Agrupar por productoId
        const mapa = new Map();
        recetasPlanas.forEach(row => {
          const prodId = row.productoId || row[0]; // soporta objeto o array
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
        console.log(`[DB Sync] ${this.recetas.length} recetas sincronizadas (${recetasPlanas.length} relaciones).`);
      }
    } catch (e) {
      console.warn("[DB Sync] Error obteniendo recetas.", e.message);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 7. SINCRONIZACIÓN MASIVA (llamada desde DB.init)
  // ──────────────────────────────────────────────────────────────
  module.sincronizarTodo = async function() {
    showToast('info', '<i class="fas fa-sync-alt fa-spin"></i> Sincronizando con Google Sheets...');
    try {
      await Promise.all([
        this._fetchProductos(),
        this._fetchMozos(),
        this._fetchIngredientes(),
        this._fetchRecetas()
      ]);
      await this._procesarSyncQueue(); // envía operaciones pendientes
      showToast('success', '<i class="fas fa-check-circle"></i> Datos sincronizados correctamente');
      EventBus.emit('sincronizacion:completada');
    } catch (e) {
      console.error("[DB Sync] Error en sincronización general:", e);
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error de conexión con Sheets');
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 8. OPERACIONES DE ESCRITURA (con cola offline)
  // ──────────────────────────────────────────────────────────────
  module.syncGuardarProducto = async function(producto) {
    // Actualiza caché local
    const idx = this.productos.findIndex(p => p.id === producto.id);
    if (idx >= 0) this.productos[idx] = producto;
    else this.productos.push(producto);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);

    // Intenta enviar a Sheets, si falla, encola
    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardarProducto', producto })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log('[DB Sync] Producto guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Offline, producto encolado.');
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
      console.log('[DB Sync] Mozo guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Offline, mozo encolado.');
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
      console.log('[DB Sync] Pedido guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Offline, pedido encolado.');
      this._encolarOperacion('guardarPedido', { pedido });
    }
  };

  return module;
})();