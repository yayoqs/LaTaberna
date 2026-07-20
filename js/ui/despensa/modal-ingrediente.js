/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/modal-ingrediente.js
   Versión: 2.0.1
   Propósito: Modal para crear y editar ingredientes del inventario.
              v2.0.1: Mantiene fallback local con aviso y logs de diagnóstico.
   ================================================================ */

import { InventarioService } from '../../servicios/inventario-service.js';
import { DB } from '../../db.js';
import { Store } from '../../lib/store.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';

export function mostrar(ingrediente = null, onGuardado = null) {
  const esEdicion = !!ingrediente;
  const titulo = esEdicion ? 'Editar Ingrediente' : 'Nuevo Ingrediente';
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
          <label>Valor unitario ($)</label><input type="number" id="ingValorUnitario" step="0.01" value="0" placeholder="0.00">
          <div class="modal-small-footer"><button class="btn-secondary" id="btnCancelarModalIng">Cancelar</button><button class="btn-primary" id="btnGuardarModalIng">Guardar</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalIng').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnCancelarModalIng').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnGuardarModalIng').addEventListener('click', () => guardar(onGuardado));
  }

  document.getElementById('ingId').value = ingrediente?.id || '';
  document.getElementById('ingNombre').value = ingrediente?.nombre || '';
  document.getElementById('ingCategoria').value = ingrediente?.categoria || 'general';
  document.getElementById('ingStock').value = ingrediente?.stock || 0;
  document.getElementById('ingUnidad').value = ingrediente?.unidad || 'kg';
  document.getElementById('ingStockMin').value = ingrediente?.stock_minimo || 5;
  document.getElementById('ingUbicacion').value = ingrediente?.ubicacion || '';
  document.getElementById('ingValorUnitario').value = ingrediente?.valor_unitario || 0;
  document.getElementById('ingTitulo').textContent = titulo;
  modal.style.display = 'flex';
}

export function cerrar(onCerrar) {
  const modal = document.getElementById('modalIngrediente');
  if (modal) modal.style.display = 'none';
  if (typeof onCerrar === 'function') onCerrar();
}

export async function guardar(onGuardado) {
  const id = document.getElementById('ingId').value;
  const nombre = document.getElementById('ingNombre').value.trim();
  if (!nombre) { mostrarToast('error', 'Nombre obligatorio'); return; }

  const datos = {
    id: id || `ins_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
    nombre,
    stock: parseFloat(document.getElementById('ingStock').value) || 0,
    unidad: document.getElementById('ingUnidad').value.trim() || 'u',
    stock_minimo: parseFloat(document.getElementById('ingStockMin').value) || 0,
    categoria: document.getElementById('ingCategoria').value,
    ubicacion: document.getElementById('ingUbicacion').value.trim() || '',
    valor_unitario: parseFloat(document.getElementById('ingValorUnitario').value) || 0
  };

  // 1. Intento con Appwrite (InventarioService configurado por bootstrap)
  try {
    const resultado = await InventarioService.guardarIngrediente(datos);
    console.log('[modal-ingrediente] Resultado de Appwrite:', resultado);
    if (resultado && resultado.exito) {
      cerrar(onGuardado);
      mostrarToast('success', 'Ingrediente guardado');
      if (typeof onGuardado === 'function') setTimeout(() => onGuardado(), 100);
      return;
    } else {
      Logger.warn('[modal-ingrediente] Appwrite falló:', resultado?.error || 'Error desconocido');
    }
  } catch (e) {
    Logger.error('[modal-ingrediente] Excepción en Appwrite:', e);
  }

  // 2. Fallback local (DB)
  if (DB.ingredientes && Array.isArray(DB.ingredientes)) {
    try {
      const idx = DB.ingredientes.findIndex(i => i.id === datos.id);
      if (idx >= 0) {
        DB.ingredientes[idx] = datos;
      } else {
        DB.ingredientes.push(datos);
      }
      Store.despachar({ type: 'INGREDIENTE_GUARDADO', payload: datos });
      cerrar(onGuardado);
      mostrarToast('success', 'Ingrediente guardado (local)');
      if (typeof onGuardado === 'function') setTimeout(() => onGuardado(), 100);
      return;
    } catch (e) {
      Logger.error('[modal-ingrediente] Error en fallback local:', e);
    }
  }

  mostrarToast('error', 'Error al guardar ingrediente. Revisa la consola.');
}

export function editarIngrediente(id) {
  const ing = DB.ingredientes.find(i => i.id == id);
  if (ing) mostrar(ing);
}