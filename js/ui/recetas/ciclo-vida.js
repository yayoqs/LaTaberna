/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/ciclo-vida.js
   Versión: 1.0.0
   Propósito: Ciclo de vida de la vista de recetas.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { getActivada, setActivada, getCanceladores } from './estado.js';
import { pintar } from './renderer.js';

export function activar() {
  if (getActivada()) return;
  setActivada(true);
  const canceladores = getCanceladores();

  canceladores.push(Store.subscribe((_, action) => {
    if (action.type.startsWith('PRODUCTO') || action.type.startsWith('RECETA') || action.type.startsWith('INGREDIENTE')) {
      pintar();
    }
  }));
  canceladores.push(EventBus.on('db:inicializada', () => setTimeout(pintar, 100)));
  canceladores.push(EventBus.on('vista:cambiada', v => { if (v === 'recetas') pintar(); }));
  canceladores.push(EventBus.on('recetas:actualizadas', () => pintar()));
  pintar();
}

export function limpiar() {
  if (!getActivada()) return;
  setActivada(false);
  getCanceladores().forEach(fn => { if (typeof fn === 'function') fn(); });
  getCanceladores().length = 0;
  const main = document.getElementById('view-recetas');
  if (main) main.innerHTML = '';
}