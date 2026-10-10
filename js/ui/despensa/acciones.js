/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/acciones.js
   Versión: 1.1.3
   Propósito: Ajuste rápido de stock de insumos.
              v1.1.3: corrige lectura de state.insumos (antes
                      state.ingredientes). Corrige mensaje al
                      usuario para no usar voseo.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { InventarioService } from '../../servicios/inventario-service.js';
import { mostrarToast, mostrarEntrada } from '../../utils.js';

export async function ajusteRapido(ingredienteId = null, onAjustado = null) {
  const insumos = Store.obtenerEstado().insumos || [];

  if (!ingredienteId) {
    const nombre = await mostrarEntrada(
      'Ajuste rápido',
      'Insumo a ajustar (nombre exacto):',
      { placeholder: 'Ej: Harina 000' }
    );
    if (!nombre) return;
    const ins = insumos.find(i => i.nombre.toLowerCase() === nombre.toLowerCase());
    if (!ins) { mostrarToast('error', 'Insumo no encontrado'); return; }
    ingredienteId = ins.id;
  }

  const insumo = insumos.find(i => i.id === ingredienteId);
  if (!insumo) return;

  const deltaStr = await mostrarEntrada(
    'Ajuste rápido',
    `Ajustar stock de ${insumo.nombre} (actual: ${insumo.stock} ${insumo.unidad}).\nIngresa cantidad (positiva para agregar, negativa para quitar):`,
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
      mostrarToast('success', `Stock de ${insumo.nombre} actualizado`);
      if (typeof onAjustado === 'function') onAjustado();
      return;
    } else {
      mostrarToast('error', resultado.error);
      return;
    }
  }
}