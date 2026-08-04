/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/app.js
   Versión: 1.3.2
   Propósito: Punto de entrada modular. Control de vistas con ciclo
              de vida (limpiar/activar).
              Auth.logout() → Auth.cerrarSesion().
   ================================================================ */

// ── Utilidades y librerías ────────────────────────────────
import { $id, mostrarToast } from './utils.js';
import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { CommandBus } from './lib/command-bus.js';
import { Store } from './lib/store.js';
import { Deps } from './lib/deps.js';

// ── Dominio (todos ES6) ───────────────────────────────────
import './dominio/resultado.js';
import './dominio/dinero.js';
import './dominio/cantidad.js';
import './dominio/direccion.js';
import './dominio/pedido.js';
import './dominio/delivery.js';
import './dominio/ingrediente.js';

// ── Base de datos ─────────────────────────────────────────
import { DBCore } from './db-core.js';
import { DBInventario } from './db-inventario.js';
import { DBFusion } from './db-fusion.js';
import { DBShim } from './db-shim.js';
import { DBAppwrite } from './db-appwrite.js';
import { DB } from './db.js';

// ── Auth y roles ──────────────────────────────────────────
import { Roles } from './roles.js';
import { Auth } from './auth.js';

// ── Servicios ─────────────────────────────────────────────
import './servicios/pedido-service.js';
import './servicios/delivery-service.js';
import './servicios/inventario-service.js';

// ── Comandos ──────────────────────────────────────────────
import './comandos/crear-pedido-mesa.js';
import './comandos/enviar-comanda.js';
import './comandos/agregar-mesa.js';
import './comandos/liberar-mesa.js';
import './comandos/completar-subcomanda.js';
import './comandos/marcar-agotado.js';
import './comandos/cerrar-turno.js';

// ── Repositorios ──────────────────────────────────────────
import './repositorios/pedido-repository.js';

// ── Managers ──────────────────────────────────────────────
import './managers/pedido-manager.js';
import './managers/turno-manager.js';

// ── Vistas (importadas para que se ejecuten sus registros) ─
import { Carta } from './ui/carta.js';
import { Comanda } from './ui/comanda.js';
import { Caja } from './ui/caja.js';
import { Cobro } from './ui/cobro.js';
import { Config } from './ui/config.js';
import { Cuenta } from './ui/cuenta.js';
import { Despensa } from './ui/despensa.js';
import { Eventos } from './ui/eventos.js';
import { KDS } from './ui/kds.js';
import { Menu } from './ui/menu.js';
import { MesaDetalles } from './ui/mesa-detalles.js';
import { Mesas } from './ui/mesas.js';
import { Pedido } from './ui/pedido-ui.js';
import { Perfil } from './ui/perfil.js';
import { Recetas } from './ui/recetas.js';
import { Reparto } from './ui/reparto.js';
import { Tickets } from './ui/tickets.js';
import { GuiaMesero } from './modulos/interno/guia-mesero.js';
import { PrecargaControl } from './modulos/interno/precarga-control.js';
import { EventosEnVivo } from './modulos/admin/eventos-en-vivo.js';
import './modulos/cliente/principal.js';

// ── Bootstrap (inicia la aplicación) ──────────────────────
import './bootstrap.js';

// ═══════════════════════════════════════════════════════════
// Mapa de módulos con soporte de ciclo de vida (limpiar/activar)
// ═══════════════════════════════════════════════════════════
const modulosVista = {
  mesas: Mesas,
  cocina: KDS,
  caja: Caja,
  config: Config,
  despensa: Despensa,
  recetas: Recetas,
  reparto: Reparto,
  menu: Menu,
  eventos: Eventos,
  'eventos-en-vivo': EventosEnVivo,
  perfil: Perfil,
  'carta-editor': Menu
  // Las vistas 'inicio' y 'bienvenida' se gestionan internamente
};

// ═══════════════════════════════════════════════════════════
// Definición del núcleo de la UI
// ═══════════════════════════════════════════════════════════
let _vistaActual = null;

