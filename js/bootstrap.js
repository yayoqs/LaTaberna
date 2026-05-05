/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1.2 – captura de errores global)
   Propósito: Inicializar la aplicación con inyección de dependencias
              y un listener global que muestra cualquier error no
              controlado como toast para el usuario.
   ================================================================ */
const Bootstrap = (() => {

  async function arrancar() {
    console.log('[Bootstrap] Iniciando aplicación...');

    // ── CAPTURA GLOBAL DE ERRORES (NUEVO) ──────────────────
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
    let pedidoRepo;
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      pedidoRepo = PedidoRepositoryLocal;
      console.log('[Bootstrap] Usando PedidoRepositoryLocal.');
    } else {
      console.warn('[Bootstrap] PedidoRepositoryLocal no encontrado.');
    }

    // ── 5. Configurar Servicios de Dominio (DDD) ────────────
    if (typeof PedidoService !== 'undefined' && pedidoRepo) {
      PedidoService.configurar(pedidoRepo);
      console.log('[Bootstrap] PedidoService configurado.');
    } else {
      console.warn('[Bootstrap] Servicio de pedidos no disponible.');
    }

    // ── 6. Iniciar PedidoManager ────────────────────────────
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo });
        console.log(`[Bootstrap] PedidoManager activo. Turno: ${turno?.id}`);
      } else {
        console.warn('[Bootstrap] PedidoManager no encontrado.');
      }
    } catch (e) {
      console.error('[Bootstrap] Error al iniciar PedidoManager:', e);
    }

    // ── 7. TurnoManager ─────────────────────────────────────
    if (typeof TurnoManager === 'undefined') {
      console.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // ── 8. Inicializar UI ───────────────────────────────────
    if (typeof App !== 'undefined' && App.init) {
      App.init();
      console.log('[Bootstrap] UI iniciada.');
    }

    // ── 9. Mostrar vista inicial ────────────────────────────
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

  /**
   * Instala manejadores globales para capturar errores no controlados
   * y promesas rechazadas sin catch, mostrándolos como toasts.
   */
  function _instalarManejadorErrores() {
    // Errores síncronos
    window.addEventListener('error', (event) => {
      const mensaje = event.message || 'Error inesperado';
      console.error('[Global Error]', mensaje, event);
      showToast('error', `<i class="fas fa-bug"></i> ${mensaje}`);
    });

    // Promesas rechazadas sin control
    window.addEventListener('unhandledrejection', (event) => {
      const mensaje = (event.reason && event.reason.message) || 'Error en operación asíncrona';
      console.error('[Unhandled Rejection]', mensaje, event.reason);
      showToast('error', `<i class="fas fa-exclamation-triangle"></i> ${mensaje}`);
    });

    console.log('[Bootstrap] Manejador global de errores activado.');
  }

  return { arrancar };
})();

document.addEventListener('DOMContentLoaded', () => {
  Bootstrap.arrancar();
});