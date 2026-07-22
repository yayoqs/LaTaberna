/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/eventos.js
   Versión: 1.0.9
   Propósito: Vista de gestión de eventos administrativos.
              v1.0.9: elimina autoactivación en scope de módulo.
   ================================================================ */

import { EventBus } from '../lib/eventBus.js';

const Eventos = (() => {

  let _abortController = null;
  let _desuscripciones = [];

  function _asegurarVista() {
    let main = document.getElementById('view-eventos');
    if (main && main.querySelector('.view-toolbar')) return;
    
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-eventos';
      main.className = 'view';
      const referencia = document.getElementById('toastContainer') || document.body.lastChild;
      document.body.insertBefore(main, referencia);
    }

    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-calendar-alt"></i> Gestión de Eventos</h2>
      </div>
      <div style="padding:40px; text-align:center; color:var(--color-text-muted);">
        <i class="fas fa-tools" style="font-size:48px; opacity:.3; display:block; margin-bottom:16px;"></i>
        <p>Gestión de eventos en mantenimiento.</p>
        <p style="font-size:12px;">Próximamente: integración con Appwrite.</p>
      </div>
    `;
  }

  function render() {
    _asegurarVista();
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();

    _desuscripciones.push(EventBus.on('db:inicializada', render));
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
  }

  return {
    activar,
    limpiar,
    render
  };
})();

export { Eventos };