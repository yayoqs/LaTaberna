/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/alergias-cliente.js
   Versión: 1.0.0
   Propósito: Gestión de alergias declaradas por el cliente. El
              cliente las declara una sola vez por sesión y se
              aplican a todos los items que arma en su orden.

   Fase 1: persistencia en memoria + sessionStorage. Cuando el
   ecosistema integre MiRefugio ↔ LaTaberna, el campo vivirá en
   global_Perfiles.alergias y se precargará desde el perfil.

   Ciclo de vida:
     · _asegurarVista() — crea el overlay una sola vez.
     · activar()        — registra listeners del modal.
     · limpiar()        — aborta AbortController.
     · mostrar()        — abre el modal.
     · ocultar()        — cierra el modal.

   Emite:
     · cliente:alergias_actualizadas  { alergias: string[] }

   Consume:
     (ninguno)
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { ALERGENOS } from '../../dominio/alergenos.js';

const ETIQUETAS_ALERGENO = {
  mani: 'Maní',
  gluten: 'Gluten',
  lactosa: 'Lactosa',
  mariscos: 'Mariscos',
  huevo: 'Huevo',
  soya: 'Soya',
  frutos_secos: 'Frutos secos',
  pescado: 'Pescado',
  otro: 'Otro'
};

const STORAGE_KEY = 'cliente_alergias_sesion';

const AlergiasCliente = (() => {
  let _vista = null;
  let _activada = false;
  let _abortController = null;

  // Conjunto de alergias declaradas por el cliente. Fuente de verdad
  // del módulo durante la sesión.
  let _alergias = new Set();

  // Buffer temporal mientras el modal está abierto. Se aplica sólo al
  // confirmar.
  let _temporal = new Set();

  function _cargarDesdeSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _alergias = new Set(parsed.filter(a => ALERGENOS.includes(a)));
      }
    } catch (e) {
      Logger.warn('[AlergiasCliente] No se pudo cargar de sessionStorage:', e.message);
    }
  }

  function _persistirEnSession() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([..._alergias]));
    } catch (e) {
      Logger.warn('[AlergiasCliente] No se pudo persistir en sessionStorage:', e.message);
    }
  }

  function _asegurarVista() {
    if (_vista) return;

    let overlay = document.getElementById('modalAlergiasCliente');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalAlergiasCliente';
      overlay.className = 'modal-overlay-cliente modal-alergias-cliente';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Mis alergias e intolerancias');
      overlay.innerHTML = `
        <div class="mac-card">
          <div class="mac-header">
            <h3>⚠ Mis alergias e intolerancias</h3>
            <p>Declara una vez. Se aplicará a todos los productos que pidas en esta visita.</p>
          </div>
          <div class="mac-body">
            <div class="moc-chips" id="macChips"></div>
          </div>
          <div class="mac-resumen" id="macResumen"></div>
          <div class="mac-footer">
            <button class="moc-btn moc-btn-cancelar" id="macBtnCancelar">Cancelar</button>
            <button class="moc-btn moc-btn-agregar" id="macBtnGuardar">✓ Guardar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    _vista = overlay;
  }

  function _esVistaAbierta() {
    return _vista && _vista.classList.contains('active');
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _cargarDesdeSession();

    _asegurarVista();

    _abortController = new AbortController();
    const { signal } = _abortController;

    document.getElementById('macBtnCancelar').addEventListener('click', ocultar, { signal });
    document.getElementById('macBtnGuardar').addEventListener('click', _confirmar, { signal });

    _vista.addEventListener('click', (e) => {
      if (e.target === _vista) ocultar();
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _esVistaAbierta()) ocultar();
    }, { signal });
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    if (_vista) _vista.classList.remove('active');
    _activada = false;
    _temporal = new Set();
  }

  function mostrar() {
    _asegurarVista();
    activar();
    _temporal = new Set(_alergias);
    _render();
    _vista.classList.add('active');
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    _temporal = new Set();
  }

  function _render() {
    const cont = document.getElementById('macChips');
    if (!cont) return;
    cont.innerHTML = ALERGENOS.map(a => `
      <button class="moc-chip alergia${_temporal.has(a) ? ' on' : ''}" data-alergeno="${a}">
        ${ETIQUETAS_ALERGENO[a] || a}
      </button>
    `).join('');

    cont.querySelectorAll('.moc-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.alergeno;
        if (_temporal.has(a)) _temporal.delete(a);
        else _temporal.add(a);
        _render();
      });
    });

    const n = _temporal.size;
    const resumen = document.getElementById('macResumen');
    resumen.innerHTML = n === 0
      ? '<em>Sin alergias declaradas.</em>'
      : `<strong>${n} alergia${n > 1 ? 's' : ''} declarada${n > 1 ? 's' : ''}:</strong> ` +
        [..._temporal].map(a => ETIQUETAS_ALERGENO[a] || a).join(', ');
  }

  function _confirmar() {
    _alergias = new Set(_temporal);
    _persistirEnSession();
    const lista = [..._alergias].sort();
    EventBus.emit('cliente:alergias_actualizadas', { alergias: lista });
    ocultar();
    Logger.info('[AlergiasCliente] Alergias guardadas:', lista.join(', ') || '(ninguna)');
  }

  /**
   * Devuelve la lista actual de alergias declaradas por el cliente.
   * @returns {string[]}
   */
  function obtener() {
    return [..._alergias].sort();
  }

  /**
   * Devuelve true si el cliente declaró la alergia indicada.
   * @param {string} alergeno
   * @returns {boolean}
   */
  function tiene(alergeno) {
    return _alergias.has(alergeno);
  }

  /**
   * Cantidad de alergias declaradas.
   * @returns {number}
   */
  function cantidad() {
    return _alergias.size;
  }

  function etiqueta(alergeno) {
    return ETIQUETAS_ALERGENO[alergeno] || alergeno;
  }

  return {
    activar,
    limpiar,
    mostrar,
    ocultar,
    obtener,
    tiene,
    cantidad,
    etiqueta
  };
})();

export { AlergiasCliente };