/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/bandeja-atencion.js
   Versión: 1.1.0
   Propósito: Bandeja lateral de atención para mesero.
              v1.1.0: Despliegue por gesto swipe desde borde derecho.
                      Sin botón. Encapsulado en vista mesas.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';

let _solicitudes = [];
let _overlay = null;
let _escuchadores = [];
let _vistaMesasActiva = false;

let _touchStartX = 0;
let _touchStartY = 0;

function _asegurarOverlay() {
  if (_overlay) return true;

  const overlay = document.getElementById('bandejaAtencionOverlay');
  if (!overlay) return false;

  _overlay = overlay;

  _overlay.innerHTML = `
    <div class="bandeja-panel">
      <div class="bandeja-header">
        <h3><i class="fas fa-bell"></i> Atención</h3>
        <button class="bandeja-cerrar" id="btnCerrarBandeja"><i class="fas fa-times"></i></button>
      </div>
      <div class="bandeja-lista" id="bandejaLista"></div>
    </div>
  `;

  document.getElementById('btnCerrarBandeja')?.addEventListener('click', cerrarBandeja);
  _overlay.addEventListener('click', (e) => {
    if (e.target === _overlay) cerrarBandeja();
  });

  return true;
}

function _actualizarContador() {
  // Sin botón contador. Solo para depuración futura.
}

function _renderSolicitudes() {
  const lista = document.getElementById('bandejaLista');
  if (!lista) return;

  if (_solicitudes.length === 0) {
    lista.innerHTML = '<div class="bandeja-vacia">No hay solicitudes pendientes.</div>';
    return;
  }

  lista.innerHTML = _solicitudes.map(sol => {
    const icono = sol.tipo === 'esperando' ? 'fa-clock' : sol.tipo === 'precarga' ? 'fa-bell' : 'fa-hand-point-up';
    const texto = sol.tipo === 'esperando' ? 'quiere unirse' : sol.tipo === 'precarga' ? 'precarga de pedido' : 'llamado';

    return `
      <div class="bandeja-item" data-id="${sol.id}">
        <div class="bandeja-icono"><i class="fas ${icono}"></i></div>
        <div class="bandeja-info">
          <strong>Mesa ${sol.mesa}</strong>
          <p>${texto}</p>
        </div>
        <div class="bandeja-acciones">
          <button class="btn-mini bandeja-ver" data-mesa="${sol.mesa}">Ver</button>
          <button class="btn-mini secundario bandeja-cerrar-sol" data-id="${sol.id}">✕</button>
        </div>
      </div>`;
  }).join('');

  lista.querySelectorAll('.bandeja-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const mesa = btn.dataset.mesa;
      cerrarBandeja();
      EventBus.emit('mesa:seleccionada', mesa);
    });
  });

  lista.querySelectorAll('.bandeja-cerrar-sol').forEach(btn => {
    btn.addEventListener('click', () => {
      _eliminarSolicitud(btn.dataset.id);
    });
  });
}

function _eliminarSolicitud(id) {
  _solicitudes = _solicitudes.filter(s => s.id !== id);
  _renderSolicitudes();
}

function _agregarSolicitud(tipo, mesa, datos = {}) {
  const id = `${tipo}_${mesa}_${Date.now()}`;
  const existente = _solicitudes.find(s => s.tipo === tipo && String(s.mesa) === String(mesa));
  if (existente) return;

  _solicitudes.push({ id, tipo, mesa, ...datos });
  _renderSolicitudes();
}

function _onTouchStart(e) {
  if (!_vistaMesasActiva) return;
  _touchStartX = e.touches[0].clientX;
  _touchStartY = e.touches[0].clientY;
}

function _onTouchEnd(e) {
  if (!_vistaMesasActiva) return;

  const dx = e.changedTouches[0].clientX - _touchStartX;
  const dy = e.changedTouches[0].clientY - _touchStartY;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    const overlayAbierto = _overlay && _overlay.style.display === 'flex';
    if (overlayAbierto) {
      if (dx > 60) cerrarBandeja();
    } else {
      // Swipe hacia la izquierda desde el borde derecho abre la bandeja
      if (dx < -60 && _touchStartX > window.innerWidth - 30) {
        abrirBandeja();
      }
    }
  }
}

export function abrirBandeja() {
  if (!_asegurarOverlay()) return;
  _overlay.style.display = 'flex';
  _renderSolicitudes();
}

export function cerrarBandeja() {
  if (_overlay) _overlay.style.display = 'none';
}

export function activar() {
  _escuchadores.push(EventBus.on('vista:cambiada', (vista) => {
    _vistaMesasActiva = vista === 'mesas';
  }));

  _escuchadores.push(EventBus.on('cliente:mesa_ingresada', (data) => {
    if (data && data.mesa) _agregarSolicitud('esperando', data.mesa, {});
  }));

  _escuchadores.push(EventBus.on('cliente:precarga_enviada', (data) => {
    if (data && data.mesa) _agregarSolicitud('precarga', data.mesa, { precargaId: data.id });
  }));

  _escuchadores.push(EventBus.on('cliente:llamar_garzon', (data) => {
    if (data && data.mesa) _agregarSolicitud('llamado', data.mesa, {});
  }));

  _escuchadores.push(EventBus.on('mesa:actualizada', (data) => {
    if (data && data.estado === 'ocupada') {
      _solicitudes = _solicitudes.filter(s => !(s.tipo === 'esperando' && String(s.mesa) === String(data.mesa)));
      _renderSolicitudes();
    }
  }));

  _escuchadores.push(EventBus.on('precarga:revisada', () => {
    _solicitudes = _solicitudes.filter(s => s.tipo !== 'precarga');
    _renderSolicitudes();
  }));

  document.addEventListener('touchstart', _onTouchStart, { passive: true });
  document.addEventListener('touchend', _onTouchEnd, { passive: true });

  Logger.info('[BandejaAtencion] Activada con gestos.');
}

export function limpiar() {
  _escuchadores.forEach(fn => fn());
  _escuchadores = [];

  document.removeEventListener('touchstart', _onTouchStart);
  document.removeEventListener('touchend', _onTouchEnd);

  _solicitudes = [];
  if (_overlay) {
    _overlay.innerHTML = '';
    _overlay.style.display = 'none';
    _overlay = null;
  }
  _vistaMesasActiva = false;
}

export const BandejaAtencion = {
  activar,
  limpiar,
  abrirBandeja,
  cerrarBandeja,
  agregarSolicitud: _agregarSolicitud,
  eliminarSolicitud: _eliminarSolicitud
};