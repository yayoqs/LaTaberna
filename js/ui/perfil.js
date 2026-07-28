/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/perfil.js
   Versión: 4.0.0
   Propósito: Fachada de la vista de perfil modularizada.
              Delega en los submódulos.
   ================================================================ */

import { activar, limpiar } from './perfil/ciclo-vida.js';

const Perfil = {
  activar,
  limpiar,

  render() {
    activar();
  }
};

export { Perfil };