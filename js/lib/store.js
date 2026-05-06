/* ================================================================
   PubPOS — MÓDULO: store.js (Store centralizado)
   Propósito: Reemplazar los accesos directos a DB.mesas, DB.pedidos,
              DB.comandas, etc., por un flujo de estado unidireccional.
              Cada cambio de estado se hace mediante acciones (objetos
              planos) y reductores puros, avisando a los suscriptores
              para que las vistas se actualicen automáticamente.
   ================================================================ */

const Store = (() => {
  // Estado inicial (se llenará cuando arranque la app)
  let state = {
    mesas: [],
    pedidos: [],
    pedidosDelivery: [],
    comandas: [],
    productos: [],
    ingredientes: [],
    recetas: [],
    mozos: [],
    config: {}
  };

  // Lista de funciones suscriptor (se llaman tras cada cambio)
  const listeners = [];

  /**
   * Devuelve una copia inmutable del estado actual.
   * Los módulos solo deben leer de aquí, nunca modificar directamente.
   */
  function getState() {
    return state;
  }

  /**
   * Despacha una acción que modifica el estado.
   * @param {object} action - Debe tener al menos { type: string, payload?: any }
   */
  function dispatch(action) {
    if (!action || !action.type) {
      Logger.warn('[Store] Intento de dispatch sin type:', action);
      return;
    }

    Logger.debug(`[Store] Acción: ${action.type}`, action.payload);

    // 1. Calculamos el nuevo estado usando el reductor raíz
    const newState = rootReducer(state, action);

    // 2. Si no hubo cambio, evitamos notificar para no causar renders innecesarios
    if (newState === state) {
      Logger.debug('[Store] El estado no cambió, no se notifica.');
      return;
    }

    // 3. Reemplazamos el estado
    state = newState;

    // 4. Notificamos a todos los suscriptores (ej. funciones render)
    listeners.forEach(fn => {
      try {
        fn(state, action);
      } catch (e) {
        Logger.error('[Store] Error en listener:', e);
      }
    });

    // 5. Emitimos evento global para módulos que usen EventBus
    EventBus.emit('state:cambiado', { state, action });
  }

  /**
   * Suscribe una función que se ejecutará después de cada dispatch.
   * @param {function} fn - Recibe (newState, action)
   * @returns {function} Función para cancelar la suscripción.
   */
  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  /* ── REDUCTOR RAÍZ ──────────────────────────────────────── */
  function rootReducer(currentState, action) {
    const newState = { ...currentState };

    newState.mesas           = mesasReducer(newState.mesas, action, newState);
    newState.pedidos         = pedidosReducer(newState.pedidos, action, newState);
    newState.pedidosDelivery = deliveryReducer(newState.pedidosDelivery, action, newState);
    newState.comandas        = comandasReducer(newState.comandas, action, newState);
    newState.productos       = productosReducer(newState.productos, action, newState);
    newState.ingredientes    = ingredientesReducer(newState.ingredientes, action, newState);
    newState.recetas         = recetasReducer(newState.recetas, action, newState);
    newState.mozos           = mozosReducer(newState.mozos, action, newState);
    newState.config          = configReducer(newState.config, action, newState);

    return newState;
  }

  /* ── SUB-REDUCTORES ──────────────────────────────────────── */

  function mesasReducer(mesas, action) {
    switch (action.type) {
      case 'MESAS_INICIALIZAR':
        return action.payload || [];
      case 'MESA_CAMBIAR_ESTADO': {
        const { numero, estado } = action.payload;
        return mesas.map(m => m.numero === numero ? { ...m, estado } : m);
      }
      case 'MESA_AGREGAR':
        return [...mesas, action.payload];
      case 'MESA_ELIMINAR':
        return mesas.filter(m => m.numero !== action.payload);
      default:
        return mesas;
    }
  }

  function pedidosReducer(pedidos, action) {
    switch (action.type) {
      case 'PEDIDOS_INICIALIZAR':
        return action.payload || [];
      case 'PEDIDO_CREADO':
        return [...pedidos, action.payload];
      case 'PEDIDO_ACTUALIZADO': {
        const { id, cambios } = action.payload;
        return pedidos.map(p => p.id === id ? { ...p, ...cambios } : p);
      }
      case 'PEDIDO_CERRADO': {
        const { id, total, updated_at } = action.payload;
        return pedidos.map(p => p.id === id ? { ...p, estado: 'cerrada', total, updated_at } : p);
      }
      default:
        return pedidos;
    }
  }

  function deliveryReducer(deliveries, action) {
    switch (action.type) {
      case 'DELIVERY_CREADO':
        return [...deliveries, action.payload];
      case 'DELIVERY_ACTUALIZADO': {
        const { id, cambios } = action.payload;
        return deliveries.map(d => d.id === id ? { ...d, ...cambios } : d);
      }
      case 'DELIVERY_ELIMINADO':
        return deliveries.filter(d => d.id !== action.payload);
      default:
        return deliveries;
    }
  }

  function comandasReducer(comandas, action) {
    switch (action.type) {
      case 'COMANDA_AGREGADA':
        return [...comandas, action.payload];
      case 'COMANDA_ACTUALIZADA': {
        const { id, cambios } = action.payload;
        return comandas.map(c => c.id === id ? { ...c, ...cambios } : c);
      }
      default:
        return comandas;
    }
  }

  function productosReducer(productos, action) {
    switch (action.type) {
      case 'PRODUCTOS_INICIALIZAR':
        return action.payload || [];
      case 'PRODUCTO_GUARDADO':
        return [...productos.filter(p => p.id !== action.payload.id), action.payload];
      default:
        return productos;
    }
  }

  function ingredientesReducer(ingredientes, action) {
    switch (action.type) {
      case 'INGREDIENTES_INICIALIZAR':
        return action.payload || [];
      case 'INGREDIENTE_GUARDADO':
        return [...ingredientes.filter(i => i.id !== action.payload.id), action.payload];
      default:
        return ingredientes;
    }
  }

  function recetasReducer(recetas, action) {
    switch (action.type) {
      case 'RECETAS_INICIALIZAR':
        return action.payload || [];
      case 'RECETA_GUARDADA':
        return [...recetas.filter(r => r.productoId !== action.payload.productoId), action.payload];
      default:
        return recetas;
    }
  }

  function mozosReducer(mozos, action) {
    switch (action.type) {
      case 'MOZOS_INICIALIZAR':
        return action.payload || [];
      case 'MOZO_GUARDADO':
        return [...mozos.filter(m => m.id !== action.payload.id), action.payload];
      default:
        return mozos;
    }
  }

  function configReducer(config, action) {
    switch (action.type) {
      case 'CONFIG_INICIALIZAR':
        return action.payload || {};
      default:
        return config;
    }
  }

  return {
    getState,
    dispatch,
    subscribe
  };
})();

window.Store = Store;