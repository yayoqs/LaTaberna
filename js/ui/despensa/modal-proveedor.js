/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/modal-proveedor.js
   Versión: 1.1.0
   Propósito: Modal para crear y editar proveedores con todos los campos.
              v1.1.0: adaptado a laTaberna_Proveedores ampliada.
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
          <label>Nombre *</label><input type="text" id="provNombre" placeholder="Ej: Distribuidora Norte">
          <label>Tipo</label>
          <select id="provTipo">
            <option value="distribuidor">Distribuidor</option>
            <option value="supermercado">Supermercado</option>
            <option value="feria">Feria</option>
            <option value="huerta">Huerta</option>
            <option value="donacion">Donación</option>
            <option value="otro">Otro</option>
          </select>
          <label>Contacto</label><input type="text" id="provContacto" placeholder="Nombre de la persona de contacto">
          <label>Teléfono</label><input type="text" id="provTelefono" placeholder="+56 9 ...">
          <label>Email</label><input type="email" id="provEmail" placeholder="proveedor@correo.com">
          <label>Dirección</label><input type="text" id="provDireccion" placeholder="Calle, número, comuna">
          <label>Rubro</label><input type="text" id="provRubro" placeholder="Ej: Lácteos, Bebidas, Abarrotes">
          <label>Notas</label><textarea id="provNotas" rows="2" placeholder="Horario, referencias, condiciones..."></textarea>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="provActivo" checked style="width:auto;"> Proveedor activo
          </label>
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
  document.getElementById('provTipo').value = proveedor?.tipo || 'otro';
  document.getElementById('provContacto').value = proveedor?.contacto || '';
  document.getElementById('provTelefono').value = proveedor?.telefono || '';
  document.getElementById('provEmail').value = proveedor?.email || '';
  document.getElementById('provDireccion').value = proveedor?.direccion || '';
  document.getElementById('provRubro').value = proveedor?.rubro || '';
  document.getElementById('provNotas').value = proveedor?.notas || '';
  document.getElementById('provActivo').checked = proveedor?.activo !== false;
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
    tipo: document.getElementById('provTipo').value,
    contacto: document.getElementById('provContacto').value.trim(),
    telefono: document.getElementById('provTelefono').value.trim(),
    email: document.getElementById('provEmail').value.trim(),
    direccion: document.getElementById('provDireccion').value.trim(),
    rubro: document.getElementById('provRubro').value.trim(),
    notas: document.getElementById('provNotas').value.trim(),
    activo: document.getElementById('provActivo').checked
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