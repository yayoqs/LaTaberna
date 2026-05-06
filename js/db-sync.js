/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v4.1 – método llamar con timeout)
   Propósito: Sincronización bidireccional con Google Sheets.
              Incluye manejo de cola offline y método 'llamar' con
              timeout para evitar bloqueos prolongados.
   ================================================================ */
const DBSync = (function() {
  const module = {};

  module.urlSheets = "https://script.google.com/macros/s/AKfycbxOtznKKLBnJPMvpChxy6isJwDkvLhuVsc7W3ykyPusqZV3wQZtUllrHcd2xmCL1ypH/exec";

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
    Logger.info(`[DB Sync] Operación "${action}" encolada.`);
  };

  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    Logger.info(`[DB Sync] Procesando cola (${this.syncQueue.length} operaciones)...`);
    const queueCopy = [...this.syncQueue];
    this.syncQueue = [];
    this._saveSyncQueue();

    let exitos = 0, fallos = 0;
    for (const item of queueCopy) {
      try {
        await this._sendDataViaGet(item.action, item.payload);
        exitos++;
      } catch (e) {
        Logger.warn(`[DB Sync] Falló "${item.action}", re-encolando.`, e);
        item.intentos++;
        if (item.intentos < 5) {
          this.syncQueue.push(item);
        } else {
          Logger.error(`[DB Sync] Descartando "${item.action}" tras 5 intentos.`);
        }
        fallos++;
      }
    }
    this._saveSyncQueue();
    if (exitos > 0 && fallos === 0) {
      showToast('success', `<i class="fas fa-check-circle"></i> ${exitos} operaciones sincronizadas.`);
    } else if (exitos > 0 && fallos > 0) {
      showToast('warning', `<i class="fas fa-exclamation-triangle"></i> ${exitos} enviadas, ${fallos} pendientes.`);
    } else if (exitos === 0 && fallos > 0) {
      showToast('error', `<i class="fas fa-exclamation-circle"></i> No se pudo conectar. Se reintentará automáticamente.`);
    }
    EventBus.emit('sync:colaActualizada', this.syncQueue.length);
  };

  module._sendDataViaGet = async function(action, payload) {
    const data = { action, ...payload };
    const param = encodeURIComponent(JSON.stringify(data));
    const url = `${this.urlSheets}?json=${param}`;
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const respData = await res.json();
    if (respData.error) throw new Error(respData.error);
    return respData;
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
        const conImagen = this.productos.filter(p => p.imagen && p.imagen.trim() !== '').length;
        Logger.info(`[DB Sync] ${this.productos.length} productos sincronizados (${conImagen} con imagen).`);
      }
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo productos, usando caché local.", e.message);
      const cache = localStorage.getItem('pubpos_cache_prod');
      this.productos = cache ? JSON.parse(cache).map(p => this._normalizarProducto(p)) : [];
    }
  };

  module._fetchMozos = async function() { /* similar con Logger */ };
  module._fetchIngredientes = async function() { /* similar con Logger */ };
  module._fetchRecetas = async function() { /* similar con Logger */ };

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

  module.syncGuardarProducto = async function(producto) {
    const idx = this.productos.findIndex(p => p.id == producto.id);
    if (idx >= 0) this.productos[idx] = producto;
    else this.productos.push(producto);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);
    try {
      await this._sendDataViaGet('guardarProducto', { producto });
    } catch (e) {
      Logger.warn('[DB Sync] Error, encolando:', e);
      this._encolarOperacion('guardarProducto', { producto });
    }
  };

  // ... resto de syncGuardar/Eliminar igual ...

  module.llamar = async function(action, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const data = { action, ...payload };
      const param = encodeURIComponent(JSON.stringify(data));
      const url = `${this.urlSheets}?json=${param}`;
      Logger.debug(`[DB Sync] Llamada genérica -> ${action}`);
      const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const respData = await res.json();
      if (respData.error) throw new Error(respData.error);
      Logger.info(`[DB Sync] "${action}" completado con éxito.`);
      return respData;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado y fue cancelada.');
      }
      throw e;
    }
  };

  module.getPendingSyncCount = function() {
    return this.syncQueue.length;
  };

  return module;
})();