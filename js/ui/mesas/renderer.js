/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/renderer.js
   Versión: 1.1.1
   Propósito: Renderizado de la grilla, tarjetas, popover.
              Migración a Store.obtenerEstado.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { ICONOS, LABELS, ZONA_COLORS } from './constantes.js';
import { getNotificaciones, removeNotificacion } from './notificaciones.js';
import { getEstadoComandas, colorEstado } from './estado-comandas.js';

let _modoSeleccion = false;
let _mesasSeleccionadas = new Set();
let _zonaActiva = 'todas';
let _longPressTimer = null;
let _longPressMesa = null;
let _popoverCloseListeners = [];

function _limpiarPopoverListeners() {
  _popoverCloseListeners.forEach(fn => fn());
  _popoverCloseListeners = [];
}

export function setModoSeleccion(valor) { _modoSeleccion = valor; }
export function isModoSeleccion() { return _modoSeleccion; }
export function getMesasSeleccionadas() { return _mesasSeleccionadas; }
export function limpiarSeleccion() { _mesasSeleccionadas.clear(); }
export function setZonaActiva(zona) { _zonaActiva = zona; }
export function getZonaActiva() { return _zonaActiva; }

function _getZonaColor(zonaNombre) {
  const zonas = (Store.obtenerEstado().config && Store.obtenerEstado().config.zonas) || [];
  const idx = zonas.findIndex(z => z.nombre === zonaNombre);
  return ZONA_COLORS[idx >= 0 ? idx % ZONA_COLORS.length : 0];
}

