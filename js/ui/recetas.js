/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/recetas.js
   Versión: 6.0.1
   Propósito: Centro de creación de Cocina/Barra. Gestión de recetas
              con niveles libres, stock interno (es_intermedio),
              ingredientes tipados (insumo / subreceta) y anidamiento.
              Pestañas internas: Recetario | Mi Stock | Planificación.
              Ciclo de vida con activar()/limpiar().
              Corrección: migradas referencias de ingredienteId a id.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';
import { Logger } from '../lib/logger.js';
import { mostrarToast, mostrarConfirmacion, obtenerColorDesdeNombre } from '../utils.js';

/* ─── Estado interno ────────────────────────── */
let _modo = null;
let _activada = false;
let _canceladores = [];
let _pestanaActiva = 'recetario';
let _busqueda = '';
let _filtroNivel = 'todos';

/* ─── Vista ─────────────────────────────────── */

function _asegurarVista() {
  let main = document.getElementById('view-recetas');
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-recetas';
    main.className = 'view';
    document.body.appendChild(main);
  }
  if (!main.querySelector('#recetas-contenedor')) {
    _construirVista(main);
  }
}

function _construirVista(main) {
  main.innerHTML = `
    <div class="recetas-pestanas" id="recetas-pestanas">
      <div class="recetas-pestana activo" data-pestana="recetario"><i class="fas fa-book-open"></i><span>Recetario</span></div>
      <div class="recetas-pestana" data-pestana="stock"><i class="fas fa-boxes"></i><span>Mi Stock</span></div>
      <div class="recetas-pestana" data-pestana="planificacion"><i class="fas fa-tasks"></i><span>Planificación</span></div>
    </div>
    <div id="recetas-contenedor" class="recetas-contenedor"></div>
  `;

  document.getElementById('recetas-pestanas').addEventListener('click', e => {
    const pestana = e.target.closest('.recetas-pestana');
    if (!pestana) return;
    _pestanaActiva = pestana.dataset.pestana;
    document.querySelectorAll('#recetas-pestanas .recetas-pestana').forEach(p => p.classList.toggle('activo', p === pestana));
    _pintar();
  });
}

/* ─── Pintado principal ─────────────────────── */

function _pintar(modo) {
  if (!_activada) {
    activar();
  }

  if (modo) _modo = modo;
  else _modo = (Auth.getRol() === 'admin' || Auth.getRol() === 'master' || Auth.getRol() === 'cocina' || Auth.getRol() === 'barra') ? 'produccion' : 'consulta';

  _asegurarVista();
  const contenedor = document.getElementById('recetas-contenedor');
  if (!contenedor) return;

  switch (_pestanaActiva) {
    case 'recetario': _pintarRecetario(contenedor); break;
    case 'stock': _pintarStock(contenedor); break;
    case 'planificacion': _pintarPlanificacion(contenedor); break;
    default: _pintarRecetario(contenedor);
  }
}

/* ─── Recetario ─────────────────────────────── */

