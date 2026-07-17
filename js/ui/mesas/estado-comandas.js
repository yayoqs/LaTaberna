/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/estado-comandas.js
   Versión: 1.0.1
   Propósito: Obtiene el estado más avanzado de las comandas.
              Migración a Store.obtenerEstado.
   ================================================================ */

import { Store } from '../../lib/store.js';

export function getEstadoComandas(mesaNumero) {
  const comandas = Store.obtenerEstado().comandas || [];
  const estados = { cocina: 'pendiente', barra: 'pendiente' };

  comandas.forEach(c => {
    if (c.mesa != mesaNumero) return;

    let destino = c.destino;
    if (c.id && c.id.endsWith('_cocina')) destino = 'cocina';
    if (c.id && c.id.endsWith('_barra')) destino = 'barra';

    if (destino === 'cocina' || destino === 'ambos') {
      if (c.estado === 'lista') estados.cocina = 'lista';
      else if (c.estado === 'en-proceso' && estados.cocina !== 'lista') estados.cocina = 'en-proceso';
      else if (c.estado === 'nueva' && estados.cocina === 'pendiente') estados.cocina = 'pendiente';
    }
    if (destino === 'barra' || destino === 'ambos') {
      if (c.estado === 'lista') estados.barra = 'lista';
      else if (c.estado === 'en-proceso' && estados.barra !== 'lista') estados.barra = 'en-proceso';
      else if (c.estado === 'nueva' && estados.barra === 'pendiente') estados.barra = 'pendiente';
    }
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