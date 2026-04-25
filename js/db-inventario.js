/* ================================================================
   PubPOS — MÓDULO: db-inventario.js (v3 – completo)
   Propósito: Gestión de ingredientes, recetas y movimientos de stock.
   ================================================================ */

const DBInventario = (function() {
  const module = {};

  module.ingredientes = [];
  module.recetas = [];
  module.movimientos = [];

  // ── NORMALIZACIÓN ─────────────────────────────────────────────
  module._normalizarIngrediente = function(i) {
    return {
      id: this._validarId(i.id, 'ins'),
      nombre: this._validarString(i.nombre, 'Sin nombre'),
      stock: this._validarNumero(i.stock, 0),
      unidad: this._validarString(i.unidad, 'u'),
      stock_minimo: this._validarNumero(i.stock_minimo, 0),
      categoria: this._validarString(i.categoria, 'general'),
      ubicacion: this._validarString(i.ubicacion, '')
    };
  };

  module._normalizarReceta = function(r) {
    return {
      id: this._validarId(r.id, 'rec'),
      productoId: this._validarId(r.productoId, 'prod'),
      ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.map(ing => ({
        ingredienteId: this._validarId(ing.ingredienteId, 'ins'),
        cantidad: this._validarNumero(ing.cantidad, 0)
      })) : []
    };
  };

  module._normalizarMovimiento = function(mov) {
    return {
      id: this._validarId(mov.id, 'mov'),
      ingredienteId: this._validarId(mov.ingredienteId, 'ins'),
      tipo: ['entrada', 'salida', 'ajuste'].includes(mov.tipo) ? mov.tipo : 'ajuste',
      cantidad: this._validarNumero(mov.cantidad, 0),
      fecha: mov.fecha || new Date().toISOString(),
      motivo: this._validarString(mov.motivo, ''),
      usuario: this._validarString(mov.usuario, 'sistema')
    };
  };

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
    if (raw) {
      const recParseadas = JSON.parse(raw);
      this.recetas = recParseadas.map(r => this._normalizarReceta(r));
    } else {
      this.recetas = [];
    }
  };

  module._cargarMovimientosLocal = function() {
    const raw = localStorage.getItem('pubpos_movimientos');
    if (raw) {
      const movParseados = JSON.parse(raw);
      this.movimientos = movParseados.map(m => this._normalizarMovimiento(m));
    } else {
      this.movimientos = [];
    }
  };

  module.saveIngredientes = function() {
    localStorage.setItem('pubpos_ingredientes', JSON.stringify(this.ingredientes));
    EventBus.emit('ingredientes:actualizados', this.ingredientes);
  };

  module.saveRecetas = function() {
    localStorage.setItem('pubpos_recetas', JSON.stringify(this.recetas));
  };

  module.saveMovimientos = function() {
    localStorage.setItem('pubpos_movimientos', JSON.stringify(this.movimientos));
  };

  // ── CONSULTAS ─────────────────────────────────────────────────
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
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return false;

    for (const ingReceta of receta.ingredientes) {
      const ingrediente = this.ingredientes.find(i => i.id === ingReceta.ingredienteId);
      if (!ingrediente) continue;

      const cantidadADescontar = ingReceta.cantidad * cantidad;
      ingrediente.stock = Math.max(0, ingrediente.stock - cantidadADescontar);

      this.movimientos.push(this._normalizarMovimiento({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        ingredienteId: ingrediente.id,
        tipo: 'salida',
        cantidad: -cantidadADescontar,
        fecha: new Date().toISOString(),
        motivo: motivo,
        usuario: (typeof Auth !== 'undefined' && Auth.getNombre) ? Auth.getNombre() : 'sistema'
      }));

      if (ingrediente.stock <= ingrediente.stock_minimo) {
        EventBus.emit('inventario:stock_bajo', {
          ingrediente: ingrediente.nombre,
          stock: ingrediente.stock,
          unidad: ingrediente.unidad
        });
      }
    }

    this.saveIngredientes();
    this.saveMovimientos();
    EventBus.emit('inventario:actualizado');
    return true;
  };

  // ── AJUSTE MANUAL ────────────────────────────────────────────
  module.ajustarStock = function(ingredienteId, cantidadDelta, motivo = 'Ajuste manual') {
    const ingrediente = this.ingredientes.find(i => i.id === ingredienteId);
    if (!ingrediente) return false;

    ingrediente.stock = Math.max(0, ingrediente.stock + cantidadDelta);

    this.movimientos.push(this._normalizarMovimiento({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      ingredienteId: ingrediente.id,
      tipo: cantidadDelta > 0 ? 'entrada' : 'salida',
      cantidad: cantidadDelta,
      fecha: new Date().toISOString(),
      motivo: motivo,
      usuario: (typeof Auth !== 'undefined' && Auth.getNombre) ? Auth.getNombre() : 'sistema'
    }));

    this.saveIngredientes();
    this.saveMovimientos();
    EventBus.emit('inventario:actualizado');

    if (ingrediente.stock <= ingrediente.stock_minimo) {
      EventBus.emit('inventario:stock_bajo', {
        ingrediente: ingrediente.nombre,
        stock: ingrediente.stock,
        unidad: ingrediente.unidad
      });
    }
    return true;
  };

  return module;
})();