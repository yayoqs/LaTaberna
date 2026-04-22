/* ================================================================
   PubPOS — MÓDULO: app.js (Versión integrada con EventBus)
   ================================================================ */
const App = {
  async init() {
    try {
      console.log('[App] Iniciando aplicación...');
      
      // 1. Inicializar autenticación (muestra login si no hay sesión)
      Auth.init();
      
      // 2. Inicializar base de datos (carga datos locales y remotos)
      await DB.init();  // DB.init ahora emite 'db:inicializada' internamente
      
      // 3. Cargar configuración en la UI
      if (typeof Config !== 'undefined' && Config.cargar) {
        Config.cargar();
      }
      
      // 4. Iniciar reloj en header
      this._iniciarReloj();
      
      // 5. Mostrar vista inicial (mesas) si el usuario ya está autenticado
      if (Auth.getRol()) {
        this.showView('mesas');
      }
      
      // 6. Suscribirse a eventos globales
      this._suscribirEventos();
      
      console.log('[App] Sistema listo.');
    } catch (e) {
      console.error('[App] Fallo en arranque:', e);
      this._mostrarErrorCarga();
    }
  },

  _iniciarReloj() {
    const tick = () => {
      const d = $id('currentDate'), t = $id('currentTime');
      if (d) d.textContent = fmtFechaLarga();
      if (t) t.textContent = fmtHoraCompleta();
    };
    setInterval(tick, 1000);
    tick();
  },

  _mostrarErrorCarga() {
    const grid = $id('mesasGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--color-text-muted)">
          <i class="fas fa-exclamation-triangle" style="font-size:48px;opacity:.5;margin-bottom:16px"></i>
          <p>Error al cargar las mesas.</p>
          <p style="font-size:12px">Intente recargar.</p>
        </div>`;
    }
  },

  /**
   * Cambia la vista activa y actualiza la UI.
   */
  showView(nombre) {
    // Verificar autenticación
    if (!Auth.getRol()) {
      Auth.mostrarLogin();
      return;
    }
    
    // Verificar permisos según vista
    if (nombre === 'caja' && !Auth.puedeAccederCaja()) {
      showToast('error', 'No tienes permiso para acceder a Caja');
      return;
    }
    if (nombre === 'cocina' && !Auth.puedeAccederCocina()) {
      showToast('error', 'No tienes permiso para acceder a Cocina');
      return;
    }
    if (nombre === 'config' && !Auth.esAdmin()) {
      showToast('error', 'Solo administradores pueden acceder a Configuración');
      return;
    }
    if (nombre === 'despensa') {
      // Permitir a admin, master, cocina y barra
      if (!Auth.esAdmin() && !Auth.esCocina() && !Auth.esBarra()) {
        showToast('error', 'No tienes permiso para acceder a Despensa');
        return;
      }
    }

    // Cambiar clases activas en vistas y botones
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const vista = $id(`view-${nombre}`);
    const btn = document.querySelector(`[data-view="${nombre}"]`);
    if (vista) vista.classList.add('active');
    if (btn) btn.classList.add('active');

    // Emitir evento de cambio de vista
    EventBus.emit('vista:cambiada', nombre);
    
    // Disparar renderizados necesarios según la vista
    if (nombre === 'mesas') {
      if (window.Mesas && typeof window.Mesas.render === 'function') {
        window.Mesas.render();
      }
    }
    if (nombre === 'cocina' && window.KDS) {
      KDS.refresh();
    }
    if (nombre === 'caja' && window.Caja) {
      Caja.render();
    }
    if (nombre === 'config' && window.Config) {
      Config.renderProductos();
    }
    if (nombre === 'despensa' && window.Despensa) {
      Despensa.render();
    }
  },

  /**
   * Suscribirse a eventos relevantes para la aplicación.
   */
  _suscribirEventos() {
    // Cuando se complete la sincronización desde Config, refrescar productos en la vista activa
    EventBus.on('sincronizacion:completada', () => {
      showToast('success', 'Datos actualizados');
      if (typeof Config !== 'undefined' && Config.renderProductos) {
        Config.renderProductos();
      }
      // Refrescar despensa si está activa
      const vistaActiva = document.querySelector('.view.active')?.id;
      if (vistaActiva === 'view-despensa' && window.Despensa) {
        Despensa.render();
      }
    });

    // Cuando se guarden mesas, si la vista activa es 'mesas', aseguramos que se vea
    EventBus.on('mesas:guardadas', () => {
      const vistaActiva = document.querySelector('.view.active')?.id;
      if (vistaActiva === 'view-mesas' && window.Mesas) {
        window.Mesas.render();
      }
    });

    // Cuando se guarden comandas, si estamos en cocina, refrescar
    EventBus.on('comandas:guardadas', () => {
      const vistaActiva = document.querySelector('.view.active')?.id;
      if (vistaActiva === 'view-cocina' && window.KDS) {
        window.KDS.refresh();
      }
    });

    // Cuando se cierre un pedido, si estamos en caja, refrescar
    EventBus.on('pedido:cerrado', () => {
      const vistaActiva = document.querySelector('.view.active')?.id;
      if (vistaActiva === 'view-caja' && window.Caja) {
        window.Caja.render();
      }
      // También refrescar despensa porque el stock pudo cambiar
      if (vistaActiva === 'view-despensa' && window.Despensa) {
        Despensa.render();
      }
    });

    // Escuchar clic en mesa desde Mesas
    EventBus.on('mesa:seleccionada', (num) => {
      if (typeof Pedido !== 'undefined' && Pedido.abrirMesa) {
        Pedido.abrirMesa(num);
      }
    });
    
    // Escuchar alertas de stock bajo para mostrar notificación (ya se maneja en Despensa, pero podemos reforzar)
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
  }
};

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());

// Exponer globalmente
window.App = App;