function _pintarRecetario(contenedor) {
  const state = Store.getState();
  let recetas = state.recetas || [];
  const productos = state.productos || [];

  recetas = recetas.map(r => {
    const prod = productos.find(p => p.id == r.productoId);
    return { ...r, _productoNombre: prod ? prod.nombre : 'Sin producto', _productoActivo: prod ? prod.activo !== false : true };
  }).filter(r => r._productoActivo);

  if (_busqueda) {
    const t = _busqueda.toLowerCase();
    recetas = recetas.filter(r => r._productoNombre.toLowerCase().includes(t));
  }

  if (_filtroNivel !== 'todos') {
    recetas = recetas.filter(r => (r.nivel || 'sin_nivel') === _filtroNivel);
  }

  const nivelesUnicos = [...new Set(recetas.map(r => r.nivel || 'sin_nivel').filter(Boolean))].sort();
  const esProduccion = _modo === 'produccion';

  contenedor.innerHTML = `
    <div class="recetas-toolbar">
      <div class="recetas-busqueda">
        <i class="fas fa-search"></i>
        <input type="text" id="recetas-buscar" placeholder="Buscar receta..." value="${_busqueda}">
      </div>
      <select id="recetas-filtro-nivel" class="recetas-select">
        <option value="todos">Todos los niveles</option>
        ${nivelesUnicos.map(n => `<option value="${n}" ${_filtroNivel === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      ${esProduccion ? `<button class="recetas-boton-nueva" id="recetas-boton-nueva"><i class="fas fa-plus"></i> Nueva</button>` : ''}
    </div>
    <div class="recetas-cuadricula" id="recetas-cuadricula"></div>
  `;

  document.getElementById('recetas-buscar').addEventListener('input', e => {
    _busqueda = e.target.value.trim();
    _pintarRecetario(contenedor);
  });
  document.getElementById('recetas-filtro-nivel').addEventListener('change', e => {
    _filtroNivel = e.target.value;
    _pintarRecetario(contenedor);
  });
  if (esProduccion) {
    document.getElementById('recetas-boton-nueva').addEventListener('click', () => _mostrarModalReceta());
  }

  const cuadricula = document.getElementById('recetas-cuadricula');
  if (!recetas.length) {
    cuadricula.innerHTML = '<div class="recetas-vacia">No se encontraron recetas</div>';
    return;
  }

  recetas.sort((a, b) => a._productoNombre.localeCompare(b._productoNombre));

  cuadricula.innerHTML = recetas.map(r => {
    const color = obtenerColorDesdeNombre(r._productoNombre);
    const nivel = r.nivel || 'sin_nivel';
    const tipoBadge = r.es_intermedio
      ? '<span class="recetas-badge-intermedio">Preparación</span>'
      : '<span class="recetas-badge-final">Producto final</span>';
    const numIng = r.ingredientes ? r.ingredientes.length : 0;
    const stockInfo = r.es_intermedio ? `<span class="recetas-badge-stock">${r.stockActual || 0} ${r.unidadStock || ''}</span>` : '';
    return `
      <div class="recetas-tarjeta" data-receta="${r.id}">
        <div class="recetas-tarjeta-img" style="background-color:${color}">
          ${r._productoNombre.charAt(0).toUpperCase()}
          <span class="recetas-tarjeta-badge">${numIng} <i class="fas fa-boxes"></i></span>
        </div>
        <div class="recetas-tarjeta-nombre">${r._productoNombre}</div>
        <div class="recetas-tarjeta-nivel">${nivel} ${stockInfo} ${tipoBadge}</div>
      </div>
    `;
  }).join('');

  cuadricula.querySelectorAll('.recetas-tarjeta').forEach(tarjeta => {
    tarjeta.addEventListener('click', () => {
      if (esProduccion) _mostrarVistaCompleta(tarjeta.dataset.receta);
      else _mostrarDetalle(tarjeta.dataset.receta);
    });
  });
}

/* ─── Mi Stock ──────────────────────────────── */

function _pintarStock(contenedor) {
  const state = Store.getState();
  const recetas = (state.recetas || []).filter(r => r.es_intermedio);
  const productos = state.productos || [];

  const stockItems = recetas.map(r => {
    const prod = productos.find(p => p.id == r.productoId);
    return { ...r, _productoNombre: prod ? prod.nombre : r.productoId, _productoActivo: prod ? prod.activo !== false : true };
  }).filter(r => r._productoActivo).sort((a, b) => a._productoNombre.localeCompare(b._productoNombre));

  const alertaBaja = stockItems.filter(r => (r.stockActual || 0) <= 1);

  contenedor.innerHTML = `
    <div class="recetas-toolbar">
      <h3><i class="fas fa-boxes"></i> Stock Interno de Preparaciones</h3>
      <span class="recetas-stock-resumen">${stockItems.length} preparaciones · ${alertaBaja.length} con stock bajo</span>
    </div>
    ${stockItems.length === 0 ? '<div class="recetas-vacia">No hay preparaciones con stock interno</div>' : `
      <div class="recetas-tabla-stock">
        <table>
          <thead><tr><th>Preparación</th><th>Nivel</th><th>Stock</th><th>Unidad</th><th>Acciones</th></tr></thead>
          <tbody>
            ${stockItems.map(r => `
              <tr class="${(r.stockActual || 0) <= 1 ? 'recetas-stock-bajo' : ''}">
                <td><strong>${r._productoNombre}</strong></td>
                <td><span class="recetas-chip-nivel">${r.nivel || 'sin_nivel'}</span></td>
                <td><span class="recetas-stock-valor">${r.stockActual || 0}</span></td>
                <td>${r.unidadStock || ''}</td>
                <td>
                  <button class="recetas-accion-preparar" data-receta="${r.id}" title="Preparar más"><i class="fas fa-fire"></i> Preparar</button>
                  <button class="recetas-accion-ver" data-receta="${r.id}" title="Ver receta"><i class="fas fa-eye"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  contenedor.querySelectorAll('.recetas-accion-preparar').forEach(btn => {
    btn.addEventListener('click', () => _ejecutarPreparacion(btn.dataset.receta));
  });
  contenedor.querySelectorAll('.recetas-accion-ver').forEach(btn => {
    btn.addEventListener('click', () => _mostrarDetalle(btn.dataset.receta));
  });
}

/* ─── Planificación (placeholder) ───────────── */

function _pintarPlanificacion(contenedor) {
  contenedor.innerHTML = `
    <div class="recetas-planificacion-placeholder">
      <i class="fas fa-tasks" style="font-size:48px;opacity:.3;"></i>
      <h3>Planificación de Tareas</h3>
      <p>Próximamente — Esta sección se integrará en la vista del KDS como parte del flujo de trabajo durante el turno.</p>
      <p class="recetas-nota">Podrás crear tareas de mise en place, asignarlas a ayudantes y seguir el avance en tiempo real.</p>
    </div>
  `;
}

/* ─── Detalle rápido (modal, usado por KDS) ─── */

function _mostrarDetalle(idReceta) {
  const state = Store.getState();
  const receta = (state.recetas || []).find(r => r.id === idReceta || r.productoId == idReceta);
  if (!receta) { mostrarToast('error', 'Receta no encontrada'); return; }
  const prod = (state.productos || []).find(p => p.id == receta.productoId);
  const nombre = prod ? prod.nombre : 'Receta';

  let modal = document.getElementById('modalRecetaDetalle');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRecetaDetalle';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="recetas-modal-detalle">
        <div class="modal-header"><h3 id="detalleTitulo"></h3><button class="modal-close" id="btnCerrarDetalle"><i class="fas fa-times"></i></button></div>
        <div class="recetas-modal-cuerpo">
          <div id="detalleIngredientes"></div>
          <div id="detalleCosto"></div>
          <div id="detalleInstrucciones"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="btnCerrarDetalle2">Cerrar</button>
          <button class="btn-secondary" id="btnExportarPDF"><i class="fas fa-print"></i> Exportar PDF</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnCerrarDetalle').addEventListener('click', _cerrarDetalle);
    document.getElementById('btnCerrarDetalle2').addEventListener('click', _cerrarDetalle);
    document.getElementById('btnExportarPDF').addEventListener('click', () => _exportarPDF(receta.id));
  }

  const tipoReceta = receta.es_intermedio ? 'Preparación intermedia' : 'Producto final';
  document.getElementById('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${nombre} <span class="recetas-chip-nivel">${receta.nivel || 'sin_nivel'}</span> <span class="recetas-tipo-badge">${tipoReceta}</span>`;
  if (receta.es_intermedio) {
    document.getElementById('detalleTitulo').innerHTML += ` <span class="recetas-stock-info">Stock: ${receta.stockActual || 0} ${receta.unidadStock || ''}</span>`;
  }

  // Construir árbol de ingredientes
  const htmlIngredientes = _construirArbolIngredientes(receta.ingredientes || [], state, 0);
  document.getElementById('detalleIngredientes').innerHTML = `<h4><i class="fas fa-list-ul"></i> Ingredientes</h4>${htmlIngredientes}`;
  document.getElementById('detalleCosto').innerHTML = '';
  document.getElementById('detalleInstrucciones').innerHTML = `<h4><i class="fas fa-tasks"></i> Preparación</h4><div class="recetas-pasos">${(receta.instrucciones || 'Sin instrucciones').split('\n').filter(l => l.trim()).map((l, i) => `<div class="recetas-paso"><span class="recetas-paso-num">${i+1}</span><span class="recetas-paso-texto">${l}</span></div>`).join('') || '<p>Sin instrucciones.</p>'}</div>`;

  modal.dataset.recetaId = idReceta;
  modal.style.display = 'flex';
}

function _construirArbolIngredientes(ingredientes, state, profundidad) {
  if (!ingredientes.length) return '<p class="recetas-sin-ingredientes">Sin ingredientes</p>';

  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  const productosState = state.productos || [];

  let html = '<ul class="recetas-arbol-ingredientes">';
  ingredientes.forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const ingData = ingredientesState.find(i => i.id == ing.id);
      const nombre = ingData ? ingData.nombre : ing.id;
      html += `
        <li class="recetas-nodo-insumo">
          <span class="recetas-ing-nombre">🧄 ${nombre}</span>
          <span class="recetas-ing-cantidad">${ing.cantidad} ${ingData?.unidad || ing.unidad || ''}</span>
        </li>`;
    } else if (tipo === 'subreceta') {
      const subReceta = recetasState.find(r => r.id == ing.id);
      const prod = subReceta ? productosState.find(p => p.id == subReceta.productoId) : null;
      const nombreSub = prod ? prod.nombre : (subReceta ? subReceta.productoId : ing.id);
      html += `
        <li class="recetas-nodo-subreceta">
          <details ${profundidad === 0 ? 'open' : ''}>
            <summary>
              <span class="recetas-ing-nombre">📦 ${nombreSub}</span>
              <span class="recetas-ing-cantidad">${ing.cantidad} ${subReceta?.unidadStock || ''}</span>
              ${subReceta?.es_intermedio ? `<span class="recetas-stock-info">Stock: ${subReceta.stockActual || 0} ${subReceta.unidadStock || ''}</span>` : ''}
            </summary>
            ${subReceta ? _construirArbolIngredientes(subReceta.ingredientes || [], state, profundidad + 1) : '<p class="recetas-sin-ingredientes">Receta no encontrada</p>'}
          </details>
        </li>`;
    }
  });
  html += '</ul>';
  return html;
}

