/* ================================================================
   PubPOS — MÓDULO: app.js (v5.1 – logging unificado + JSDoc)
   Propósito: Controlador de vistas, reloj, navegación y suscripción
              a eventos de UI.
   ================================================================ */
const App = {
  /**
   * Inicializa componentes de UI que no dependen de la lógica de negocio.
   */
  async init() {
    Logger.info('[App] Iniciando UI...');
    this._iniciarReloj();
    this._initRealVH();
    this._mejorarFocoEnModales();
    this._suscribirEventos();
    Logger.info('[App] UI lista.');
  },

  /** Reloj en el header */
  _iniciarReloj() {
    const actualizar = () => {
      const ahora = new Date();
      const fechaEl = document.getElementById('currentDate');
      const horaEl = document.getElementById('currentTime');
      if (fechaEl) fechaEl.textContent = ahora.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (horaEl) horaEl.textContent = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    actualizar();
    setInterval(actualizar, 1000);
  },

  /** Tamaño real de viewport en móviles */
  _initRealVH() {
    function setRealVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', setRealVH);
    window.addEventListener('orientationchange', setRealVH);
    setRealVH();
  },

  /** Mejora el foco en inputs dentro de modales */
  _mejorarFocoEnModales() {
    document.addEventListener('focusin', (e) => {
      const target = e.target;
      if (!target.matches('input, textarea, select')) return;
      const overlay = target.closest('.modal-overlay');
      if (!overlay || overlay.style.display === 'none') return;

      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const scrollableParent = target.closest('.modal-small-body, .receta-detalle-body, .modal-body, .menu-detalle-body');
        if (scrollableParent) {
          const rect = target.getBoundingClientRect();
          const parentRect = scrollableParent.getBoundingClientRect();
          if (rect.bottom > parentRect.bottom || rect.top < parentRect.top) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }, 300);
    });
  },

  /**
   * Navega a una vista verificando permisos.
   * @param {string} nombre - Nombre de la vista (ej. 'mesas')
   */
  showView(nombre) {
    if (!Auth.getRol()) { Auth.mostrarLogin(); return; }

    // Validaciones de permisos
    if (nombre === 'caja' && !Auth.puedeAccederCaja()) { showToast('error', 'No tienes permiso para acceder a Caja'); return; }
    if (nombre === 'cocina' && !Auth.puedeAccederCocina()) { showToast('error', 'No tienes permiso para acceder a Cocina'); return; }
    if (nombre === 'config' && !Auth.esAdmin()) { showToast('error', 'Solo administradores pueden acceder a Configuración'); return; }
    if (nombre === 'despensa') {
      if (!Auth.esAdmin() && !Auth.esCocina() && !Auth.esBarra() && !Auth.esDespensa()) {
        showToast('error', 'No tienes permiso para acceder a Despensa'); return;
      }
    }
    if (nombre === 'recetas') {
      if (!Auth.esCocina() && !Auth.esBarra() && !Auth.esAdmin() && !Auth.esMaster()) {
        showToast('error', 'No tienes permiso para acceder a Recetas'); return;
      }
    }
    if (nombre === 'reparto') {
      if (!Auth.puedeAccederReparto()) { showToast('error', 'No tienes permiso para acceder a Reparto'); return; }
    }
    if (nombre === 'menu') {
      if (!Auth.puedeAccederMenu()) { showToast('error', 'No tienes permiso para acceder al Menú'); return; }
    }
    if (nombre === 'eventos') {
      if (!Auth.puedeAccederEventos()) { showToast('error', 'No tienes permiso para acceder a Eventos'); return; }
    }
    if (nombre === 'perfil') {
      if (!Auth.puedeAccederPerfil()) { showToast('error', 'No tienes permiso para acceder a Perfil'); return; }
    }

    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = '';
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const vista = $id(`view-${nombre}`);
    const btn = document.querySelector(`[data-view="${nombre}"]`);
    if (vista) {
      vista.classList.add('active');
      vista.style.display = '';
    }
    if (btn) btn.classList.add('active');

    EventBus.emit('vista:cambiada', nombre);

    if (Auth.esMasterReal && Auth.esMasterReal()) {
      Auth.aplicarRestriccionesUI();
    }

    if (nombre === 'mesas' && window.Mesas) Mesas.render();
    if (nombre === 'cocina' && window.KDS) KDS.refresh();
    if (nombre === 'caja' && window.Caja) Caja.render();
    if (nombre === 'config' && window.Config) Config.renderProductos();
    if (nombre === 'despensa' && window.Despensa) Despensa.render();
    if (nombre === 'recetas' && window.Recetas) Recetas.render();
    if (nombre === 'reparto' && window.Reparto) Reparto.render();
    if (nombre === 'menu' && window.Menu) Menu.render();
    if (nombre === 'eventos' && window.Eventos) Eventos.render();
    if (nombre === 'perfil' && window.Perfil) Perfil.render();
  },

  /** Suscripción a eventos generales de UI */
  _suscribirEventos() {
    EventBus.on('sincronizacion:completada', () => {
      if (window.Mesas) Mesas.render();
      if (window.Carta) Carta.render();
      if (window.Recetas) Recetas.render();
      if (window.Reparto) Reparto.render();
      if (window.Menu) Menu.render();
      if (window.Eventos) Eventos.render();
      if (window.Perfil) Perfil.render();
    });
    EventBus.on('mesas:guardadas', () => { if (window.Mesas) Mesas.render(); });
    EventBus.on('comandas:guardadas', () => { if (window.KDS) KDS.refresh(); });
    EventBus.on('pedido:cerrado', () => { if (window.Caja) Caja.render(); });
    EventBus.on('mesa:seleccionada', (num) => { if (window.Pedido) Pedido.abrirMesa(num); });
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
    EventBus.on('productos:cargados', () => {
      if (window.Recetas) Recetas.render();
      if (window.Menu) Menu.render();
    });
    EventBus.on('recetas:actualizadas', () => { if (window.Recetas) Recetas.render(); });
    EventBus.on('pedidosDelivery:guardados', () => { if (window.Reparto) Reparto.render(); });
    EventBus.on('sync:colaActualizada', (pendientes) => {
      const badge = document.getElementById('syncPendingBadge');
      if (badge) {
        badge.textContent = pendientes > 0 ? pendientes : '';
        badge.style.display = pendientes > 0 ? 'inline-block' : 'none';
      }
    });
    EventBus.on('turno:iniciado', (turno) => {
      Logger.info(`[App] Turno iniciado: ${turno?.id}`);
      if (window.Caja) Caja.render();
    });
    EventBus.on('turno:cerrado', () => {
      showToast('success', 'Turno cerrado correctamente.');
      if (window.Caja) Caja.render();
    });
    EventBus.on('audit:actualizado', (info) => {
      Logger.info(`[App] Bitácora actualizada: ${info.total} registros.`);
    });
  },

  /**
   * Cierra el turno actual desde cualquier vista.
   */
  async cerrarTurnoApp() {
    if (typeof TurnoManager === 'undefined') {
      showToast('error', 'Sistema de turnos no disponible.');
      return;
    }

    if (!confirm('¿Estás seguro de cerrar el turno actual? Se resetearán mesas y pedidos. Se guardará un respaldo en Drive.')) {
      return;
    }

    const resultado = await TurnoManager.cerrarTurno();
    if (resultado.exito) {
      showToast('success', resultado.mensaje);
      if (window.Mesas) Mesas.render();
      if (window.KDS) KDS.refresh();
      if (window.Caja) Caja.render();
      if (window.Reparto) Reparto.render();
    } else {
      showToast('error', resultado.mensaje);
    }
  }
};

window.App = App;