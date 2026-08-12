/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/config.js
   Versión: 3.0.4
   Propósito: Vista de configuración rediseñada con panel izquierdo,
              gestión de zonas, personal por roles, impresoras y
              contraseñas. Swipe y overlay en móvil.
              v3.0.4: sección Personal delega en admin-roles.js pasando
                      contenedorId 'sec-personal'.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Auth } from '../auth.js';
import { mostrarToast, mostrarConfirmacion, mostrarEntrada } from '../utils.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';
import { renderTabAdmin } from './perfil/admin-roles.js';

const Config = (() => {
  let _abortController = null;
  let _desuscripciones = [];
  let _observerHeader = null;

  function _asegurarVista() {
    let main = document.getElementById('view-config');
    if (!main) return;
    if (main.querySelector('.main-layout')) return;

    main.innerHTML = `
      <div class="config-header">
        <button class="icon-btn" id="btnToggleMenuConfig" title="Menú">☰</button>
        <h2>⚙️ Configuración</h2>
      </div>
      <div class="main-layout" id="configMainLayout">
        <div class="panel-izquierdo" id="panelIzquierdoConfig">
          <button class="nav-btn activo" data-seccion="local">🏠 Datos del Local</button>
          <button class="nav-btn" data-seccion="zonas">📍 Zonas</button>
          <button class="nav-btn" data-seccion="personal">👥 Personal</button>
          <button class="nav-btn" data-seccion="impresoras">🖨️ Impresoras</button>
          <button class="nav-btn" data-seccion="contrasenas" id="navContrasenas" style="display:none;">🔑 Contraseñas</button>
        </div>
        <div class="panel-central" id="panelCentralConfig">
          <div class="seccion activo" id="sec-local"></div>
          <div class="seccion" id="sec-zonas"></div>
          <div class="seccion" id="sec-personal"></div>
          <div class="seccion" id="sec-impresoras"></div>
          <div class="seccion" id="sec-contrasenas"></div>
        </div>
      </div>
      <div class="overlay" id="configOverlay"></div>
    `;

    main.classList.add('active');
  }

  function _renderSeccionLocal() {
    const config = Store.obtenerEstado().config || DB.config || {};
    const sec = document.getElementById('sec-local');
    if (!sec) return;
    sec.innerHTML = `
      <h3><i class="fas fa-store"></i> Datos del Local</h3>
      <div class="campo"><label>Nombre del Local</label><input type="text" id="cfgNombreLocal" value="${config.nombreLocal || ''}"></div>
      <div class="campo"><label>Dirección</label><input type="text" id="cfgDireccion" value="${config.direccion || ''}"></div>
      <div class="campo"><label>CUIT / RUT</label><input type="text" id="cfgCuit" value="${config.cuit || ''}"></div>
      <div class="campo"><label>Pie de ticket</label><input type="text" id="cfgPie" value="${config.pieTicket || ''}"></div>
      <label style="display:flex; align-items:center; gap:8px; margin:12px 0;">
        <input type="checkbox" id="cfgBloquearStock" ${config.bloquearStockInsuficiente !== false ? 'checked' : ''}> Bloquear envío si falta stock
      </label>
      <button class="btn-primary" id="btnGuardarConfig"><i class="fas fa-save"></i> Guardar</button>
    `;
    document.getElementById('btnGuardarConfig')?.addEventListener('click', _guardarConfig);
  }

  function _renderSeccionZonas() {
    const config = Store.obtenerEstado().config || {};
    const zonas = config.zonas || [{ nombre: 'salon', cantidad: 12 }];
    const sec = document.getElementById('sec-zonas');
    if (!sec) return;
    sec.innerHTML = `
      <h3><i class="fas fa-map-marker-alt"></i> Zonas / Espacios</h3>
      <div id="zonasContainer"></div>
      <button class="btn-secondary" id="btnAgregarZona" style="margin-top:8px;"><i class="fas fa-plus"></i> Añadir Zona</button>
      <button class="btn-danger" id="btnResetearMesas" style="margin-top:12px;"><i class="fas fa-sync-alt"></i> Resetear Mesas</button>
    `;
    _renderFilasZonas(zonas);
    document.getElementById('btnAgregarZona')?.addEventListener('click', _agregarZona);
    document.getElementById('btnResetearMesas')?.addEventListener('click', _resetearMesas);
  }

  function _renderFilasZonas(zonas) {
    const container = document.getElementById('zonasContainer');
    if (!container) return;
    container.innerHTML = zonas.map((z, idx) => `
      <div class="zona-row">
        <input type="text" value="${z.nombre}" placeholder="Nombre zona" data-idx="${idx}" data-campo="nombre">
        <input type="number" value="${z.cantidad}" min="0" step="1" style="width:80px;" data-idx="${idx}" data-campo="cantidad">
        <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-icon-sm.del').forEach(btn => {
      btn.addEventListener('click', () => _eliminarZona(parseInt(btn.dataset.idx)));
    });
  }

  function _renderSeccionPersonal() {
    const usuarioActual = Auth.obtenerUsuarioActual();
    const esMaster = Auth.esMasterReal();
    // ✅ Pasamos el ID del contenedor correcto
    renderTabAdmin(usuarioActual, esMaster, 'sec-personal');
  }

  function _renderSeccionImpresoras() {
    const config = Store.obtenerEstado().config || DB.config || {};
    const sec = document.getElementById('sec-impresoras');
    if (!sec) return;
    sec.innerHTML = `
      <h3><i class="fas fa-print"></i> Impresoras</h3>
      <div class="campo"><label>Cocina</label><input type="text" id="impCocinaIP" value="${config.impCocinaIP || '192.168.1.100'}"></div>
      <div class="campo"><label>Barra</label><input type="text" id="impBarraIP" value="${config.impBarraIP || '192.168.1.101'}"></div>
      <div class="campo"><label>Caja</label><input type="text" id="impCajaIP" value="${config.impCajaIP || '192.168.1.102'}"></div>
      <p style="font-size:11px; color:var(--color-text-muted); margin-top:8px;">Para impresión directa instalá QZ Tray.</p>
    `;
  }

  function _renderSeccionContrasenas() {
    const sec = document.getElementById('sec-contrasenas');
    if (!sec) return;

    let usuarios = [];
    try {
      const raw = localStorage.getItem('pubpos_usuarios');
      if (raw) usuarios = JSON.parse(raw);
    } catch (e) { usuarios = []; }

    sec.innerHTML = `
      <h3><i class="fas fa-key"></i> Contraseñas de Usuarios</h3>
      <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:12px;">Solo el master puede cambiar contraseñas.</p>
      ${usuarios.map(u => `
        <div class="usuario-row">
          <div class="usuario-row-top">
            <div class="av">${u.nombre.charAt(0).toUpperCase()}</div>
            <strong>${u.nombre}</strong>
            <span class="rol-actual">${u.rol}</span>
          </div>
          <button class="btn-secondary btn-cambiar-pass" data-nombre="${u.nombre}">🔑 Cambiar contraseña</button>
        </div>
      `).join('')}
    `;

    sec.querySelectorAll('.btn-cambiar-pass').forEach(btn => {
      btn.addEventListener('click', () => _mostrarCambiarPassword(btn.dataset.nombre));
    });
  }

  async function _guardarConfig() {
    const zonasContainer = document.getElementById('zonasContainer');
    let config = Store.obtenerEstado().config || {};

    if (zonasContainer) {
      const filas = zonasContainer.querySelectorAll('.zona-row');
      const zonasNuevas = Array.from(filas).map(fila => {
        const inputs = fila.querySelectorAll('input');
        return { nombre: inputs[0]?.value.trim() || 'sin_nombre', cantidad: parseInt(inputs[1]?.value) || 0 };
      });
      if (zonasNuevas.length === 0) {
        mostrarToast('error', 'Debe existir al menos una zona.');
        return;
      }
      config.zonas = zonasNuevas;
    }

    config = {
      ...config,
      nombreLocal: document.getElementById('cfgNombreLocal').value.trim(),
      direccion: document.getElementById('cfgDireccion').value.trim(),
      cuit: document.getElementById('cfgCuit').value.trim(),
      pieTicket: document.getElementById('cfgPie').value.trim(),
      impCocinaIP: document.getElementById('impCocinaIP')?.value.trim() || config.impCocinaIP,
      impBarraIP: document.getElementById('impBarraIP')?.value.trim() || config.impBarraIP,
      impCajaIP: document.getElementById('impCajaIP')?.value.trim() || config.impCajaIP,
      bloquearStockInsuficiente: document.getElementById('cfgBloquearStock')?.checked ?? true
    };
    delete config.cantidadMesas;

    DB.config = config;
    DB.saveConfig();
    DB.saveMesas();

    if (typeof DB.sincronizarMesasConConfig === 'function') {
      await DB.sincronizarMesasConConfig();
    }

    EventBus.emit('config:actualizada');
    mostrarToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        var datosConfig = { clave: 'global', valor: JSON.stringify(config) };
        var existente = await DBAppwrite.listar('configuracion');
        var docGlobal = existente.find(function(d) { return d.clave === 'global'; });
        if (docGlobal) {
          await DBAppwrite.actualizar('configuracion', docGlobal.id, datosConfig);
        } else {
          await DBAppwrite.crear('configuracion', 'global', datosConfig);
        }
      } catch (e) {
        Logger.warn('[Config] No se pudo sincronizar configuración con Appwrite:', e);
      }
    }
  }

  async function _agregarZona() {
    const nombre = await mostrarEntrada('Nueva zona', 'Nombre de la nueva zona:', { placeholder: 'Terraza' });
    if (!nombre) return;
    const cantidadStr = await mostrarEntrada('Nueva zona', 'Cantidad de mesas inicial:', { type: 'number', placeholder: '0' });
    const cantidad = parseInt(cantidadStr || '0');
    if (isNaN(cantidad)) return;
    const config = Store.obtenerEstado().config || {};
    if (!config.zonas) config.zonas = [];
    config.zonas.push({ nombre: nombre.trim(), cantidad });
    _renderFilasZonas(config.zonas);
  }

  async function _eliminarZona(idx) {
    const config = Store.obtenerEstado().config || {};
    if (!config.zonas || config.zonas.length <= 1) {
      mostrarToast('error', 'Debe existir al menos una zona.');
      return;
    }
    const confirmado = await mostrarConfirmacion('Eliminar zona', `¿Eliminar la zona "${config.zonas[idx].nombre}"?`);
    if (!confirmado) return;
    config.zonas.splice(idx, 1);
    _renderFilasZonas(config.zonas);
  }

  async function _resetearMesas() {
    const confirmado = await mostrarConfirmacion('Resetear mesas', '¿Resetear todas las mesas? Se recrearán según las zonas configuradas.');
    if (!confirmado) return;
    if (typeof DB.resetearMesas === 'function') {
      await DB.resetearMesas();
      EventBus.emit('config:actualizada');
      mostrarToast('success', 'Mesas reseteadas correctamente');
    } else {
      mostrarToast('error', 'Función no disponible');
    }
  }

  async function _mostrarCambiarPassword(nombreUsuario) {
    if (!Auth.esMasterReal()) {
      mostrarToast('error', 'Solo el master puede cambiar contraseñas');
      return;
    }
    const nueva = await mostrarEntrada('Nueva contraseña', 'Nueva contraseña para ' + nombreUsuario + ':', { type: 'password' });
    if (!nueva || nueva.trim().length === 0) return;
    const confirmacion = await mostrarEntrada('Confirmar contraseña', 'Confirma la nueva contraseña:', { type: 'password' });
    if (confirmacion !== nueva) {
      mostrarToast('error', 'Las contraseñas no coinciden');
      return;
    }
    if (typeof Auth.cambiarPassword === 'function') {
      const ok = await Auth.cambiarPassword(nombreUsuario, nueva.trim());
      if (ok) _renderSeccionContrasenas();
    } else {
      mostrarToast('error', 'Función no disponible');
    }
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();
    const { signal } = _abortController;

    _asegurarVista();

    document.querySelectorAll('#view-config .nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-config .nav-btn').forEach(b => b.classList.remove('activo'));
        document.querySelectorAll('#view-config .seccion').forEach(s => s.classList.remove('activo'));
        btn.classList.add('activo');
        document.getElementById('sec-' + btn.dataset.seccion)?.classList.add('activo');
        if (window.innerWidth <= 768) _cerrarPanel();
      }, { signal });
    });

    document.getElementById('btnToggleMenuConfig')?.addEventListener('click', () => {
      const panel = document.getElementById('panelIzquierdoConfig');
      if (panel?.classList.contains('abierto')) _cerrarPanel();
      else _abrirPanel();
    }, { signal });

    document.getElementById('configOverlay')?.addEventListener('click', _cerrarPanel, { signal });

    _configurarSwipe(signal);
    _configurarAjusteHeader(signal);

    const navContrasenas = document.getElementById('navContrasenas');
    if (navContrasenas) {
      navContrasenas.style.display = Auth.esMasterReal() ? 'flex' : 'none';
    }

    _renderSeccionLocal();
    _renderSeccionZonas();
    _renderSeccionPersonal();
    _renderSeccionImpresoras();
    _renderSeccionContrasenas();

    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'config') {
        _renderSeccionLocal();
        _renderSeccionZonas();
        _renderSeccionPersonal();
      }
    }));
  }

  function limpiar() {
    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (_observerHeader) { _observerHeader.disconnect(); _observerHeader = null; }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
    const main = document.getElementById('view-config');
    if (main) { main.innerHTML = ''; }
  }

  function _abrirPanel() {
    const panel = document.getElementById('panelIzquierdoConfig');
    if (panel) {
      _ajustarPosicionPanel(panel);
      panel.classList.add('abierto');
      document.getElementById('configOverlay')?.classList.add('activo');
    }
  }

  function _cerrarPanel() {
    document.getElementById('panelIzquierdoConfig')?.classList.remove('abierto');
    document.getElementById('configOverlay')?.classList.remove('activo');
  }

  function _calcularTopPanel() {
    const appHeader = document.querySelector('.app-header');
    if (!appHeader) return '0';
    return window.getComputedStyle(appHeader).display === 'none' ? '0' : appHeader.offsetHeight + 'px';
  }

  function _ajustarPosicionPanel(panel) {
    if (!panel || window.innerWidth > 768) return;
    const top = _calcularTopPanel();
    panel.style.top = top;
    panel.style.height = top === '0' ? '100%' : `calc(100% - ${top})`;
  }

  function _configurarAjusteHeader(signal) {
    const appHeader = document.querySelector('.app-header');
    if (!appHeader) return;
    _observerHeader = new MutationObserver(() => {
      const oculto = appHeader.style.display === 'none';
      const top = oculto ? '0' : 'var(--header-h)';
      const h = oculto ? '100%' : 'calc(100% - var(--header-h))';
      const panel = document.getElementById('panelIzquierdoConfig');
      if (panel) { panel.style.top = top; panel.style.height = h; }
    });
    _observerHeader.observe(appHeader, { attributes: true, attributeFilter: ['style'] });
  }

  function _configurarSwipe(signal) {
    const mainLayout = document.getElementById('configMainLayout');
    if (!mainLayout) return;
    let touchStartX = 0, touchStartY = 0;
    mainLayout.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { signal });
    mainLayout.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0 && touchStartX < 40) _abrirPanel();
        else if (dx < 0 && document.getElementById('panelIzquierdoConfig')?.classList.contains('abierto')) _cerrarPanel();
      }
    }, { signal });
  }

  return {
    activar,
    limpiar,
    cargar: activar
  };
})();

export { Config };