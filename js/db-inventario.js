/* ================================================================
   PubPOS — MÓDULO: db-inventario.js (v2 – con ubicación)
   ================================================================ */
const DBInventario = (function() {
  const module = {};

  module.ingredientes = [];
  module.recetas = [];
  module.movimientos = [];

  module._normalizarIngrediente = function(i) {
    return {
      id: this._validarId(i.id, 'ins'),
      nombre: this._validarString(i.nombre, 'Sin nombre'),
      stock: this._validarNumero(i.stock, 0),
      unidad: this._validarString(i.unidad, 'u'),
      stock_minimo: this._validarNumero(i.stock_minimo, 0),
      categoria: this._validarString(i.categoria, 'general'),
      ubicacion: this._validarString(i.ubicacion, '')   // ← nuevo
    };
  };

  module._normalizarReceta = function(r) { /* igual que antes */ };
  module._normalizarMovimiento = function(mov) { /* igual */ };

  // ── PERSISTENCIA LOCAL ───────────────────────────────────────
  module._cargarIngredientesLocal = function() {
    const raw = localStorage.getItem('pubpos_ingredientes');
    if (raw) {
      const ingParseados = JSON.parse(raw);
      this.ingredientes = ingParseados.map(i => this._normalizarIngrediente(i));
    } else {
      this.ingredientes = [];
    }
  };

  module._cargarRecetasLocal = function() {
    const raw = localStorage.getItem('pubpos_recetas');
    this.recetas = raw ? JSON.parse(raw) : [];
  };

  module._cargarMovimientosLocal = function() {
    const raw = localStorage.getItem('pubpos_movimientos');
    this.movimientos = raw ? JSON.parse(raw) : [];
  };

  module.saveIngredientes = function() {
    localStorage.setItem('pubpos_ingredientes', JSON.stringify(this.ingredientes));
    EventBus.emit('ingredientes:actualizados', this.ingredientes);
  };
  module.saveRecetas = function() { /* igual */ };
  module.saveMovimientos = function() { /* igual */ };

  module.getIngredientesDeProducto = function(productoId) {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return [];
    return receta.ingredientes.map(ing => {
      const ingrediente = this.ingredientes.find(i => i.id === ing.ingredienteId);
      return {
        ...ingrediente,
        cantidadUsada: ing.cantidad
      };
    }).filter(i => i !== undefined);
  };

  // ── DESCONTAR STOCK (local) ──────────────────────────────────
  module.consumirIngredientesDeProducto = async function(productoId, cantidad, motivo = 'Consumo') {
    /* igual que antes, sin cambios */
  };

  module.ajustarStock = function(ingredienteId, cantidadDelta, motivo = 'Ajuste manual') {
    /* igual */
  };

  return module;
})();