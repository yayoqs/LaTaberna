/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1.6 – Logger integrado)
   ================================================================
   Cambios:
   • Eliminado _instalarManejadorErrores() porque ErrorHandler ya
     se encarga desde logger.js.
   • Reemplazados todos los console.log/error/warn por Logger.info,
     Logger.error, etc., para aprovechar el sistema centralizado.
   • Agregado Logger.setLevel('DEBUG') explícito para desarrollo.
   ================================================================ */
const Bootstrap = (() => {

  async function arrancar() {
    // Configurar Logger (en producción se puede cambiar a 'WARN')
    Logger.setLevel('DEBUG');
    Logger.info('[Bootstrap] Iniciando aplicación...');

    // ── 1. Autenticación (crítica) ─────────────────────────
    try {
      Auth.init();
      Logger.info('[Bootstrap] Auth listo.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en Auth:', e);
      showToast('error', 'Error crítico al iniciar autenticación');
      return;
    }

    // ── 2. Base de datos (crítica) ─────────────────────────
    try {
      await DB.init();
      Logger.info('[Bootstrap] DB lista.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en DB:', e);
      showToast('error', 'Error crítico al cargar los datos');
      return;
    }

    // ── 3. Configuración (no crítica) ──────────────────────
    try {
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
    } catch (e) {
      Logger.warn('[Bootstrap] Config no disponible:', e);
    }

    // ── 4. Inyección de dependencias (REPOSITORIOS) ────────
    let pedidoRepo;
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      pedidoRepo = PedidoRepositoryLocal;
      Logger.info('[Bootstrap] Usando PedidoRepositoryLocal.');
    } else {
      Logger.warn('[Bootstrap] PedidoRepositoryLocal no encontrado.');
    }

    // Repositorio de Delivery (adaptador simple sobre DB)
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

    // Repositorio de Inventario (adaptador sobre DB)
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

    // ── 5. Configurar Servicios de Dominio ─────────────────
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

    // ── 6. Iniciar PedidoManager ──────────────────────────
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo });
        Logger.info(`[Bootstrap] PedidoManager activo. Turno: ${turno?.id}`);
      }
    } catch (e) {
      Logger.error('[Bootstrap] Error al iniciar PedidoManager:', e);
    }

    // ── 7. TurnoManager ───────────────────────────────────
    if (typeof TurnoManager === 'undefined') {
      Logger.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // ── 8. Inicializar UI ─────────────────────────────────
    if (typeof App !== 'undefined' && App.init) {
      App.init();
      Logger.info('[Bootstrap] UI iniciada.');
    }

    // ── 9. Mostrar vista inicial ──────────────────────────
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