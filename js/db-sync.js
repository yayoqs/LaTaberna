/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v5.5 – logging unificado + JSDoc)
   Propósito: Sincronización con Google Sheets, cola offline y
              método genérico de llamada. Reconstruye comandas al
              iniciar.
   ================================================================ */
window.DBSync = (function() {
  const module = {};

  module.urlSheets = "https://script.google.com/macros/s/AKfycbzbLLE-lJJRyeHpLTxyvtI7hganGCLHOd9EJJmNqAQBPUz22KfFBW_JZIpX1kq7t7tZcQ/exec";

  module.syncQueue = [];

  /**
   * Carga la cola de sincronización desde localStorage.
   */
  module._cargarSyncQueueLocal = function() {
    const raw = localStorage.getItem('pubpos_sync_queue');
    this.syncQueue = raw ? JSON.parse(raw) : [];
  };

  /**
   * Persiste la cola de sincronización en localStorage y emite evento.
   */
  module._saveSyncQueue = function() {
    localStorage.setItem('pubpos_sync_queue', JSON.stringify(this.syncQueue));
    if (window.EventBus) EventBus.emit('sync:colaActualizada', this.syncQueue.length);
  };

  /**
   * Agrega una operación a la cola para reintento posterior.
   * @param {string} action - Nombre de la acción
   * @param {object} payload - Datos de la operación
   */
  module._encolarOperacion = function(action, payload) {
    this.syncQueue.push({
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36),
      action,
      payload,
      intentos: 0,
      creado: new Date().toISOString()
    });
    this._saveSyncQueue();
    Logger.info(`[DB Sync] Operación "${action}" encolada.`);
  };

  /**
   * Procesa todas las operaciones pendientes en la cola.
   * Las exitosas se eliminan; las fallidas se reencolan hasta 5 intentos.
   */
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

  /**
   * Envía datos al backend mediante una petición GET con parámetros JSON.
   * @param {string} action
   * @param {object} payload
   * @returns {Promise<object>} Respuesta del backend
   */
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

  /** Descarga productos desde Sheets y los guarda localmente. */
  module._fetchProductos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getProductos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.productos)) {
        this.productos = data.productos.map(p => window.DB._normalizarProducto(p));
        localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
        EventBus.emit('productos:cargados', this.productos);
        Logger.info(`[DB Sync] ${this.productos.length} productos sincronizados.`);
      }
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo productos, usando caché.");
      const cache = localStorage.getItem('pubpos_cache_prod');
      this.productos = cache ? JSON.parse(cache).map(p => window.DB._normalizarProducto(p)) : [];
    }
  };

  /** Descarga mozos desde Sheets y los guarda localmente. */
  module._fetchMozos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getMozos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.mozos)) {
        this.mozos = data.mozos.map(m => window.DB._normalizarMozo(m));
        window.DB.saveMozos();
        EventBus.emit('mozos:cargados', this.mozos);
        Logger.info(`[DB Sync] ${this.mozos.length} mozos sincronizados.`);
      }
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo mozos.");
    }
  };

  /** Descarga ingredientes desde Sheets y los guarda localmente. */
  module._fetchIngredientes = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getInsumos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let ing = [];
      if (data && Array.isArray(data.insumos)) ing = data.insumos;
      else if (data && Array.isArray(data.ingredientes)) ing = data.ingredientes;
      if (ing.length) {
        this.ingredientes = ing.map(i => window.DB._normalizarIngrediente(i));
        window.DB.saveIngredientes();
        Logger.info(`[DB Sync] ${this.ingredientes.length} ingredientes sincronizados.`);
      }
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo insumos.");
    }
  };

  /** Descarga recetas desde Sheets y las guarda localmente. */
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
        window.DB.saveRecetas();
        Logger.info(`[DB Sync] ${this.recetas.length} recetas sincronizadas.`);
      }
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo recetas.");
    }
  };

  /**
   * Descarga pedidos desde Sheets y reconstruye las comandas para KDS.
   */
  module._fetchPedidos = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getPedidos`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.pedidos)) return;

      const pedidosRemotos = data.pedidos
        .map(p => ({
          id: p.id || '',
          mesa: parseInt(p.mesa) || 0,
          mozo: p.mozo || 'Sin mozo',
          comensales: parseInt(p.comensales) || 1,
          estado: p.estado || 'abierta',
          items: p.items || '[]',
          total: parseFloat(p.total) || 0,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString()
        }))
        .filter(p => p.id && p.mesa);

      window.DB.pedidos = pedidosRemotos;
      window.DB.savePedidos();

      const comandasReconstruidas = [];
      pedidosRemotos.forEach(pedido => {
        if (pedido.estado !== 'abierta' && pedido.estado !== 'en_proceso') return;

        let items;
        try {
          items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items;
        } catch (e) {
          items = [];
        }
        if (!Array.isArray(items) || items.length === 0) return;

        const mesa = window.DB.getMesa(pedido.mesa);
        if (mesa) {
          mesa.estado = pedido.estado === 'abierta' ? 'ocupada' : 'esperando';
          mesa.pedidoId = pedido.id;
          mesa.mozo = pedido.mozo;
          mesa.comensales = pedido.comensales;
          mesa.abiertaEn = pedido.created_at;
          mesa.items = items;
          mesa.total = pedido.total;
        }

        const comanda = {
          id: 'kds_restored_' + pedido.id,
          mesa: pedido.mesa,
          mozo: pedido.mozo,
          destino: 'cocina',
          items: items.map(it => ({
            prodId: it.prodId || '',
            nombre: it.nombre || '',
            precio: it.precio || 0,
            qty: it.qty || 1,
            destino: it.destino || 'cocina',
            obs: it.obs || '',
            enviado: true,
            enviadoA: it.destino || 'cocina',
            enviadoTs: pedido.updated_at || Date.now()
          })),
          observaciones: '',
          estado: 'nueva',
          ts: Date.now()
        };
        comandasReconstruidas.push(comanda);
      });

      window.DB.comandas = comandasReconstruidas;
      window.DB.saveComandas();

      if (typeof Store !== 'undefined') {
        comandasReconstruidas.forEach(c => {
          Store.dispatch({ type: 'COMANDA_AGREGADA', payload: c });
        });
      }

      window.DB.saveMesas();
      Logger.info(`[DB Sync] ${pedidosRemotos.length} pedidos sincronizados, ${comandasReconstruidas.length} comandas reconstruidas.`);
    } catch (e) {
      Logger.warn("[DB Sync] Error obteniendo pedidos.", e.message);
    }
  };

  /**
   * Sincroniza todos los datos con Google Sheets y procesa la cola offline.
   */
  module.sincronizarTodo = async function() {
    showToast('info', 'Sincronizando...');
    try {
      await Promise.all([
        this._fetchProductos(),
        this._fetchMozos(),
        this._fetchIngredientes(),
        this._fetchRecetas(),
        this._fetchPedidos()
      ]);
      await this._procesarSyncQueue();
      showToast('success', 'Datos sincronizados');
      EventBus.emit('sincronizacion:completada');
    } catch (e) {
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error de conexión');
    }
  };

  /** Guarda un producto en Sheets o lo encola si falla. */
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

  /** Elimina un producto de Sheets o encola la operación. */
  module.syncEliminarProducto = async function(productoId) {
    this.productos = this.productos.filter(p => p.id != productoId);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(this.productos));
    EventBus.emit('productos:cargados', this.productos);
    try {
      await this._sendDataViaGet('eliminarProducto', { productoId });
    } catch (e) {
      Logger.warn('[DB Sync] Error, encolando:', e);
      this._encolarOperacion('eliminarProducto', { productoId });
    }
  };

  /** Guarda un mozo en Sheets o lo encola si falla. */
  module.syncGuardarMozo = async function(mozo) {
    const idx = this.mozos.findIndex(m => m.id === mozo.id);
    if (idx >= 0) this.mozos[idx] = mozo;
    else this.mozos.push(mozo);
    window.DB.saveMozos();
    try {
      await this._sendDataViaGet('guardarMozo', { mozo });
    } catch (e) {
      Logger.warn('[DB Sync] Offline, encolando mozo.');
      this._encolarOperacion('guardarMozo', { mozo });
    }
  };

  /** Guarda un pedido en Sheets o lo encola si falla. */
  module.syncGuardarPedido = async function(pedido) {
    try {
      const respuesta = await this._sendDataViaGet('guardarPedido', { pedido });
      Logger.debug(`[DB Sync] Respuesta de guardarPedido: ${JSON.stringify(respuesta)}`);
    } catch (e) {
      Logger.warn('[DB Sync] Offline, pedido encolado.');
      this._encolarOperacion('guardarPedido', { pedido });
    }
  };

  /** Guarda un ingrediente en Sheets o lo encola. */
  module.syncGuardarIngrediente = async function(ingrediente) {
    const idx = this.ingredientes.findIndex(i => i.id == ingrediente.id);
    if (idx >= 0) this.ingredientes[idx] = ingrediente;
    else this.ingredientes.push(ingrediente);
    window.DB.saveIngredientes();
    try {
      await this._sendDataViaGet('guardarIngrediente', { ingrediente });
    } catch (e) {
      Logger.warn('[DB Sync] Error, encolando ingrediente:', e);
      this._encolarOperacion('guardarIngrediente', { ingrediente });
    }
  };

  /** Elimina un ingrediente de Sheets o encola la operación. */
  module.syncEliminarIngrediente = async function(ingredienteId) {
    this.ingredientes = this.ingredientes.filter(i => i.id != ingredienteId);
    window.DB.saveIngredientes();
    try {
      await this._sendDataViaGet('eliminarIngrediente', { ingredienteId });
    } catch (e) {
      Logger.warn('[DB Sync] Error, encolando eliminación:', e);
      this._encolarOperacion('eliminarIngrediente', { ingredienteId });
    }
  };

  /** Guarda una receta en Sheets o la encola. */
  module.syncGuardarReceta = async function(receta) {
    let recetaLocal = this.recetas.find(r => r.productoId == receta.productoId);
    if (!recetaLocal) {
      recetaLocal = { id: receta.id, productoId: receta.productoId, ingredientes: [] };
      this.recetas.push(recetaLocal);
    }
    const ingIdx = recetaLocal.ingredientes.findIndex(ing => ing.ingredienteId == receta.insumoId);
    if (ingIdx >= 0) recetaLocal.ingredientes[ingIdx].cantidad = receta.cantidad;
    else recetaLocal.ingredientes.push({ ingredienteId: receta.insumoId, cantidad: receta.cantidad });
    window.DB.saveRecetas();
    try {
      await this._sendDataViaGet('guardarReceta', { receta });
    } catch (e) {
      Logger.warn('[DB Sync] Error, encolando receta:', e);
      this._encolarOperacion('guardarReceta', { receta });
    }
  };

  /** Retorna la cantidad de operaciones pendientes en la cola. */
  module.getPendingSyncCount = function() {
    return this.syncQueue.length;
  };

  /**
   * Método genérico para llamadas al backend con timeout.
   * @param {string} action
   * @param {object} payload
   * @returns {Promise<object>}
   */
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

  return module;
})();