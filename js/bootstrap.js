/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1.8 – contenedor de dependencias)
   ================================================================
   Cambios:
   • Después de crear los repositorios, se registran en Deps.
   • Los servicios ya se configuran con ellos; ahora también se
     registran en Deps para que los comandos los usen fácilmente.
   • Se elimina el paso de inyectar repo al PedidoManager porque
     ya no es necesario (PedidoManager usa PedidoService directamente).
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

    // ── 3. Poblar el Store con datos iniciales ────────────
    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'MESAS_INICIALIZAR',       payload: DB.mesas || [] });
      Store.dispatch({ type: 'PEDIDOS_INICIALIZAR',     payload: DB.pedidos || [] });
      Store.dispatch({ type: 'PRODUCTOS_INICIALIZAR',   payload: DB.productos || [] });
      Store.dispatch({ type: 'INGREDIENTES_INICIALIZAR', payload: DB.ingredientes || [] });
      Store.dispatch({ type: 'RECETAS_INICIALIZAR',      payload: DB.recetas || [] });
      Store.dispatch({ type: 'MOZOS_INICIALIZAR',        payload: DB.mozos || [] });
      Store.dispatch({ type: 'CONFIG_INICIALIZAR',       payload: DB.config || {} });
      Store.dispatch({ type: 'PEDIDOSDELIVERY_INICIALIZAR', payload: DB.pedidosDelivery || [] });
      Logger.info('[Bootstrap] Store poblado con datos iniciales.');
    }

    // ── 4. Configuración ──────────────────────────────────
    try {
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
    } catch (e) {
      Logger.warn('[Bootstrap] Config no disponible:', e);
    }

    // ── 5. Inyección de dependencias (REPOSITORIOS) ──────
    // PedidoRepositoryLocal ya está definido como variable global, lo usamos.
    let pedidoRepo = typeof PedidoRepositoryLocal !== 'undefined' ? PedidoRepositoryLocal : null;

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

    // Registrar en el contenedor
    if (typeof Deps !== 'undefined') {
      if (pedidoRepo) Deps.registrar('pedidoRepo', pedidoRepo);
      Deps.registrar('deliveryRepo', deliveryRepo);
      Deps.registrar('inventarioRepo', inventarioRepo);
      Logger.info('[Bootstrap] Dependencias registradas en el contenedor.');
    }

    // ── 6. Configurar Servicios de Dominio ────────────────
    if (typeof PedidoService !== 'undefined' && pedidoRepo) {
      PedidoService.configurar(pedidoRepo);
      // También registramos el servicio en el contenedor
      if (typeof Deps !== 'undefined') Deps.registrar('pedidoService', PedidoService);
      Logger.info('[Bootstrap] PedidoService configurado y registrado.');
    }
    if (typeof DeliveryService !== 'undefined') {
      DeliveryService.configurar(deliveryRepo);
      if (typeof Deps !== 'undefined') Deps.registrar('deliveryService', DeliveryService);
      Logger.info('[Bootstrap] DeliveryService configurado.');
    }
    if (typeof InventarioService !== 'undefined') {
      InventarioService.configurar(inventarioRepo);
      if (typeof Deps !== 'undefined') Deps.registrar('inventarioService', InventarioService);
      Logger.info('[Bootstrap] InventarioService configurado.');
    }

    // ── 7. Iniciar PedidoManager (ya no necesita repo explícito) ─
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo }); // aún se lo pasamos para compatibilidad
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