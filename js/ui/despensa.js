/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/despensa.js
   Versión: 2.0.0
   Propósito: Fachada de la vista de despensa. Reexporta funciones
              de los submódulos. Delega inicialización a ciclo-vida.
   ================================================================ */

import { activar, limpiar } from './despensa/ciclo-vida.js';
import { renderCompleto } from './despensa/renderer.js';
import { setCategoriaFiltro } from './despensa/estado.js';
import { mostrar as mostrarModalIngrediente, cerrar as cerrarModalIngrediente } from './despensa/modal-ingrediente.js';
import { exportarCSV, exportarPDF } from './despensa/exportacion.js';
import { ajusteRapido } from './despensa/acciones.js';

const Despensa = {
  activar,
  limpiar,

  render() {
    activar();
    renderCompleto();
  },

  filtrarPorCategoria(categoria) {
    setCategoriaFiltro(categoria);
    this.render();
  },

  mostrarModalIngrediente(ingrediente = null) {
    mostrarModalIngrediente(ingrediente, () => this.render());
  },
  cerrarModalIngrediente,

  ajusteRapido(id = null) {
    ajusteRapido(id, () => this.render());
  },

  exportarCSV,
  exportarPDF
};

// ── Inicialización ──
activar();

export { Despensa };