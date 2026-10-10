/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/store.js
   Versión: 2.0.15
   Propósito: Estado centralizado con slices 'cliente', 'menus',
              'precargas_cliente', 'usuario', 'insumos', 'variantes'
              y 'movimientos'.
              v2.0.15: A.74: agrega slice 'movimientos' como log
              append-only de ajustes y consumos de stock. Contrato:
              MOVIMIENTOS_INICIALIZAR, MOVIMIENTO_REGISTRADO,
              MOVIMIENTOS_LIMPIAR.
              v2.0.14: rename slice 'menus' → 'cartas'.
              v2.0.13: slice 'variantes'. Extiende pedidosReducer
              para items con opciones y alergias_manuales.
   ================================================================ */

import { EventBus } from './eventBus.js';
import { Logger } from './logger.js';

const Store = (() => {
  let state = {
    mesas: [],
    pedidos: [],
    pedidosDelivery: [],
    comandas: [],
    productos: [],
    insumos: [],
    recetas: [],
    mozos: [],
    config: {},
    espacios: [],
    espacioActivo: null,
    cartas: [],
    precargas_cliente: [],
    usuario: null,
    cliente: { permitePrepedidos: false, mesa: null },
    variantes: [],
    movimientos: []
  };

  const listeners = [];

  function obtenerEstado() {
    return state;
  }

  function despachar(action) {
    if (!action || !action.type) {
      Logger.warn('[Store] Intento de despachar sin type:', action);
      return;
    }

    Logger.debug(`[Store] Acción: ${action.type}`, action.payload);

    const newState = rootReducer(state, action);

    if (newState === state) {
      Logger.debug('[Store] El estado no cambió, no se notifica.');
      return;
    }

    state = newState;

    listeners.forEach(fn => {
      try {
        fn(state, action);
      } catch (e) {
        Logger.error('[Store] Error en listener:', e);
      }
    });

    EventBus.emit('state:cambiado', { state, action });
  }

  function suscribir(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  /* ── HELPERS PRIVADOS ─────────────────────────── */

  function _calcularTotalItems(items) {
    return (items || []).reduce(
      (sum, it) => sum + (it.precio || 0) * (it.qty || 1), 0
    );
  }

  /**
   * Compara dos ítems para deduplicación.
   * Dos ítems son el mismo si:
   *   · Tienen el mismo prodId.
   *   · Ninguno de los dos fue enviado.
   *   · Tienen exactamente las mismas opciones seleccionadas.
   *   · Tienen exactamente las mismas alergias manuales.
   */
  function _esMismoItem(a, b) {
    if (!a || !b) return false;
    if (a.prodId !== b.prodId) return false;
    if (a.enviado || b.enviado) return false;
    if (JSON.stringify(a.opciones || []) !== JSON.stringify(b.opciones || [])) return false;
    if (JSON.stringify(a.alergias_manuales || []) !== JSON.stringify(b.alergias_manuales || [])) return false;
    return true;
  }

  function rootReducer(currentState, action) {
    const newState = { ...currentState };

    newState.mesas              = mesasReducer(newState.mesas, action, newState);
    newState.pedidos            = pedidosReducer(newState.pedidos, action, newState);
    newState.pedidosDelivery    = deliveryReducer(newState.pedidosDelivery, action, newState);
    newState.comandas           = comandasReducer(newState.comandas, action, newState);
    newState.productos          = productosReducer(newState.productos, action, newState);
    newState.insumos            = insumosReducer(newState.insumos, action, newState);
    newState.recetas            = recetasReducer(newState.recetas, action, newState);
    newState.mozos              = mozosReducer(newState.mozos, action, newState);
    newState.config             = configReducer(newState.config, action, newState);
    newState.espacios           = espaciosReducer(newState.espacios, action, newState);
    newState.espacioActivo      = espacioActivoReducer(newState.espacioActivo, action, newState);
    newState.cartas             = cartasReducer(newState.cartas, action);
    newState.precargas_cliente  = precargasClienteReducer(newState.precargas_cliente, action);
    newState.usuario            = usuarioReducer(newState.usuario, action);
    newState.cliente            = clienteReducer(newState.cliente, action);
    newState.variantes          = variantesReducer(newState.variantes, action);
    newState.movimientos        = movimientosReducer(newState.movimientos, action);

    return newState;
  }

  /* ── SUB-REDUCTORES ────────────────────────────── */

  function mesasReducer(mesas, action) {
    switch (action.type) {
      case 'MESAS_INICIALIZAR': return action.payload || [];
      case 'MESA_AGREGAR': {
        const nueva = action.payload;
        if (!nueva || !nueva.numero) return mesas;
        if (mesas.some(m => String(m.numero) === String(nueva.numero))) {
          Logger.warn('[Store] MESA_AGREGAR duplicada ignorada para mesa ' + nueva.numero);
          return mesas;
        }
        return [...mesas, nueva];
      }
      case 'MESA_CAMBIAR_ESTADO': {
        const { numero, estado } = action.payload;
        return mesas.map(m => String(m.numero) === String(numero) ? { ...m, estado } : m);
      }
      case 'MESA_ELIMINAR': return mesas.filter(m => String(m.numero) !== String(action.payload));
      case 'MESA_ACTUALIZAR': {
        const { numero, cambios } = action.payload;
        return mesas.map(m => String(m.numero) === String(numero) ? { ...m, ...cambios } : m);
      }
      default: return mesas;
    }
  }

  function pedidosReducer(pedidos, action) {
    switch (action.type) {
      case 'PEDIDOS_INICIALIZAR': return action.payload || [];
      case 'PEDIDO_CREADO': {
        const nuevo = action.payload;
        if (pedidos.some(p => p.id === nuevo.id)) return pedidos;
        return [...pedidos, nuevo];
      }
      case 'PEDIDO_ACTUALIZADO': {
        const { id, cambios } = action.payload;
        return pedidos.map(p => p.id === id ? { ...p, ...cambios } : p);
      }
      case 'PEDIDO_CERRADO': {
        const { id, total, actualizadoEn } = action.payload;
        return pedidos.map(p => p.id === id ? { ...p, estado: 'cerrada', total, actualizadoEn } : p);
      }
      case 'PEDIDO_ITEM_AGREGAR': {
        const { pedidoId, item } = action.payload;
        return pedidos.map(p => {
          if (p.id !== pedidoId) return p;
          const items = Array.isArray(p.items) ? [...p.items] : [];

          const idx = items.findIndex(it => _esMismoItem(it, item));

          if (idx >= 0) {
            items[idx] = {
              ...items[idx],
              qty: (items[idx].qty || 1) + 1
            };
          } else {
            items.push({
              ...item,
              qty: item.qty || 1,
              obs: item.obs || '',
              enviado: false,
              opciones: Array.isArray(item.opciones) ? item.opciones : [],
              alergias_manuales: Array.isArray(item.alergias_manuales) ? item.alergias_manuales : []
            });
          }

          return {
            ...p,
            items,
            total: _calcularTotalItems(items)
          };
        });
      }
      case 'PEDIDO_ITEM_CAMBIAR': {
        const { pedidoId, index, cambios } = action.payload;
        return pedidos.map(p => {
          if (p.id !== pedidoId) return p;
          const items = Array.isArray(p.items)
            ? p.items.map((it, i) => i === index ? { ...it, ...cambios } : it)
            : [];
          return { ...p, items, total: _calcularTotalItems(items) };
        });
      }
      case 'PEDIDO_ITEM_QUITAR': {
        const { pedidoId, index } = action.payload;
        return pedidos.map(p => {
          if (p.id !== pedidoId) return p;
          const items = Array.isArray(p.items)
            ? p.items.filter((_, i) => i !== index)
            : [];
          return { ...p, items, total: _calcularTotalItems(items) };
        });
      }
      default: return pedidos;
    }
  }

  function deliveryReducer(deliveries, action) {
    switch (action.type) {
      case 'PEDIDOSDELIVERY_INICIALIZAR':
      case 'DELIVERY_INICIALIZAR':
        return action.payload || [];
      case 'DELIVERY_CREADO': {
        const nuevo = action.payload;
        if (deliveries.some(d => d.id === nuevo.id)) return deliveries;
        return [...deliveries, nuevo];
      }
      case 'DELIVERY_ACTUALIZADO': {
        const { id, cambios } = action.payload;
        return deliveries.map(d => d.id === id ? { ...d, ...cambios } : d);
      }
      case 'DELIVERY_ELIMINADO': return deliveries.filter(d => d.id !== action.payload);
      default: return deliveries;
    }
  }

  function comandasReducer(comandas, action) {
    switch (action.type) {
      case 'COMANDA_AGREGADA': {
        const nueva = action.payload;
        if (comandas.some(c => c.id === nueva.id)) return comandas;
        return [...comandas, nueva];
      }
      case 'COMANDA_ACTUALIZADA': {
        const { id, cambios } = action.payload;
        return comandas.map(c => c.id === id ? { ...c, ...cambios } : c);
      }
      default: return comandas;
    }
  }

  function productosReducer(productos, action) {
    switch (action.type) {
      case 'PRODUCTOS_INICIALIZAR': return action.payload || [];
      case 'PRODUCTO_GUARDADO':
        return [...productos.filter(p => p.id !== action.payload.id), action.payload];
      default: return productos;
    }
  }

  function insumosReducer(insumos, action) {
    switch (action.type) {
      case 'INSUMOS_INICIALIZAR':
        return action.payload || [];
      case 'INSUMOS_GUARDADO':
      case 'INSUMO_GUARDADO':
        return [...insumos.filter(i => i.id !== action.payload.id), action.payload];
      default: return insumos;
    }
  }

  function recetasReducer(recetas, action) {
    switch (action.type) {
      case 'RECETAS_INICIALIZAR': return action.payload || [];
      case 'RECETA_GUARDADA':
        return [...recetas.filter(r => r.productoId !== action.payload.productoId), action.payload];
      default: return recetas;
    }
  }

  function mozosReducer(mozos, action) {
    switch (action.type) {
      case 'MOZOS_INICIALIZAR': return action.payload || [];
      case 'MOZO_GUARDADO':
        return [...mozos.filter(m => m.id !== action.payload.id), action.payload];
      default: return mozos;
    }
  }

  function configReducer(config, action) {
    switch (action.type) {
      case 'CONFIG_INICIALIZAR': return action.payload || {};
      default: return config;
    }
  }

  function espaciosReducer(espacios, action) {
    switch (action.type) {
      case 'ESPACIOS_INICIALIZAR': return action.payload || [];
      case 'ESPACIO_AGREGADO': return [...espacios, action.payload];
      default: return espacios;
    }
  }

  function espacioActivoReducer(espacioActivo, action) {
    switch (action.type) {
      case 'ESPACIO_ACTIVO_CAMBIADO': return action.payload;
      default: return espacioActivo;
    }
  }

  function cartasReducer(cartas, action) {
    switch (action.type) {
      case 'CARTAS_INICIALIZAR': return action.payload || [];
      default: return cartas;
    }
  }

  function precargasClienteReducer(precargas, action) {
    switch (action.type) {
      case 'PRECARGAS_CLIENTE_ACTUALIZAR':
        return action.payload || [];
      default:
        return precargas;
    }
  }

  function usuarioReducer(usuario, action) {
    switch (action.type) {
      case 'USUARIO_ACTUALIZAR':
        return action.payload || null;
      case 'USUARIO_LIMPIAR':
        return null;
      default:
        return usuario;
    }
  }

  function clienteReducer(cliente, action) {
    switch (action.type) {
      case 'CLIENTE_PERMISO_PREPEDIDOS':
        return { ...cliente, permitePrepedidos: action.payload };
      case 'CLIENTE_MESA_ASIGNADA':
        return { ...cliente, mesa: action.payload };
      default:
        return cliente;
    }
  }

  function variantesReducer(variantes, action) {
    switch (action.type) {
      case 'VARIANTES_INICIALIZAR':
        return action.payload || [];
      case 'VARIANTE_GUARDADA': {
        const nueva = action.payload;
        if (!nueva || !nueva.id) return variantes;
        const existe = variantes.some(v => v.id === nueva.id);
        if (existe) {
          return variantes.map(v => v.id === nueva.id ? nueva : v);
        }
        return [...variantes, nueva];
      }
      case 'VARIANTE_ELIMINADA':
        return variantes.filter(v => v.id !== action.payload);
      default:
        return variantes;
    }
  }

  /**
   * A.74: reducer del slice `movimientos`.
   * Log append-only de ajustes y consumos de stock.
   * La retención de 30 días se aplica al cargar desde Appwrite,
   * no en el reducer.
   */
  function movimientosReducer(movimientos, action) {
    switch (action.type) {
      case 'MOVIMIENTOS_INICIALIZAR': {
        const lista = Array.isArray(action.payload) ? action.payload : [];
        // Ordenar por fecha descendente (más reciente primero).
        const ordenados = lista.slice().sort((a, b) => {
          const fa = a && a.fecha ? new Date(a.fecha).getTime() : 0;
          const fb = b && b.fecha ? new Date(b.fecha).getTime() : 0;
          return fb - fa;
        });
        return ordenados;
      }
      case 'MOVIMIENTO_REGISTRADO': {
        const nuevo = action.payload;
        if (!nuevo || !nuevo.id) return movimientos;
        // Dedupe por id: si ya existe, se reemplaza.
        const idx = movimientos.findIndex(m => m.id === nuevo.id);
        if (idx >= 0) {
          const copia = movimientos.slice();
          copia[idx] = nuevo;
          return copia;
        }
        // Prepend (el más reciente va primero).
        return [nuevo, ...movimientos];
      }
      case 'MOVIMIENTOS_LIMPIAR':
        return [];
      default:
        return movimientos;
    }
  }

  return {
    obtenerEstado,
    despachar,
    suscribir,
    getState: obtenerEstado,
    dispatch: despachar,
    subscribe: suscribir
  };
})();

export { Store };