function _cerrarDetalle() {
  const m = document.getElementById('modalRecetaDetalle');
  if (m) m.style.display = 'none';
}

/* ─── Vista completa (edición) ──────────────── */

function _mostrarVistaCompleta(idReceta) {
  const state = Store.getState();
  const receta = (state.recetas || []).find(r => r.id === idReceta);
  if (!receta) { mostrarToast('error', 'Receta no encontrada'); return; }
  const prod = (state.productos || []).find(p => p.id == receta.productoId);
  const nombre = prod ? prod.nombre : 'Receta';

  _pestanaActiva = 'recetario';
  const contenedor = document.getElementById('recetas-contenedor');
  if (!contenedor) return;

  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  const productosState = state.productos || [];

  const ingredientesActuales = (receta.ingredientes || []).map(ing => {
    const tipo = ing.tipo || 'insumo';
    let nombreMostrar = ing.id;
    if (tipo === 'insumo') {
      const ingData = ingredientesState.find(i => i.id == ing.id);
      nombreMostrar = ingData ? ingData.nombre : ing.id;
    } else {
      const sub = recetasState.find(r => r.id == ing.id);
      const p = sub ? productosState.find(p => p.id == sub.productoId) : null;
      nombreMostrar = p ? p.nombre : (sub ? sub.productoId : ing.id);
    }
    return { ...ing, tipo, _nombre: nombreMostrar };
  });

  contenedor.innerHTML = `
    <div class="recetas-edicion">
      <div class="recetas-edicion-header">
        <button class="btn-secondary" id="recetas-volver"><i class="fas fa-arrow-left"></i> Volver</button>
        <h2>Editando: ${nombre}</h2>
        <div>
          <button class="btn-secondary" id="recetas-duplicar"><i class="fas fa-copy"></i> Duplicar</button>
          <button class="btn-danger" id="recetas-eliminar"><i class="fas fa-trash"></i> Eliminar</button>
        </div>
      </div>
      <div class="recetas-edicion-cuerpo">
        <div class="recetas-campo">
          <label>Nivel (etiqueta)</label>
          <input type="text" id="rec-nivel" value="${receta.nivel || ''}" placeholder="Ej: salsa, guarnicion...">
        </div>
        <div class="recetas-campo">
          <label>
            <input type="checkbox" id="rec-es-intermedio" ${receta.es_intermedio ? 'checked' : ''}>
            ¿Es una preparación intermedia? (genera stock interno)
          </label>
          ${receta.es_intermedio ? `<div class="recetas-campo"><label>Unidad de stock</label><input type="text" id="rec-unidad-stock" value="${receta.unidadStock || ''}" placeholder="Ej: kg, L, unidades"></div>` : ''}
        </div>
        <div class="recetas-campo">
          <label>Instrucciones</label>
          <textarea id="rec-instrucciones" rows="6" placeholder="1. Pelar y cortar...">${receta.instrucciones || ''}</textarea>
        </div>
        <div class="recetas-campo">
          <label>Ingredientes</label>
          <div class="recetas-ingredientes-lista" id="recetas-ingredientes-actuales">
            ${ingredientesActuales.map((ing, idx) => `
              <div class="recetas-ingrediente-item">
                <span class="recetas-tipo-badge ${ing.tipo === 'subreceta' ? 'recetas-tipo-subreceta' : 'recetas-tipo-insumo'}">${ing.tipo === 'subreceta' ? 'Sub-receta' : 'Insumo'}</span>
                <span>${ing._nombre}</span>
                <input type="number" value="${ing.cantidad}" step="0.01" data-idx="${idx}" data-id="${ing.id}" data-tipo="${ing.tipo}" class="recetas-ing-cantidad-input" placeholder="Cantidad">
                <button class="recetas-quitar-ing" data-idx="${idx}"><i class="fas fa-trash"></i></button>
              </div>
            `).join('')}
          </div>
          <div class="recetas-agregar-ingrediente">
            <select id="rec-tipo-ingrediente" class="recetas-select">
              <option value="insumo">Insumo (Despensa)</option>
              <option value="subreceta">Sub-receta (Preparación)</option>
            </select>
            <select id="rec-nuevo-ingrediente" class="recetas-select">
              <option value="">— Seleccionar —</option>
            </select>
            <input type="number" id="rec-nueva-cantidad" step="0.01" placeholder="Cant." class="recetas-cantidad-input">
            <button class="btn-secondary" id="rec-agregar-ing"><i class="fas fa-plus"></i> Agregar</button>
          </div>
        </div>
      </div>
      <div class="recetas-edicion-footer">
        <button class="btn-secondary" id="recetas-cancelar">Cancelar</button>
        <button class="btn-primary" id="recetas-guardar"><i class="fas fa-save"></i> Guardar</button>
      </div>
    </div>
  `;

  // Rellenar opciones según tipo
  _actualizarSelectorIngrediente('insumo', ingredientesState, recetasState, productosState);

  document.getElementById('rec-tipo-ingrediente').addEventListener('change', e => {
    _actualizarSelectorIngrediente(e.target.value, ingredientesState, recetasState, productosState);
  });

  document.getElementById('rec-es-intermedio').addEventListener('change', e => {
    const unidadDiv = document.getElementById('rec-unidad-stock')?.closest('.recetas-campo');
    if (e.target.checked) {
      if (!document.getElementById('rec-unidad-stock')) {
        const campoUnidad = document.createElement('div');
        campoUnidad.className = 'recetas-campo';
        campoUnidad.innerHTML = '<label>Unidad de stock</label><input type="text" id="rec-unidad-stock" value="" placeholder="Ej: kg, L, unidades">';
        e.target.closest('.recetas-campo').after(campoUnidad);
      }
    } else {
      const campo = document.getElementById('rec-unidad-stock')?.closest('.recetas-campo');
      if (campo) campo.remove();
    }
  });

  document.getElementById('recetas-volver').addEventListener('click', () => _pintar());
  document.getElementById('recetas-cancelar').addEventListener('click', () => _pintar());
  document.getElementById('recetas-guardar').addEventListener('click', () => _guardarEdicionReceta(receta.id));
  document.getElementById('recetas-duplicar').addEventListener('click', () => _duplicarReceta(receta.id));
  document.getElementById('recetas-eliminar').addEventListener('click', () => _eliminarReceta(receta.id));
  document.getElementById('rec-agregar-ing').addEventListener('click', () => _agregarIngredienteEnEdicion());
  document.querySelectorAll('.recetas-quitar-ing').forEach(btn => {
    btn.addEventListener('click', () => _quitarIngredienteEnEdicion(btn.dataset.idx));
  });
}

