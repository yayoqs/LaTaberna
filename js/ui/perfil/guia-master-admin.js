/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/guia-master-admin.js
   Versión: 5.1.0
   Propósito: Guía master interactiva para agregar un admin.
              Spotlight con bloqueo, detección de acción real.
              v5.1.0: encapsula clases CSS con prefijo guia-taberna-*
                      para evitar colisiones.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';

const ID_GUIA = 'guia-master-admin';
const NOMBRE_GUIA = 'Agregar un admin';
const ROL_REQUERIDO = 'master';

const CLASE_SPOTLIGHT = 'guia-taberna-spotlight-overlay';
const CLASE_TOOLTIP = 'guia-taberna-tooltip';
const CLASE_TOOLTIP_CENTRADO = 'guia-taberna-tooltip-centrado';
const CLASE_HEADER = 'guia-taberna-tooltip-header';
const CLASE_ICONO = 'guia-taberna-paso-icono';
const CLASE_BTN_CERRAR = 'guia-taberna-btn-cerrar';
const CLASE_BODY = 'guia-taberna-tooltip-body';
const CLASE_INSTRUCCION = 'guia-taberna-instruccion';
const CLASE_FOOTER = 'guia-taberna-tooltip-footer';
const CLASE_BTN_ANTERIOR = 'guia-taberna-btn-anterior';
const CLASE_BTN_CONTINUAR = 'guia-taberna-btn-continuar';

const PASOS = [
  { id: 'objetivo', tipo: 'explicacion', titulo: 'Objetivo de la guía', descripcion: 'Vas a aprender a agregar o convertir un usuario en administrador.', instruccion: 'Un admin puede gestionar personal, configuración y más.', icono: '🎯', objetivo: null, evento: null, avanceAutomatico: false, validacion: null, siguiente: 'ir-configuracion' },
  { id: 'ir-configuracion', tipo: 'accion', titulo: 'Ir a Configuración', descripcion: 'Toca el botón Configuración.', instruccion: 'Busca el ícono de engranaje.', icono: '⚙️', objetivo: '.nav-btn[data-view="config"]', evento: 'click', avanceAutomatico: true, validacion: null, siguiente: 'desplegar-barra' },
  { id: 'desplegar-barra', tipo: 'accion', titulo: 'Desplegar barra lateral', descripcion: 'Toca el botón de menú.', instruccion: 'En móvil es ☰.', icono: '☰', objetivo: '#btnToggleMenuConfig', evento: 'click', avanceAutomatico: true, validacion: null, siguiente: 'ir-personal' },
  { id: 'ir-personal', tipo: 'accion', titulo: 'Ir a Personal', descripcion: 'Toca la pestaña Personal.', instruccion: 'Está en el panel izquierdo.', icono: '👥', objetivo: '#view-config .nav-btn[data-seccion="personal"]', evento: 'click', avanceAutomatico: true, validacion: null, siguiente: 'buscar-o-crear' },
  { id: 'buscar-o-crear', tipo: 'accion', titulo: 'Buscar o crear usuario', descripcion: 'Usa búsqueda o "Nuevo personal".', instruccion: 'Puedes buscar por nombre.', icono: '🔍', objetivo: '#btnNuevoStaff', evento: 'click', avanceAutomatico: true, validacion: null, siguiente: 'asignar-rol-admin' },
  { id: 'asignar-rol-admin', tipo: 'accion', titulo: 'Asignar rol admin', descripcion: 'Marca casilla Admin.', instruccion: 'Solo máster.', icono: '🛡️', objetivo: '#altaRolesChecks input[value="admin"]', evento: 'change', avanceAutomatico: true, validacion: () => document.querySelector('#altaRolesChecks input[value="admin"]')?.checked === true, siguiente: 'definir-rol-principal' },
  { id: 'definir-rol-principal', tipo: 'accion', titulo: 'Definir rol principal', descripcion: 'Selecciona admin.', instruccion: 'Rol principal.', icono: '⭐', objetivo: '#altaRolPrincipal', evento: 'change', avanceAutomatico: true, validacion: () => document.querySelector('#altaRolPrincipal')?.value === 'admin', siguiente: 'verificar-acceso' },
  { id: 'verificar-acceso', tipo: 'explicacion', titulo: 'Verificar acceso', descripcion: 'Confirma inicio de sesión.', instruccion: 'Debe entrar a Configuración.', icono: '🔐', objetivo: null, evento: null, avanceAutomatico: false, validacion: null, siguiente: 'cierre' },
  { id: 'cierre', tipo: 'explicacion', titulo: 'Cierre', descripcion: '¡Listo!', instruccion: 'Puedes volver a activar en Perfil → Guías.', icono: '✅', objetivo: null, evento: null, avanceAutomatico: false, validacion: null, siguiente: null }
];

