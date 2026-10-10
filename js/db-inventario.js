/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-inventario.js
   Versión: 1.3.2
   Propósito: Gestión de insumos, recetas, stock y movimientos.
              Soporte para recetas anidadas (sub-recetas).
              v1.3.2: fix del hallazgo 6.18 del test unificado.
                      ajustarStock usaba module.insumos, que queda
                      desincronizado tras DB.init() (db.js reasigna
                      this.insumos = lista.map(...), pero no toca
                      module.insumos del módulo). El bug se
                      manifiesta como "Insumo no encontrado" sobre
                      insumos que sí existen en Appwrite y en DB.
                      Se agrega _obtenerInsumosActuales() que
                      consulta Deps.obtener('db').insumos como
                      fuente primaria (patrón §7.15 del brief) y
                      cae al Store y a module.insumos como
                      fallback. Solo ajustarStock usa el helper;
                      consumirInsumosDeProducto ya usaba
                      _obtenerContexto() y no presentaba el bug.
              v1.3.1: hallazgo 2 del saneamiento post-movimientos.
                      _obtenerEspacioId devuelve null en lugar del
                      valor hardcodeado 'esp_taberna'.
              v1.3.0: A.74: movimientos de inventario como log
                      persistido en laTaberna_Movimientos.
              v1.2.3: A.61: _resolverInsumos detecta ciclos.
              v1.2.2: A.55.bis: saveRecetas emite
                      'recetas:actualizadas'.
              v1.2.1: A.48: _aplicarDeltas sin receta base.
              v1.2.0: A.34/A.36/A.37.
              v1.1.9: A.24 (refuerzo).
              v1.1.8: A.24/A.25/A.26.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Store } from './lib/store.js';
import { Deps } from './lib/deps.js';
import { DBAppwrite } from './db-appwrite.js';
import { Auth } from './auth.js';