function _actualizarSelectorIngrediente(tipo, ingredientesState, recetasState, productosState) {
  const select = document.getElementById('rec-nuevo-ingrediente');
  if (!select) return;
  select.innerHTML = '<option value="">— Seleccionar —</option>';
  if (tipo === 'insumo') {
    ingredientesState.forEach(i => {
      const option = document.createElement('option');
      option.value = i.id;
      option.textContent = `${i.nombre} (${i.unidad})`;
      option.dataset.unidad = i.unidad;
      select.appendChild(option);
    });
  } else {
    recetasState.filter(r => r.es_intermedio).forEach(r => {
      const prod = productosState.find(p => p.id == r.productoId);
      const nombre = prod ? prod.nombre : r.productoId;
      const option = document.createElement('option');
      option.value = r.id;
      option.textContent = `${nombre} (${r.unidadStock || ''})`;
      option.dataset.unidad = r.unidadStock || '';
      select.appendChild(option);
    });
  }
}

function _agregarIngredienteEnEdicion() {
  const tipo = document.getElementById('rec-tipo-ingrediente').value;
  const select = document.getElementById('rec-nuevo-ingrediente');
  const cantidad = parseFloat(document.getElementById('rec-nueva-cantidad').value);
  if (!select.value || isNaN(cantidad) || cantidad <= 0) {
    mostrarToast('warning', 'Selecciona un ingrediente y una cantidad válida');
    return;
  }
  const lista = document.getElementById('recetas-ingredientes-actuales');
  const item = document.createElement('div');
  item.className = 'recetas-ingrediente-item';
  const tipoLabel = tipo === 'subreceta' ? 'Sub-receta' : 'Insumo';
  const tipoClass = tipo === 'subreceta' ? 'recetas-tipo-subreceta' : 'recetas-tipo-insumo';
  item.innerHTML = `
    <span class="recetas-tipo-badge ${tipoClass}">${tipoLabel}</span>
    <span>${select.options[select.selectedIndex].text}</span>
    <input type="number" value="${cantidad}" step="0.01" class="recetas-ing-cantidad-input" data-id="${select.value}" data-tipo="${tipo}">
    <button class="recetas-quitar-ing"><i class="fas fa-trash"></i></button>
  `;
  item.querySelector('.recetas-quitar-ing').addEventListener('click', () => item.remove());
  lista.appendChild(item);
  select.value = '';
  document.getElementById('rec-nueva-cantidad').value = '';
}

