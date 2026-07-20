/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-inventario.js
   Versión: 1.0.9
   Propósito: Gestión de ingredientes, recetas, stock y movimientos.
              Soporte para recetas anidadas (sub-recetas).
              Auth importado explícitamente.
              Todos los catch registran error.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { DBAppwrite } from './db-appwrite.js';
import { Auth } from './auth.js';

export const DBInventario = (function() {
  const module = {};

  module.ingredientes = [];
  module.recetas = [];
  module.movimientos = [];

  // ══ FUNCIONES AUXILIARES PRIVADAS ══

  function _validarId(val, prefijo) {
    if (typeof val === 'string' && val.length > 0) return val;
    return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function _validarString(val, defecto) {
    return (typeof val === 'string' && val.trim()) ? val.trim() : defecto;
  }

  function _validarNumero(val, defecto) {
    const num = Number(val);
    return isNaN(num) ? defecto : num;
  }

  function _validarBooleano(val, defecto) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return defecto;
  }

  /**
   * Resuelve recursivamente todos los ingredientes de una receta,
   * incluyendo los de sus sub-recetas.
   * @param {string} recetaId - ID de la receta a resolver.
   * @param {number} cantidad - Cantidad de veces que se usa la receta.
   * @param {Array} recetas - Array completo de recetas disponibles.
   * @param {Array} ingredientes - Array completo de ingredientes disponibles.
   * @returns {Array} Array de { ingredienteId, nombre, cantidadNecesaria, unidad }.
   */
  function _resolverIngredientes(recetaId, cantidad, recetas, ingredientes) {
    const receta = recetas.find(r => r.id === recetaId);
    if (!receta) {
      Logger.warn(`[DBInventario] Sub-receta ${recetaId} no encontrada.`);
      return [];
    }

    const resultado = [];

    for (const ing of receta.ingredientes) {
      const cantidadTotal = ing.cantidad * cantidad;

      if (ing.tipo === 'insumo') {
        const insumo = ingredientes.find(i => i.id === ing.id);
        resultado.push({
          ingredienteId: ing.id,
          nombre: insumo ? insumo.nombre : ing.id,
          cantidadNecesaria: cantidadTotal,
          unidad: insumo ? insumo.unidad : 'u'
        });
      } else if (ing.tipo === 'subreceta') {
        const subIngredientes = _resolverIngredientes(ing.id, cantidadTotal, recetas, ingredientes);
        resultado.push(...subIngredientes);
      }
    }

    // Consolidar ingredientes repetidos
    const consolidado = new Map();
    for (const r of resultado) {
      if (consolidado.has(r.ingredienteId)) {
        consolidado.get(r.ingredienteId).cantidadNecesaria += r.cantidadNecesaria;
      } else {
        consolidado.set(r.ingredienteId, { ...r });
      }
    }

    return Array.from(consolidado.values());
  }

  /* ── NORMALIZACIONES ─────────────────────────────────────── */
  module._normalizarIngrediente = function(i) {
    return {
      id: _validarId(i.id, 'ins'),
      nombre: _validarString(i.nombre, 'Sin nombre'),
      stock: _validarNumero(i.stock, 0),
      unidad: _validarString(i.unidad, 'u'),
      stock_minimo: _validarNumero(i.stock_minimo, 0),
      categoria: _validarString(i.categoria, 'general'),
      ubicacion: _validarString(i.ubicacion, ''),
      valor_unitario: _validarNumero(i.valor_unitario, 0)
    };
  };

  module._normalizarReceta = function(r) {
    return {
      id: _validarId(r.id, 'rec'),
      productoId: r.productoId || null,
      nombre: _validarString(r.nombre, 'Sin nombre'),
      ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.map(ing => ({
        tipo: ['insumo', 'subreceta'].includes(ing.tipo) ? ing.tipo : 'insumo',
        id: _validarId(ing.id, ing.tipo === 'subreceta' ? 'rec' : 'ins'),
        cantidad: _validarNumero(ing.cantidad, 0)
      })) : [],
      instrucciones: _validarString(r.instrucciones, ''),
      esIntermedio: _validarBooleano(r.es_intermedio || r.esIntermedio, false)
    };
  };

  module._normalizarMovimiento = function(mov) {
    return {
      id: _validarId(mov.id, 'mov'),
      ingredienteId: _validarId(mov.ingredienteId, 'ins'),
      tipo: ['entrada', 'salida', 'ajuste'].includes(mov.tipo) ? mov.tipo : 'ajuste',
      cantidad: _validarNumero(mov.cantidad, 0),
      fecha: mov.fecha || new Date().toISOString(),
      motivo: _validarString(mov.motivo, ''),
      usuario: _validarString(mov.usuario, 'sistema')
    };
  };

  /* ── PERSISTENCIA LOCAL ────────────────────────────────── */
  module._cargarIngredientesLocal = function() {
    const raw = localStorage.getItem('pubpos_ingredientes');
    if (raw) {
      try {
        const ingParseados = JSON.parse(raw);
        this.ingredientes = ingParseados.map(i => this._normalizarIngrediente(i));
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear ingredientes locales:', e);
        this.ingredientes = [];
      }
    } else {
      this.ingredientes = [];
    }
  };

  module._cargarRecetasLocal = function() {
    const raw = localStorage.getItem('pubpos_recetas');
    if (raw) {
      try {
        const recParseadas = JSON.parse(raw);
        this.recetas = recParseadas.map(r => this._normalizarReceta(r));
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear recetas locales:', e);
        this.recetas = [];
      }
    } else {
      this.recetas = [];
    }
  };

  module._cargarMovimientosLocal = function() {
    const raw = localStorage.getItem('pubpos_movimientos');
    if (raw) {
      try {
        const movParseados = JSON.parse(raw);
        this.movimientos = movParseados.map(m => this._normalizarMovimiento(m));
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear movimientos locales:', e);
        this.movimientos = [];
      }
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

  module.getIngredientesDeProducto = function(productoId) {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return [];
    return _resolverIngredientes(receta.id, 1, this.recetas, this.ingredientes);
  };

  module.consumirIngredientesDeProducto = async function(productoId, cantidad, motivo = 'Consumo') {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return false;

    const ingredientesNecesarios = _resolverIngredientes(receta.id, cantidad, this.recetas, this.ingredientes);

    for (const necesario of ingredientesNecesarios) {
      const ingrediente = this.ingredientes.find(i => i.id === necesario.ingredienteId);
      if (!ingrediente) continue;

      const cantidadADescontar = necesario.cantidadNecesaria;

      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
        try {
          const resultado = await DBAppwrite.decrementarCampo(
            'ingredientes',
            ingrediente.id,
            'stock',
            cantidadADescontar,
            0
          );
          if (resultado && typeof resultado.stock === 'number') {
            ingrediente.stock = resultado.stock;
          }
        } catch (e) {
          Logger.error('[DBInventario] Error al decrementar stock en Appwrite:', e);
          ingrediente.stock = Math.max(0, ingrediente.stock - cantidadADescontar);
        }
      } else {
        ingrediente.stock = Math.max(0, ingrediente.stock - cantidadADescontar);
      }

      this.movimientos.push(this._normalizarMovimiento({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        ingredienteId: ingrediente.id,
        tipo: 'salida',
        cantidad: -cantidadADescontar,
        fecha: new Date().toISOString(),
        motivo: motivo,
        usuario: (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema'
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
      usuario: (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema'
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