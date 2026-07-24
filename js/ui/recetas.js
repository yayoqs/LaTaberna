/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/recetas.js
   Versión: 6.2.0
   Propósito: Fachada del módulo de recetas. Reexporta los métodos
              públicos para app.js y kds.js.
              v6.2.0: modularizado en submódulos.
   ================================================================ */

import { activar, limpiar } from './recetas/ciclo-vida.js';
import { pintar } from './recetas/renderer.js';
import { mostrarDetalle } from './recetas/detalle.js';

export const Recetas = {
  render: pintar,
  mostrarDetalle,
  activar,
  limpiar
};