function _quitarIngredienteEnEdicion(idx) {
  const items = document.querySelectorAll('#recetas-ingredientes-actuales .recetas-ingrediente-item');
  if (items[idx]) items[idx].remove();
}

async function _guardarEdicionReceta(idReceta) {
  const nivel = document.getElementById('rec-nivel').value.trim().toLowerCase();
  const esIntermedio = document.getElementById('rec-es-intermedio').checked;
  const unidadStock = esIntermedio ? (document.getElementById('rec-unidad-stock')?.value?.trim() || '') : '';
  const instrucciones = document.getElementById('rec-instrucciones').value.trim();
  const ingredientes = [];
  document.querySelectorAll('#recetas-ingredientes-actuales .recetas-ingrediente-item').forEach(item => {
    const input = item.querySelector('input');
    const id = input.dataset.id;
    const tipo = input.dataset.tipo || 'insumo';
    const cantidad = parseFloat(input.value);
    if (id && !isNaN(cantidad) && cantidad > 0) {
      ingredientes.push({ id, cantidad, tipo, unidad: '' });
    }
  });

  const receta = DB.recetas.find(r => r.id === idReceta);
  if (receta) {
    receta.nivel = nivel;
    receta.es_intermedio = esIntermedio;
    if (esIntermedio) {
      receta.unidadStock = unidadStock;
    } else {
      receta.stockActual = 0;
      receta.unidadStock = '';
    }
    receta.instrucciones = instrucciones;
    receta.ingredientes = ingredientes;
    DB.saveRecetas();
    EventBus.emit('recetas:actualizadas');
    mostrarToast('success', 'Receta actualizada');
  }
  _pintar();
}

