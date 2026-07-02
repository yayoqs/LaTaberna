/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/constantes.js
   Versión: 1.0.0
   Propósito: Constantes visuales para la vista de reparto.
   ================================================================ */

export const ESTADO_BADGE = {
  pendiente:      'warning',
  en_preparacion: 'info',
  en_camino:      'accent',
  entregado:      'success'
};

export const ESTADO_LABEL = {
  pendiente:      'Pendiente',
  en_preparacion: 'En preparación',
  en_camino:      'En camino',
  entregado:      'Entregado'
};

export const ESTADOS = ['pendiente', 'en_preparacion', 'en_camino', 'entregado'];

export const ESTADO_DEFAULT = 'default';