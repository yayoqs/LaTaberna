/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/acciones.js
   Versión: 1.1.2
   Propósito: Ajuste rápido de stock de ingredientes.
              v1.1.2: usa Store en lugar de DB.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { InventarioService } from '../../servicios/inventario-service.js';
import { mostrarToast, mostrarEntrada } from '../../utils.js';

export async function ajusteRapido(ingredienteId = null, onAjustado = null) {
  const ingredientes = Store.obtenerEstado().ingredientes || [];

  if (!ingredienteId) {
    const nombre = await mostrarEntrada(
      'Ajuste rápido',
      'Ingrediente a ajustar (nombre exacto):',
      { placeholder: 'Ej: Harina 000' }
    );
    if (!nombre) return;
    const ing = ingredientes.find(i => i.nombre.toLowerCase() === nombre.toLowerCase());
    if (!ing) { mostrarToast('error', 'Ingrediente no encontrado'); return; }
    ingredienteId = ing.id;
  }
  const ing = ingredientes.find(i => i.id === ingredienteId);
  if (!ing) return;

  const deltaStr = await mostrarEntrada(
    'Ajuste rápido',
    `Ajustar stock de ${ing.nombre} (actual: ${ing.stock} ${ing.unidad}).\nIngresá cantidad (positiva para agregar, negativa para quitar):`,
    { placeholder: '0', type: 'number' }
  );
  if (deltaStr === null || deltaStr === undefined) return;
  const cantidad = parseFloat(deltaStr);
  if (isNaN(cantidad)) { mostrarToast('error', 'Cantidad inválida'); return; }
  const motivo = await mostrarEntrada(
    'Ajuste rápido',
    'Motivo (opcional):',
    { placeholder: 'Ajuste manual' }
  ) || 'Ajuste rápido';

  if (typeof InventarioService !== 'undefined' && InventarioService.ajustarStock) {
    const resultado = await InventarioService.ajustarStock(ingredienteId, cantidad, motivo);
    if (resultado.exito) {
      mostrarToast('success', `Stock de ${ing.nombre} actualizado`);
      if (typeof onAjustado === 'function') onAjustado();
      return;
    } else {
      mostrarToast('error', resultado.error);
      return;
    }
  }
}