async function _duplicarReceta(idReceta) {
  const original = DB.recetas.find(r => r.id === idReceta);
  if (!original) return;
  const nueva = {
    ...original,
    id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    productoId: original.productoId,
    stockActual: 0,
    ingredientes: (original.ingredientes || []).map(ing => ({ ...ing }))
  };
  DB.recetas.push(nueva);
  DB.saveRecetas();
  EventBus.emit('recetas:actualizadas');
  mostrarToast('success', 'Receta duplicada');
  _pintar();
}

async function _eliminarReceta(idReceta) {
  const ok = await mostrarConfirmacion('Eliminar receta', '¿Seguro? Esta acción no se puede deshacer.');
  if (!ok) return;
  DB.recetas = DB.recetas.filter(r => r.id !== idReceta);
  DB.saveRecetas();
  EventBus.emit('recetas:actualizadas');
  mostrarToast('success', 'Receta eliminada');
  _pintar();
}

/* ─── Modal de creación rápida ──────────────── */

function _mostrarModalReceta() {
  if (_modo !== 'produccion') return mostrarToast('error', 'Acceso denegado');
  const state = Store.getState();
  const productos = (state.productos || []).filter(p => p.activo !== false);

  let modal = document.getElementById('modalRecetaCrear');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRecetaCrear';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="recetas-modal-form">
        <div class="modal-header"><h3>Nueva Receta</h3><button class="modal-close" id="btnCerrarModalCrear"><i class="fas fa-times"></i></button></div>
        <div class="recetas-form-cuerpo">
          <label>Producto</label><select id="recProductoId"></select>
          <label>Nivel (etiqueta)</label>
          <input type="text" id="recNivel" placeholder="Ej: salsa, guarnicion...">
          <label>
            <input type="checkbox" id="recEsIntermedio">
            ¿Es una preparación intermedia?
          </label>
          <div class="recetas-form-botones">
            <button class="btn-secondary" id="btnCancelarCrear">Cancelar</button>
            <button class="btn-primary" id="btnCrearReceta">Crear</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnCerrarModalCrear').addEventListener('click', _cerrarModalCrear);
    document.getElementById('btnCancelarCrear').addEventListener('click', _cerrarModalCrear);
    document.getElementById('btnCrearReceta').addEventListener('click', _crearRecetaRapida);
  }

  document.getElementById('recProductoId').innerHTML = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  document.getElementById('recNivel').value = '';
  document.getElementById('recEsIntermedio').checked = false;
  modal.style.display = 'flex';
}

