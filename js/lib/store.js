/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/store.js
   Versión: 2.0.8
   Propósito: Estado centralizado con slices 'cliente', 'menus',
              'precargas_cliente' y 'usuario'. Métodos en español.
              v2.0.8: Agrega slice 'usuario' y reducer para sesión.
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
    ingredientes: [],
    recetas: [],
    mozos: [],
    config: {},
    espacios: [],
    espacioActivo: null,
    menus: [],
    precargas_cliente: [],
    usuario: null,   // ← nuevo slice
    cliente: { permitePrepedidos: false, mesa: null }
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

  function rootReducer(currentState, action) {
    const newState = { ...currentState };

    newState.mesas              = mesasReducer(newState.mesas, action, newState);
    newState.pedidos            = pedidosReducer(newState.pedidos, action, newState);
    newState.pedidosDelivery    = deliveryReducer(newState.pedidosDelivery, action, newState);
    newState.comandas           = comandasReducer(newState.comandas, action, newState);
    newState.productos          = productosReducer(newState.productos, action, newState);
    newState.ingredientes       = ingredientesReducer(newState.ingredientes, action, newState);
    newState.recetas            = recetasReducer(newState.recetas, action, newState);
    newState.mozos              = mozosReducer(newState.mozos, action, newState);
    newState.config             = configReducer(newState.config, action, newState);
    newState.espacios           = espaciosReducer(newState.espacios, action, newState);
    newState.espacioActivo      = espacioActivoReducer(newState.espacioActivo, action, newState);
    newState.menus              = menusReducer(newState.menus, action);
    newState.precargas_cliente  = precargasClienteReducer(newState.precargas_cliente, action);
    newState.usuario            = usuarioReducer(newState.usuario, action);   // ← nuevo reducer
    newState.cliente            = clienteReducer(newState.cliente, action);

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
      case 'COMANDA_ITEM_AGREGAR': {
        const { numeroMesa, item } = action.payload;
        return mesas.map(m => {
          if (String(m.numero) !== String(numeroMesa)) return m;
          const items = m.items || [];
          const nuevoItem = { ...item, qty: 1, obs: item.obs || '', enviado: false };
          return { ...m, items: [...items, nuevoItem] };
        });
      }
      case 'COMANDA_ITEM_CAMBIAR': {
        const { numeroMesa, index, cambios } = action.payload;
        return mesas.map(m => {
          if (String(m.numero) !== String(numeroMesa)) return m;
          const items = (m.items || []).map((item, i) => i === index ? { ...item, ...cambios } : item);
          return { ...m, items };
        });
      }
      case 'COMANDA_ITEM_QUITAR': {
        const { numeroMesa, index } = action.payload;
        return mesas.map(m => {
          if (String(m.numero) !== String(numeroMesa)) return m;
          const items = (m.items || []).filter((_, i) => i !== index);
          return { ...m, items };
        });
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

  function ingredientesReducer(ingredientes, action) {
    switch (action.type) {
      case 'INGREDIENTES_INICIALIZAR': return action.payload || [];
      case 'INGREDIENTE_GUARDADO':
        return [...ingredientes.filter(i => i.id !== action.payload.id), action.payload];
      default: return ingredientes;
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

  function menusReducer(menus, action) {
    switch (action.type) {
      case 'MENUS_INICIALIZAR': return action.payload || [];
      default: return menus;
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