function _claveLocalStorage(usuarioId) { return `pubpos_guia_${ID_GUIA}_${usuarioId}`; }

export function obtenerEstado(usuarioId) {
  try {
    const raw = localStorage.getItem(_claveLocalStorage(usuarioId));
    if (raw) {
      const estado = JSON.parse(raw);
      return { activa: estado.activa !== false, estado: estado.estado || 'pendiente', pasoActual: estado.pasoActual || 0, pasoActualId: estado.pasoActualId || PASOS[0].id, minimizada: estado.minimizada || false };
    }
  } catch (e) { Logger.warn('[guia-master-admin] Error al leer estado:', e); }
  return { activa: true, estado: 'pendiente', pasoActual: 0, pasoActualId: PASOS[0].id, minimizada: false };
}

function _guardarEstado(usuarioId, estado) {
  try { localStorage.setItem(_claveLocalStorage(usuarioId), JSON.stringify(estado)); } catch (e) { Logger.warn('[guia-master-admin] Error al guardar estado:', e); }
}

export function estaDisponible(rolesEfectivos) { return Array.isArray(rolesEfectivos) && rolesEfectivos.includes(ROL_REQUERIDO); }

function _emitir(evento, payload) {
  try { EventBus.emit(evento, payload); Logger.info(`[guia-master-admin] Evento ${evento} emitido.`); } catch (e) { Logger.warn('[guia-master-admin] Error al emitir evento:', e); }
}

let _overlaySpotlight = null;
let _tooltip = null;
let _usuarioActual = null;
let _desuscripcionVista = null;
let _listenerObjetivo = null;
let _onScroll = null;
let _objetivoActual = null;
let _pasoActualId = null;

function _limpiarSpotlight() {
  if (_overlaySpotlight) { _overlaySpotlight.remove(); _overlaySpotlight = null; }
  if (_tooltip) { _tooltip.remove(); _tooltip = null; }
  _detenerMonitoreoScroll();
  _limpiarListenerObjetivo();
  _objetivoActual = null;
}

function _limpiarListenerObjetivo() {
  if (_listenerObjetivo) {
    const { elemento, evento, handler } = _listenerObjetivo;
    elemento?.removeEventListener(evento, handler);
    _listenerObjetivo = null;
  }
}

function _generarClipPath(rect) {
  const padding = 4;
  const x0 = rect.left - padding;
  const y0 = rect.top - padding;
  const x1 = rect.right + padding;
  const y1 = rect.bottom + padding;

  return `polygon(
    0 0,
    100% 0,
    100% 100%,
    0 100%,
    0 0,
    ${x0}px ${y0}px,
    ${x0}px ${y1}px,
    ${x1}px ${y1}px,
    ${x1}px ${y0}px,
    ${x0}px ${y0}px
  )`;
}

function _reposicionar() {
  if (_objetivoActual && _overlaySpotlight && _tooltip) {
    const rect = _objetivoActual.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    if (rect.top < 0 || rect.bottom > viewportHeight || rect.left < 0 || rect.right > viewportWidth) {
      _objetivoActual.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      setTimeout(() => _reposicionar(), 400);
      return;
    }

    _overlaySpotlight.style.clipPath = _generarClipPath(rect);

    const tooltipRect = _tooltip.getBoundingClientRect();
    const margin = 10;
    let top = rect.bottom + margin;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    if (left + tooltipRect.width > window.innerWidth - margin) left = window.innerWidth - tooltipRect.width - margin;
    if (left < margin) left = margin;
    if (top + tooltipRect.height > window.innerHeight - margin) top = rect.top - tooltipRect.height - margin;
    if (top < margin) top = margin;
    _tooltip.style.top = `${top}px`;
    _tooltip.style.left = `${left}px`;
  }
}

function _iniciarMonitoreoScroll() {
  if (_onScroll) return;
  _onScroll = () => _reposicionar();
  window.addEventListener('scroll', _onScroll, true);
  window.addEventListener('resize', _onScroll, true);
}

function _detenerMonitoreoScroll() {
  if (_onScroll) { window.removeEventListener('scroll', _onScroll, true); window.removeEventListener('resize', _onScroll, true); _onScroll = null; }
}