function _cerrarModalCrear() { const m = document.getElementById('modalRecetaCrear'); if (m) m.style.display = 'none'; }

async function _crearRecetaRapida() {
  const productoId = document.getElementById('recProductoId').value;
  const nivel = document.getElementById('recNivel').value.trim().toLowerCase();
  const esIntermedio = document.getElementById('recEsIntermedio').checked;
  if (!productoId) { mostrarToast('error', 'Selecciona un producto'); return; }

  const existe = DB.recetas.find(r => r.productoId == productoId);
  if (existe) { mostrarToast('warning', 'Ya existe una receta para este producto'); return; }

  const nueva = {
    id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    productoId,
    nivel,
    es_intermedio: esIntermedio,
    ingredientes: [],
    instrucciones: '',
    stockActual: 0,
    unidadStock: '',
    creadoPor: Auth.getRol(),
    creadoEn: new Date().toISOString()
  };
  DB.recetas.push(nueva);
  DB.saveRecetas();
  EventBus.emit('recetas:actualizadas');
  _cerrarModalCrear();
  mostrarToast('success', 'Receta creada. Ahora puedes añadir ingredientes e instrucciones.');
  _mostrarVistaCompleta(nueva.id);
}

/* ─── Ejecutar preparación ──────────────────── */

async function _ejecutarPreparacion(idReceta) {
  const receta = DB.recetas.find(r => r.id === idReceta);
  if (!receta || !receta.es_intermedio) { mostrarToast('error', 'Esta receta no es una preparación intermedia'); return; }

  const cantidad = await _pedirCantidad('Preparar ' + receta.productoId, '¿Cuánto vas a preparar?', receta.unidadStock || 'unidades');
  if (!cantidad || cantidad <= 0) return;

  const state = Store.getState();
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
        ingData.stock = (ingData.stock || 0) - ing.cantidad * cantidad;
        Store.dispatch({ type: 'INGREDIENTE_GUARDADO', payload: ingData });
      }
    } else if (tipo === 'subreceta') {
      const sub = recetas.find(r => r.id == ing.id);
      if (sub) {
        sub.stockActual = (sub.stockActual || 0) - ing.cantidad * cantidad;
        const idx = DB.recetas.findIndex(r => r.id === sub.id);
        if (idx >= 0) DB.recetas[idx] = sub;
      }
    }
  }

  receta.stockActual = (receta.stockActual || 0) + cantidad;
  const idx = DB.recetas.findIndex(r => r.id === idReceta);
  if (idx >= 0) DB.recetas[idx] = receta;
  DB.saveRecetas();
  EventBus.emit('recetas:actualizadas');
  mostrarToast('success', `Preparado: +${cantidad} ${receta.unidadStock || ''} de ${receta.productoId}`);

  if (_pestanaActiva === 'stock') {
    const contenedor = document.getElementById('recetas-contenedor');
    if (contenedor) _pintarStock(contenedor);
  }
}

