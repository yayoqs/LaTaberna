/* ================================================================
   PubPOS — MÓDULO: db-sync.js (v2.2 – con syncIngredientes y Recetas)
   ================================================================ */
const DBSync = (function() {
  const module = {};

  module.urlSheets = "https://script.google.com/macros/s/AKfycbxsOZ1KVokva9hq6tX2jKSfnHe-Q1e_5-DjdbxA-N2L4R2QDsJi7mIP96KwuP_TFkZ2gQ/exec";

  module.syncQueue = [];

  // ... (código existente de _cargarSyncQueueLocal, _saveSyncQueue, _encolarOperacion, _procesarSyncQueue, _fetch...)

  module.syncGuardarIngrediente = async function(ingrediente) {
    // Actualizar local
    const idx = this.ingredientes.findIndex(i => i.id == ingrediente.id);
    if (idx >= 0) this.ingredientes[idx] = ingrediente;
    else this.ingredientes.push(ingrediente);
    this.saveIngredientes();

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'guardarIngrediente', ingrediente })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Ingrediente guardado en la nube');
      console.log('[DB Sync] Ingrediente guardado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      showToast('warning', '⚠️ Sin conexión. Se guardará localmente.');
      this._encolarOperacion('guardarIngrediente', { ingrediente });
    }
  };

  module.syncEliminarIngrediente = async function(ingredienteId) {
    this.ingredientes = this.ingredientes.filter(i => i.id != ingredienteId);
    this.saveIngredientes();

    try {
      const res = await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'eliminarIngrediente', ingredienteId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', '✅ Ingrediente eliminado de la nube');
      console.log('[DB Sync] Ingrediente eliminado en Sheets.');
    } catch (e) {
      console.warn('[DB Sync] Error, se encolará:', e);
      showToast('warning', '⚠️ Sin conexión. Se eliminará solo localmente.');
      this._encolarOperacion('eliminarIngrediente', { ingredienteId });
    }
  };

  module.syncGuardarReceta = async function(receta) {
    // Actualizar local: buscar receta para ese productoId
    let recetaLocal = this.recetas.find(r => r.productoId == receta.productoId);
    if (!recetaLocal) {
      recetaLocal = { id: receta.id, productoId: receta.productoId, ingredientes: [] };
      this.recetas.push(recetaLocal);
    }
    // Buscar ingrediente dentro de la receta
    const ingIdx = recetaLocal.ingredientes.findIndex(ing => ing.ingredienteId == receta.insumoId);
    if (ingIdx >= 0) {
      recetaLocal.ingredientes[ingIdx].cantidad = receta.cantidad;
    } else {
      recetaLocal.ingredientes.push({ ingredienteId: receta.insumoId, cantidad: receta.cantidad });
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

  // ... el resto de funciones (syncGuardarProducto, syncEliminarProducto, etc.) se mantienen como estaban

  return module;
})();