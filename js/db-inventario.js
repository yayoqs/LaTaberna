/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-inventario.js
   Versión: 1.1.2
   Propósito: Gestión de insumos, recetas, stock y movimientos.
              Soporte para recetas anidadas (sub-recetas).
              v1.1.2: reforzado fallback ingredienteId → insumoId en
                      _normalizarMovimiento.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { DBAppwrite } from './db-appwrite.js';
import { Auth } from './auth.js';

export const DBInventario = (function() {
  const module = {};

  module.insumos = [];
  module.recetas = [];
  module.movimientos = [];
  module.entradas = [];

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
   * Resuelve recursivamente todos los insumos de una receta,
   * incluyendo los de sus sub-recetas.
   * @param {string} recetaId - ID de la receta a resolver.
   * @param {number} cantidad - Cantidad de veces que se usa la receta.
   * @param {Array} recetas - Array completo de recetas disponibles.
   * @param {Array} insumos - Array completo de insumos disponibles.
   * @returns {Array} Array de { insumoId, nombre, cantidadNecesaria, unidad }.
   */
  function _resolverInsumos(recetaId, cantidad, recetas, insumos) {
    const receta = recetas.find(r => r.id === recetaId);
    if (!receta) {
      Logger.warn(`[DBInventario] Sub-receta ${recetaId} no encontrada.`);
      return [];
    }

    const resultado = [];

    for (const ing of receta.ingredientes) {
      const cantidadTotal = ing.cantidad * cantidad;

      if (ing.tipo === 'insumo') {
        const insumo = insumos.find(i => i.id === ing.id);
        resultado.push({
          insumoId: ing.id,
          nombre: insumo ? insumo.nombre : ing.id,
          cantidadNecesaria: cantidadTotal,
          unidad: insumo ? insumo.unidad : 'u'
        });
      } else if (ing.tipo === 'subreceta') {
        const subInsumos = _resolverInsumos(ing.id, cantidadTotal, recetas, insumos);
        resultado.push(...subInsumos);
      }
    }

    // Consolidar insumos repetidos
    const consolidado = new Map();
    for (const r of resultado) {
      if (consolidado.has(r.insumoId)) {
        consolidado.get(r.insumoId).cantidadNecesaria += r.cantidadNecesaria;
      } else {
        consolidado.set(r.insumoId, { ...r });
      }
    }

    return Array.from(consolidado.values());
  }

  /* ── NORMALIZACIONES ─────────────────────────────────────── */
  module._normalizarInsumo = function(i) {
    const datos = Object.assign({}, i);
    
    datos.id = _validarId(i.id, 'ins');
    datos.nombre = _validarString(i.nombre, 'Sin nombre');
    datos.stock = _validarNumero(i.stock, 0);
    datos.unidad = _validarString(i.unidad, 'u');
    datos.stock_minimo = _validarNumero(i.stock_minimo, 0);
    datos.categoria = _validarString(i.categoria, 'general');
    datos.ubicacion = _validarString(i.ubicacion, '');
    datos.tipo = _validarString(i.tipo, 'cocina');
    datos.costo_manual = i.costo_manual != null ? _validarNumero(i.costo_manual, null) : null;
    
    return datos;
  };

  module._normalizarReceta = function(r) {
    const datos = Object.assign({}, r);
    
    datos.id = _validarId(r.id, 'rec');
    datos.productoId = r.productoId || null;
    // El nombre del producto se obtiene mediante la relación con laTaberna_Productos
    // y el método obtenerRecetaConProducto(). No se normaliza aquí.
    datos.ingredientes = Array.isArray(r.ingredientes) ? r.ingredientes.map(ing => ({
      tipo: ['insumo', 'subreceta'].includes(ing.tipo) ? ing.tipo : 'insumo',
      id: _validarId(ing.id, ing.tipo === 'subreceta' ? 'rec' : 'ins'),
      cantidad: _validarNumero(ing.cantidad, 0)
    })) : [];
    datos.instrucciones = _validarString(r.instrucciones, '');
    datos.esIntermedio = _validarBooleano(r.es_intermedio || r.esIntermedio, false);
    
    return datos;
  };

  module._normalizarMovimiento = function(mov) {
    return {
      id: _validarId(mov.id, 'mov'),
      insumoId: _validarId(mov.insumoId || mov.ingredienteId, 'ins'),
      tipo: ['entrada', 'salida', 'ajuste'].includes(mov.tipo) ? mov.tipo : 'ajuste',
      cantidad: _validarNumero(mov.cantidad, 0),
      fecha: mov.fecha || new Date().toISOString(),
      motivo: _validarString(mov.motivo, ''),
      usuario: _validarString(mov.usuario, 'sistema')
    };
  };

  /* ── PERSISTENCIA LOCAL ────────────────────────────────── */
  module._cargarInsumosLocal = function() {
    const raw = localStorage.getItem('pubpos_insumos') || localStorage.getItem('pubpos_ingredientes');
    if (raw) {
      try {
        const insumosParseados = JSON.parse(raw);
        this.insumos = insumosParseados.map(i => this._normalizarInsumo(i));
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear insumos locales:', e);
        this.insumos = [];
      }
    } else {
      this.insumos = [];
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

  module._cargarEntradasLocal = function() {
    const raw = localStorage.getItem('pubpos_entradas');
    if (raw) {
      try {
        this.entradas = JSON.parse(raw);
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear entradas locales:', e);
        this.entradas = [];
      }
    } else {
      this.entradas = [];
    }
  };

  module.saveInsumos = function() {
    localStorage.setItem('pubpos_insumos', JSON.stringify(this.insumos));
    EventBus.emit('insumos:actualizados', this.insumos);
  };
  module.saveRecetas = function() {
    localStorage.setItem('pubpos_recetas', JSON.stringify(this.recetas));
  };
  module.saveMovimientos = function() {
    localStorage.setItem('pubpos_movimientos', JSON.stringify(this.movimientos));
  };
  module.saveEntradas = function() {
    localStorage.setItem('pubpos_entradas', JSON.stringify(this.entradas));
  };

  /* ── MÉTODOS DE COSTO ─────────────────────────────────── */

  /**
   * Obtiene el costo unitario de un insumo.
   * 1. Si tiene costo_manual (> 0), devuelve ese.
   * 2. Si no, busca la entrada más reciente y devuelve su costo_unitario.
   * 3. Si no hay entradas, devuelve 0.
   * @param {string} insumoId
   * @returns {Promise<number>}
   */
  module.obtenerCostoUnitario = async function(insumoId) {
    const insumo = this.insumos.find(i => i.id === insumoId);
    if (insumo && insumo.costo_manual != null && insumo.costo_manual > 0) {
      return insumo.costo_manual;
    }

    try {
      if (DBAppwrite && DBAppwrite.habilitado) {
        const entradas = await DBAppwrite.listar('entradas');
        const entradasInsumo = entradas
          .filter(e => e.insumoId === insumoId)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (entradasInsumo.length > 0 && entradasInsumo[0].costo_unitario != null) {
          return entradasInsumo[0].costo_unitario;
        }
      }
    } catch (e) {
      Logger.warn('[DBInventario] Error al obtener costo unitario desde Appwrite:', e);
    }

    const entradasLocales = (this.entradas || [])
      .filter(e => e.insumoId === insumoId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (entradasLocales.length > 0 && entradasLocales[0].costo_unitario != null) {
      return entradasLocales[0].costo_unitario;
    }

    return 0;
  };

  /**
   * Calcula el costo promedio ponderado de todas las entradas de un insumo.
   * Fórmula: sum(costo_total) / sum(cantidad * unidad_por_formato)
   * @param {string} insumoId
   * @returns {Promise<number>}
   */
  module.obtenerCostoPromedio = async function(insumoId) {
    let todasEntradas = [];

    try {
      if (DBAppwrite && DBAppwrite.habilitado) {
        const entradas = await DBAppwrite.listar('entradas');
        todasEntradas = entradas.filter(e => e.insumoId === insumoId);
      }
    } catch (e) {
      Logger.warn('[DBInventario] Error al obtener entradas desde Appwrite:', e);
    }

    if (todasEntradas.length === 0) {
      todasEntradas = (this.entradas || []).filter(e => e.insumoId === insumoId);
    }

    if (todasEntradas.length === 0) return 0;

    let costoTotal = 0;
    let cantidadTotalBase = 0;

    for (const entrada of todasEntradas) {
      costoTotal += (entrada.costo_total || 0);
      cantidadTotalBase += (entrada.cantidad || 0) * (entrada.unidad_por_formato || 1);
    }

    if (cantidadTotalBase === 0) return 0;
    return costoTotal / cantidadTotalBase;
  };

  /* ── MÉTODO DE RELACIÓN RECETA-PRODUCTO ───────────────── */

  /**
   * Obtiene una receta con el nombre del producto resuelto desde laTaberna_Productos.
   * @param {string} recetaId
   * @returns {object|null} Receta con campo `nombre` (del producto) agregado.
   */
  module.obtenerRecetaConProducto = function(recetaId) {
    const receta = this.recetas.find(r => r.id === recetaId);
    if (!receta) return null;
    const producto = this.productos ? this.productos.find(p => p.id === receta.productoId) : null;
    return { ...receta, nombre: producto ? producto.nombre : 'Sin producto' };
  };

  /* ── MÉTODOS DE CONSUMO ────────────────────────────────── */

  module.getInsumosDeProducto = function(productoId) {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return [];
    return _resolverInsumos(receta.id, 1, this.recetas, this.insumos);
  };

  module.consumirInsumosDeProducto = async function(productoId, cantidad, motivo = 'Consumo') {
    const receta = this.recetas.find(r => r.productoId === productoId);
    if (!receta) return false;

    const insumosNecesarios = _resolverInsumos(receta.id, cantidad, this.recetas, this.insumos);

    for (const necesario of insumosNecesarios) {
      const insumo = this.insumos.find(i => i.id === necesario.insumoId);
      if (!insumo) continue;

      const cantidadADescontar = necesario.cantidadNecesaria;

      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
        try {
          const resultado = await DBAppwrite.decrementarCampo(
            'insumos',
            insumo.id,
            'stock',
            cantidadADescontar,
            0
          );
          if (resultado && typeof resultado.stock === 'number') {
            insumo.stock = resultado.stock;
          }
        } catch (e) {
          Logger.error('[DBInventario] Error al decrementar stock en Appwrite:', e);
          insumo.stock = Math.max(0, insumo.stock - cantidadADescontar);
        }
      } else {
        insumo.stock = Math.max(0, insumo.stock - cantidadADescontar);
      }

      this.movimientos.push(this._normalizarMovimiento({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        insumoId: insumo.id,
        tipo: 'salida',
        cantidad: -cantidadADescontar,
        fecha: new Date().toISOString(),
        motivo: motivo,
        usuario: (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema'
      }));

      if (insumo.stock <= insumo.stock_minimo) {
        EventBus.emit('inventario:stock_bajo', {
          insumo: insumo.nombre,
          stock: insumo.stock,
          unidad: insumo.unidad
        });
      }
    }

    this.saveInsumos();
    this.saveMovimientos();
    EventBus.emit('inventario:actualizado');
    return true;
  };

  module.ajustarStock = function(insumoId, cantidadDelta, motivo = 'Ajuste manual') {
    const insumo = this.insumos.find(i => i.id === insumoId);
    if (!insumo) return false;

    insumo.stock = Math.max(0, insumo.stock + cantidadDelta);

    this.movimientos.push(this._normalizarMovimiento({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      insumoId: insumo.id,
      tipo: cantidadDelta > 0 ? 'entrada' : 'salida',
      cantidad: cantidadDelta,
      fecha: new Date().toISOString(),
      motivo: motivo,
      usuario: (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema'
    }));

    this.saveInsumos();
    this.saveMovimientos();
    EventBus.emit('inventario:actualizado');

    if (insumo.stock <= insumo.stock_minimo) {
      EventBus.emit('inventario:stock_bajo', {
        insumo: insumo.nombre,
        stock: insumo.stock,
        unidad: insumo.unidad
      });
    }
    return true;
  };

  return module;
})();