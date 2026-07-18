/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/despensa.js
   Versión: 3.0.0
   Propósito: Fachada de la nueva vista de despensa con tres paneles.
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

  // Lista de compras
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