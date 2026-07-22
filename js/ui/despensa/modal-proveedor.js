/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/modal-proveedor.js
   Versión: 1.0.1
   Propósito: Modal para crear y editar proveedores.
              v1.0.1: solo nombre y notas (texto libre).
   ================================================================ */

import { crearProveedorRepo } from '../../repositorios/proveedor-repository.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';

let _repo = null;
function _getRepo() {
  if (!_repo) _repo = crearProveedorRepo();
  return _repo;
}

export function mostrar(proveedor = null, onGuardado = null) {
  const esEdicion = !!proveedor;
  const titulo = esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor';
  let modal = document.getElementById('modalProveedor');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalProveedor';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small">
        <div class="modal-header"><h3 id="provTitulo">${titulo}</h3><button class="modal-close" id="btnCerrarModalProv"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <input type="hidden" id="provId">
          <label>Nombre</label><input type="text" id="provNombre" placeholder="Ej: Distribuidora Norte">
          <label>Notas</label><textarea id="provNotas" rows="3" placeholder="Dirección, teléfono, horario, referencias..."></textarea>
          <div class="modal-small-footer"><button class="btn-secondary" id="btnCancelarModalProv">Cancelar</button><button class="btn-primary" id="btnGuardarModalProv">Guardar</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalProv').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnCancelarModalProv').addEventListener('click', () => cerrar(onGuardado));
    document.getElementById('btnGuardarModalProv').addEventListener('click', () => guardar(onGuardado));
  }

  document.getElementById('provId').value = proveedor?.id || '';
  document.getElementById('provNombre').value = proveedor?.nombre || '';
  document.getElementById('provNotas').value = proveedor?.notas || '';
  document.getElementById('provTitulo').textContent = titulo;
  modal.style.display = 'flex';
}

export function cerrar(onCerrar) {
  const modal = document.getElementById('modalProveedor');
  if (modal) modal.style.display = 'none';
  if (typeof onCerrar === 'function') onCerrar();
}

async function guardar(onGuardado) {
  const id = document.getElementById('provId').value;
  const nombre = document.getElementById('provNombre').value.trim();
  if (!nombre) { mostrarToast('error', 'Nombre obligatorio'); return; }

  const datos = {
    id: id || null,
    nombre,
    notas: document.getElementById('provNotas').value.trim()
  };

  try {
    const repo = _getRepo();
    const resultado = await repo.guardarProveedor(datos);
    cerrar(onGuardado);
    mostrarToast('success', 'Proveedor guardado');
    if (typeof onGuardado === 'function') setTimeout(onGuardado, 100);
  } catch (e) {
    Logger.error('[modal-proveedor] Error al guardar:', e);
    mostrarToast('error', 'Error al guardar proveedor');
  }
}