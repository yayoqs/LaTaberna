/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja.js
   Versión: 1.5.1
   Propósito: Fachada de la vista de caja. Reexporta submódulos
              para mantener API pública sin cambios.
   Dependencias:
     · js/ui/caja/ciclo-vida.js
     · js/ui/caja/renderer.js
     · js/ui/caja/arqueo.js
     · js/ui/caja/movimientos.js
     · js/ui/caja/historial.js
   ================================================================ */

import { activar, limpiar } from './caja/ciclo-vida.js';
import { render } from './caja/renderer.js';
import { abrirArqueo } from './caja/arqueo.js';
import { abrirMovimiento, abrirListaMovimientos } from './caja/movimientos.js';
import { abrirHistorial } from './caja/historial.js';

export const Caja = {
  activar,
  limpiar,
  render,
  abrirArqueo,
  abrirMovimiento,
  abrirListaMovimientos,
  abrirHistorial
};