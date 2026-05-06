/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1.4 – inyección completa DDD)
   ================================================================ */
const Bootstrap = (() => {

  async function arrancar() {
    console.log('[Bootstrap] Iniciando aplicación...');
    _instalarManejadorErrores();

    // ── 1. Autenticación (crítica) ─────────────────────────
    try {
      Auth.init();
      console.log('[Bootstrap] Auth listo.');
    } catch (e) {
      console.error('[Bootstrap] Error en Auth:', e);
      showToast('error', 'Error crítico al iniciar autenticación');
      return;
    }

    // ── 2. Base de datos (crítica) ─────────────────────────
    try {
      await DB.init();
      console.log('[Bootstrap] DB lista.');
    } catch (e) {
      console.error('[Bootstrap] Error en DB:', e);
      showToast('error', 'Error crítico al cargar los datos');
      return;
    }

    // ── 3. Configuración (no crítica) ──────────────────────
    try {
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
    } catch (e) {
      console.warn('[Bootstrap] Config no disponible:', e);
    }

    // ── 4. Inyección de dependencias (REPOSITORIOS) ────────
    // Repositorio de Pedidos (mesa)
    let pedidoRepo;
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      pedidoRepo = PedidoRepositoryLocal;
      console.log('[Bootstrap] Usando PedidoRepositoryLocal.');
    } else {
      console.warn('[Bootstrap] PedidoRepositoryLocal no encontrado.');
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

    // ── 5. Configurar Servicios de Dominio ─────────────────
    if (typeof PedidoService !== 'undefined' && pedidoRepo) {
      PedidoService.configurar(pedidoRepo);
      console.log('[Bootstrap] PedidoService configurado.');
    }
    if (typeof DeliveryService !== 'undefined') {
      DeliveryService.configurar(deliveryRepo);
      console.log('[Bootstrap] DeliveryService configurado.');
    }

    // ── 6. Iniciar PedidoManager ──────────────────────────
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo });
        console.log(`[Bootstrap] PedidoManager activo. Turno: ${turno?.id}`);
      }
    } catch (e) {
      console.error('[Bootstrap] Error al iniciar PedidoManager:', e);
    }

    // ── 7. TurnoManager ───────────────────────────────────
    if (typeof TurnoManager === 'undefined') {
      console.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // ── 8. Inicializar UI ─────────────────────────────────
    if (typeof App !== 'undefined' && App.init) {
      App.init();
      console.log('[Bootstrap] UI iniciada.');
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
      console.error('[Bootstrap] Error al mostrar vista inicial:', e);
    }

    console.log('[Bootstrap] Aplicación lista.');
  }

  function _instalarManejadorErrores() {
    window.addEventListener('error', (event) => {
      const mensaje = event.message || 'Error inesperado';
      console.error('[Global Error]', mensaje, event);
      showToast('error', `<i class="fas fa-bug"></i> ${mensaje}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const mensaje = (event.reason && event.reason.message) || 'Error en operación asíncrona';
      console.error('[Unhandled Rejection]', mensaje, event.reason);
      showToast('error', `<i class="fas fa-exclamation-triangle"></i> ${mensaje}`);
    });
  }

  return { arrancar };
})();

document.addEventListener('DOMContentLoaded', () => {
  Bootstrap.arrancar();
});