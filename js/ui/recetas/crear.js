/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/crear.js
   Versión: 2.1.0
   Propósito: Modal sheet para crear/editar recetas.
              Migrado a state.insumos.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';
import { DBInventario } from '../../db-inventario.js';
import { mostrarToast } from '../../utils.js';
import { getModo } from './estado.js';
import { pintar } from './renderer.js';
import { crearRecetaRepo } from '../../repositorios/receta-repository.js';

let _modalAbierto = false;
let _editandoId = null;
let _ingredientesActuales = [];
let _pasosActuales = [];
let _repo = null;

function _getRepo() {
  if (!_repo) _repo = crearRecetaRepo();
  return _repo;
}

export function mostrarModalReceta(idReceta = null) {
  if (getModo() !== 'produccion') return mostrarToast('error', 'Acceso denegado');

  _editandoId = idReceta;
  _asegurarModal();

  const state = Store.obtenerEstado();
  const recetas = state.recetas || [];
  const receta = idReceta ? recetas.find(r => r.id === idReceta) : null;

  const categorias = [...new Set(recetas.map(r => r.categoria || 'sin_categoria'))].sort();
  const datalistCap = document.getElementById('recModalListaCapitulos');
  if (datalistCap) datalistCap.innerHTML = categorias.map(c => `<option value="${c}">`).join('');

  if (receta) {
    const recetaConProducto = DBInventario.obtenerRecetaConProducto(receta.id);
    document.getElementById('recModalNombre').value = recetaConProducto ? recetaConProducto.nombre : '';
    document.getElementById('recModalCapitulo').value = receta.categoria || 'sin_categoria';
    document.getElementById('recModalNivel').value = receta.nivel || '';
    document.getElementById('recModalIntermedio').checked = !!receta.es_intermedio;
    const destinoActivo = receta.destino || 'cocina';
    document.querySelectorAll('#recModalToggleDestino button').forEach(btn => {
      btn.classList.toggle('activo', btn.dataset.destino === destinoActivo);
      if (btn.dataset.destino === 'barra') btn.classList.toggle('barra', destinoActivo === 'barra');
    });
    const insumosState = state.insumos || [];
    _ingredientesActuales = (receta.ingredientes || []).map(ing => {
      const tipo = ing.tipo || 'insumo';
      let nombre = ing.id;
      let unidad = '';
      if (tipo === 'insumo') {
        const insumoData = insumosState.find(i => i.id == ing.id);
        nombre = insumoData ? insumoData.nombre : ing.id;
        unidad = insumoData ? insumoData.unidad : '';
      } else {
        const sub = recetas.find(r => r.id == ing.id);
        const subConProducto = sub ? DBInventario.obtenerRecetaConProducto(sub.id) : null;
        nombre = subConProducto ? subConProducto.nombre : (sub ? sub.productoId : ing.id);
        unidad = sub ? sub.unidadStock : '';
      }
      return { tipo, id: ing.id, cantidad: ing.cantidad, _nombre: nombre, _unidad: unidad };
    });
    _pasosActuales = (receta.instrucciones || '').split('\n').filter(l => l.trim());
    if (!_pasosActuales.length) _pasosActuales = [''];
    document.getElementById('recModalTitulo').textContent = 'Editar Receta';
  } else {
    document.getElementById('recModalNombre').value = '';
    document.getElementById('recModalCapitulo').value = '';
    document.getElementById('recModalNivel').value = '';
    document.getElementById('recModalIntermedio').checked = false;
    document.querySelectorAll('#recModalToggleDestino button').forEach(btn => {
      btn.classList.toggle('activo', btn.dataset.destino === 'cocina');
      btn.classList.remove('barra');
    });
    _ingredientesActuales = [];
    _pasosActuales = [''];
    document.getElementById('recModalTitulo').textContent = 'Nueva Receta';
  }

  _pintarIngredientes();
  _pintarPasos();
  _actualizarSelectorIngredientes();
  _modalAbierto = true;
  document.getElementById('modalRecetaSheet').classList.add('activo');
}

