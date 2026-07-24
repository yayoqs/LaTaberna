/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/edicion.js
   Versión: 2.0.0
   Propósito: Compatibilidad: redirige la edición al modal sheet.
   ================================================================ */

import { mostrarModalReceta } from './crear.js';

export function mostrarVistaCompleta(idReceta) {
  mostrarModalReceta(idReceta);
}