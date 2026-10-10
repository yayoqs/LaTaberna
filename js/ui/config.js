/* ================================================================
   LaTaberna - Ecosistema Elisekai — UI JS (ES6)
   Archivo: js/ui/config.js
   Versión: 3.4.3
   Propósito: Vista de configuración rediseñada con panel izquierdo,
              gestión de zonas delegada a B1, personal por roles,
              impresoras y contraseñas ocultas temporalmente.
   v3.4.3: agrega botón "Gestionar variantes" en la sección
           Catálogo. Monta el editor de variantes en modal-overlay
           reutilizando el ciclo de vida existente. Al cerrar,
           refresca la sección sin perder el estado de Config.
   v3.4.2: sincroniza Store.config tras guardar.
   v3.4.1: fix de lectura de config con Store vacío.
   v3.4.0: agrega sección Catálogo con kds_colapso_variantes.
   v3.2.9: usa getRow directo por {espacioId}_global.
   v3.3.0: eliminaciones y saneamientos previos del panel.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Auth } from '../auth.js';
import { mostrarToast } from '../utils.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';
import { renderTabAdmin } from './perfil/admin-roles.js';
import { renderZonas } from './mesas/admin-zonas.js';

const Config = (() => {
  let _abortController = null;
  let _desuscripciones = [];
  let _observerHeader = null;

  // Editor de variantes montado en modal, si está abierto.
  let _editorVariantesModulo = null;
  let _contenedorVariantes = null;

  /**
   * Devuelve el config vigente.
   * Prioriza Store.config si tiene datos. Cae a DB.config si el
   * Store tiene {} (default sin bootstrap).
   */
  function _obtenerConfigActual() {
    const configStore = Store.obtenerEstado().config;
    if (configStore && typeof configStore === 'object' && Object.keys(configStore).length > 0) {
      return configStore;
    }
    return DB.config || {};
  }

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
          <button class="nav-btn" data-seccion="catalogo">📚 Catálogo</button>
          <button class="nav-btn" data-seccion="impresoras">🖨️ Impresoras</button>
        </div>
        <div class="panel-central" id="panelCentralConfig">
          <div class="seccion activo" id="sec-local"></div>
          <div class="seccion" id="sec-zonas"></div>
          <div class="seccion" id="sec-personal"></div>
          <div class="seccion" id="sec-catalogo"></div>
          <div class="seccion" id="sec-impresoras"></div>
        </div>
      </div>
      <div class="overlay" id="configOverlay"></div>
    `;

    main.classList.add('active');
  }

  function _renderSeccionLocal() {
    const config = _obtenerConfigActual();
    const sec = document.getElementById('sec-local');
    if (!sec) return;
    sec.innerHTML = `
      <h3><i class="fas fa-store"></i> Datos del Local</h3>
      <div class="campo"><label>Nombre del Local</label><input type="text" id="cfgNombreLocal" value="${config.nombreLocal || ''}"></div>
      <div class="campo"><label>Dirección</label><input type="text" id="cfgDireccion" value="${config.direccion || ''}"></div>
      <div class="campo"><label>CUIT / RUT</label><input type="text" id="cfgCuit" value="${config.cuit || ''}"></div>
      <div class="campo"><label>Pie de ticket</label><input type="text" id="cfgPie" value="${config.pieTicket || ''}"></div>
      <label class="campo-checkbox">
        <input type="checkbox" id="cfgBloquearStock" ${config.bloquearStockInsuficiente !== false ? 'checked' : ''}>
        Bloquear envío si falta stock
      </label>
      <button class="btn-primary" id="btnGuardarConfig"><i class="fas fa-save"></i> Guardar</button>
    `;
  }

  function _renderSeccionZonas() {
    renderZonas('sec-zonas');
  }

  function _renderSeccionCatalogo() {
    const config = _obtenerConfigActual();
    const sec = document.getElementById('sec-catalogo');
    if (!sec) return;

    const colapso = config.kds_colapso_variantes != null ? config.kds_colapso_variantes : 3;

    sec.innerHTML = `
      <h3><i class="fas fa-book"></i> Catálogo</h3>
      <div class="campo">
        <label>Colapsar variantes estéticas en KDS después de N opciones</label>
        <input type="number" id="cfgKdsColapsoVariantes" min="1" max="10" step="1" value="${colapso}">
        <p class="campo-help">
          Si un item trae más de N variantes sin impacto operativo, el KDS las colapsa tras un botón.
          Rango sugerido: 1 a 10.
        </p>
      </div>
      <div class="campo">
        <label>Variantes del catálogo</label>
        <p class="campo-help" style="margin-top:0;margin-bottom:10px;">
          Crea y edita las variantes reutilizables que se asignan a los productos de la carta.
        </p>
        <button class="btn-primary" id="btnGestionarVariantes">
          <i class="fas fa-cog"></i> Gestionar variantes
        </button>
      </div>
      <button class="btn-primary" id="btnGuardarCatalogo"><i class="fas fa-save"></i> Guardar</button>
    `;
  }

  async function _renderSeccionPersonal() {
    const usuarioActual = Auth.obtenerUsuarioActual();
    if (!usuarioActual) {
      mostrarToast('error', 'No hay sesión activa.');
      return;
    }

    const roles = usuarioActual.rolesEfectivos || Auth.obtenerRolesEfectivos() || [];
    const esMaster = roles.includes('master');

    Logger.debug(`[Config] Renderizando sección Personal. esMaster=${esMaster}, roles=${roles.join(', ')}`);

    const contenedor = document.getElementById('sec-personal');
    if (!contenedor) {
      Logger.error('[Config] No se encontró el contenedor sec-personal.');
      return;
    }

    try {
      await renderTabAdmin(usuarioActual, esMaster, 'sec-personal');
    } catch (e) {
      Logger.error('[Config] Error al renderizar sección Personal:', e);
      mostrarToast('error', 'No se pudo cargar la sección Personal.');
      contenedor.innerHTML = `
        <div class="panel-admin">
          <h3><i class="fas fa-exclamation-triangle"></i> Error</h3>
          <p style="font-size:12px; color:var(--color-text-muted);">No se pudo cargar la sección Personal. Revisa la consola.</p>
          <button class="btn-primary" id="btnReintentarPersonal">Reintentar</button>
        </div>
      `;
    }
  }

  function _renderSeccionImpresoras() {
    const config = _obtenerConfigActual();
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

  async function _obtenerConfigPorRowId(rowId) {
    try {
      const doc = await DBAppwrite.baseDeDatos.getRow({
        databaseId: DBAppwrite.idBaseDeDatos,
        tableId: DBAppwrite.COLECCIONES.configuracion,
        rowId
      });
      return { id: doc.$id, clave: doc.clave, valor: doc.valor, espacioId: doc.espacioId };
    } catch (e) {
      if (e.code === 404) return null;
      Logger.warn(`[Config] Error al obtener config ${rowId}:`, e.message);
      return null;
    }
  }

  async function _guardarConfig() {
    const nombreLocal = document.getElementById('cfgNombreLocal')?.value.trim() ?? '';
    if (!nombreLocal) {
      mostrarToast('error', 'El nombre del local no puede estar vacío.');
      return;
    }

    const colapsoRaw = document.getElementById('cfgKdsColapsoVariantes')?.value;
    const colapsoParsed = parseInt(colapsoRaw, 10);
    const kdsColapsoVariantes = isNaN(colapsoParsed)
      ? 3
      : Math.max(1, Math.min(10, colapsoParsed));

    let config = _obtenerConfigActual();

    config = {
      ...config,
      nombreLocal,
      direccion: document.getElementById('cfgDireccion')?.value.trim() ?? '',
      cuit: document.getElementById('cfgCuit')?.value.trim() ?? '',
      pieTicket: document.getElementById('cfgPie')?.value.trim() ?? '',
      impCocinaIP: document.getElementById('impCocinaIP')?.value.trim() || config.impCocinaIP,
      impBarraIP: document.getElementById('impBarraIP')?.value.trim() || config.impBarraIP,
      impCajaIP: document.getElementById('impCajaIP')?.value.trim() || config.impCajaIP,
      bloquearStockInsuficiente: document.getElementById('cfgBloquearStock')?.checked ?? true,
      kds_colapso_variantes: kdsColapsoVariantes
    };

    delete config.cantidadMesas;

    DB.config = config;
    DB.saveConfig();

    Store.despachar({ type: 'CONFIG_INICIALIZAR', payload: config });

    EventBus.emit('config:actualizada');
    mostrarToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        const espacioId = Auth.obtenerLocalActivo?.()?.id || 'PubPrueba';
        const nuevoRowId = `${espacioId}_global`;
        const datosConfig = {
          clave: 'global',
          valor: JSON.stringify(config),
          espacioId
        };

        Logger.debug(`[Config] Guardando config en rowId ${nuevoRowId}`);

        let docDestino = await _obtenerConfigPorRowId(nuevoRowId);

        if (docDestino) {
          Logger.info(`[Config] Doc ${nuevoRowId} encontrado. Actualizando.`);
          await DBAppwrite.actualizar('configuracion', nuevoRowId, datosConfig, null, true);
        } else {
          Logger.info(`[Config] Doc ${nuevoRowId} no existe. Creando.`);
          try {
            await DBAppwrite.crear('configuracion', nuevoRowId, datosConfig, null, null, true);
          } catch (e) {
            if (e.code === 409) {
              Logger.info('[Config] Doc creado por otra pestaña. Actualizando.');
              await DBAppwrite.actualizar('configuracion', nuevoRowId, datosConfig, null, true);
            } else {
              throw e;
            }
          }

          const legacy = await _obtenerConfigPorRowId('global');
          if (legacy) {
            Logger.info('[Config] Legacy "global" detectado. Eliminando.');
            try {
              await DBAppwrite.eliminar('configuracion', 'global', null, true);
            } catch (e) {
              Logger.warn('[Config] No se pudo eliminar legacy:', e.message);
            }
          }
        }
      } catch (e) {
        Logger.warn('[Config] Error al sincronizar configuración:', e.message, e.code, e.type);
        mostrarToast('error', 'No se pudo guardar la configuración en el servidor.');
      }
    }
  }

  /* ── Editor de variantes (modal) ─────────────────────── */

  async function _abrirEditorVariantes() {
    if (_editorVariantesModulo) return;

    _contenedorVariantes = document.createElement('div');
    _contenedorVariantes.id = 'contenedor-variantes-modal';
    document.body.appendChild(_contenedorVariantes);

    try {
      const modulo = await import('./carta-editor/variantes/ciclo-vida.js');
      _editorVariantesModulo = modulo;

      await modulo.montar(_contenedorVariantes, {
        onCerrar: _cerrarEditorVariantes
      });
    } catch (e) {
      Logger.error('[Config] Error al abrir editor de variantes:', e);
      mostrarToast('error', 'No se pudo abrir el editor de variantes.');
      _cerrarEditorVariantes();
    }
  }

  function _cerrarEditorVariantes(refrescarCatalogo = true) {
    if (_editorVariantesModulo) {
      try { _editorVariantesModulo.desmontar(); }
      catch (e) { Logger.warn('[Config] Error al desmontar editor de variantes:', e); }
      _editorVariantesModulo = null;
    }
    if (_contenedorVariantes) {
      _contenedorVariantes.remove();
      _contenedorVariantes = null;
    }
    if (refrescarCatalogo && document.getElementById('sec-catalogo')) {
      _renderSeccionCatalogo();
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

    document.getElementById('panelCentralConfig')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'btnGuardarConfig' || btn.id === 'btnGuardarCatalogo') _guardarConfig();
      else if (btn.id === 'btnGestionarVariantes') _abrirEditorVariantes();
      else if (btn.id === 'btnReintentarPersonal') location.reload();
    }, { signal });

    window.addEventListener('resize', _cerrarPanelSiDesktop, { signal });

    _configurarSwipe(signal);
    _configurarAjusteHeader(signal);

    _renderSeccionLocal();
    _renderSeccionZonas();
    _renderSeccionPersonal();
    _renderSeccionCatalogo();
    _renderSeccionImpresoras();

    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'config') {
        _renderSeccionLocal();
        _renderSeccionZonas();
        _renderSeccionPersonal();
        _renderSeccionCatalogo();
      }
    }));
  }

  function limpiar() {
    _cerrarEditorVariantes(false);

    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (_observerHeader) { _observerHeader.disconnect(); _observerHeader = null; }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
    const main = document.getElementById('view-config');
    if (main) { main.innerHTML = ''; }
  }

  function _cerrarPanelSiDesktop() {
    if (window.innerWidth > 768) _cerrarPanel();
  }

  function _abrirPanel() {
    if (window.innerWidth > 768) return;
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
    return window.getComputedStyle(appHeader).display === 'none' ? '0' : 'var(--header-h)';
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