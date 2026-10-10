/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja/ciclo-vida.js
   Versión: 1.5.0
   Propósito: Ciclo de vida de la vista de caja (activar/limpiar).
              Suscripciones y AbortController.
   Dependencias:
     · js/lib/store.js
     · js/lib/eventBus.js
     · js/ui/caja/renderer.js
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { render, asegurarVista } from './renderer.js';

let _estaActiva = false;
let _abortController = null;
const _cleanups = [];

export function activar() {
  if (_estaActiva) return;
  _estaActiva = true;

  _abortController = new AbortController();
  const signal = _abortController.signal;

  asegurarVista(signal);
  render();

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (!_estaActiva) return;
    if (action.type.startsWith('PEDIDOS') || action.type.startsWith('PEDIDO') || action.type.startsWith('MESA')) {
      render();
    }
  });
  _cleanups.push(unsubscribeStore);

  const onDbInicializada = () => { if (_estaActiva) render(); };
  EventBus.on('db:inicializada', onDbInicializada);
  _cleanups.push(() => EventBus.off('db:inicializada', onDbInicializada));

  const onVistaCambiada = (vista) => {
    if (vista !== 'caja') {
      limpiar();
    }
  };
  EventBus.on('vista:cambiada', onVistaCambiada);
  _cleanups.push(() => EventBus.off('vista:cambiada', onVistaCambiada));
}

export function limpiar() {
  if (!_estaActiva) return;
  _estaActiva = false;

  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }

  _cleanups.forEach(fn => fn());
  _cleanups.length = 0;
}