export const App = {
  async init() {
    Logger.info('[App] Iniciando UI...');
    this._iniciarReloj();
    this.ajustarAlturaReal();
    this._mejorarFocoEnModales();
    this._suscribirEventos();
    this._iniciarMonitoreoConexion();
    Logger.info('[App] UI lista.');
  },

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

  ajustarAlturaReal() {
    function aplicarVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', aplicarVH);
    window.addEventListener('orientationchange', aplicarVH);
    aplicarVH();
  },

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

  _vistasPublicas: ['inicio'],

  showView(nombre) {
    // ── Ciclo de vida: limpiar vista anterior ──────────
    if (_vistaActual && modulosVista[_vistaActual] && typeof modulosVista[_vistaActual].limpiar === 'function') {
      try {
        modulosVista[_vistaActual].limpiar();
      } catch (e) {
        Logger.error('[App] Error al limpiar vista ' + _vistaActual + ':', e);
      }
    }

    // ── Control de header ─────────────────────────────
    const header = document.querySelector('.app-header');
    if (header) {
      header.style.display = (nombre === 'inicio' || nombre === 'bienvenida') ? 'none' : 'flex';
      header.style.transition = 'all 0.3s ease';
    }

    // ── Swipe para master en bienvenida ───────────────
    if (nombre === 'bienvenida' && typeof Auth !== 'undefined' && Auth.esMasterReal && Auth.esMasterReal()) {
      let touchStartY = 0;
      const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
      const onTouchEnd = (e) => {
        if (!header) return;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;
        if (touchStartY < 50 && deltaY > 100 && header.style.display === 'none') {
          header.style.display = 'flex';
        }
        if (touchStartY > window.innerHeight - 50 && deltaY < -100 && header.style.display === 'flex') {
          header.style.display = 'none';
        }
      };
      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
      const limpiarSwipe = () => {
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchend', onTouchEnd);
      };
      document.addEventListener('vista:cambiada', limpiarSwipe, { once: true });
    }

    // ── Control de autenticación ──────────────────────
    if (!this._vistasPublicas.includes(nombre) && !Auth.obtenerRol()) {
      Auth.mostrarLogin();
      return;
    }

    // Validaciones de permisos
    if (nombre === 'caja' && !Auth.puedeAccederCaja()) { mostrarToast('error', 'No tienes permiso para acceder a Caja'); return; }
    if (nombre === 'cocina' && !Auth.puedeAccederCocina()) { mostrarToast('error', 'No tienes permiso para acceder a Cocina'); return; }
    if (nombre === 'config' && !Auth.esAdmin()) { mostrarToast('error', 'Solo administradores pueden acceder a Configuración'); return; }
    if (nombre === 'despensa') {
      if (!Auth.esAdmin() && !Auth.esCocina() && !Auth.esBarra() && !Auth.esDespensa()) {
        mostrarToast('error', 'No tienes permiso para acceder a Despensa'); return;
      }
    }
    if (nombre === 'recetas') {
      if (!Auth.esCocina() && !Auth.esBarra() && !Auth.esAdmin() && !Auth.esMaster()) {
        mostrarToast('error', 'No tienes permiso para acceder a Recetas'); return;
      }
    }
    if (nombre === 'reparto') {
      if (!Auth.puedeAccederReparto()) { mostrarToast('error', 'No tienes permiso para acceder a Reparto'); return; }
    }
    if (nombre === 'menu') {
      if (!Auth.puedeAccederMenu()) { mostrarToast('error', 'No tienes permiso para acceder al Menú'); return; }
    }
    if (nombre === 'eventos') {
      if (!Auth.puedeAccederEventos()) { mostrarToast('error', 'No tienes permiso para acceder a Eventos'); return; }
    }
    if (nombre === 'perfil') {
      if (!Auth.puedeAccederPerfil()) { mostrarToast('error', 'No tienes permiso para acceder a Perfil'); return; }
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

    // ── Ciclo de vida: activar nueva vista ────────────
    if (modulosVista[nombre] && typeof modulosVista[nombre].activar === 'function') {
      try {
        modulosVista[nombre].activar();
      } catch (e) {
        Logger.error('[App] Error al activar vista ' + nombre + ':', e);
      }
    }

    _vistaActual = nombre;

    EventBus.emit('vista:cambiada', nombre);

    if (Auth.esMasterReal && Auth.esMasterReal()) {
      Auth.aplicarRestriccionesUI();
    }

    // ── Notificar a las vistas para que se rendericen ─
    EventBus.emit('vista:activada', nombre);
  },

  _iniciarMonitoreoConexion() {
    window.addEventListener('online', () => {
      mostrarToast('success', '<i class="fas fa-wifi"></i> Conexión restablecida. Sincronizando...');
      Logger.info('[App] Conexión restablecida.');
    });

    window.addEventListener('offline', () => {
      mostrarToast('warning', '<i class="fas fa-exclamation-triangle"></i> Sin conexión. Los cambios se guardarán localmente.');
      Logger.warn('[App] Conexión perdida.');
    });
  },

  _suscribirEventos() {
    EventBus.on('sincronizacion:completada', () => {
      if (typeof Mesas !== 'undefined') Mesas.render();
      if (typeof Carta !== 'undefined') Carta.render();
      if (typeof Recetas !== 'undefined') Recetas.render();
      if (typeof Reparto !== 'undefined') Reparto.render();
      if (typeof Menu !== 'undefined') Menu.render();
      if (typeof Eventos !== 'undefined') Eventos.render();
      if (typeof Perfil !== 'undefined') Perfil.render();
    });
    EventBus.on('mesas:guardadas', () => { if (typeof Mesas !== 'undefined') Mesas.render(); });
    EventBus.on('comandas:guardadas', () => { if (typeof KDS !== 'undefined') KDS.refresh(); });
    EventBus.on('pedido:cerrado', () => { if (typeof Caja !== 'undefined') Caja.render(); });
    EventBus.on('mesa:seleccionada', (num) => { if (typeof Pedido !== 'undefined') Pedido.abrirMesa(num); });
    EventBus.on('inventario:stock_bajo', (data) => {
      mostrarToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
    EventBus.on('productos:cargados', () => {
      if (typeof Recetas !== 'undefined') Recetas.render();
      if (typeof Menu !== 'undefined') Menu.render();
    });
    EventBus.on('recetas:actualizadas', () => { if (typeof Recetas !== 'undefined') Recetas.render(); });
    EventBus.on('pedidosDelivery:guardados', () => { if (typeof Reparto !== 'undefined') Reparto.render(); });

    EventBus.on('sync:colaActualizada', (pendientes) => {
      const badge = document.getElementById('syncPendingBadge');
      const countSpan = document.getElementById('syncPendingCount');
      if (badge && countSpan) {
        countSpan.textContent = pendientes;
        badge.style.display = pendientes > 0 ? 'inline-flex' : 'none';
        if (pendientes > 0) {
          Logger.debug(`[App] Badge de sincronización: ${pendientes} pendientes.`);
        }
      }
    });

    EventBus.on('sync:completada', (timestamp) => {
      const indicator = document.getElementById('syncStatusIndicator');
      if (indicator) {
        indicator.title = `Última sincronización: ${new Date(timestamp).toLocaleTimeString()}`;
        indicator.style.color = 'var(--color-success)';
        indicator.innerHTML = '<i class="fas fa-check-circle"></i>';
      }
    });

    EventBus.on('turno:iniciado', (turno) => {
      Logger.info(`[App] Turno iniciado: ${turno?.id}`);
      if (typeof Caja !== 'undefined') Caja.render();
    });
    EventBus.on('turno:cerrado', () => {
      mostrarToast('success', 'Turno cerrado correctamente.');
      if (typeof Caja !== 'undefined') Caja.render();
    });
    EventBus.on('audit:actualizado', (info) => {
      Logger.info(`[App] Bitácora actualizada: ${info.total} registros.`);
    });
  }
};

// ═══════════════════════════════════════════════════════════
// Listener para cambios de vista desde Auth
// ═══════════════════════════════════════════════════════════
EventBus.on('app:cambiarVista', function(vista) {
  App.showView(vista);
});

// ═══════════════════════════════════════════════════════════
// Vinculación de eventos del header (compatible con módulos)
// ═══════════════════════════════════════════════════════════
function _vincularHeader() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var view = this.getAttribute('data-view');
      if (view) {
        App.showView(view);
      }
    });
  });

  var logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      Auth.cerrarSesion();  // ← actualizado
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_vincularHeader, 100);
  });
} else {
  setTimeout(_vincularHeader, 100);
}