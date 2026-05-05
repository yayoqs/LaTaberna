/* ================================================================
   PubPOS — MÓDULO: db-inventario.js (v5.1 – validación de stock)
   Propósito: Gestión de ingredientes, recetas y movimientos de stock.
   Nuevo: método validarStockParaItems para verificar disponibilidad
          antes de enviar un pedido a cocina.
   ================================================================ */

const DBInventario = (function() {
  const module = {};

  module.ingredientes = [];
  module.recetas = [];
  module.movimientos = [];

  // ── NORMALIZACIONES (sin cambios) ──────────────────────────
  module._normalizarIngrediente = function(i) {
    return {
      id: this._validarId(i.id, 'ins'),
      nombre: this._validarString(i.nombre, 'Sin nombre'),
      stock: this._validarNumero(i.stock, 0),
      unidad: this._validarString(i.unidad, 'u'),
      stock_minimo: this._validarNumero(i.stock_minimo, 0),
      categoria: this._validarString(i.categoria, 'general'),
      ubicacion: this._validarString(i.ubicacion, ''),
      valor_unitario: this._validarNumero(i.valor_unitario, 0)
    };
  };

  module._normalizarReceta = function(r) {
    return {
      id: this._validarId(r.id, 'rec'),
      productoId: this._validarId(r.productoId, 'prod'),
      ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.map(ing => ({
        ingredienteId: this._validarId(ing.ingredienteId, 'ins'),
        cantidad: this._validarNumero(ing.cantidad, 0)
      })) : [],
      instrucciones: this._validarString(r.instrucciones, '')
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

  /* ── VALIDACIONES AUXILIARES ───────────────────────────── */
  module._validarId = function(val, prefijo) {
    if (typeof val === 'string' && val.length > 0) return val;
    return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  };
  module._validarString = function(val, defecto) {
    return (typeof val === 'string' && val.trim()) ? val.trim() : defecto;
  };
  module._validarNumero = function(val, defecto) {
    const num = Number(val);
    return isNaN(num) ? defecto : num;
  };

  // ── PERSISTENCIA LOCAL (sin cambios) ──────────────────────
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

  // ── CONSULTAS ──────────────────────────────────────────────
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

  // ── DESCONTAR STOCK ────────────────────────────────────────
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

  // ── AJUSTE MANUAL ──────────────────────────────────────────
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

  // ================================================================
  // NUEVO MÉTODO: validar stock para un conjunto de ítems
  // ================================================================
  /**
   * Verifica si hay stock suficiente para preparar los ítems.
   * @param {Array} items - Array de objetos { prodId, nombre, qty }
   * @returns {Object} { ok: boolean, faltantes: [{ ingrediente, faltante, stockActual, unidad }] }
   */
  module.validarStockParaItems = function(items) {
    const faltantes = [];
    // Mapa para acumular total necesario de cada ingrediente
    const totalNecesario = new Map(); // key: ingredienteId, value: { cantidadNecesaria, stockActual, nombre, unidad }

    for (const item of items) {
      const receta = this.recetas.find(r => r.productoId == item.prodId);
      if (!receta) continue; // producto sin receta, no podemos validar

      for (const ingReceta of receta.ingredientes) {
        const ingData = this.ingredientes.find(i => i.id === ingReceta.ingredienteId);
        if (!ingData) continue;

        const cantidadNecesaria = ingReceta.cantidad * item.qty;

        if (!totalNecesario.has(ingReceta.ingredienteId)) {
          totalNecesario.set(ingReceta.ingredienteId, {
            nombre: ingData.nombre,
            unidad: ingData.unidad,
            stockActual: ingData.stock,
            cantidadNecesaria: 0
          });
        }
        totalNecesario.get(ingReceta.ingredienteId).cantidadNecesaria += cantidadNecesaria;
      }
    }

    // Verificar cada ingrediente
    for (const [ingId, datos] of totalNecesario.entries()) {
      if (datos.stockActual < datos.cantidadNecesaria) {
        faltantes.push({
          ingrediente: datos.nombre,
          faltante: datos.cantidadNecesaria - datos.stockActual,
          stockActual: datos.stockActual,
          unidad: datos.unidad
        });
      }
    }

    return {
      ok: faltantes.length === 0,
      faltantes
    };
  };

  return module;
})();