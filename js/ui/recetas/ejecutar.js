/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/ejecutar.js
   Versión: 1.0.2
   Propósito: Ejecución de preparaciones. Usa receta-repository
              para actualizar stocks con persistencia.
              Misión 2.2: Store.getState → Store.obtenerEstado.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { mostrarToast } from '../../utils.js';
import { getPestanaActiva } from './estado.js';
import { pintarStock } from './renderer.js';
import { crearRecetaRepo } from '../../repositorios/receta-repository.js';

let _repo = null;
function _getRepo() {
  if (!_repo) _repo = crearRecetaRepo();
  return _repo;
}

export async function ejecutarPreparacion(idReceta) {
  const repo = _getRepo();
  const receta = await repo.obtenerPorId(idReceta);
  if (!receta || !receta.es_intermedio) { mostrarToast('error', 'Esta receta no es una preparación intermedia'); return; }

  const cantidad = await pedirCantidad('Preparar ' + receta.productoId, '¿Cuánto vas a preparar?', receta.unidadStock || 'unidades');
  if (!cantidad || cantidad <= 0) return;

  const state = Store.obtenerEstado();
  const ingredientes = state.ingredientes || [];
  const recetas = state.recetas || [];

  for (const ing of (receta.ingredientes || [])) {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const ingData = ingredientes.find(i => i.id == ing.id);
      if (!ingData) { mostrarToast('error', `Insumo ${ing.id} no encontrado`); return; }
      if ((ingData.stock || 0) < ing.cantidad * cantidad) {
        mostrarToast('error', `Stock insuficiente de ${ingData.nombre}. Necesitas ${ing.cantidad * cantidad} ${ingData.unidad}, hay ${ingData.stock || 0}.`);
        return;
      }
    } else if (tipo === 'subreceta') {
      const sub = recetas.find(r => r.id == ing.id);
      if (!sub || !sub.es_intermedio) { mostrarToast('error', `Sub-receta ${ing.id} no válida`); return; }
      if ((sub.stockActual || 0) < ing.cantidad * cantidad) {
        const prod = (state.productos || []).find(p => p.id == sub.productoId);
        mostrarToast('error', `Stock insuficiente de ${prod?.nombre || sub.productoId}. Necesitas ${ing.cantidad * cantidad} ${sub.unidadStock}, hay ${sub.stockActual || 0}.`);
        return;
      }
    }
  }

  for (const ing of (receta.ingredientes || [])) {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const ingData = ingredientes.find(i => i.id == ing.id);
      if (ingData) {
        const nuevoStock = Math.max(0, (ingData.stock || 0) - ing.cantidad * cantidad);
        await repo.actualizarStockIngrediente(ingData.id, nuevoStock);
      }
    } else if (tipo === 'subreceta') {
      const sub = recetas.find(r => r.id == ing.id);
      if (sub) {
        const nuevoStock = Math.max(0, (sub.stockActual || 0) - ing.cantidad * cantidad);
        await repo.actualizarStockReceta(sub.id, nuevoStock);
      }
    }
  }

  const nuevoStock = (receta.stockActual || 0) + cantidad;
  await repo.actualizarStockReceta(idReceta, nuevoStock);

  EventBus.emit('recetas:actualizadas');
  mostrarToast('success', `Preparado: +${cantidad} ${receta.unidadStock || ''} de ${receta.productoId}`);

  if (getPestanaActiva() === 'stock') {
    const contenedor = document.getElementById('recetas-contenedor');
    if (contenedor) pintarStock(contenedor);
  }
}

export function pedirCantidad(titulo, mensaje, unidad) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="recetas-modal-form" style="max-width:400px;">
        <div class="modal-header"><h3>${titulo}</h3></div>
        <div class="recetas-form-cuerpo">
          <p>${mensaje}</p>
          <input type="number" id="rec-cantidad-preparar" step="0.01" placeholder="Cantidad en ${unidad}" style="width:100%;">
          <div class="recetas-form-botones">
            <button class="btn-secondary" id="rec-cancelar-cantidad">Cancelar</button>
            <button class="btn-primary" id="rec-aceptar-cantidad">Preparar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('rec-cancelar-cantidad').addEventListener('click', () => { overlay.remove(); resolve(null); });
    document.getElementById('rec-aceptar-cantidad').addEventListener('click', () => {
      const val = parseFloat(document.getElementById('rec-cantidad-preparar').value);
      overlay.remove();
      resolve(isNaN(val) ? null : val);
    });
  });
}