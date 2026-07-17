/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/recetas.js
   Versión: 5.0.1
   Propósito: Centro de creación de Cocina/Barra. Gestión de recetas
              con niveles libres, stock interno, preparación de mise
              en place y acceso rápido desde KDS.
              Pestañas internas: Recetario | Mi Stock | Planificación.
              Ciclo de vida con activar()/limpiar().
              Corrección: eliminada autoactivación; _pintar() ahora
              verifica si el módulo está activo.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';
import { Logger } from '../lib/logger.js';
import { mostrarToast, mostrarConfirmacion, formatearDinero, obtenerColorDesdeNombre } from '../utils.js';

/* ─── Configuración ─────────────────────────── */
const NIVELES_GENERAN_STOCK = ['insumo', 'preparacion', 'salsa', 'guarnicion', 'masa', 'base', 'relleno', 'aderezo', 'mise_en_place'];
const NIVELES_POR_DEFECTO = ['insumo', 'preparacion', 'salsa', 'guarnicion', 'masa', 'base', 'relleno', 'aderezo', 'mise_en_place', 'producto_final', 'bebida', 'postre'];

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
  // CORRECCIÓN: Si el módulo no está activo, lo activamos automáticamente
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
  const ingredientes = state.ingredientes || [];

  recetas = recetas.map(r => {
    const prod = productos.find(p => p.id == r.productoId);
    return { ...r, _productoNombre: prod ? prod.nombre : 'Sin producto', _productoActivo: prod ? prod.activo !== false : true };
  }).filter(r => r._productoActivo);

  if (_busqueda) {
    const t = _busqueda.toLowerCase();
    recetas = recetas.filter(r => r._productoNombre.toLowerCase().includes(t));
  }

  if (_filtroNivel !== 'todos') {
    recetas = recetas.filter(r => r.nivel === _filtroNivel);
  }

  const nivelesUnicos = [...new Set(recetas.map(r => r.nivel).filter(Boolean))].sort();
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
    const numIng = r.ingredientes ? r.ingredientes.length : 0;
    const stockInfo = r.generaStock ? `<span class="recetas-badge-stock">${r.stockActual || 0} ${r.unidadStock || ''}</span>` : '';
    return `
      <div class="recetas-tarjeta" data-receta="${r.id}">
        <div class="recetas-tarjeta-img" style="background-color:${color}">
          ${r._productoNombre.charAt(0).toUpperCase()}
          <span class="recetas-tarjeta-badge">${numIng} <i class="fas fa-boxes"></i></span>
        </div>
        <div class="recetas-tarjeta-nombre">${r._productoNombre}</div>
        <div class="recetas-tarjeta-nivel">${nivel} ${stockInfo}</div>
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
  const recetas = (state.recetas || []).filter(r => r.generaStock);
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

  document.getElementById('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${nombre} <span class="recetas-chip-nivel">${receta.nivel || 'sin_nivel'}</span>`;
  if (receta.generaStock) {
    document.getElementById('detalleTitulo').innerHTML += ` <span class="recetas-stock-info">Stock: ${receta.stockActual || 0} ${receta.unidadStock || ''}</span>`;
  }

  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  let html = '<h4><i class="fas fa-list-ul"></i> Ingredientes</h4><ul class="recetas-lista-ingredientes">';
  (receta.ingredientes || []).forEach(ing => {
    const ingData = ingredientesState.find(i => i.id == ing.ingredienteId);
    const recData = !ingData ? recetasState.find(r => r.id == ing.ingredienteId || r.productoId == ing.ingredienteId) : null;
    const nombre = ingData ? ingData.nombre : (recData ? (state.productos || []).find(p => p.id == recData.productoId)?.nombre || recData.productoId : ing.ingredienteId);
    const origen = ingData ? 'Despensa' : 'Preparación';
    html += `<li><span class="recetas-ing-nombre">${nombre}</span><span class="recetas-ing-cantidad">${ing.cantidad} ${ingData?.unidad || ing.unidad || ''}</span><span class="recetas-ing-origen">${origen}</span></li>`;
  });
  html += '</ul>';
  document.getElementById('detalleIngredientes').innerHTML = html;
  document.getElementById('detalleCosto').innerHTML = '';
  document.getElementById('detalleInstrucciones').innerHTML = `<h4><i class="fas fa-tasks"></i> Preparación</h4><div class="recetas-pasos">${(receta.instrucciones || 'Sin instrucciones').split('\n').filter(l => l.trim()).map((l, i) => `<div class="recetas-paso"><span class="recetas-paso-num">${i+1}</span><span class="recetas-paso-texto">${l}</span></div>`).join('') || '<p>Sin instrucciones.</p>'}</div>`;

  modal.dataset.recetaId = idReceta;
  modal.style.display = 'flex';
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

  const opcionesIngredientes = [
    ...ingredientesState.map(i => ({ id: i.id, nombre: i.nombre + ' (Despensa)', unidad: i.unidad, origen: 'despensa' })),
    ...recetasState.filter(r => r.generaStock).map(r => {
      const p = productosState.find(p => p.id == r.productoId);
      return { id: r.id, nombre: (p ? p.nombre : r.productoId) + ' (Preparación)', unidad: r.unidadStock || '', origen: 'receta' };
    })
  ];

  const ingredientesActuales = (receta.ingredientes || []).map(ing => {
    const ingData = opcionesIngredientes.find(o => o.id == ing.ingredienteId);
    return { ...ing, _nombre: ingData ? ingData.nombre : ing.ingredienteId };
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
          <label>Nivel</label>
          <div class="recetas-nivel-input">
            <input type="text" id="rec-nivel" value="${receta.nivel || ''}" placeholder="Ej: preparacion, salsa..." list="lista-niveles">
            <datalist id="lista-niveles">${NIVELES_POR_DEFECTO.map(n => `<option value="${n}">`).join('')}</datalist>
          </div>
          <span class="recetas-nota">${NIVELES_GENERAN_STOCK.includes(receta.nivel) ? '✅ Este nivel genera stock interno' : 'ℹ️ Este nivel no genera stock'}</span>
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
                <span>${ing._nombre}</span>
                <input type="number" value="${ing.cantidad}" step="0.01" data-idx="${idx}" data-id="${ing.ingredienteId}" class="recetas-ing-cantidad-input" placeholder="Cantidad">
                <button class="recetas-quitar-ing" data-idx="${idx}"><i class="fas fa-trash"></i></button>
              </div>
            `).join('')}
          </div>
          <div class="recetas-agregar-ingrediente">
            <select id="rec-nuevo-ingrediente" class="recetas-select">
              <option value="">— Agregar ingrediente —</option>
              ${opcionesIngredientes.map(o => `<option value="${o.id}" data-unidad="${o.unidad}" data-origen="${o.origen}">${o.nombre}</option>`).join('')}
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

  document.getElementById('recetas-volver').addEventListener('click', () => _pintar());
  document.getElementById('recetas-cancelar').addEventListener('click', () => _pintar());
  document.getElementById('recetas-guardar').addEventListener('click', () => _guardarEdicionReceta(receta.id));
  document.getElementById('recetas-duplicar').addEventListener('click', () => _duplicarReceta(receta.id));
  document.getElementById('recetas-eliminar').addEventListener('click', () => _eliminarReceta(receta.id));

  document.getElementById('rec-nivel').addEventListener('input', e => {
    const niv = e.target.value.trim().toLowerCase();
    const nota = document.querySelector('.recetas-nota');
    if (nota) nota.innerHTML = NIVELES_GENERAN_STOCK.includes(niv) ? '✅ Este nivel genera stock interno' : 'ℹ️ Este nivel no genera stock';
  });

  document.getElementById('rec-agregar-ing').addEventListener('click', () => _agregarIngredienteEnEdicion());
  document.querySelectorAll('.recetas-quitar-ing').forEach(btn => {
    btn.addEventListener('click', () => _quitarIngredienteEnEdicion(btn.dataset.idx));
  });
}

function _agregarIngredienteEnEdicion() {
  const select = document.getElementById('rec-nuevo-ingrediente');
  const cantidad = parseFloat(document.getElementById('rec-nueva-cantidad').value);
  if (!select.value || isNaN(cantidad) || cantidad <= 0) {
    mostrarToast('warning', 'Selecciona un ingrediente y una cantidad válida');
    return;
  }
  const lista = document.getElementById('recetas-ingredientes-actuales');
  const item = document.createElement('div');
  item.className = 'recetas-ingrediente-item';
  item.innerHTML = `
    <span>${select.options[select.selectedIndex].text}</span>
    <input type="number" value="${cantidad}" step="0.01" class="recetas-ing-cantidad-input" data-id="${select.value}">
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
  const instrucciones = document.getElementById('rec-instrucciones').value.trim();
  const ingredientes = [];
  document.querySelectorAll('#recetas-ingredientes-actuales .recetas-ingrediente-item').forEach(item => {
    const input = item.querySelector('input');
    const id = input.dataset.id;
    const cantidad = parseFloat(input.value);
    if (id && !isNaN(cantidad) && cantidad > 0) {
      ingredientes.push({ ingredienteId: id, cantidad, unidad: '' });
    }
  });

  if (!nivel) { mostrarToast('error', 'El nivel es obligatorio'); return; }

  const receta = DB.recetas.find(r => r.id === idReceta);
  if (receta) {
    receta.nivel = nivel;
    receta.generaStock = NIVELES_GENERAN_STOCK.includes(nivel);
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
    stockActual: 0
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
          <label>Nivel</label>
          <input type="text" id="recNivel" placeholder="Ej: preparacion, salsa..." list="lista-niveles-crear">
          <datalist id="lista-niveles-crear">${NIVELES_POR_DEFECTO.map(n => `<option value="${n}">`).join('')}</datalist>
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
  modal.style.display = 'flex';
}

function _cerrarModalCrear() { const m = document.getElementById('modalRecetaCrear'); if (m) m.style.display = 'none'; }

async function _crearRecetaRapida() {
  const productoId = document.getElementById('recProductoId').value;
  const nivel = document.getElementById('recNivel').value.trim().toLowerCase();
  if (!productoId || !nivel) { mostrarToast('error', 'Completa todos los campos'); return; }

  const existe = DB.recetas.find(r => r.productoId == productoId);
  if (existe) { mostrarToast('warning', 'Ya existe una receta para este producto'); return; }

  const nueva = {
    id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    productoId,
    nivel,
    generaStock: NIVELES_GENERAN_STOCK.includes(nivel),
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
  if (!receta || !receta.generaStock) { mostrarToast('error', 'Esta receta no genera stock'); return; }

  const cantidad = await _pedirCantidad('Preparar ' + receta.productoId, '¿Cuánto vas a preparar?', receta.unidadStock || 'unidades');
  if (!cantidad || cantidad <= 0) return;

  const state = Store.getState();
  const ingredientes = state.ingredientes || [];
  const recetas = state.recetas || [];

  for (const ing of (receta.ingredientes || [])) {
    const ingData = ingredientes.find(i => i.id == ing.ingredienteId);
    const recData = !ingData ? recetas.find(r => r.id == ing.ingredienteId) : null;
    if (ingData) {
      if ((ingData.stock || 0) < ing.cantidad * cantidad) {
        mostrarToast('error', `Stock insuficiente de ${ingData.nombre}. Necesitas ${ing.cantidad * cantidad} ${ingData.unidad}, hay ${ingData.stock || 0}.`);
        return;
      }
    } else if (recData && recData.generaStock) {
      if ((recData.stockActual || 0) < ing.cantidad * cantidad) {
        const prod = (state.productos || []).find(p => p.id == recData.productoId);
        mostrarToast('error', `Stock insuficiente de ${prod?.nombre || recData.productoId}. Necesitas ${ing.cantidad * cantidad} ${recData.unidadStock}, hay ${recData.stockActual || 0}.`);
        return;
      }
    } else {
      mostrarToast('error', `Ingrediente ${ing.ingredienteId} no encontrado`);
      return;
    }
  }

  for (const ing of (receta.ingredientes || [])) {
    const ingData = ingredientes.find(i => i.id == ing.ingredienteId);
    const recData = !ingData ? recetas.find(r => r.id == ing.ingredienteId) : null;
    if (ingData) {
      ingData.stock = (ingData.stock || 0) - ing.cantidad * cantidad;
      Store.dispatch({ type: 'INGREDIENTE_GUARDADO', payload: ingData });
    } else if (recData) {
      recData.stockActual = (recData.stockActual || 0) - ing.cantidad * cantidad;
      const idx = DB.recetas.findIndex(r => r.id === recData.id);
      if (idx >= 0) DB.recetas[idx] = recData;
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
    const ingData = ingredientesState.find(i => i.id == ing.ingredienteId);
    const recData = !ingData ? recetasState.find(r => r.id == ing.ingredienteId || r.productoId == ing.ingredienteId) : null;
    const nombreIng = ingData ? ingData.nombre : (recData ? (state.productos || []).find(p => p.id == recData.productoId)?.nombre || recData.productoId : ing.ingredienteId);
    filas += `<tr><td>${nombreIng}</td><td>${ing.cantidad} ${ingData?.unidad || ing.unidad || ''}</td></tr>`;
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