/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/ejecutar.js
   Versión: 2.0.0
   Propósito: Ejecución de preparaciones. Crea/actualiza el insumo
              asociado en laTaberna_Insumos. Migrado a state.insumos.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { DBInventario } from '../../db-inventario.js';
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
  const insumos = state.insumos || [];
  const recetas = state.recetas || [];

  // Verificar stock de insumos necesarios
  for (const ing of (receta.ingredientes || [])) {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const insumoData = insumos.find(i => i.id == ing.id);
      if (!insumoData) { mostrarToast('error', `Insumo ${ing.id} no encontrado`); return; }
      if ((insumoData.stock || 0) < ing.cantidad * cantidad) {
        mostrarToast('error', `Stock insuficiente de ${insumoData.nombre}. Necesitas ${ing.cantidad * cantidad} ${insumoData.unidad}, hay ${insumoData.stock || 0}.`);
        return;
      }
    } else if (tipo === 'subreceta') {
      const sub = recetas.find(r => r.id == ing.id);
      if (!sub || !sub.es_intermedio) { mostrarToast('error', `Sub-receta ${ing.id} no válida`); return; }
      const subConProducto = DBInventario.obtenerRecetaConProducto(sub.id);
      const nombreSub = subConProducto ? subConProducto.nombre : sub.productoId;
      const insumoSub = insumos.find(i => i.nombre === nombreSub && (i.tipo === 'cocina' || i.tipo === 'barra'));
      const stockSub = insumoSub ? insumoSub.stock : 0;
      if (stockSub < ing.cantidad * cantidad) {
        mostrarToast('error', `Stock insuficiente de ${nombreSub}. Necesitas ${ing.cantidad * cantidad} ${sub.unidadStock}, hay ${stockSub}.`);
        return;
      }
    }
  }

  // Descontar insumos
  for (const ing of (receta.ingredientes || [])) {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const insumoData = insumos.find(i => i.id == ing.id);
      if (insumoData) {
        const nuevoStock = Math.max(0, (insumoData.stock || 0) - ing.cantidad * cantidad);
        await repo.actualizarStockInsumo(insumoData.id, nuevoStock);
      }
    } else if (tipo === 'subreceta') {
      const sub = recetas.find(r => r.id == ing.id);
      if (sub && sub.es_intermedio) {
        const subConProducto = DBInventario.obtenerRecetaConProducto(sub.id);
        const nombreSub = subConProducto ? subConProducto.nombre : sub.productoId;
        const insumoSub = insumos.find(i => i.nombre === nombreSub && (i.tipo === 'cocina' || i.tipo === 'barra'));
        if (insumoSub) {
          const nuevoStock = Math.max(0, (insumoSub.stock || 0) - ing.cantidad * cantidad);
          await repo.actualizarStockInsumo(insumoSub.id, nuevoStock);
        }
      }
    }
  }

  // Buscar o crear el insumo asociado a esta preparación
  const recetaConProducto = DBInventario.obtenerRecetaConProducto(idReceta);
  const nombreProducto = recetaConProducto ? recetaConProducto.nombre : receta.productoId;
  const tipoInsumo = (receta.destino === 'barra') ? 'barra' : 'cocina';
  
  let insumoAsociado = insumos.find(i => i.nombre === nombreProducto && i.tipo === tipoInsumo);
  
  if (!insumoAsociado) {
    // Crear el insumo por primera vez
    insumoAsociado = await repo.guardarInsumo({
      nombre: nombreProducto,
      unidad: receta.unidadStock || 'u',
      tipo: tipoInsumo,
      categoria: receta.categoria || 'general',
      stock: 0,
      stock_minimo: 1
    });
  }

  // Aumentar stock del insumo
  const nuevoStock = (insumoAsociado.stock || 0) + cantidad;
  await repo.actualizarStockInsumo(insumoAsociado.id, nuevoStock);

  EventBus.emit('recetas:actualizadas');
  mostrarToast('success', `Preparado: +${cantidad} ${receta.unidadStock || ''} de ${nombreProducto}`);

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