export const DBInventario = (function() {
  const module = {};

  module.insumos = [];
  module.recetas = [];
  module.variantes = [];
  module.movimientos = [];
  module.entradas = [];

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

  function _parsearArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * A.74: obtiene el espacio activo del usuario actual.
   *
   * v1.3.1: si no se puede resolver, devuelve null en lugar del
   * valor hardcodeado 'esp_taberna'. Ese id no existe en
   * global_Espacios y generaba filas huérfanas en
   * laTaberna_Movimientos, invisibles para cualquier consulta por
   * espacio activo pero ocupando lugar en la colección.
   */
  function _obtenerEspacioId() {
    try {
      if (Auth && typeof Auth.obtenerLocalActivo === 'function') {
        const local = Auth.obtenerLocalActivo();
        if (local && local.id) return local.id;
      }
    } catch (e) {
      // Auth no disponible
    }
    try {
      const db = Deps.obtener('db');
      if (db && typeof db.espacioActivoId === 'function') {
        const id = db.espacioActivoId();
        // Filtrar también el fallback histórico de db.js.
        if (id && id !== 'esp_taberna') return id;
      }
    } catch (e) {
      // DB no disponible
    }
    return null;
  }

  /**
   * v1.3.2: fuente de verdad de insumos para operaciones de
   * escritura. Después de DB.init(), db.js reasigna su propio
   * array (this.insumos = lista.map(...)) pero no toca
   * module.insumos de este módulo. Consultar module.insumos
   * directo da resultados vacíos y produce el bug "Insumo no
   * encontrado" del test 6.18.
   *
   * Orden de prioridad:
   *   1. Deps.obtener('db').insumos — el array del orquestador.
   *   2. Store.obtenerEstado().insumos — la fuente para la UI.
   *   3. module.insumos — fallback cuando los anteriores no
   *      están disponibles (arranque temprano, tests aislados).
   *
   * Es el mismo patrón que ya usa _obtenerContexto() para
   * consumirInsumosDeProducto (§7.15 del brief).
   */
  function _obtenerInsumosActuales() {
    try {
      const db = Deps.obtener('db');
      if (db && Array.isArray(db.insumos) && db.insumos.length > 0) {
        return db.insumos;
      }
    } catch (e) {
      // Deps no registrado aún
    }
    try {
      const state = Store.obtenerEstado();
      if (state && Array.isArray(state.insumos) && state.insumos.length > 0) {
        return state.insumos;
      }
    } catch (e) {
      // Store no disponible
    }
    return module.insumos || [];
  }

  function _obtenerContexto() {
    let recetas = null;
    let insumos = null;

    try {
      const state = Store.obtenerEstado();
      if (state && Array.isArray(state.recetas) && state.recetas.length > 0) {
        recetas = state.recetas;
      }
      if (state && Array.isArray(state.insumos) && state.insumos.length > 0) {
        insumos = state.insumos;
      }
    } catch (e) {
      // Store no disponible
    }

    if (!recetas) {
      try {
        const db = Deps.obtener('db');
        if (db && Array.isArray(db.recetas) && db.recetas.length > 0) {
          recetas = db.recetas;
        }
      } catch (e) {
        // DB no disponible
      }
    }
    if (!insumos) {
      try {
        const db = Deps.obtener('db');
        if (db && Array.isArray(db.insumos) && db.insumos.length > 0) {
          insumos = db.insumos;
        }
      } catch (e) {
        // DB no disponible
      }
    }

    if (!recetas) recetas = module.recetas || [];
    if (!insumos) insumos = module.insumos || [];
    return { recetas, insumos };
  }

  function _normalizarIngredientes(ingredientesRaw) {
    if (Array.isArray(ingredientesRaw)) return ingredientesRaw;
    if (typeof ingredientesRaw === 'string') {
      try {
        const parsed = JSON.parse(ingredientesRaw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * A.61: resuelve recursivamente los insumos base de una receta.
   */
  function _resolverInsumos(recetaId, cantidad, recetas, insumos, visitadas) {
    const receta = recetas.find(r => r.id === recetaId);
    if (!receta) {
      Logger.warn(`[DBInventario] Sub-receta ${recetaId} no encontrada.`);
      return [];
    }

    const enRama = visitadas || new Set();

    if (enRama.has(recetaId)) {
      const cadena = [...enRama, recetaId].join(' → ');
      Logger.warn(`[DBInventario] Ciclo de sub-recetas detectado: ${cadena}. Rama ignorada.`);
      return [];
    }

    enRama.add(recetaId);

    const resultado = [];
    const ingredientes = _normalizarIngredientes(receta.ingredientes);

    for (const ing of ingredientes) {
      const cantidadTotal = (Number(ing.cantidad) || 0) * cantidad;

      if (ing.tipo === 'insumo') {
        const insumo = insumos.find(i => i.id === ing.id);
        resultado.push({
          insumoId: ing.id,
          nombre: insumo ? insumo.nombre : ing.id,
          cantidadNecesaria: cantidadTotal,
          unidad: insumo ? insumo.unidad : 'u'
        });
      } else if (ing.tipo === 'subreceta') {
        const subInsumos = _resolverInsumos(ing.id, cantidadTotal, recetas, insumos, enRama);
        resultado.push(...subInsumos);
      }
    }

    enRama.delete(recetaId);

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

  /**
   * A.36: aplica insumos_delta de las opciones seleccionadas.
   */
  function _aplicarDeltas(insumosBase, opciones) {
    const mapa = new Map();
    for (const ins of insumosBase) {
      mapa.set(ins.insumoId, { ...ins });
    }

    for (const op of (opciones || [])) {
      const deltas = Array.isArray(op.insumos_delta) ? op.insumos_delta : [];
      for (const delta of deltas) {
        const accion = delta.accion || 'sumar';
        if (accion === 'sumar') {
          const existente = mapa.get(delta.insumoId);
          if (existente) {
            existente.cantidadNecesaria += (Number(delta.cantidad) || 0);
          } else {
            mapa.set(delta.insumoId, {
              insumoId: delta.insumoId,
              nombre: delta.insumoId,
              cantidadNecesaria: Number(delta.cantidad) || 0,
              unidad: 'u'
            });
          }
        } else if (accion === 'quitar') {
          const existente = mapa.get(delta.insumoId);
          if (existente) {
            existente.cantidadNecesaria -= (Number(delta.cantidad) || 0);
          }
        } else {
          Logger.warn(`[DBInventario] Acción '${accion}' reservada para Fase 2, ignorada (insumo ${delta.insumoId}).`);
        }
      }
    }

    const resultado = [];
    mapa.forEach(item => {
      if (item.cantidadNecesaria > 0) {
        resultado.push(item);
      }
    });
    return resultado;
  }

  /**
   * A.74: construye y persiste un movimiento de inventario.
   * Despacha al Store, persiste en Appwrite con fallback local,
   * y emite el evento correspondiente.
   *
   * v1.3.1: si espacioId es null, no se persiste en Appwrite.
   *
   * No debe usarse para modificar stock. Solo para registrar el log.
   */
  async function _registrarMovimiento(datosMovimiento) {
    const movimiento = module._normalizarMovimiento({
      ...datosMovimiento,
      id: datosMovimiento.id || `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      fecha: datosMovimiento.fecha || new Date().toISOString()
    });

    module.movimientos.push(movimiento);

    // 1. Despachar al Store primero (regla §5.11).
    Store.despachar({ type: 'MOVIMIENTO_REGISTRADO', payload: movimiento });

    // 2. Persistir en Appwrite. Fallback local si falla o si no
    //    hay espacioId resoluble.
    if (!movimiento.espacioId) {
      // v1.3.1: sin espacioId no se persiste en Appwrite.
      movimiento._pendiente_sync = true;
      Logger.warn(
        '[DBInventario] Movimiento sin espacioId resoluble. ' +
        'Se registra solo en memoria, no se persiste en Appwrite. ' +
        'Insumo: ' + movimiento.insumoId +
        ' · Motivo: ' + (movimiento.motivo || '(sin motivo)')
      );
    } else if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        const creado = await DBAppwrite.crear('movimientos', movimiento.id, {
          insumoId: movimiento.insumoId,
          insumoNombre: movimiento.insumoNombre,
          tipo: movimiento.tipo,
          cantidad: movimiento.cantidad,
          unidad: movimiento.unidad || '',
          motivo: movimiento.motivo || '',
          referencia: movimiento.referencia || '',
          usuario: movimiento.usuario || '',
          usuarioId: movimiento.usuarioId || '',
          fecha: movimiento.fecha,
          espacioId: movimiento.espacioId
        });
        if (!creado) {
          movimiento._pendiente_sync = true;
          Logger.warn('[DBInventario] Movimiento no persistido en Appwrite, quedará local:', movimiento.id);
        }
      } catch (e) {
        movimiento._pendiente_sync = true;
        Logger.warn('[DBInventario] Error al persistir movimiento en Appwrite:', e);
      }
    } else {
      movimiento._pendiente_sync = true;
    }

    module.saveMovimientos();
    EventBus.emit('movimientos:actualizados', movimiento);

    return movimiento;
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
    datos.vendible = _validarBooleano(i.vendible, false);
    datos.precio_venta = _validarNumero(i.precio_venta, 0);
    datos.destino = ['cocina', 'barra', 'ambos'].includes(i.destino) ? i.destino : 'cocina';
    return datos;
  };

  module._normalizarReceta = function(r) {
    const datos = Object.assign({}, r);
    datos.id = _validarId(r.id, 'rec');
    datos.productoId = r.productoId || null;
    datos.ingredientes = _normalizarIngredientes(r.ingredientes).map(ing => ({
      tipo: ['insumo', 'subreceta'].includes(ing.tipo) ? ing.tipo : 'insumo',
      id: _validarId(ing.id, ing.tipo === 'subreceta' ? 'rec' : 'ins'),
      cantidad: _validarNumero(ing.cantidad, 0)
    }));
    datos.instrucciones = _validarString(r.instrucciones, '');
    datos.esIntermedio = _validarBooleano(r.es_intermedio || r.esIntermedio, false);
    return datos;
  };

  module._normalizarOpcion = function(op) {
    if (!op || typeof op !== 'object') return null;
    return {
      id: _validarString(op.id, ''),
      nombre: _validarString(op.nombre, 'Sin nombre'),
      descripcion: _validarString(op.descripcion, ''),
      precio_delta: _validarNumero(op.precio_delta, 0),
      activo: _validarBooleano(op.activo, true),
      alergenos: _parsearArray(op.alergenos),
      requiere: _parsearArray(op.requiere),
      excluye: _parsearArray(op.excluye),
      insumos_delta: _parsearArray(op.insumos_delta),
      pasos_delta: _parsearArray(op.pasos_delta)
    };
  };

  module._normalizarVariante = function(v) {
    const datos = Object.assign({}, v);
    datos.id = _validarId(v.id, 'var_');
    datos.nombre = _validarString(v.nombre, 'Sin nombre');
    datos.descripcion = _validarString(v.descripcion, '');
    datos.tipo = ['unica', 'multiple'].includes(v.tipo) ? v.tipo : 'unica';
    datos.requerido = _validarBooleano(v.requerido, false);
    datos.min_seleccion = _validarNumero(v.min_seleccion, 0);
    datos.max_seleccion = _validarNumero(v.max_seleccion, 1);

    const opcionesRaw = _parsearArray(v.opciones);
    datos.opciones = opcionesRaw
      .map(op => module._normalizarOpcion(op))
      .filter(op => op !== null);

    datos.espacioId = _validarString(v.espacioId, '');
    datos.activo = _validarBooleano(v.activo, true);
    datos.orden = _validarNumero(v.orden, 0);
    return datos;
  };

  /**
   * A.74: normalizador extendido con los campos nuevos.
   */
  module._normalizarMovimiento = function(mov) {
    return {
      id: _validarId(mov.id, 'mov'),
      insumoId: _validarId(mov.insumoId || mov.ingredienteId, 'ins'),
      insumoNombre: _validarString(mov.insumoNombre, ''),
      tipo: ['entrada', 'salida', 'ajuste'].includes(mov.tipo) ? mov.tipo : 'ajuste',
      cantidad: _validarNumero(mov.cantidad, 0),
      unidad: _validarString(mov.unidad, ''),
      motivo: _validarString(mov.motivo, ''),
      referencia: _validarString(mov.referencia, ''),
      usuario: _validarString(mov.usuario, 'sistema'),
      usuarioId: _validarString(mov.usuarioId, ''),
      fecha: mov.fecha || new Date().toISOString(),
      espacioId: _validarString(mov.espacioId, '')
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

  module._cargarVariantesLocal = function() {
    const raw = localStorage.getItem('pubpos_variantes');
    if (raw) {
      try {
        const varParseadas = JSON.parse(raw);
        this.variantes = varParseadas.map(v => this._normalizarVariante(v));
      } catch (e) {
        Logger.error('[DBInventario] Error al parsear variantes locales:', e);
        this.variantes = [];
      }
    } else {
      this.variantes = [];
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
    EventBus.emit('recetas:actualizadas', this.recetas);
  };
  module.saveVariantes = function() {
    localStorage.setItem('pubpos_variantes', JSON.stringify(this.variantes));
  };
  module.saveMovimientos = function() {
    localStorage.setItem('pubpos_movimientos', JSON.stringify(this.movimientos));
  };
  module.saveEntradas = function() {
    localStorage.setItem('pubpos_entradas', JSON.stringify(this.entradas));
  };

  /* ── MÉTODOS DE COSTO ─────────────────────────────────── */
  module.obtenerCostoUnitario = async function(insumoId) {
    const insumo = (module.insumos || []).find(i => i.id === insumoId);
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

  /* ── RELACIÓN RECETA-PRODUCTO ─────────────────────────── */
  module.obtenerRecetaConProducto = function(recetaId) {
    const { recetas } = _obtenerContexto();
    const receta = recetas.find(r => r.id === recetaId);
    if (!receta) return null;
    try {
      const state = Store.obtenerEstado();
      const producto = (state.productos || []).find(p => p.id === receta.productoId);
      return { ...receta, nombre: producto ? producto.nombre : 'Sin producto' };
    } catch (e) {
      Logger.warn('[DBInventario] No se pudo obtener productos desde Store:', e);
      return { ...receta, nombre: 'Sin producto' };
    }
  };

  /* ── CONSUMO ──────────────────────────────────────────── */

  module.getInsumosDeProducto = function(productoId, cantidad = 1, recetasOpt, insumosOpt) {
    const ctx = _obtenerContexto();
    const recetas = recetasOpt || ctx.recetas;
    const insumos = insumosOpt || ctx.insumos;
    const receta = recetas.find(r => r.productoId === productoId);
    if (!receta) return [];
    return _resolverInsumos(receta.id, cantidad, recetas, insumos);
  };

  /**
   * A.74: consume insumos de un producto o insumo vendible.
   * Genera un movimiento por cada insumo descontado y despacha
   * INSUMO_GUARDADO al Store para que el stock en el slice de
   * insumos quede sincronizado (fix hallazgo 5.2).
   */
  module.consumirInsumosDeProducto = async function(itemOPproductoId, cantidad, motivo = 'Consumo') {
    let tipo = 'producto';
    let id = null;
    let qty = cantidad;
    let opciones = [];

    if (typeof itemOPproductoId === 'string') {
      id = itemOPproductoId;
    } else if (itemOPproductoId && typeof itemOPproductoId === 'object') {
      tipo = itemOPproductoId.tipo || 'producto';
      id = itemOPproductoId.id || itemOPproductoId.prodId || null;
      qty = itemOPproductoId.qty || itemOPproductoId.cantidad || cantidad;
      opciones = Array.isArray(itemOPproductoId.opciones) ? itemOPproductoId.opciones : [];
    }

    if (!id) return { ok: true, exitosos: [], fallidos: [], cambios: [] };

    const ctx = _obtenerContexto();
    const insumos = ctx.insumos;

    let insumosNecesarios = [];

    if (tipo === 'insumo') {
      const insumo = insumos.find(i => i.id === id);
      if (!insumo) {
        Logger.warn(`[DBInventario] Insumo ${id} no encontrado para descuento.`);
        return { ok: false, exitosos: [], fallidos: [], cambios: [], error: 'Insumo no encontrado' };
      }
      insumosNecesarios = [{
        insumoId: id,
        nombre: insumo.nombre,
        cantidadNecesaria: Number(qty) || 1,
        unidad: insumo.unidad
      }];
    } else {
      insumosNecesarios = module.getInsumosDeProducto(id, qty, ctx.recetas, insumos);

      if (opciones.length > 0) {
        insumosNecesarios = _aplicarDeltas(insumosNecesarios, opciones);
      }

      if (!insumosNecesarios || insumosNecesarios.length === 0) {
        return { ok: true, exitosos: [], fallidos: [], cambios: [] };
      }
    }

    const exitosos = [];
    const fallidos = [];
    const espacioId = _obtenerEspacioId();
    const usuario = (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema';

    let usuarioId = null;
    try {
      if (Auth && typeof Auth.obtenerIdUsuarioAppwrite === 'function') {
        usuarioId = await Auth.obtenerIdUsuarioAppwrite();
      }
    } catch (e) {
      // Sin usuarioId, queda vacío
    }

    for (const necesario of insumosNecesarios) {
      const insumo = insumos.find(i => i.id === necesario.insumoId);
      if (!insumo) {
        Logger.warn(`[DBInventario] Insumo ${necesario.insumoId} no encontrado, se omite.`);
        fallidos.push({
          insumoId: necesario.insumoId,
          cantidad: necesario.cantidadNecesaria,
          error: 'Insumo no encontrado en catálogo'
        });
        continue;
      }

      const cantidadADescontar = necesario.cantidadNecesaria;

      try {
        if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
          const resultado = await DBAppwrite.decrementarCampo(
            'insumos',
            insumo.id,
            'stock',
            cantidadADescontar,
            0
          );
          if (resultado && typeof resultado.stock === 'number') {
            insumo.stock = resultado.stock;
          } else {
            insumo.stock = Math.max(0, insumo.stock - cantidadADescontar);
          }
        } else {
          insumo.stock = Math.max(0, insumo.stock - cantidadADescontar);
        }

        // A.74 (fix 5.2): despachar INSUMO_GUARDADO al Store para
        // sincronizar el slice de insumos.
        Store.despachar({ type: 'INSUMO_GUARDADO', payload: { ...insumo } });

        exitosos.push({
          insumoId: insumo.id,
          cantidad: cantidadADescontar
        });

        // A.74: registrar el movimiento con los campos nuevos.
        await _registrarMovimiento({
          insumoId: insumo.id,
          insumoNombre: insumo.nombre,
          unidad: insumo.unidad,
          tipo: 'salida',
          cantidad: -cantidadADescontar,
          motivo: motivo,
          referencia: null,
          usuario: usuario,
          usuarioId: usuarioId || '',
          espacioId: espacioId
        });

        if (insumo.stock <= insumo.stock_minimo) {
          EventBus.emit('inventario:stock_bajo', {
            insumo: insumo.nombre,
            stock: insumo.stock,
            unidad: insumo.unidad
          });
        }
      } catch (e) {
        Logger.error(
          '[DBInventario] Fallo al descontar stock' +
          ' · insumo: ' + insumo.id +
          ' · cantidad: ' + cantidadADescontar +
          ' · error: ' + e.message
        );
        fallidos.push({
          insumoId: insumo.id,
          cantidad: cantidadADescontar,
          error: e.message
        });
      }
    }

    module.saveInsumos();
    EventBus.emit('inventario:actualizado');

    return {
      ok: true,
      exitosos: exitosos,
      fallidos: fallidos,
      cambios: exitosos
    };
  };

  /**
   * A.74: operación canónica de ajuste manual de stock.
   * Calcula el delta efectivo, persiste en Appwrite antes de
   * modificar la memoria, despacha al Store, registra el
   * movimiento y emite eventos.
   *
   * v1.3.2: la búsqueda del insumo usa _obtenerInsumosActuales()
   * en lugar de module.insumos. El cambio corrige el bug del test
   * 6.18: tras DB.init(), db.js reasigna su array this.insumos
   * pero no toca module.insumos, y ajustarStock fallaba con
   * "Insumo no encontrado" sobre insumos que sí existían.
   *
   * @param {string} insumoId
   * @param {number} cantidadDelta - Delta solicitado (puede ser negativo).
   * @param {string} motivo
   * @returns {Promise<{exito: boolean, datos?: object, movimiento?: object, sinCambio?: boolean, error?: string}>}
   */
  module.ajustarStock = async function(insumoId, cantidadDelta, motivo = 'Ajuste manual') {
    const insumosActuales = _obtenerInsumosActuales();
    const insumo = insumosActuales.find(i => i.id === insumoId);

    if (!insumo) {
      Logger.warn(`[DBInventario] ajustarStock: insumo ${insumoId} no encontrado.`);
      return { exito: false, error: 'Insumo no encontrado' };
    }

    const deltaSolicitado = Number(cantidadDelta) || 0;

    // A.74 (mejora 2): salida temprana si delta === 0.
    if (deltaSolicitado === 0) {
      return { exito: true, datos: insumo, sinCambio: true };
    }

    const stockAnterior = Number(insumo.stock) || 0;
    const stockCalculado = Math.max(0, stockAnterior + deltaSolicitado);

    // A.74 (mejora 1): delta efectivo = lo que realmente cambia.
    const deltaEfectivo = stockCalculado - stockAnterior;

    if (deltaEfectivo === 0) {
      // El recorte a 0 dejó el stock igual. No hay cambio real.
      return { exito: true, datos: insumo, sinCambio: true };
    }

    // A.74 (mejora 3): persistir en Appwrite ANTES de modificar memoria.
    let persistido = false;
    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        const resultado = await DBAppwrite.actualizar('insumos', insumoId, { stock: stockCalculado });
        persistido = !!resultado;
      } catch (e) {
        Logger.error('[DBInventario] ajustarStock: error al persistir en Appwrite:', e);
        persistido = false;
      }
    } else {
      // Sin Appwrite, se considera persistido localmente.
      persistido = true;
    }

    if (!persistido) {
      Logger.error('[DBInventario] ajustarStock: no se pudo persistir el ajuste. Memoria intacta.');
      return { exito: false, error: 'No se pudo persistir el ajuste en Appwrite' };
    }

    // Ahora sí, modificar memoria.
    insumo.stock = stockCalculado;

    // Despachar al Store para sincronizar el slice de insumos.
    Store.despachar({ type: 'INSUMO_GUARDADO', payload: { ...insumo } });

    const espacioId = _obtenerEspacioId();
    const usuario = (Auth && Auth.obtenerNombre) ? Auth.obtenerNombre() : 'sistema';

    let usuarioId = null;
    try {
      if (Auth && typeof Auth.obtenerIdUsuarioAppwrite === 'function') {
        usuarioId = await Auth.obtenerIdUsuarioAppwrite();
      }
    } catch (e) {
      // Sin usuarioId
    }

    const movimiento = await _registrarMovimiento({
      insumoId: insumo.id,
      insumoNombre: insumo.nombre,
      unidad: insumo.unidad,
      tipo: deltaEfectivo >= 0 ? 'entrada' : 'salida',
      cantidad: deltaEfectivo,
      motivo: motivo,
      referencia: null,
      usuario: usuario,
      usuarioId: usuarioId || '',
      espacioId: espacioId
    });

    module.saveInsumos();
    EventBus.emit('inventario:actualizado');

    if (insumo.stock <= insumo.stock_minimo) {
      EventBus.emit('inventario:stock_bajo', {
        insumo: insumo.nombre,
        stock: insumo.stock,
        unidad: insumo.unidad
      });
    }

    return { exito: true, datos: insumo, movimiento };
  };

  /**
   * A.74: consulta paginada de movimientos.
   * Fase 1 lee desde Appwrite si está disponible; fallback local.
   * Fase 2 usa cursor.
   *
   * @param {object} filtros
   *   { insumoId, tipo, desde, hasta, limite, cursorDespues }
   * @returns {Promise<{movimientos: Array, hayMas: boolean, cursor: string|null}>}
   */
  module.obtenerMovimientos = async function(filtros = {}) {
    const {
      insumoId, tipo, desde, hasta,
      limite = 100, cursorDespues = null
    } = filtros;

    if (DBAppwrite && DBAppwrite.habilitado) {
      try {
        const filtrosQuery = [];
        if (insumoId) filtrosQuery.push(Appwrite.Query.equal('insumoId', insumoId));
        if (tipo) filtrosQuery.push(Appwrite.Query.equal('tipo', tipo));
        if (desde) filtrosQuery.push(Appwrite.Query.greaterThanEqual('fecha', desde));
        if (hasta) filtrosQuery.push(Appwrite.Query.lessThanEqual('fecha', hasta));

        const lista = await DBAppwrite.listar('movimientos', {
          filtros: filtrosQuery,
          orden: [Appwrite.Query.orderDesc('fecha')],
          limite: Math.min(limite, 100),
          cursorDespues: cursorDespues
        });

        const hayMas = lista.length === Math.min(limite, 100);
        const nuevoCursor = hayMas && lista.length > 0 ? lista[lista.length - 1].id : null;

        return {
          movimientos: lista,
          hayMas,
          cursor: nuevoCursor
        };
      } catch (e) {
        Logger.warn('[DBInventario] Error al consultar movimientos de Appwrite, usando local:', e);
      }
    }

    // Fallback local con filtros aplicados en memoria.
    let movs = module.movimientos || [];
    if (insumoId) movs = movs.filter(m => m.insumoId === insumoId);
    if (tipo) movs = movs.filter(m => m.tipo === tipo);
    if (desde) movs = movs.filter(m => new Date(m.fecha) >= new Date(desde));
    if (hasta) movs = movs.filter(m => new Date(m.fecha) <= new Date(hasta));

    movs = movs
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, limite);

    return { movimientos: movs, hayMas: false, cursor: null };
  };

  return module;
})();