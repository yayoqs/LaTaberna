/* ================================================================
   PubPOS — MÓDULO: app.js (v3 – soporte para vista recetas)
   ================================================================ */
const App = {
  async init() {
    try {
      console.log('[App] Iniciando aplicación...');
      Auth.init();
      await DB.init();
      if (typeof Config !== 'undefined' && Config.cargar) Config.cargar();
      this._iniciarReloj();
      this._initRealVH();
      
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

  _iniciarReloj() {
    const actualizar = () => {
      const ahora = new Date();
      const fechaEl = document.getElementById('currentDate');
      const horaEl = document.getElementById('currentTime');
      if (fechaEl) fechaEl.textContent = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (horaEl) horaEl.textContent = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    actualizar();
    setInterval(actualizar, 1000);
  },

  _initRealVH() {
    function setRealVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', setRealVH);
    window.addEventListener('orientationchange', setRealVH);
    setRealVH();
  },

  _mostrarErrorCarga() {
    const toast = document.getElementById('toastContainer');
    if (toast) {
      toast.innerHTML = '<div class="toast error"><i class="fas fa-exclamation-circle"></i> Error al cargar la aplicación. Recarga la página.</div>';
    }
  },

  showView(nombre) {
    if (!Auth.getRol()) { Auth.mostrarLogin(); return; }

    // Validaciones de permisos por vista
    if (nombre === 'caja' && !Auth.puedeAccederCaja()) { showToast('error', 'No tienes permiso para acceder a Caja'); return; }
    if (nombre === 'cocina' && !Auth.puedeAccederCocina()) { showToast('error', 'No tienes permiso para acceder a Cocina'); return; }
    if (nombre === 'config' && !Auth.esAdmin()) { showToast('error', 'Solo administradores pueden acceder a Configuración'); return; }
    if (nombre === 'despensa') {
      if (!Auth.esAdmin() && !Auth.esCocina() && !Auth.esBarra() && !Auth.esDespensa()) {
        showToast('error', 'No tienes permiso para acceder a Despensa');
        return;
      }
    }
    // NUEVA VALIDACIÓN PARA RECETAS
    if (nombre === 'recetas') {
      if (!Auth.esCocina() && !Auth.esBarra() && !Auth.esAdmin() && !Auth.esMaster()) {
        showToast('error', 'No tienes permiso para acceder a Recetas');
        return;
      }
    }

    // Ocultar todas las vistas y desactivar botones de navegación
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Activar la vista y el botón correspondiente
    const vista = $id(`view-${nombre}`);
    const btn = document.querySelector(`[data-view="${nombre}"]`);
    if (vista) vista.classList.add('active');
    if (btn) btn.classList.add('active');

    EventBus.emit('vista:cambiada', nombre);

    // Actualizar UI del header (selector de simulación) al cambiar de vista
    if (Auth.esMasterReal && Auth.esMasterReal()) {
      Auth.aplicarRestriccionesUI();
    }

    // Llamar al render de cada módulo según la vista
    if (nombre === 'mesas' && window.Mesas) Mesas.render();
    if (nombre === 'cocina' && window.KDS) KDS.refresh();
    if (nombre === 'caja' && window.Caja) Caja.render();
    if (nombre === 'config' && window.Config) Config.renderProductos();
    if (nombre === 'despensa' && window.Despensa) Despensa.render();
    if (nombre === 'recetas' && window.Recetas) Recetas.render();  // NUEVO
  },

  _suscribirEventos() {
    EventBus.on('sincronizacion:completada', () => {
      if (window.Mesas) Mesas.render();
      if (window.Carta) Carta.render();
      if (window.Recetas) Recetas.render();  // Refrescar recetas cuando se sincroniza
    });
    EventBus.on('mesas:guardadas', () => { if (window.Mesas) Mesas.render(); });
    EventBus.on('comandas:guardadas', () => { if (window.KDS) KDS.refresh(); });
    EventBus.on('pedido:cerrado', () => { if (window.Caja) Caja.render(); });
    EventBus.on('mesa:seleccionada', (num) => { if (window.Pedido) Pedido.abrirMesa(num); });
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
    // NUEVO: refrescar recetas cuando se actualicen productos o recetas
    EventBus.on('productos:cargados', () => { if (window.Recetas) Recetas.render(); });
    EventBus.on('recetas:actualizadas', () => { if (window.Recetas) Recetas.render(); });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;