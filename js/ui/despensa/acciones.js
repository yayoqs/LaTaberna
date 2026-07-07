/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/acciones.js
   Versión: 1.1.0
   Propósito: Ajuste rápido de stock de ingredientes.
              v1.1.0: migra window.prompt a mostrarEntrada.
   ================================================================ */

import { DB } from '../../db.js';
import { InventarioService } from '../../servicios/inventario-service.js';
import { showToast, mostrarEntrada } from '../../utils.js';

export async function ajusteRapido(ingredienteId = null, onAjustado = null) {
  if (!ingredienteId) {
    const nombre = await mostrarEntrada(
      'Ajuste rápido',
      'Ingrediente a ajustar (nombre exacto):',
      { placeholder: 'Ej: Harina 000' }
    );
    if (!nombre) return;
    const ing = DB.ingredientes.find(i => i.nombre.toLowerCase() === nombre.toLowerCase());
    if (!ing) { showToast('error', 'Ingrediente no encontrado'); return; }
    ingredienteId = ing.id;
  }
  const ing = DB.ingredientes.find(i => i.id === ingredienteId);
  if (!ing) return;

  const deltaStr = await mostrarEntrada(
    'Ajuste rápido',
    `Ajustar stock de ${ing.nombre} (actual: ${ing.stock} ${ing.unidad}).\nIngresá cantidad (positiva para agregar, negativa para quitar):`,
    { placeholder: '0', type: 'number' }
  );
  if (deltaStr === null || deltaStr === undefined) return;
  const cantidad = parseFloat(deltaStr);
  if (isNaN(cantidad)) { showToast('error', 'Cantidad inválida'); return; }
  const motivo = await mostrarEntrada(
    'Ajuste rápido',
    'Motivo (opcional):',
    { placeholder: 'Ajuste manual' }
  ) || 'Ajuste rápido';

  if (typeof InventarioService !== 'undefined' && InventarioService.ajustarStock) {
    const resultado = await InventarioService.ajustarStock(ingredienteId, cantidad, motivo);
    if (resultado.exito) {
      showToast('success', `Stock de ${ing.nombre} actualizado`);
      if (typeof onAjustado === 'function') onAjustado();
      return;
    } else {
      showToast('error', resultado.error);
      return;
    }
  }

  DB.ajustarStock(ingredienteId, cantidad, motivo);
  showToast('success', `Stock de ${ing.nombre} actualizado`);
  if (typeof onAjustado === 'function') onAjustado();
}