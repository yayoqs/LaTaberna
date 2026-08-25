/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/bandeja-atencion.js
   Versión: 1.3.1
   Propósito: Bandeja lateral de atención para mesero.
              v1.3.1: Corrección de campo de aviso: usa mesaId en
                      la colección laTaberna_Avisos. Las precargas
                      siguen usando mesa en laTaberna_Pedidos.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Auth } from '../../auth.js';
import { CommandBus } from '../../lib/command-bus.js';

let _solicitudes = [];
let _overlay = null;
let _escuchadores = [];
let _vistaMesasActiva = false;

let _touchStartX = 0;
let _touchStartY = 0;

function _espacioIdActivo() {
  try {
    const local = Auth.obtenerLocalActivo?.();
    return local?.id || 'lataberna';
  } catch {
    return 'lataberna';
  }
}

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

function _renderSolicitudes() {
  const lista = document.getElementById('bandejaLista');
  if (!lista) return;

  if (_solicitudes.length === 0) {
    lista.innerHTML = '<div class="bandeja-vacia">No hay solicitudes pendientes.</div>';
    return;
  }

  lista.innerHTML = _solicitudes.map(sol => {
    const icono = sol.tipo === 'vinculacion' ? 'fa-clock'
      : sol.tipo === 'llamado' ? 'fa-hand-point-up'
      : 'fa-bell';

    const texto = sol.tipo === 'vinculacion' ? 'quiere unirse'
      : sol.tipo === 'llamado' ? 'llamado'
      : 'precarga de pedido';

    const botones = sol.tipo === 'precarga'
      ? `<button class="btn-mini bandeja-revisar" data-id="${sol.id}" data-mesa="${sol.mesa}">Revisar</button>`
      : `<button class="btn-mini bandeja-atender" data-id="${sol.id}">Atender</button>`;

    return `
      <div class="bandeja-item" data-id="${sol.id}">
        <div class="bandeja-icono"><i class="fas ${icono}"></i></div>
        <div class="bandeja-info">
          <strong>Mesa ${sol.mesa}</strong>
          <p>${texto}</p>
        </div>
        <div class="bandeja-acciones">
          <button class="btn-mini secundario bandeja-ver" data-mesa="${sol.mesa}">Ver</button>
          ${botones}
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

  lista.querySelectorAll('.bandeja-atender').forEach(btn => {
    btn.addEventListener('click', () => _atenderAviso(btn.dataset.id));
  });

  lista.querySelectorAll('.bandeja-revisar').forEach(btn => {
    btn.addEventListener('click', () => _revisarPrecarga(btn.dataset.id));
  });
}

async function _atenderAviso(id) {
  if (!DBAppwrite || !DBAppwrite.habilitado) return;

  const usuario = Auth.obtenerNombre?.() || 'mesero';
  try {
    await DBAppwrite.actualizar('avisos', id, {
      estado: 'atendido',
      atendidoPor: usuario,
      atendidoEn: new Date().toISOString()
    });
    Logger.info('[BandejaAtencion] Aviso ' + id + ' atendido.');
    await _cargarSolicitudes();
  } catch (e) {
    Logger.error('[BandejaAtencion] Error al atender aviso:', e);
  }
}

async function _revisarPrecarga(id) {
  const precarga = _solicitudes.find(s => s.id === id);
  if (!precarga) return;

  try {
    await CommandBus.ejecutar({
      type: 'precarga:revisar',
      datos: {
        precargaId: id,
        mesa: precarga.mesa,
        id_usuario: precarga.id_usuario || '',
        revisadoPor: Auth.obtenerNombre?.() || 'mesero'
      }
    });
    Logger.info('[BandejaAtencion] Precarga ' + id + ' revisada.');
    await _cargarSolicitudes();
  } catch (e) {
    Logger.error('[BandejaAtencion] Error al revisar precarga:', e);
  }
}

async function _cargarSolicitudes() {
  if (!DBAppwrite || !DBAppwrite.habilitado) return;

  const espacioId = _espacioIdActivo();
  const solicitudes = [];

  try {
    const avisos = await DBAppwrite.listar('avisos');
    avisos
      .filter(a => a.estado === 'pendiente')
      .filter(a => a.tipo === 'vinculacion' || a.tipo === 'llamado')
      .filter(a => String(a.espacioId || '') === String(espacioId))
      .forEach(a => {
        solicitudes.push({
          id: a.id,
          tipo: a.tipo,
          mesa: a.mesaId || a.mesa,
          id_usuario: a.id_usuario || a.usuarioId || null
        });
      });
  } catch (e) {
    Logger.warn('[BandejaAtencion] No se pudieron cargar avisos:', e);
  }

  try {
    const pedidos = await DBAppwrite.listar('pedidos');
    pedidos
      .filter(p => p.estado === 'precarga')
      .filter(p => p.origen === 'cliente')
      .filter(p => String(p.espacioId || '') === String(espacioId))
      .forEach(p => {
        solicitudes.push({
          id: p.id,
          tipo: 'precarga',
          mesa: p.mesa,
          id_usuario: p.id_usuario || null
        });
      });
  } catch (e) {
    Logger.warn('[BandejaAtencion] No se pudieron cargar precargas:', e);
  }

  _solicitudes = solicitudes;
  _renderSolicitudes();
}

async function _refrescarSolicitudes() {
  await _cargarSolicitudes();
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
      if (dx < -60 && _touchStartX > window.innerWidth - 30) {
        abrirBandeja();
      }
    }
  }
}

export function abrirBandeja() {
  if (!_asegurarOverlay()) return;
  _overlay.style.display = 'flex';
  _refrescarSolicitudes();
}

export function cerrarBandeja() {
  if (_overlay) _overlay.style.display = 'none';
}

export function activar() {
  _escuchadores.push(EventBus.on('vista:cambiada', (vista) => {
    _vistaMesasActiva = vista === 'mesas';
  }));

  _escuchadores.push(EventBus.on('bandeja:abrir', abrirBandeja));
  _escuchadores.push(EventBus.on('avisos:actualizada', () => {
    if (_overlay && _overlay.style.display === 'flex') _refrescarSolicitudes();
  }));
  _escuchadores.push(EventBus.on('pedidos:actualizada', () => {
    if (_overlay && _overlay.style.display === 'flex') _refrescarSolicitudes();
  }));

  document.addEventListener('touchstart', _onTouchStart, { passive: true });
  document.addEventListener('touchend', _onTouchEnd, { passive: true });

  Logger.info('[BandejaAtencion] Activada en modo persistente puro.');
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
  refrescar: _refrescarSolicitudes
};