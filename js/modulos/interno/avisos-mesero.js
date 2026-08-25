/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/avisos-mesero.js
   Versión: 1.1.0
   Propósito: Indicador visual de notificaciones para el mesero.
              v1.1.0: Lee avisos y precargas persistentes desde
                      Appwrite. Filtra por espacioId activo y no
                      se muestra para rol cliente puro.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { Auth } from '../../auth.js';
import { DBAppwrite } from '../../db-appwrite.js';

const AvisosMesero = (() => {
  let _triangulo = null;
  let _contador = 0;
  let _vistaActiva = 'mesas';
  let _activado = false;

  const _avisos = new Map();
  const _precargas = new Map();
  const _desuscripciones = [];

  function _esSoloCliente() {
    try {
      const roles = Auth.obtenerRolesEfectivos?.();
      if (!Array.isArray(roles) || roles.length === 0) return true;
      return roles.length === 1 && roles[0] === 'cliente';
    } catch (e) {
      return true;
    }
  }

  function _espacioIdActivo() {
    try {
      const local = Auth.obtenerLocalActivo?.();
      return local?.id || 'lataberna';
    } catch (e) {
      return 'lataberna';
    }
  }

  function _crearTriangulo() {
    if (_triangulo) return;

    _triangulo = document.createElement('div');
    _triangulo.id = 'avisos-mesero-triangulo';
    _triangulo.title = 'Ir a Mesas';
    _triangulo.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 60px;
      height: 60px;
      background: var(--color-accent, #f59e0b);
      clip-path: polygon(0 0, 100% 0, 0 100%);
      cursor: pointer;
      display: none;
      align-items: flex-start;
      justify-content: flex-start;
      z-index: 9999;
      transition: transform 0.2s ease, opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(245,158,11,.4);
    `;

    _triangulo.addEventListener('mouseenter', () => {
      _triangulo.style.transform = 'scale(1.08)';
    });
    _triangulo.addEventListener('mouseleave', () => {
      _triangulo.style.transform = 'scale(1)';
    });
    _triangulo.addEventListener('click', () => {
      EventBus.emit('app:cambiarVista', 'mesas');
      EventBus.emit('mesas:abrir_bandeja');
    });

    const icono = document.createElement('i');
    icono.className = 'fas fa-bell';
    icono.style.cssText = `
      position: absolute;
      top: 6px;
      left: 6px;
      font-size: 1rem;
      color: #1a1a24;
    `;
    _triangulo.appendChild(icono);

    const contador = document.createElement('span');
    contador.id = 'avisos-mesero-contador';
    contador.style.cssText = `
      position: absolute;
      top: 22px;
      left: 4px;
      background: #ef4444;
      color: #fff;
      font-size: 0.6rem;
      font-weight: 800;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.4);
    `;
    _triangulo.appendChild(contador);

    document.body.appendChild(_triangulo);
  }

  function _actualizarUI() {
    if (!_triangulo) return;

    const contadorEl = document.getElementById('avisos-mesero-contador');
    if (!contadorEl) return;

    const visible = _contador > 0 && _vistaActiva !== 'mesas';
    _triangulo.style.display = visible ? 'flex' : 'none';
    contadorEl.style.display = _contador > 0 ? 'flex' : 'none';
    contadorEl.textContent = _contador > 9 ? '9+' : _contador;
  }

  function _recalcularContador() {
    _contador = _avisos.size + _precargas.size;
    _actualizarUI();
  }

  async function _cargarAvisos() {
    if (!DBAppwrite || !DBAppwrite.habilitado) return;

    const espacioId = _espacioIdActivo();
    try {
      const avisos = await DBAppwrite.listar('avisos');
      _avisos.clear();

      avisos
        .filter(a => a.estado === 'pendiente')
        .filter(a => String(a.espacioId || '') === String(espacioId))
        .forEach(a => {
          if (!_avisos.has(a.id)) _avisos.set(a.id, a);
        });

      _recalcularContador();
    } catch (e) {
      Logger.warn('[AvisosMesero] No se pudieron cargar avisos:', e);
    }
  }

  async function _cargarPrecargas() {
    if (!DBAppwrite || !DBAppwrite.habilitado) return;

    const espacioId = _espacioIdActivo();
    try {
      const pedidos = await DBAppwrite.listar('pedidos');
      _precargas.clear();

      pedidos
        .filter(p => p.estado === 'precarga')
        .filter(p => p.origen === 'cliente')
        .filter(p => String(p.espacioId || '') === String(espacioId))
        .forEach(p => {
          if (!_precargas.has(p.id)) _precargas.set(p.id, p);
        });

      _recalcularContador();
    } catch (e) {
      Logger.warn('[AvisosMesero] No se pudieron cargar precargas:', e);
    }
  }

  async function _refrescar() {
    await Promise.all([_cargarAvisos(), _cargarPrecargas()]);
  }

  function activar() {
    if (_activado) return;
    _activado = true;

    if (_esSoloCliente()) {
      Logger.info('[AvisosMesero] No se activa para rol cliente puro.');
      return;
    }

    _crearTriangulo();
    _refrescar();

    _desuscripciones.push(EventBus.on('avisos:actualizada', () => _cargarAvisos()));
    _desuscripciones.push(EventBus.on('pedidos:actualizada', () => _cargarPrecargas()));
    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      _vistaActiva = vista || 'mesas';
      _actualizarUI();
    }));
    _desuscripciones.push(EventBus.on('mesas:abrir_bandeja', () => {
      EventBus.emit('bandeja:abrir');
    }));

    Logger.info('[AvisosMesero] Módulo activado (v1.1.0).');
  }

  function limpiar() {
    _desuscripciones.forEach(fn => fn());
    _desuscripciones.length = 0;

    if (_triangulo) {
      _triangulo.remove();
      _triangulo = null;
    }
    _avisos.clear();
    _precargas.clear();
    _contador = 0;
    _activado = false;
  }

  activar();

  return { activar, limpiar, _refrescar };
})();

export { AvisosMesero };