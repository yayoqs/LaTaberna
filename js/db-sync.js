/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v2.4 – cola automática y notificaciones)
   ================================================================ */
const DBSync = (function() {
  const module = {};
  module.urlSheets = "https://script.google.com/macros/s/AKfycbyeVDfM2h_UNG-rF0JrvotFvOHT3-sr90zIa-_jYhZ72KYNBhKY3X-z_B5rFV9SeXsjeg/exec";
  module.syncQueue = [];

  module._cargarSyncQueueLocal = function() {
    const raw = localStorage.getItem('pubpos_sync_queue');
    this.syncQueue = raw ? JSON.parse(raw) : [];
  };

  module._saveSyncQueue = function() {
    localStorage.setItem('pubpos_sync_queue', JSON.stringify(this.syncQueue));
    EventBus.emit('sync:status', { pendientes: this.syncQueue.length });
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
    // Intentar procesar inmediatamente
    this._procesarSyncQueue();
  };

  module._procesarSyncQueue = async function() {
    if (this.syncQueue.length === 0) return;
    console.log(`[DB Sync] Procesando cola (${this.syncQueue.length})...`);
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
          showToast('error', `No se pudo sincronizar "${item.action}" tras varios intentos`);
        }
      }
    }
    this._saveSyncQueue();
  };

  // Iniciar temporizador de sincronización automática
  module._iniciarSyncPeriodica = function() {
    setInterval(() => {
      this._procesarSyncQueue();
    }, 30000); // cada 30 segundos
  };

  module._fetchProductos = async function() { /* ... igual ... */ };
  module._fetchMozos = async function() { /* ... igual ... */ };
  module._fetchIngredientes = async function() { /* ... igual ... */ };
  module._fetchRecetas = async function() {
    try {
      const res = await fetch(`${this.urlSheets}?action=getRecetas`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let recetasPlanas = data && data.recetas ? data.recetas : [];
      if (recetasPlanas.length) {
        const mapa = new Map();
        recetasPlanas.forEach(row => {
          const prodId = row.productoId;
          const ingId = row.insumoId || row.ingredienteId; // compatibilidad
          const cant = row.cantidad;
          if (!prodId || !ingId) return;
          if (!mapa.has(prodId)) {
            mapa.set(prodId, { id: `rec_${prodId}`, productoId: prodId, ingredientes: [], instrucciones: row.instrucciones || '' });
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

  module.sincronizarTodo = async function() { /* ... igual ... */ };
  
  // Productos
  module.syncGuardarProducto = async function(producto) { /* ... igual, pero al final llamar a this._procesarSyncQueue() */ };
  module.syncEliminarProducto = async function(productoId) { /* ... igual */ };
  // Mozos
  module.syncGuardarMozo = async function(mozo) { /* ... igual */ };
  // Pedidos
  module.syncGuardarPedido = async function(pedido) { /* ... igual */ };
  // Ingredientes
  module.syncGuardarIngrediente = async function(ingrediente) { /* ... igual */ };
  module.syncEliminarIngrediente = async function(ingredienteId) { /* ... igual */ };
  // Recetas
  module.syncGuardarReceta = async function(receta) {
    let recetaLocal = this.recetas.find(r => r.productoId == receta.productoId);
    if (!recetaLocal) {
      recetaLocal = { id: receta.id, productoId: receta.productoId, ingredientes: [], instrucciones: '' };
      this.recetas.push(recetaLocal);
    }
    const ingIdx = recetaLocal.ingredientes.findIndex(ing => ing.ingredienteId == receta.insumoId);
    if (ingIdx >= 0) {
      recetaLocal.ingredientes[ingIdx].cantidad = receta.cantidad;
    } else {
      recetaLocal.ingredientes.push({ ingredienteId: receta.insumoId, cantidad: receta.cantidad });
    }
    // Guardar instrucciones si vienen en la receta
    if (receta.instrucciones !== undefined) {
      recetaLocal.instrucciones = receta.instrucciones;
    }
    this.saveRecetas();

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'guardarReceta', receta })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Receta actualizada en la nube');
      console.log('[DB Sync] Receta guardada en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      showToast('warning', '⚠️ Sin conexión. Se guardará localmente.');
      this._encolarOperacion('guardarReceta', { receta });
    }
  };

  return module;
})();