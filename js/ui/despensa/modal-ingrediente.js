/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/modal-ingrediente.js
   Versión: 2.3.2
   Propósito: Modal para crear/editar/eliminar ingredientes con selector
              de proveedor y precio de proveedor.
              v2.3.2: editarIngrediente lee del Store.
   ================================================================ */

import { InventarioService } from '../../servicios/inventario-service.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Store } from '../../lib/store.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast, mostrarConfirmacion } from '../../utils.js';
import { crearProveedorRepo } from '../../repositorios/proveedor-repository.js';

let _repoProveedor = null;
function _getRepoProv() {
  if (!_repoProveedor) _repoProveedor = crearProveedorRepo();
  return _repoProveedor;
}

export async function mostrar(ingrediente = null, onGuardado = null) {
  const esEdicion = !!ingrediente;
  const titulo = esEdicion ? 'Editar Ingrediente' : 'Nuevo Ingrediente';

  let proveedores = [];
  try {
    proveedores = await _getRepoProv().obtenerProveedores();
  } catch (e) {
    Logger.warn('[modal-ingrediente] No se pudieron cargar proveedores:', e);
  }

  let modal = document.getElementById('modalIngrediente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalIngrediente';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small">
        <div class="modal-header"><h3 id="ingTitulo">${titulo}</h3><button class="modal-close" id="btnCerrarModalIng"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <input type="hidden" id="ingId">
          <label>Nombre</label><input type="text" id="ingNombre" placeholder="Ej: Harina 000">
          <label>Categoría</label><select id="ingCategoria"><option value="cocina">Cocina</option><option value="barra">Barra</option><option value="general">General</option></select>
          <label>Stock actual</label><input type="number" id="ingStock" step="0.01" value="0">
          <label>Unidad</label><input type="text" id="ingUnidad" placeholder="kg, g, L, u" value="kg">
          <label>Stock mínimo</label><input type="number" id="ingStockMin" step="0.01" value="5">
          <label>Ubicación</label><input type="text" id="ingUbicacion" placeholder="Ej: Estante 3">
          <label>Proveedor</label>
          <select id="ingProveedorSelect">
            <option value="">Sin proveedor</option>
          </select>
          <label>Precio proveedor ($)</label><input type="number" id="ingPrecioProveedor" step="0.01" value="0" placeholder="0.00">
          <label>Valor unitario ($)</label><input type="number" id="ingValorUnitario" step="0.01" value="0" placeholder="0.00">
          <div class="modal-small-footer" style="justify-content: space-between;">
            <button class="btn-danger" id="btnEliminarModalIng" style="display:none;"><i class="fas fa-trash"></i> Eliminar</button>
            <div style="display:flex; gap:10px;">
              <button class="btn-secondary" id="btnCancelarModalIng">Cancelar</button>
              <button class="btn-primary" id="btnGuardarModalIng">Guardar</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalIng').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnCancelarModalIng').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnGuardarModalIng').addEventListener('click', () => guardar(onGuardado));
    document.getElementById('btnEliminarModalIng').addEventListener('click', () => eliminar(onGuardado));
  }

  const selectProv = document.getElementById('ingProveedorSelect');
  selectProv.innerHTML = '<option value="">Sin proveedor</option>';
  proveedores.forEach(p => {
    const option = document.createElement('option');
    option.value = p.nombre;
    option.textContent = p.nombre;
    selectProv.appendChild(option);
  });

  document.getElementById('ingId').value = ingrediente?.id || '';
  document.getElementById('ingNombre').value = ingrediente?.nombre || '';
  document.getElementById('ingCategoria').value = ingrediente?.categoria || 'general';
  document.getElementById('ingStock').value = ingrediente?.stock || 0;
  document.getElementById('ingUnidad').value = ingrediente?.unidad || 'kg';
  document.getElementById('ingStockMin').value = ingrediente?.stock_minimo || 5;
  document.getElementById('ingUbicacion').value = ingrediente?.ubicacion || '';

  const proveedorActual = ingrediente?.proveedor || '';
  selectProv.value = proveedorActual;
  if (proveedorActual && !proveedores.some(p => p.nombre === proveedorActual)) {
    const option = document.createElement('option');
    option.value = proveedorActual;
    option.textContent = proveedorActual;
    selectProv.appendChild(option);
    selectProv.value = proveedorActual;
  }

  document.getElementById('ingPrecioProveedor').value = ingrediente?.precio_proveedor || ingrediente?.valor_unitario || 0;
  document.getElementById('ingValorUnitario').value = ingrediente?.valor_unitario || 0;
  document.getElementById('ingTitulo').textContent = titulo;
  document.getElementById('btnEliminarModalIng').style.display = esEdicion ? 'inline-flex' : 'none';
  modal.style.display = 'flex';
}