function _asegurarModal() {
  if (document.getElementById('modalRecetaSheet')) return;

  const overlay = document.createElement('div');
  overlay.id = 'modalRecetaSheet';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="recetas-modal-sheet">
      <div class="recetas-modal-handle"></div>
      <div class="recetas-modal-header">
        <h3 class="recetas-font-libro" id="recModalTitulo">Nueva Receta</h3>
        <button class="recetas-modal-close" id="btnCerrarModalSheet"><i class="fas fa-times"></i></button>
      </div>
      <div class="recetas-modal-body">
        <div class="recetas-campo">
          <label>Nombre del producto</label>
          <input type="text" id="recModalNombre" placeholder="Ej: Cebolla caramelizada">
        </div>
        <div class="recetas-fila">
          <div class="recetas-campo">
            <label>Capítulo</label>
            <input type="text" id="recModalCapitulo" placeholder="Ej: Salsas, Guarniciones..." list="recModalListaCapitulos" autocomplete="off">
            <datalist id="recModalListaCapitulos"></datalist>
          </div>
          <div class="recetas-campo">
            <label>Nivel (etiqueta)</label>
            <input type="text" id="recModalNivel" placeholder="Ej: salsa, guarnicion...">
          </div>
        </div>
        <div class="recetas-campo">
          <label>Destino</label>
          <div class="recetas-toggle-destino" id="recModalToggleDestino">
            <button class="activo" data-destino="cocina"><i class="fas fa-fire-burner"></i> Cocina</button>
            <button data-destino="barra"><i class="fas fa-wine-glass"></i> Barra</button>
          </div>
        </div>
        <div class="recetas-campo">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="recModalIntermedio" style="width:auto;">
            ¿Es una preparación intermedia? (genera stock interno)
          </label>
        </div>
        <div class="recetas-campo">
          <label>Ingredientes</label>
          <div class="recetas-ingredientes-lista" id="recModalIngredientesLista"></div>
          <div class="recetas-agregar-ingrediente" style="margin-top:8px;">
            <select id="recModalTipoIng" style="flex:1;">
              <option value="insumo">Insumo (Despensa)</option>
              <option value="subreceta">Sub-receta (Preparación)</option>
            </select>
            <select id="recModalSelectorIng" style="flex:2;">
              <option value="">— Seleccionar —</option>
            </select>
            <input type="number" id="recModalCantidadIng" placeholder="Cant." step="0.01" style="width:70px;">
            <button class="recetas-boton-nueva" id="btnAgregarIngModal" style="padding:8px 12px;font-size:11px;">Agregar</button>
          </div>
        </div>
        <div class="recetas-campo">
          <label>Instrucciones (por pasos)</label>
          <div class="recetas-pasos-editor" id="recModalPasosEditor"></div>
          <button class="recetas-btn-agregar-paso" id="btnAgregarPasoModal" style="margin-top:8px;">
            <i class="fas fa-plus"></i> Añadir paso
          </button>
        </div>
      </div>
      <div class="recetas-modal-footer">
        <button class="recetas-btn-cancelar" id="btnCancelarModalSheet">Cancelar</button>
        <button class="recetas-btn-guardar" id="btnGuardarModalSheet"><i class="fas fa-save"></i> Guardar</button>
      </div>
    </div>`;

  const vista = document.getElementById('view-recetas');
  if (vista) {
    vista.appendChild(overlay);
  } else {
    document.body.appendChild(overlay);
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModalReceta(); });
  document.getElementById('btnCerrarModalSheet').addEventListener('click', cerrarModalReceta);
  document.getElementById('btnCancelarModalSheet').addEventListener('click', cerrarModalReceta);
  document.getElementById('btnGuardarModalSheet').addEventListener('click', _guardarReceta);

  document.querySelectorAll('#recModalToggleDestino button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#recModalToggleDestino button').forEach(b => {
        b.classList.remove('activo', 'barra');
      });
      btn.classList.add('activo');
      if (btn.dataset.destino === 'barra') btn.classList.add('barra');
    });
  });

  document.getElementById('recModalTipoIng').addEventListener('change', _actualizarSelectorIngredientes);
  document.getElementById('btnAgregarIngModal').addEventListener('click', _agregarIngrediente);
  document.getElementById('btnAgregarPasoModal').addEventListener('click', () => {
    _pasosActuales.push('');
    _pintarPasos();
  });
}

export function cerrarModalReceta() {
  _modalAbierto = false;
  const modal = document.getElementById('modalRecetaSheet');
  if (modal) modal.classList.remove('activo');
}

function _actualizarSelectorIngredientes() {
  const tipo = document.getElementById('recModalTipoIng').value;
  const select = document.getElementById('recModalSelectorIng');
  select.innerHTML = '<option value="">— Seleccionar —</option>';
  const state = Store.obtenerEstado();
  if (tipo === 'insumo') {
    (state.insumos || []).forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = `${i.nombre} (${i.unidad})`;
      opt.dataset.unidad = i.unidad;
      opt.dataset.nombre = i.nombre;
      select.appendChild(opt);
    });
  } else {
    (state.recetas || []).filter(r => r.es_intermedio).forEach(r => {
      const recetaConProducto = DBInventario.obtenerRecetaConProducto(r.id);
      const nombre = recetaConProducto ? recetaConProducto.nombre : r.productoId;
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${nombre} (${r.unidadStock || ''})`;
      opt.dataset.unidad = r.unidadStock || '';
      opt.dataset.nombre = nombre;
      select.appendChild(opt);
    });
  }
}