function _crearOverlayBloqueo(elemento) {
  _overlaySpotlight = document.createElement('div');
  _overlaySpotlight.className = CLASE_SPOTLIGHT;
  _overlaySpotlight.style.position = 'fixed';
  _overlaySpotlight.style.top = '0';
  _overlaySpotlight.style.left = '0';
  _overlaySpotlight.style.width = '100vw';
  _overlaySpotlight.style.height = '100vh';
  _overlaySpotlight.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  _overlaySpotlight.style.zIndex = '9998';
  _overlaySpotlight.style.pointerEvents = 'auto';
  _overlaySpotlight.style.clipPath = _generarClipPath(elemento.getBoundingClientRect());
  document.body.appendChild(_overlaySpotlight);
}

function _crearSpotlight(elemento, paso) {
  _limpiarSpotlight();
  _objetivoActual = elemento;

  _crearOverlayBloqueo(elemento);

  _tooltip = document.createElement('div');
  _tooltip.className = CLASE_TOOLTIP;
  _tooltip.style.pointerEvents = 'none';

  const footerHTML = paso.tipo === 'explicacion'
    ? `<div class="${CLASE_FOOTER}" style="pointer-events:auto;"><button class="${CLASE_BTN_ANTERIOR}">Anterior</button><button class="${CLASE_BTN_CONTINUAR}">Continuar</button></div>`
    : `<div class="${CLASE_FOOTER}" style="pointer-events:auto;"><button class="${CLASE_BTN_ANTERIOR}">Anterior</button></div>`;

  _tooltip.innerHTML = `
    <div class="${CLASE_HEADER}">
      <span class="${CLASE_ICONO}">${paso.icono}</span>
      <strong>${paso.titulo}</strong>
      <button class="${CLASE_BTN_CERRAR}" title="Cerrar guía">✕</button>
    </div>
    <div class="${CLASE_BODY}"><p>${paso.descripcion}</p><div class="${CLASE_INSTRUCCION}">${paso.instruccion}</div></div>
    ${footerHTML}
  `;

  document.body.appendChild(_tooltip);
  _reposicionar();
  _iniciarMonitoreoScroll();

  _tooltip.querySelector('.' + CLASE_BTN_CONTINUAR)?.addEventListener('click', (e) => { e.stopPropagation(); avanzarA(paso.siguiente); });
  _tooltip.querySelector('.' + CLASE_BTN_ANTERIOR)?.addEventListener('click', (e) => { e.stopPropagation(); retroceder(); });
  _tooltip.querySelector('.' + CLASE_BTN_CERRAR)?.addEventListener('click', (e) => { e.stopPropagation(); salir(); });
}

function _crearTooltipCentrado(paso) {
  _limpiarSpotlight();
  _objetivoActual = null;

  _tooltip = document.createElement('div');
  _tooltip.className = `${CLASE_TOOLTIP} ${CLASE_TOOLTIP_CENTRADO}`;
  _tooltip.style.pointerEvents = 'none';

  _tooltip.innerHTML = `
    <div class="${CLASE_HEADER}">
      <span class="${CLASE_ICONO}">${paso.icono}</span>
      <strong>${paso.titulo}</strong>
      <button class="${CLASE_BTN_CERRAR}" title="Cerrar guía">✕</button>
    </div>
    <div class="${CLASE_BODY}"><p>${paso.descripcion}</p><div class="${CLASE_INSTRUCCION}">${paso.instruccion}</div></div>
    <div class="${CLASE_FOOTER}" style="pointer-events:auto;">
      <button class="${CLASE_BTN_ANTERIOR}">Anterior</button>
      ${paso.siguiente ? `<button class="${CLASE_BTN_CONTINUAR}">Continuar</button>` : `<button class="${CLASE_BTN_CERRAR}">Cerrar</button>`}
    </div>
  `;
  document.body.appendChild(_tooltip);
  _tooltip.querySelector('.' + CLASE_BTN_CONTINUAR)?.addEventListener('click', (e) => { e.stopPropagation(); avanzarA(paso.siguiente); });
  _tooltip.querySelector('.' + CLASE_BTN_ANTERIOR)?.addEventListener('click', (e) => { e.stopPropagation(); retroceder(); });
  _tooltip.querySelector('.' + CLASE_BTN_CERRAR)?.addEventListener('click', (e) => { e.stopPropagation(); salir(); });
}

