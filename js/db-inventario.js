/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-inventario.js
   Versión: 1.0.8
   Propósito: Gestión de ingredientes, recetas, stock y movimientos.
              Métodos auxiliares de validación ahora son privados.
              Auth importado explícitamente.
              Eliminada función duplicada validarStockParaArticulos.
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

  // ══ FUNCIONES AUXILIARES PRIVADAS (no expuestas) ══

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
      productoId: _validarId(r.productoId, 'prod'),
      ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.map(ing => ({
        ingredienteId: _validarId(ing.ingredienteId, 'ins'),
        cantidad: _validarNumero(ing.cantidad, 0)
      })) : [],
      instrucciones: _validarString(r.instrucciones, '')
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
    return receta.ingredientes.map(ing => {
      const ingrediente = this.ingredientes.find(i => i.id === ing.ingredienteId);
      return {
        ...ingrediente,
        cantidadUsada: ing.cantidad
      };
    }).filter(i => i !== undefined);
  };

  module.consumirIngredientesDeProducto = async function(productoId, cantidad, motivo = 'Consumo') {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return false;

    for (const ingReceta of receta.ingredientes) {
      const ingrediente = this.ingredientes.find(i => i.id === ingReceta.ingredienteId);
      if (!ingrediente) continue;

      const cantidadADescontar = ingReceta.cantidad * cantidad;

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