function _pintarIngredientes() {
  const lista = document.getElementById('recModalIngredientesLista');
  if (!lista) return;
  if (!_ingredientesActuales.length) {
    lista.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">Sin ingredientes</div>';
    return;
  }
  lista.innerHTML = _ingredientesActuales.map((ing, idx) => `
    <div class="recetas-ingrediente-item">
      <span class="recetas-tipo-badge ${ing.tipo === 'subreceta' ? 'recetas-tipo-subreceta' : 'recetas-tipo-insumo'}">${ing.tipo === 'subreceta' ? 'Sub-receta' : 'Insumo'}</span>
      <span>${ing._nombre}</span>
      <span style="font-weight:700;color:var(--color-accent);white-space:nowrap;">${ing.cantidad} ${ing._unidad}</span>
      <button class="recetas-quitar-ing" data-idx="${idx}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
  lista.querySelectorAll('.recetas-quitar-ing').forEach(btn => {
    btn.addEventListener('click', () => {
      _ingredientesActuales.splice(parseInt(btn.dataset.idx), 1);
      _pintarIngredientes();
    });
  });
}

function _agregarIngrediente() {
  const tipo = document.getElementById('recModalTipoIng').value;
  const select = document.getElementById('recModalSelectorIng');
  const cantidad = parseFloat(document.getElementById('recModalCantidadIng').value);
  if (!select.value || isNaN(cantidad) || cantidad <= 0) {
    mostrarToast('warning', 'Selecciona un ingrediente y una cantidad válida');
    return;
  }
  const opt = select.options[select.selectedIndex];
  _ingredientesActuales.push({
    tipo,
    id: select.value,
    cantidad,
    _nombre: opt.dataset.nombre,
    _unidad: opt.dataset.unidad
  });
  document.getElementById('recModalCantidadIng').value = '';
  select.value = '';
  _pintarIngredientes();
}

function _pintarPasos() {
  const editor = document.getElementById('recModalPasosEditor');
  if (!editor) return;
  if (!_pasosActuales.length) {
    editor.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">Sin pasos definidos</div>';
    return;
  }
  editor.innerHTML = _pasosActuales.map((paso, idx) => `
    <div class="recetas-paso-editor-item">
      <span class="recetas-paso-editor-num">${idx + 1}</span>
      <input type="text" class="recetas-paso-editor-input" value="${paso.replace(/"/g, '&quot;')}" data-idx="${idx}" placeholder="Describe este paso...">
      <button class="recetas-btn-quitar-paso" data-idx="${idx}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
  editor.querySelectorAll('.recetas-paso-editor-input').forEach(input => {
    input.addEventListener('input', (e) => {
      _pasosActuales[parseInt(e.target.dataset.idx)] = e.target.value;
    });
  });
  editor.querySelectorAll('.recetas-btn-quitar-paso').forEach(btn => {
    btn.addEventListener('click', () => {
      _pasosActuales.splice(parseInt(btn.dataset.idx), 1);
      _pintarPasos();
    });
  });
}

async function _guardarReceta() {
  const nombre = document.getElementById('recModalNombre').value.trim();
  const capitulo = document.getElementById('recModalCapitulo').value.trim() || 'sin_categoria';
  const nivel = document.getElementById('recModalNivel').value.trim().toLowerCase();
  const esIntermedio = document.getElementById('recModalIntermedio').checked;
  const destino = document.querySelector('#recModalToggleDestino button.activo')?.dataset.destino || 'cocina';
  const pasosValidos = _pasosActuales.filter(p => p.trim());
  const ingredientes = _ingredientesActuales.map(ing => ({
    tipo: ing.tipo,
    id: ing.id,
    cantidad: ing.cantidad,
    unidad: ing._unidad || ''
  }));

  if (!nombre) { mostrarToast('error', 'El nombre es obligatorio'); return; }
  if (!ingredientes.length) { mostrarToast('error', 'Añade al menos un ingrediente'); return; }
  if (!pasosValidos.length) { mostrarToast('error', 'Añade al menos un paso'); return; }

  const state = Store.obtenerEstado();
  const productos = state.productos || [];
  const repo = _getRepo();

  let producto = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (!producto) {
    producto = await repo.guardarProducto({
      nombre,
      activo: true,
      destino
    });
  }

  const recetaExistente = _editandoId ? await repo.obtenerPorId(_editandoId) : null;
  let recetaGuardada;

  if (recetaExistente) {
    recetaExistente.productoId = producto.id;
    recetaExistente.nivel = nivel || 'sin_nivel';
    recetaExistente.categoria = capitulo;
    recetaExistente.es_intermedio = esIntermedio;
    recetaExistente.destino = destino;
    recetaExistente.ingredientes = ingredientes;
    recetaExistente.instrucciones = pasosValidos.join('\n');
    recetaGuardada = await repo.guardarReceta(recetaExistente);
  } else {
    recetaGuardada = await repo.guardarReceta({
      productoId: producto.id,
      nivel: nivel || 'sin_nivel',
      categoria: capitulo,
      es_intermedio: esIntermedio,
      destino,
      ingredientes,
      instrucciones: pasosValidos.join('\n'),
      creadoPor: Auth.obtenerRol(),
      creadoEn: new Date().toISOString()
    });
  }

  EventBus.emit('recetas:actualizadas');
  cerrarModalReceta();
  mostrarToast('success', _editandoId ? 'Receta actualizada' : 'Receta creada');
  pintar();
}