function _configurarDeteccionPaso(paso) {
  _limpiarListenerObjetivo();
  if (!paso.objetivo || !paso.evento || !paso.avanceAutomatico) return;
  const objetivo = document.querySelector(paso.objetivo);
  if (!objetivo) {
    Logger.warn(`[guia-master-admin] Objetivo no encontrado: ${paso.objetivo}`);
    return;
  }

  const handler = () => {
    if (paso.validacion && !paso.validacion()) return;
    avanzarA(paso.siguiente);
  };

  objetivo.addEventListener(paso.evento, handler);
  _listenerObjetivo = { elemento: objetivo, evento: paso.evento, handler };
}

function _renderizarGuia() {
  _limpiarSpotlight();
  _limpiarListenerObjetivo();
  if (_desuscripcionVista) { _desuscripcionVista(); _desuscripcionVista = null; }

  const usuarioId = _usuarioActual?.usuarioId || _usuarioActual?.nombre || 'master';
  const estado = obtenerEstado(usuarioId);

  if (!estado.activa || estado.estado === 'completada') return;

  const paso = PASOS.find(p => p.id === estado.pasoActualId) || PASOS[estado.pasoActual] || PASOS[0];
  _pasoActualId = paso.id;

  if (paso.id === 'ir-personal') {
    const panel = document.getElementById('panelIzquierdoConfig');
    const overlay = document.getElementById('configOverlay');
    if (panel && !panel.classList.contains('abierto')) {
      panel.classList.add('abierto');
      if (overlay) overlay.classList.add('activo');
      setTimeout(() => _renderizarGuia(), 500);
      return;
    }
  }

  if (paso.tipo === 'explicacion') {
    _crearTooltipCentrado(paso);
  } else {
    const objetivo = document.querySelector(paso.objetivo);
    if (objetivo) {
      _crearSpotlight(objetivo, paso);
      _configurarDeteccionPaso(paso);
    } else {
      setTimeout(() => {
        const objetivoRetry = document.querySelector(paso.objetivo);
        if (objetivoRetry) {
          _crearSpotlight(objetivoRetry, paso);
          _configurarDeteccionPaso(paso);
        } else {
          _crearTooltipCentrado(paso);
        }
      }, 300);
    }
  }
}

export function iniciar(usuarioActual) {
  _usuarioActual = usuarioActual;
  const usuarioId = usuarioActual?.usuarioId || usuarioActual?.nombre || 'master';
  const estado = obtenerEstado(usuarioId);

  if (estado.estado === 'completada') {
    estado.estado = 'pendiente';
    estado.pasoActualId = PASOS[0].id;
    estado.pasoActual = 0;
    _guardarEstado(usuarioId, estado);
  } else if (estado.estado === 'pendiente') {
    estado.estado = 'en progreso';
    estado.pasoActualId = PASOS[0].id;
    estado.pasoActual = 0;
    _guardarEstado(usuarioId, estado);
  }

  _renderizarGuia();
  _suscribirVista();
  _emitir('guia:iniciada', { guia: ID_GUIA, rol: ROL_REQUERIDO });
}

export function avanzarA(pasoId) {
  if (!pasoId) { salir(); return; }
  const usuarioId = _usuarioActual?.usuarioId || _usuarioActual?.nombre || 'master';
  const estado = obtenerEstado(usuarioId);
  const index = PASOS.findIndex(p => p.id === pasoId);
  if (index === -1) return;
  estado.pasoActualId = pasoId;
  estado.pasoActual = index;
  if (pasoId === 'cierre') {
    estado.estado = 'completada';
    _limpiarListenerObjetivo();
    _limpiarSpotlight();
    _desuscribirVista();
    _emitir('guia:completada', { guia: ID_GUIA, rol: ROL_REQUERIDO });
  } else {
    estado.estado = 'en progreso';
    _guardarEstado(usuarioId, estado);
    _limpiarListenerObjetivo();
    _renderizarGuia();
    _emitir('guia:paso_completado', { guia: ID_GUIA, rol: ROL_REQUERIDO, paso: pasoId });
  }
}

export function retroceder() {
  const usuarioId = _usuarioActual?.usuarioId || _usuarioActual?.nombre || 'master';
  const estado = obtenerEstado(usuarioId);
  const index = PASOS.findIndex(p => p.id === estado.pasoActualId);
  if (index > 0) {
    const pasoAnterior = PASOS[index - 1];
    estado.pasoActualId = pasoAnterior.id;
    estado.pasoActual = index - 1;
    estado.estado = 'en progreso';
    _guardarEstado(usuarioId, estado);
    _limpiarListenerObjetivo();
    _renderizarGuia();
  }
}

