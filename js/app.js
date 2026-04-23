/* ================================================================
   PubPOS — MÓDULO: app.js
   Propósito: Orquestador principal, gestión de vistas y eventos.
   Cambios (2026-04-23):
     • En init(), al mostrar la vista inicial si hay usuario autenticado,
       se utiliza Auth.getDefaultView() en lugar de fijar 'mesas'.
   ================================================================ */
const App = {
  async init() {
    try {
      console.log('[App] Iniciando aplicación...');
      Auth.init();
      await DB.init();
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
      this._iniciarReloj();
      
      // CAMBIO: usar vista por defecto según rol
      if (Auth.getRol()) {
        const vistaDefecto = Auth.getDefaultView();
        this.showView(vistaDefecto);
      }
      
      this._suscribirEventos();
      console.log('[App] Sistema listo.');
    } catch (e) {
      console.error('[App] Fallo en arranque:', e);
      this._mostrarErrorCarga();
    }
  },

  _iniciarReloj() { /* sin cambios */ },
  _mostrarErrorCarga() { /* sin cambios */ },

  showView(nombre) {
    // (sin cambios: validaciones de permisos, activación de vista y renderizado)
    if (!Auth.getRol()) { Auth.mostrarLogin(); return; }
    if (nombre === 'caja' && !Auth.puedeAccederCaja()) { showToast('error', 'No tienes permiso para acceder a Caja'); return; }
    if (nombre === 'cocina' && !Auth.puedeAccederCocina()) { showToast('error', 'No tienes permiso para acceder a Cocina'); return; }
    if (nombre === 'config' && !Auth.esAdmin()) { showToast('error', 'Solo administradores pueden acceder a Configuración'); return; }
    if (nombre === 'despensa') {
      if (!Auth.esAdmin() && !Auth.esCocina() && !Auth.esBarra()) {
        showToast('error', 'No tienes permiso para acceder a Despensa');
        return;
      }
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const vista = $id(`view-${nombre}`);
    const btn = document.querySelector(`[data-view="${nombre}"]`);
    if (vista) vista.classList.add('active');
    if (btn) btn.classList.add('active');

    EventBus.emit('vista:cambiada', nombre);
    if (nombre === 'mesas' && window.Mesas) Mesas.render();
    if (nombre === 'cocina' && window.KDS) KDS.refresh();
    if (nombre === 'caja' && window.Caja) Caja.render();
    if (nombre === 'config' && window.Config) Config.renderProductos();
    if (nombre === 'despensa' && window.Despensa) Despensa.render();
  },

  _suscribirEventos() {
    // (sin cambios)
    EventBus.on('sincronizacion:completada', () => { /* ... */ });
    EventBus.on('mesas:guardadas', () => { /* ... */ });
    EventBus.on('comandas:guardadas', () => { /* ... */ });
    EventBus.on('pedido:cerrado', () => { /* ... */ });
    EventBus.on('mesa:seleccionada', (num) => { if (window.Pedido) Pedido.abrirMesa(num); });
    EventBus.on('inventario:stock_bajo', (data) => showToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;