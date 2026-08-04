/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/avisos-mesero.js
   Versión: 1.0.0
   Propósito: Indicador visual de notificaciones para el mesero.
              Muestra un triángulo en la esquina superior izquierda
              cuando hay eventos que requieren atención en Mesas.
              Se oculta al cambiar a la vista 'mesas'.
   Dependencias: EventBus, Logger
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';

const AvisosMesero = (() => {
  let _triangulo = null;
  let _contador = 0;
  let _vistaActiva = 'mesas'; // valor inicial seguro
  let _activado = false;

  // Colección de notificaciones activas: clave compuesta "tipo:mesa"
  const _notificaciones = new Map();

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
      _contador = 0;
      _notificaciones.clear();
      _actualizarUI();
    });

    // Ícono de campana
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

    // Contador de notificaciones
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

  function _agregarNotificacion(tipo, mesa) {
    const clave = `${tipo}:${mesa}`;
    if (!_notificaciones.has(clave)) {
      _notificaciones.set(clave, { tipo, mesa });
      _contador++;
      _actualizarUI();
      Logger.debug(`[AvisosMesero] Notificación agregada: ${clave} (total: ${_contador})`);
    }
  }

  function _removerNotificacion(tipo, mesa) {
    const clave = `${tipo}:${mesa}`;
    if (_notificaciones.has(clave)) {
      _notificaciones.delete(clave);
      _contador = Math.max(0, _contador - 1);
      _actualizarUI();
      Logger.debug(`[AvisosMesero] Notificación removida: ${clave} (total: ${_contador})`);
    }
  }

  function activar() {
    if (_activado) return;
    _activado = true;

    _crearTriangulo();

    // Eventos que generan notificaciones
    EventBus.on('cliente:mesa_ingresada', (data) => {
      if (data && data.mesa) _agregarNotificacion('esperando', data.mesa);
    });

    EventBus.on('cliente:precarga_enviada', (data) => {
      if (data && data.mesa) _agregarNotificacion('precarga', data.mesa);
    });

    EventBus.on('cliente:llamar_garzon', (data) => {
      if (data && data.mesa) _agregarNotificacion('llamado', data.mesa);
    });

    // Eventos que eliminan notificaciones (otro mesero ya actuó)
    EventBus.on('mesa:actualizada', (data) => {
      if (data && data.estado === 'ocupada' && data.mesa) {
        _removerNotificacion('esperando', data.mesa);
      }
    });

    EventBus.on('precarga:revisada', (data) => {
      // data tiene precargaId, necesitamos la mesa. No la tenemos directamente,
      // así que eliminamos todas las notificaciones de precarga (poco preciso pero seguro)
      // Alternativa: iterar _notificaciones y eliminar las de tipo 'precarga'
      for (const [clave, valor] of _notificaciones) {
        if (valor.tipo === 'precarga') {
          _notificaciones.delete(clave);
          _contador = Math.max(0, _contador - 1);
        }
      }
      _actualizarUI();
    });

    EventBus.on('mesas:limpiar_badge', (data) => {
      if (data && data.mesa) {
        _removerNotificacion('precarga', data.mesa);
        _removerNotificacion('llamado', data.mesa);
      }
    });

    // Seguimiento de vista activa
    EventBus.on('vista:cambiada', (vista) => {
      _vistaActiva = vista || 'mesas';
      _actualizarUI();
    });

    Logger.info('[AvisosMesero] Módulo inicializado (v1.0.0).');
  }

  function limpiar() {
    // No implementamos desuscripción granular por ahora (se limpia con la página)
    if (_triangulo) {
      _triangulo.remove();
      _triangulo = null;
    }
    _notificaciones.clear();
    _contador = 0;
    _activado = false;
  }

  // Autoactivación al importar
  activar();

  return { activar, limpiar };
})();

export { AvisosMesero };