export function renderZoneButtons() {
  const container = document.getElementById('zonaButtonsContainer');
  if (!container) return;

  const zonas = (Store.obtenerEstado().config && Store.obtenerEstado().config.zonas) || [];
  container.innerHTML = '';

  const btnTodas = document.createElement('button');
  btnTodas.className = `nav-btn zona-btn ${_zonaActiva === 'todas' ? 'active' : ''}`;
  btnTodas.innerHTML = '<i class="fas fa-globe"></i> Todas';
  btnTodas.addEventListener('click', () => {
    _zonaActiva = 'todas';
    renderZoneButtons();
    renderGrid();
  });
  container.appendChild(btnTodas);

  zonas.forEach(z => {
    const btn = document.createElement('button');
    btn.className = `nav-btn zona-btn ${_zonaActiva === z.nombre ? 'active' : ''}`;
    btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${z.nombre.charAt(0).toUpperCase() + z.nombre.slice(1)}`;
    btn.addEventListener('click', () => {
      _zonaActiva = z.nombre;
      renderZoneButtons();
      renderGrid();
    });
    container.appendChild(btn);
  });
}

export function renderGrid() {
  const grid = document.getElementById('mesasGrid');
  if (!grid) return;

  let mesas = Store.obtenerEstado().mesas || [];
  mesas = mesas.filter(m => m.estado !== 'fusionada');
  if (_zonaActiva !== 'todas') {
    mesas = mesas.filter(m => m.zona === _zonaActiva);
  }
  mesas.sort((a, b) => {
    const numA = a.esVirtual && a.mesasFusionadas && a.mesasFusionadas.length > 0
      ? Math.min(...a.mesasFusionadas)
      : (typeof a.numero === 'number' ? a.numero : 9999);
    const numB = b.esVirtual && b.mesasFusionadas && b.mesasFusionadas.length > 0
      ? Math.min(...b.mesasFusionadas)
      : (typeof b.numero === 'number' ? b.numero : 9999);
    return numA - numB;
  });

  grid.innerHTML = '';

  mesas.forEach(mesa => {
    const card = document.createElement('article');
    let clases = `mesa-card ${mesa.estado}`;
    if (mesa.esVirtual) clases += ' mesa-virtual';
    card.className = clases;

    const colorZona = _getZonaColor(mesa.zona || 'salon');
    card.style.borderLeft = `5px solid ${colorZona}`;
    card.style.background = `linear-gradient(135deg, ${colorZona}10 0%, var(--color-card) 100%)`;

    const puedeSeleccionar = _modoSeleccion && 
                             (mesa.estado === 'libre' || mesa.estado === 'ocupada' || mesa.estado === 'esperando') && 
                             !mesa.esVirtual;

    card.innerHTML = _htmlMesa(mesa, puedeSeleccionar, colorZona);

    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('.precarga-badge') || e.target.closest('.micro-badge') || e.target.closest('.esperando-cliente-badge')) return;
      _longPressMesa = mesa.numero;
      _longPressTimer = setTimeout(() => {
        mostrarPopover(mesa, card);
        _longPressTimer = null;
      }, 400);
    });

    card.addEventListener('mouseup', (e) => {
      if (_longPressTimer) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
        if (_longPressMesa === mesa.numero && !e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge') && !e.target.closest('.esperando-cliente-badge')) {
          if (puedeSeleccionar) {
            const cb = card.querySelector('.mesa-checkbox');
            if (cb) {
              cb.checked = !cb.checked;
              if (cb.checked) _mesasSeleccionadas.add(mesa.numero);
              else _mesasSeleccionadas.delete(mesa.numero);
            }
          } else {
            EventBus.emit('mesa:seleccionada', mesa.numero);
          }
        }
      }
      _longPressMesa = null;
    });

    card.addEventListener('mouseleave', () => {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; _longPressMesa = null; }
    });

    card.addEventListener('touchstart', (e) => {
      if (e.target.closest('.precarga-badge') || e.target.closest('.micro-badge') || e.target.closest('.esperando-cliente-badge')) return;
      _longPressMesa = mesa.numero;
      _longPressTimer = setTimeout(() => {
        mostrarPopover(mesa, card);
        _longPressTimer = null;
      }, 400);
    });

    card.addEventListener('touchend', (e) => {
      if (_longPressTimer) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
        if (_longPressMesa === mesa.numero && !e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge') && !e.target.closest('.esperando-cliente-badge')) {
          if (puedeSeleccionar) {
            const cb = card.querySelector('.mesa-checkbox');
            if (cb) { cb.checked = !cb.checked; if (cb.checked) _mesasSeleccionadas.add(mesa.numero); else _mesasSeleccionadas.delete(mesa.numero); }
          } else {
            EventBus.emit('mesa:seleccionada', mesa.numero);
          }
        }
      }
      _longPressMesa = null;
    });

    card.addEventListener('touchmove', () => {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; _longPressMesa = null; }
    });

    card.addEventListener('click', (e) => {
      const badge = e.target.closest('.precarga-badge');
      if (badge) {
        e.stopPropagation();
        const notificaciones = getNotificaciones(mesa.numero);
        const precarga = notificaciones.find(n => n.tipo === 'precarga');
        if (precarga) EventBus.emit('mesa:badge_click', { mesa: mesa.numero, precargaId: precarga.precargaId });
        return;
      }
      const checkbox = e.target.closest('.mesa-checkbox');
      if (checkbox) {
        e.stopPropagation();
        if (checkbox.checked) _mesasSeleccionadas.add(mesa.numero);
        else _mesasSeleccionadas.delete(mesa.numero);
        return;
      }
    });

    grid.appendChild(card);
  });
}

function _htmlMesa(mesa, puedeSeleccionar, colorZona) {
  const notificaciones = getNotificaciones(mesa.numero);
  let badgeHTML = '';
  const precargaNotif = notificaciones.find(n => n.tipo === 'precarga');
  if (precargaNotif) {
    const cant = precargaNotif.cantidad || 0;
    badgeHTML = `<span class="precarga-badge" title="Precarga pendiente"><i class="fas fa-bell"></i> ${cant}</span>`;
  }

  let esperandoHTML = '';
  const esperaNotif = notificaciones.find(n => n.tipo === 'esperando');
  if (esperaNotif && mesa.estado === 'libre' && mesa.permite_prepedidos === false) {
    esperandoHTML = `<span class="esperando-cliente-badge" title="Cliente esperando validación"><i class="fas fa-clock"></i></span>`;
  } else if (esperaNotif) {
    removeNotificacion(mesa.numero, 'esperando');
  }

  const estados = getEstadoComandas(mesa.numero);
  const microCocina = `<span class="micro-badge micro-cocina" style="background:${colorEstado(estados.cocina)};" title="Cocina: ${estados.cocina}"><i class="fas fa-utensils"></i></span>`;
  const microBarra = `<span class="micro-badge micro-barra" style="background:${colorEstado(estados.barra)};" title="Barra: ${estados.barra}"><i class="fas fa-glass-martini-alt"></i></span>`;

  const icono = ICONOS[mesa.estado] || 'fa-chair';
  const numeroMostrado = mesa.esVirtual && mesa.mesasFusionadas ? mesa.mesasFusionadas.join(' + ') : mesa.numero;

  if (puedeSeleccionar) {
    const checked = _mesasSeleccionadas.has(mesa.numero) ? 'checked' : '';
    return `
      <input type="checkbox" class="mesa-checkbox" data-num="${mesa.numero}" ${checked}>
      <i class="fas ${icono} mesa-icon"></i>
      <strong class="mesa-numero">${numeroMostrado}</strong>
      <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
      <div class="micro-insignias">${microCocina}${microBarra}</div>
      ${badgeHTML}${esperandoHTML}
      <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>`;
  } else {
    return `
      <i class="fas ${icono} mesa-icon"></i>
      <strong class="mesa-numero">${numeroMostrado}</strong>
      <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
      ${mesa.esVirtual ? '<span class="mesa-virtual-badge"><i class="fas fa-link"></i> Unión</span>' : ''}
      <div class="micro-insignias">${microCocina}${microBarra}</div>
      ${badgeHTML}${esperandoHTML}
      <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>`;
  }
}

export function mostrarPopover(mesa, card) {
  const cont = document.getElementById('popoverContainer');
  if (!cont) return;

  _limpiarPopoverListeners();

  const rect = card.getBoundingClientRect();
  const estados = getEstadoComandas(mesa.numero);
  const comandas = Store.obtenerEstado().comandas || [];
  const mesaComandas = comandas.filter(c => c.mesa == mesa.numero);

  let itemsHTML = '';
  mesaComandas.forEach(c => {
    const destino = (c.id && c.id.endsWith('_barra')) ? 'barra' : (c.id && c.id.endsWith('_cocina')) ? 'cocina' : c.destino;
    const icono = destino === 'barra' ? '🍹' : '🍳';
    (c.items || []).forEach(it => {
      itemsHTML += `<div style="font-size:11px;padding:2px 0;">${icono} ${it.nombre} x${it.qty} — <strong>${c.estado}</strong></div>`;
    });
  });

  cont.innerHTML = `
    <div style="background:#1a1a2e;border:1px solid #2e2e42;border-radius:8px;padding:12px;color:#f1f5f9;font-size:12px;min-width:180px;pointer-events:auto;position:absolute;top:${rect.top}px;left:${rect.right + 8}px;z-index:9999;" id="popoverContent">
      <strong>Mesa ${mesa.numero}</strong>
      <div style="margin-top:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorEstado(estados.cocina)};margin-right:4px;"></span> Cocina: ${estados.cocina}</div>
      <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorEstado(estados.barra)};margin-right:4px;"></span> Barra: ${estados.barra}</div>
      <div style="margin-top:6px;border-top:1px solid #2e2e42;padding-top:4px;">${itemsHTML || '<span style="color:#9ca3af;">Sin comandas</span>'}</div>
      <button style="margin-top:8px;background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;float:right;" id="popoverCerrarBtn">Cerrar</button>
    </div>`;

  document.getElementById('popoverCerrarBtn')?.addEventListener('click', () => {
    cont.innerHTML = '';
    _limpiarPopoverListeners();
  });

  const clickFuera = (e) => {
    const popover = document.getElementById('popoverContent');
    if (popover && !popover.contains(e.target)) {
      cont.innerHTML = '';
      _limpiarPopoverListeners();
    }
  };
  setTimeout(() => {
    document.addEventListener('click', clickFuera);
    _popoverCloseListeners.push(() => document.removeEventListener('click', clickFuera));
  }, 0);

  const grid = document.getElementById('mesasGrid');
  if (grid) {
    const scrollCierre = () => {
      cont.innerHTML = '';
      _limpiarPopoverListeners();
    };
    grid.addEventListener('scroll', scrollCierre, { once: true });
    _popoverCloseListeners.push(() => grid.removeEventListener('scroll', scrollCierre));
  }
}

export function asegurarVista(callbacks = {}) {
  const main = document.getElementById('view-mesas');
  if (main && main.querySelector('.mesas-grid')) return;

  if (!main) {
    const nuevoMain = document.createElement('main');
    nuevoMain.id = 'view-mesas';
    nuevoMain.className = 'view active';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(nuevoMain, referencia);
    _construirContenido(nuevoMain, callbacks);
    return;
  }

  _construirContenido(main, callbacks);
}

function _construirContenido(contenedor, callbacks) {
  contenedor.innerHTML = `
    <div class="view-toolbar">
      <h2><i class="fas fa-grip"></i> Salón — Mapa de Mesas</h2>
      <div class="toolbar-actions">
        <span class="legend">
          <span class="badge libre">Libre</span>
          <span class="badge ocupada">Ocupada</span>
          <span class="badge esperando">Lista</span>
          <span class="badge cuenta">Cuenta</span>
        </span>
        <div id="zonaButtonsContainer" style="display: flex; gap: 4px;"></div>
        <button class="btn-secondary" id="btnAgregarMesa" data-rol="admin,master">
          <i class="fas fa-plus"></i> Nueva Mesa
        </button>
        <button id="btnFusionar" class="btn-secondary" data-rol="mesero,admin,master">
          <i class="fas fa-object-group"></i> Fusionar Mesas
        </button>
        <button id="btnConfirmarFusion" class="btn-primary" style="display:none;">
          <i class="fas fa-check"></i> Confirmar Fusión
        </button>
      </div>
    </div>
    <div id="mesasGrid" class="mesas-grid"></div>
    <div id="popoverContainer" style="position:fixed;z-index:9999;pointer-events:none;"></div>
  `;

  document.getElementById('btnAgregarMesa')?.addEventListener('click', () => {
    if (callbacks.onAgregarMesa) callbacks.onAgregarMesa();
  });
  document.getElementById('btnFusionar')?.addEventListener('click', () => {
    if (callbacks.onToggleFusion) callbacks.onToggleFusion();
  });
  document.getElementById('btnConfirmarFusion')?.addEventListener('click', () => {
    if (callbacks.onConfirmarFusion) callbacks.onConfirmarFusion();
  });
}