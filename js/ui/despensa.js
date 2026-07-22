/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/despensa.js
   Versión: 3.0.1
   Propósito: Fachada de la nueva vista de despensa con tres paneles.
              v3.0.1: render() solo llama a activar().
   ================================================================ */

import { activar, limpiar } from './despensa/ciclo-vida.js';
import { getListaCompras, agregarAListaCompras, quitarDeListaCompras, limpiarListaCompras } from './despensa/estado.js';
import { renderListaCompras } from './despensa/renderer.js';

const Despensa = {
  activar,
  limpiar,

  render() {
    activar();
  },

  getListaCompras,
  agregarAListaCompras(item) {
    agregarAListaCompras(item);
    renderListaCompras(getListaCompras());
  },
  quitarDeListaCompras(item) {
    quitarDeListaCompras(item);
    renderListaCompras(getListaCompras());
  },
  limpiarListaCompras() {
    limpiarListaCompras();
    renderListaCompras([]);
  }
};

export { Despensa };