export function salir() {
  const usuarioId = _usuarioActual?.usuarioId || _usuarioActual?.nombre || 'master';
  const estado = obtenerEstado(usuarioId);
  const pasoActual = estado.pasoActual || 0;
  _limpiarListenerObjetivo();
  _limpiarSpotlight();
  _desuscribirVista();
  mostrarToast('info', 'Puedes volver a encontrar esta guía en tu Perfil, en la sección Guías.');
  _emitir('guia:abandonada', { guia: ID_GUIA, rol: ROL_REQUERIDO, pasoActual });
}

export function restaurarDesdeSesion(usuarioActual) { /* no restaura */ }

function _suscribirVista() {
  if (!_desuscripcionVista) {
    _desuscripcionVista = EventBus.on('vista:cambiada', () => {
      _renderizarGuia();
    });
  }
}

function _desuscribirVista() {
  if (_desuscripcionVista) {
    _desuscripcionVista();
    _desuscripcionVista = null;
  }
}

export function renderSeccionGuias(usuarioActual) {
  const usuarioId = usuarioActual?.usuarioId || usuarioActual?.nombre || 'master';
  const rolesEfectivos = usuarioActual?.rolesEfectivos || [];
  if (!estaDisponible(rolesEfectivos)) return '';
  const estado = obtenerEstado(usuarioId);
  const estadoLabel = estado.estado === 'pendiente' ? 'pendiente' : estado.estado === 'en progreso' ? 'en progreso' : 'completada';
  const botonTexto = estado.estado === 'pendiente' ? 'Iniciar' : estado.estado === 'en progreso' ? 'Continuar' : 'Reiniciar';
  return `
    <div class="seccion-guias" id="perfilSeccionGuias">
      <h4>Guías</h4>
      <div class="guia-card ${estado.activa ? '' : 'inactiva'}">
        <div class="guia-card-header">
          <div class="guia-nombre"><span class="guia-icono">🛡️</span><strong>${NOMBRE_GUIA}</strong></div>
          <label class="switch guia-switch"><input type="checkbox" data-guia-switch="${ID_GUIA}" ${estado.activa ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <div class="guia-estado ${estado.estado}">${estadoLabel}</div>
        ${estado.activa ? `<button class="btn-guia" data-guia-accion="${botonTexto.toLowerCase()}">${botonTexto}</button>` : ''}
      </div>
    </div>`;
}

export function inicializarListenersGuias(usuarioActual) {
  const seccion = document.getElementById('perfilSeccionGuias');
  if (!seccion) return;
  seccion.querySelectorAll('[data-guia-switch]').forEach(sw => {
    sw.addEventListener('change', () => {
      const activa = sw.checked;
      const usuarioId = usuarioActual?.usuarioId || usuarioActual?.nombre;
      const estado = obtenerEstado(usuarioId);
      estado.activa = activa;
      _guardarEstado(usuarioId, estado);
      const contenedor = document.getElementById('perfilGuias');
      if (contenedor) {
        contenedor.innerHTML = renderSeccionGuias(usuarioActual);
        inicializarListenersGuias(usuarioActual);
      }
    });
  });
  seccion.querySelectorAll('[data-guia-accion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.guiaAccion;
      if (accion === 'iniciar' || accion === 'continuar') {
        iniciar(usuarioActual);
      } else if (accion === 'reiniciar') {
        reiniciar(usuarioActual);
        const contenedor = document.getElementById('perfilGuias');
        if (contenedor) {
          contenedor.innerHTML = renderSeccionGuias(usuarioActual);
          inicializarListenersGuias(usuarioActual);
        }
      }
    });
  });
}

export function reiniciar(usuarioActual) {
  _usuarioActual = usuarioActual;
  const usuarioId = usuarioActual?.usuarioId || usuarioActual?.nombre || 'master';
  const estado = { activa: true, estado: 'pendiente', pasoActual: 0, pasoActualId: PASOS[0].id, minimizada: false };
  _guardarEstado(usuarioId, estado);
  _limpiarListenerObjetivo();
  _limpiarSpotlight();
  _desuscribirVista();
  _emitir('guia:reiniciada', { guia: ID_GUIA, rol: ROL_REQUERIDO });
}