function _pedirCantidad(titulo, mensaje, unidad) {
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

/* ─── Exportar PDF ──────────────────────────── */

function _exportarPDF(idReceta) {
  const state = Store.getState();
  const receta = (state.recetas || []).find(r => r.id === idReceta || r.productoId == idReceta);
  if (!receta) return;
  const prod = (state.productos || []).find(p => p.id == receta.productoId);
  const nombre = prod ? prod.nombre : 'Receta';
  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  let filas = '';
  (receta.ingredientes || []).forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    let nombreIng = ing.id;
    if (tipo === 'insumo') {
      const ingData = ingredientesState.find(i => i.id == ing.id);
      nombreIng = ingData ? ingData.nombre : ing.id;
    } else {
      const sub = recetasState.find(r => r.id == ing.id);
      const p = sub ? (state.productos || []).find(p => p.id == sub.productoId) : null;
      nombreIng = p ? p.nombre : (sub ? sub.productoId : ing.id);
    }
    filas += `<tr><td>${nombreIng} (${tipo})</td><td>${ing.cantidad} ${ing.unidad || ''}</td></tr>`;
  });
  const html = `<html><head><title>Receta: ${nombre}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#f5f5f5}</style></head><body><h1>${nombre}</h1><h2>Ingredientes</h2><table><thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead><tbody>${filas}</tbody></table><h2>Preparación</h2><p>${(receta.instrucciones||'').replace(/\n/g,'<br>')}</p></body></html>`;
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(html); w.document.close(); w.focus(); w.print(); w.close();
}

/* ─── Ciclo de vida ─────────────────────────── */

function activar() {
  if (_activada) return;
  _activada = true;
  _canceladores.push(Store.subscribe((_, action) => {
    if (action.type.startsWith('PRODUCTO') || action.type.startsWith('RECETA') || action.type.startsWith('INGREDIENTE')) _pintar();
  }));
  _canceladores.push(EventBus.on('db:inicializada', () => setTimeout(_pintar, 100)));
  _canceladores.push(EventBus.on('vista:cambiada', v => { if (v === 'recetas') _pintar(); }));
  _canceladores.push(EventBus.on('recetas:actualizadas', () => _pintar()));
  _pintar();
}

function limpiar() {
  if (!_activada) return;
  _activada = false;
  _canceladores.forEach(fn => { if (typeof fn === 'function') fn(); });
  _canceladores = [];
  const main = document.getElementById('view-recetas');
  if (main) main.innerHTML = '';
}

export const Recetas = {
  render: _pintar,
  mostrarDetalle: _mostrarDetalle,
  activar,
  limpiar
};