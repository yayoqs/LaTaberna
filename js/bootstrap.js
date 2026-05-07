/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1.7 – integración Store)
   ================================================================
   Cambios:
   • Después de inicializar DB, cargamos los datos iniciales en el
     Store para que las vistas reactivas tengan acceso inmediato.
   • Se despachan acciones MESAS_INICIALIZAR, PEDIDOS_INICIALIZAR, etc.
   ================================================================ */
const Bootstrap = (() => {

  async function arrancar() {
    Logger.setLevel('DEBUG');
    Logger.info('[Bootstrap] Iniciando aplicación...');

    // ── 1. Autenticación ──────────────────────────────────
    try {
      Auth.init();
      Logger.info('[Bootstrap] Auth listo.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en Auth:', e);
      showToast('error', 'Error crítico al iniciar autenticación');
      return;
    }

    // ── 2. Base de datos ──────────────────────────────────
    try {
      await DB.init();
      Logger.info('[Bootstrap] DB lista.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en DB:', e);
      showToast('error', 'Error crítico al cargar los datos');
      return;
    }

    // ── 3. Poblar el Store con los datos iniciales ────────
    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'MESAS_INICIALIZAR',      payload: DB.mesas || [] });
      Store.dispatch({ type: 'PEDIDOS_INICIALIZAR',    payload: DB.pedidos || [] });
      Store.dispatch({ type: 'PRODUCTOS_INICIALIZAR',  payload: DB.productos || [] });
      Store.dispatch({ type: 'INGREDIENTES_INICIALIZAR', payload: DB.ingredientes || [] });
      Store.dispatch({ type: 'RECETAS_INICIALIZAR',    payload: DB.recetas || [] });
      Store.dispatch({ type: 'MOZOS_INICIALIZAR',       payload: DB.mozos || [] });
      Store.dispatch({ type: 'CONFIG_INICIALIZAR',      payload: DB.config || {} });
      // Delivery: se cargará cuando se obtenga de DB
      Store.dispatch({ type: 'DELIVERY_CREADO', payload: DB.pedidosDelivery || [] });
      Logger.info('[Bootstrap] Store poblado con datos iniciales.');
    }

    // ── 4. Configuración ──────────────────────────────────
    try {
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
    } catch (e) {
      Logger.warn('[Bootstrap] Config no disponible:', e);
    }

    // ── 5. Inyección de dependencias (REPOSITORIOS) ──────
    let pedidoRepo;
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      pedidoRepo = PedidoRepositoryLocal;
      Logger.info('[Bootstrap] Usando PedidoRepositoryLocal.');
    } else {
      Logger.warn('[Bootstrap] PedidoRepositoryLocal no encontrado.');
    }

    const deliveryRepo = {
      async crearDelivery(datos) {
        if (!window.DB || !DB.crearPedidoDelivery) throw new Error('DB no disponible');
        const nuevo = DB.crearPedidoDelivery(datos);
        if (!nuevo) throw new Error('No se pudo crear el delivery');
        return nuevo;
      },
      async obtenerPorId(id) {
        if (!window.DB || !DB.pedidosDelivery) return null;
        return DB.pedidosDelivery.find(p => p.id === id) || null;
      },
      async guardarDelivery(datos) {
        if (!window.DB || !DB.pedidosDelivery) throw new Error('DB no disponible');
        const idx = DB.pedidosDelivery.findIndex(p => p.id === datos.id);
        if (idx >= 0) {
          DB.pedidosDelivery[idx] = { ...DB.pedidosDelivery[idx], ...datos };
        }
        DB.savePedidosDelivery();
      }
    };

    const inventarioRepo = {
      async guardarIngrediente(datos) {
        if (!window.DB || typeof DB.syncGuardarIngrediente !== 'function') {
          throw new Error('DB.syncGuardarIngrediente no disponible');
        }
        await DB.syncGuardarIngrediente(datos);
        return datos;
      },
      async obtenerPorId(id) {
        if (!window.DB || !DB.ingredientes) return null;
        return DB.ingredientes.find(i => i.id == id) || null;
      },
      async registrarMovimiento(movimiento) {
        if (typeof DB.ajustarStock === 'function') {
          DB.ajustarStock(movimiento.ingredienteId, movimiento.cantidad, movimiento.motivo);
        }
      }
    };

    // ── 6. Configurar Servicios de Dominio ────────────────
    if (typeof PedidoService !== 'undefined' && pedidoRepo) {
      PedidoService.configurar(pedidoRepo);
      Logger.info('[Bootstrap] PedidoService configurado.');
    }
    if (typeof DeliveryService !== 'undefined') {
      DeliveryService.configurar(deliveryRepo);
      Logger.info('[Bootstrap] DeliveryService configurado.');
    }
    if (typeof InventarioService !== 'undefined') {
      InventarioService.configurar(inventarioRepo);
      Logger.info('[Bootstrap] InventarioService configurado.');
    }

    // ── 7. Iniciar PedidoManager ──────────────────────────
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo });
        Logger.info(`[Bootstrap] PedidoManager activo. Turno: ${turno?.id}`);
      }
    } catch (e) {
      Logger.error('[Bootstrap] Error al iniciar PedidoManager:', e);
    }

    // ── 8. TurnoManager ───────────────────────────────────
    if (typeof TurnoManager === 'undefined') {
      Logger.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // ── 9. Inicializar UI ─────────────────────────────────
    if (typeof App !== 'undefined' && App.init) {
      App.init();
      Logger.info('[Bootstrap] UI iniciada.');
    }

    // ── 10. Mostrar vista inicial ─────────────────────────
    try {
      if (Auth.getRol()) {
        const vistaDefecto = Auth.getDefaultView();
        if (typeof App !== 'undefined' && App.showView) {
          App.showView(vistaDefecto);
        }
      }
    } catch (e) {
      Logger.error('[Bootstrap] Error al mostrar vista inicial:', e);
    }

    Logger.info('[Bootstrap] Aplicación lista.');
  }

  return { arrancar };
})();

document.addEventListener('DOMContentLoaded', () => {
  Bootstrap.arrancar();
});