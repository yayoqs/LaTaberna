/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/estado-comandas.js
   Versión: 1.0.2
   Propósito: Obtiene el estado más avanzado de las comandas.
              Corregida inferencia de destino: respeta c.destino.
   ================================================================ */

import { Store } from '../../lib/store.js';

export function getEstadoComandas(mesaNumero) {
  const comandas = Store.obtenerEstado().comandas || [];
  const estados = { cocina: 'pendiente', barra: 'pendiente' };

  comandas.forEach(c => {
    if (c.mesa != mesaNumero) return;

    let destino = c.destino;
    if (!destino || !['cocina', 'barra', 'ambos'].includes(destino)) {
      if (c.id && c.id.endsWith('_cocina')) destino = 'cocina';
      else if (c.id && c.id.endsWith('_barra')) destino = 'barra';
      else return; // no podemos determinar destino, omitimos
    }

    const destinos = destino === 'ambos' ? ['cocina', 'barra'] : [destino];

    destinos.forEach(dest => {
      if (c.estado === 'lista') {
        estados[dest] = 'lista';
      } else if (c.estado === 'en-proceso') {
        if (estados[dest] !== 'lista') estados[dest] = 'en-proceso';
      }
      // 'nueva' no modifica el estado actual (queda pendiente)
    });
  });

  return estados;
}

export function colorEstado(estado) {
  const colores = {
    'pendiente': '#9ca3af',
    'en-proceso': '#f59e0b',
    'lista': '#22c55e'
  };
  return colores[estado] || '#9ca3af';
}