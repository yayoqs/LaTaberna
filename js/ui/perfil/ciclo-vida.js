/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/ciclo-vida.js
   Versión: 1.0.2
   Propósito: Ciclo de vida de la vista de perfil modularizada.
              v1.0.2: elimina remoción de clase 'active' en limpiar
                      (causaba que la vista no se mostrara).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';
import { asegurarVista, renderPanelIzquierdo, renderModoVitrina, renderModoEdicion, renderPanelDerecho, aplicarVisibilidadRoles } from './renderer.js';
import { cargarExtras } from './estado.js';

let _abortController = null;
let _desuscripciones = [];
let _observerHeader = null;

async function _renderContenido() {
  const usuario = Auth.obtenerUsuarioActual();
  if (!usuario) return;

  const extras = cargarExtras(usuario.nombre);
  const rol = usuario.rolEfectivo || 'cliente';
  const esStaff = rol !== 'cliente';
  const esAdmin = Auth.esAdmin();
  const esMaster = Auth.esMasterReal();

  renderPanelIzquierdo(usuario, extras);
  renderModoVitrina(usuario, extras);
  renderModoEdicion(usuario, extras, esAdmin, esMaster);
  renderPanelDerecho(usuario, extras);
  aplicarVisibilidadRoles(esStaff, esAdmin);

  // Mostrar/ocultar el modo switch
  const modoSwitch = document.getElementById('perfilModoSwitch');
  if (modoSwitch) modoSwitch.style.display = esStaff ? 'flex' : 'none';
}

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();

  // Listeners de UI
  document.getElementById('btnToggleIzqPerfil')?.addEventListener('click', _toggleIzq, { signal });
  document.getElementById('btnToggleDerPerfil')?.addEventListener('click', _toggleDer, { signal });
  document.getElementById('perfilOverlay')?.addEventListener('click', _cerrarPaneles, { signal });
  document.getElementById('btnEditarPerfil')?.addEventListener('click', _mostrarEdicion, { signal });
  document.getElementById('btnVolverVitrina')?.addEventListener('click', _mostrarVitrina, { signal });

  // Tabs de edición
  document.querySelectorAll('.central-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!tab.classList.contains('visible')) return;
      document.querySelectorAll('.central-tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.central-tab-content').forEach(c => c.classList.remove('activo'));
      tab.classList.add('activo');
      document.getElementById('tab-' + tab.dataset.tab)?.classList.add('activo');
    }, { signal });
  });

  // Modo switch
  document.querySelectorAll('#perfilModoSwitch button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('#perfilModoSwitch button').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
    }, { signal });
  });

  _configurarSwipe(signal);
  _configurarAjusteHeader(signal);

  _desuscripciones.push(EventBus.on('db:inicializada', _renderContenido));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'perfil') _renderContenido();
  }));

  if (Auth.obtenerUsuarioActual()) _renderContenido();
}

export function limpiar() {
  if (_abortController) { _abortController.abort(); _abortController = null; }
  if (_observerHeader) { _observerHeader.disconnect(); _observerHeader = null; }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];

  const main = document.getElementById('view-perfil');
  if (main) {
    main.innerHTML = '';
    // ❌ No remover la clase 'active': eso lo gestiona App.showView
    // main.classList.remove('active');
  }
}

// ── HELPERS DE UI ──────────────────────────────────────
function _toggleIzq() {
  const panel = document.getElementById('panelIzquierdoPerfil');
  if (panel) { _ajustarPosicionPanel(panel); panel.classList.toggle('abierto'); document.getElementById('perfilOverlay')?.classList.toggle('activo'); }
}
function _toggleDer() {
  const panel = document.getElementById('panelDerechoPerfil');
  if (panel) { _ajustarPosicionPanel(panel); panel.classList.toggle('abierto'); document.getElementById('perfilOverlay')?.classList.toggle('activo'); }
}
function _cerrarPaneles() {
  document.getElementById('panelIzquierdoPerfil')?.classList.remove('abierto');
  document.getElementById('panelDerechoPerfil')?.classList.remove('abierto');
  document.getElementById('perfilOverlay')?.classList.remove('activo');
}
function _mostrarEdicion() {
  const vitrina = document.getElementById('modoVitrinaPerfil');
  const edicion = document.getElementById('modoEdicionPerfil');
  if (vitrina) vitrina.style.display = 'none';
  if (edicion) edicion.style.display = 'block';
}
function _mostrarVitrina() {
  const vitrina = document.getElementById('modoVitrinaPerfil');
  const edicion = document.getElementById('modoEdicionPerfil');
  if (edicion) edicion.style.display = 'none';
  if (vitrina) vitrina.style.display = 'flex';
}

function _calcularTopPanel() {
  const appHeader = document.querySelector('.app-header');
  if (!appHeader) return '0';
  return window.getComputedStyle(appHeader).display === 'none' ? '0' : appHeader.offsetHeight + 'px';
}
function _ajustarPosicionPanel(panel) {
  if (!panel || window.innerWidth > 900) return;
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
    const panelIzq = document.getElementById('panelIzquierdoPerfil');
    const panelDer = document.getElementById('panelDerechoPerfil');
    if (panelIzq) { panelIzq.style.top = top; panelIzq.style.height = h; }
    if (panelDer) { panelDer.style.top = top; panelDer.style.height = h; }
  });
  _observerHeader.observe(appHeader, { attributes: true, attributeFilter: ['style'] });
}

function _configurarSwipe(signal) {
  const mainLayout = document.getElementById('perfilMainLayout');
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
      if (dx > 0 && touchStartX < 40) _toggleIzq();
      else if (dx < 0 && touchStartX > window.innerWidth - 40) _toggleDer();
      else if (dx > 0 && document.getElementById('panelDerechoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
      else if (dx < 0 && document.getElementById('panelIzquierdoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
    }
  }, { signal });
}