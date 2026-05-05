/* ================================================================
   PubPOS — MÓDULO: bootstrap.js (v1 – inicialización desacoplada)
   Propósito: Configura todas las dependencias (repositorios, managers)
              y arranca la aplicación. Si algo falla, lo registra sin
              detener el resto de módulos no críticos.
   ================================================================ */

const Bootstrap = (() => {

  async function arrancar() {
    console.log('[Bootstrap] Iniciando aplicación...');

    // ── 1. Autenticación (crítica) ─────────────────────────
    try {
      Auth.init();
      console.log('[Bootstrap] Auth listo.');
    } catch (e) {
      console.error('[Bootstrap] Error en Auth:', e);
      // Sin auth no podemos continuar
      return;
    }

    // ── 2. Base de datos (crítica) ─────────────────────────
    try {
      await DB.init();
      console.log('[Bootstrap] DB lista.');
    } catch (e) {
      console.error('[Bootstrap] Error en DB:', e);
      // Sin DB no podemos operar
      return;
    }

    // ── 3. Configuración (no crítica) ──────────────────────
    try {
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
    } catch (e) {
      console.warn('[Bootstrap] Config no disponible:', e);
    }

    // ── 4. Inyección de dependencias ───────────────────────
    // Seleccionar el adaptador de repositorio
    let pedidoRepo;
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      pedidoRepo = PedidoRepositoryLocal;
      console.log('[Bootstrap] Usando PedidoRepositoryLocal.');
    } else {
      console.warn('[Bootstrap] PedidoRepositoryLocal no encontrado. Se usará DB directa como fallback.');
      // Podríamos crear un adaptador simple de fallback, pero por ahora avisamos.
    }

    // ── 5. Iniciar PedidoManager con el repositorio ─────────
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

    // ── 6. TurnoManager (no requiere init especial) ─────────
    if (typeof TurnoManager === 'undefined') {
      console.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // ── 7. Mostrar vista inicial ────────────────────────────
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

  return { arrancar };
})();

// Reemplazar el event listener del DOM para usar Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  Bootstrap.arrancar();
});