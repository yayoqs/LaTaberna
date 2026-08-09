/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/modal-insumo.js
   Versión: 3.0.1
   Propósito: Modal para crear/editar/eliminar insumos del inventario.
              v3.0.1: corrige acción del Store al eliminar.
   ================================================================ */

import { InventarioService } from '../../servicios/inventario-service.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Store } from '../../lib/store.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast, mostrarConfirmacion } from '../../utils.js';

export async function mostrar(insumo = null, onGuardado = null) {
  const esEdicion = !!insumo;
  const titulo = esEdicion ? 'Editar Insumo' : 'Nuevo Insumo';

  let modal = document.getElementById('modalInsumo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalInsumo';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small">
        <div class="modal-header"><h3 id="ingTitulo">${titulo}</h3><button class="modal-close" id="btnCerrarModalInsumo"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <input type="hidden" id="insumoId">
          <label>Nombre</label><input type="text" id="insumoNombre" placeholder="Ej: Harina 000">
          <label>Categoría</label><select id="insumoCategoria"><option value="cocina">Cocina</option><option value="barra">Barra</option><option value="general">General</option></select>
          <label>Tipo</label><select id="insumoTipo"><option value="cocina">Cocina</option><option value="operativo">Operativo</option><option value="menaje">Menaje</option><option value="aseo">Aseo</option></select>
          <label>Stock actual</label><input type="number" id="insumoStock" step="0.01" value="0">
          <label>Unidad</label><input type="text" id="insumoUnidad" placeholder="kg, g, L, u" value="kg">
          <label>Stock mínimo</label><input type="number" id="insumoStockMin" step="0.01" value="5">
          <label>Ubicación</label><input type="text" id="insumoUbicacion" placeholder="Ej: Estante 3">
          <label>Costo manual ($)</label><input type="number" id="insumoCostoManual" step="0.01" value="" placeholder="Vacío = calcular desde entradas">
          <div class="modal-small-footer" style="justify-content: space-between;">
            <button class="btn-danger" id="btnEliminarModalInsumo" style="display:none;"><i class="fas fa-trash"></i> Eliminar</button>
            <div style="display:flex; gap:10px;">
              <button class="btn-secondary" id="btnCancelarModalInsumo">Cancelar</button>
              <button class="btn-primary" id="btnGuardarModalInsumo">Guardar</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalInsumo').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnCancelarModalInsumo').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnGuardarModalInsumo').addEventListener('click', () => guardar(onGuardado));
    document.getElementById('btnEliminarModalInsumo').addEventListener('click', () => eliminar(onGuardado));
  }

  document.getElementById('insumoId').value = insumo?.id || '';
  document.getElementById('insumoNombre').value = insumo?.nombre || '';
  document.getElementById('insumoCategoria').value = insumo?.categoria || 'general';
  document.getElementById('insumoTipo').value = insumo?.tipo || 'cocina';
  document.getElementById('insumoStock').value = insumo?.stock || 0;
  document.getElementById('insumoUnidad').value = insumo?.unidad || 'kg';
  document.getElementById('insumoStockMin').value = insumo?.stock_minimo || 5;
  document.getElementById('insumoUbicacion').value = insumo?.ubicacion || '';
  document.getElementById('insumoCostoManual').value = insumo?.costo_manual != null ? insumo.costo_manual : '';
  document.getElementById('ingTitulo').textContent = titulo;
  document.getElementById('btnEliminarModalInsumo').style.display = esEdicion ? 'inline-flex' : 'none';
  modal.style.display = 'flex';
}

export function cerrar(onCerrar) {
  const modal = document.getElementById('modalInsumo');
  if (modal) modal.style.display = 'none';
  if (typeof onCerrar === 'function') onCerrar();
}

async function eliminar(onEliminado) {
  const id = document.getElementById('insumoId').value;
  if (!id) return;

  const confirmado = await mostrarConfirmacion('Eliminar insumo', '¿Estás seguro de eliminar este insumo? Esta acción no se puede deshacer.');
  if (!confirmado) return;

  try {
    if (DBAppwrite && DBAppwrite.habilitado) {
      await DBAppwrite.eliminar('insumos', id);
    }
    const state = Store.obtenerEstado();
    const insumosActualizados = (state.insumos || []).filter(i => i.id != id);
    // ✅ Usar INSUMOS_INICIALIZAR que sí existe en el Store
    Store.despachar({ type: 'INSUMOS_INICIALIZAR', payload: insumosActualizados });
    mostrarToast('success', 'Insumo eliminado');
    cerrar(onEliminado);
    if (typeof onEliminado === 'function') setTimeout(onEliminado, 100);
  } catch (e) {
    Logger.error('[modal-insumo] Error al eliminar:', e);
    mostrarToast('error', 'Error al eliminar insumo');
  }
}

async function guardar(onGuardado) {
  const id = document.getElementById('insumoId').value;
  const nombre = document.getElementById('insumoNombre').value.trim();
  if (!nombre) { mostrarToast('error', 'Nombre obligatorio'); return; }

  const datos = {
    id: id || undefined,
    nombre,
    stock: parseFloat(document.getElementById('insumoStock').value) || 0,
    unidad: document.getElementById('insumoUnidad').value.trim() || 'u',
    stock_minimo: parseFloat(document.getElementById('insumoStockMin').value) || 0,
    categoria: document.getElementById('insumoCategoria').value,
    ubicacion: document.getElementById('insumoUbicacion').value.trim() || '',
    tipo: document.getElementById('insumoTipo').value,
    costo_manual: document.getElementById('insumoCostoManual').value !== '' ? parseFloat(document.getElementById('insumoCostoManual').value) : null
  };

  try {
    const resultado = await InventarioService.guardarInsumo(datos);
    if (!resultado || !resultado.exito) {
      mostrarToast('error', resultado?.error || 'Error al guardar');
      return;
    }

    mostrarToast('success', 'Insumo guardado');
    cerrar(onGuardado);
    if (typeof onGuardado === 'function') setTimeout(onGuardado, 100);
  } catch (e) {
    Logger.error('[modal-insumo] Error al guardar:', e);
    mostrarToast('error', 'Error inesperado al guardar');
  }
}

export function editarInsumo(id, onGuardado) {
  const insumos = Store.obtenerEstado().insumos || [];
  const insumo = insumos.find(i => i.id == id);
  if (insumo) mostrar(insumo, onGuardado);
}