export function cerrar(onCerrar) {
  const modal = document.getElementById('modalIngrediente');
  if (modal) modal.style.display = 'none';
  if (typeof onCerrar === 'function') onCerrar();
}

async function eliminar(onEliminado) {
  const id = document.getElementById('ingId').value;
  if (!id) return;

  const confirmado = await mostrarConfirmacion(
    'Eliminar ingrediente',
    '¿Estás seguro de que deseas eliminar este ingrediente? Esta acción no se puede deshacer.'
  );
  if (!confirmado) return;

  try {
    if (DBAppwrite && DBAppwrite.habilitado) {
      await DBAppwrite.eliminar('ingredientes', id);
    }
    // La acción en el Store la despacha el repositorio
    const state = Store.obtenerEstado();
    const ingredientesActualizados = (state.ingredientes || []).filter(i => i.id != id);
    Store.despachar({ type: 'INGREDIENTES_INICIALIZAR', payload: ingredientesActualizados });
    mostrarToast('success', 'Ingrediente eliminado');
    cerrar(onEliminado);
    if (typeof onEliminado === 'function') setTimeout(onEliminado, 100);
  } catch (e) {
    Logger.error('[modal-ingrediente] Error al eliminar:', e);
    mostrarToast('error', 'Error al eliminar ingrediente');
  }
}

export async function guardar(onGuardado) {
  const id = document.getElementById('ingId').value;
  const nombre = document.getElementById('ingNombre').value.trim();
  if (!nombre) { mostrarToast('error', 'Nombre obligatorio'); return; }

  const proveedorSeleccionado = document.getElementById('ingProveedorSelect').value;
  const precioProveedor = parseFloat(document.getElementById('ingPrecioProveedor').value) || 0;

  const datos = {
    id: id || `ins_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
    nombre,
    stock: parseFloat(document.getElementById('ingStock').value) || 0,
    unidad: document.getElementById('ingUnidad').value.trim() || 'u',
    stock_minimo: parseFloat(document.getElementById('ingStockMin').value) || 0,
    categoria: document.getElementById('ingCategoria').value,
    ubicacion: document.getElementById('ingUbicacion').value.trim() || '',
    valor_unitario: parseFloat(document.getElementById('ingValorUnitario').value) || 0,
    proveedor: proveedorSeleccionado,
    precio_proveedor: precioProveedor
  };

  try {
    const resultado = await InventarioService.guardarIngrediente(datos);
    if (!resultado || !resultado.exito) {
      mostrarToast('error', resultado?.error || 'Error al guardar');
      return;
    }

    mostrarToast('success', 'Ingrediente guardado');
    cerrar(onGuardado);
    if (typeof onGuardado === 'function') setTimeout(onGuardado, 100);
  } catch (e) {
    Logger.error('[modal-ingrediente] Error al guardar:', e);
    mostrarToast('error', 'Error inesperado al guardar');
  }
}

export function editarIngrediente(id, onGuardado) {
  const ingredientes = Store.obtenerEstado().ingredientes || [];
  const ing = ingredientes.find(i => i.id == id);
  if (ing) mostrar(ing, onGuardado);
}