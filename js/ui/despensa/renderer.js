/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/renderer.js
   Versión: 3.1.0
   Propósito: Renderizado de la nueva vista de despensa con tres paneles.
              v3.1.0: añade clase 'active' al contenedor para mostrarse.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { formatearDinero } from '../../utils.js';
import { getListaCompras } from './estado.js';

let _layoutConstruido = false;

export function asegurarVista() {
  if (_layoutConstruido && document.querySelector('.main-layout')) return;

  let main = document.getElementById('view-despensa');
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-despensa';
    main.className = 'view';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  // Activar la vista para que se muestre (display: flex)
  main.classList.add('active');

  main.innerHTML = `
    <div class="despensa-header">
      <button class="icon-btn pc-only" id="btnToggleIzq" title="Proveedores">📦</button>
      <h2>🧺 Despensa</h2>
      <button class="btn-nuevo-insumo" id="btnNuevoInsumo">+ Nuevo Insumo</button>
      <button class="icon-btn" id="btnExportarCSV" title="Exportar CSV">📥</button>
      <button class="icon-btn" id="btnExportarPDF" title="Exportar PDF">🖨️</button>
      <button class="icon-btn pc-only" id="btnToggleDer" title="Lista de compras">🛒</button>
    </div>
    <div class="main-layout">
      <div class="panel-izquierdo" id="panelIzquierdo">
        <div class="panel-tabs">
          <button class="panel-tab activo" data-tab="proveedores">🏭 Proveedores</button>
          <button class="panel-tab" data-tab="productos">📦 Productos</button>
        </div>
        <div class="panel-tab-content activo" id="tab-proveedores"></div>
        <div class="panel-tab-content" id="tab-productos"></div>
      </div>
      <div class="panel-central">
        <div class="resumen-bar" id="resumenBar"></div>
        <div class="search-box">
          <i>🔍</i>
          <input type="text" id="inventarioSearch" placeholder="Buscar en el inventario...">
        </div>
        <div id="espaciosContainer"></div>
      </div>
      <div class="panel-derecho" id="panelDerecho">
        <div class="panel-derecho-header">
          <h3>🛒 Lista de compras</h3>
          <button class="icon-btn" id="btnCerrarDer" style="border-radius:8px;">✕</button>
        </div>
        <div class="lista-compras" id="listaCompras"></div>
        <div class="add-compra">
          <input type="text" id="inputCompra" placeholder="Agregar producto...">
          <button id="btnAddCompra">+</button>
        </div>
      </div>
    </div>
    <div class="overlay" id="despensaOverlay"></div>
    <button class="fab-izquierdo" id="fabIzquierdo">📦</button>
    <button class="fab-derecho" id="fabDerecho">🛒</button>
  `;

  _layoutConstruido = true;
}

// ── RENDERIZADO DE COMPONENTES ────────────────────────────

export function renderResumen(ingredientes) {
  const bar = document.getElementById('resumenBar');
  if (!bar) return;
  const ingredientesValidos = ingredientes.filter(ing => ing && ing.nombre && ing.nombre.trim() !== '');
  const total = ingredientesValidos.length;
  const bajoMin = ingredientesValidos.filter(i => i.stock <= i.stock_minimo).length;
  const valorTotal = ingredientesValidos.reduce((sum, i) => sum + (i.stock * (i.valor_unitario || 0)), 0);

  bar.innerHTML = `
    <div class="resumen-card"><div class="valor">${total}</div><div class="etiqueta">Total ítems</div></div>
    <div class="resumen-card"><div class="valor">${formatearDinero(valorTotal)}</div><div class="etiqueta">Valor inventario</div></div>
    <div class="resumen-card" style="border-color: var(--color-danger);"><div class="valor" style="color:var(--color-danger);">${bajoMin}</div><div class="etiqueta">Bajo mínimo</div></div>
  `;
}

export function renderEspacios(ingredientes) {
  const container = document.getElementById('espaciosContainer');
  if (!container) return;

  const ingredientesValidos = ingredientes.filter(ing => ing && ing.nombre && ing.nombre.trim() !== '');

  const espacios = {};
  ingredientesValidos.forEach(ing => {
    const ubicacion = ing.ubicacion || 'Sin ubicación';
    if (!espacios[ubicacion]) espacios[ubicacion] = [];
    espacios[ubicacion].push(ing);
  });

  container.innerHTML = Object.entries(espacios).map(([nombre, items]) => {
    const algunBajo = items.some(i => i.stock <= i.stock_minimo);
    const colorIndicador = algunBajo ? 'var(--color-danger)' : 'var(--color-success)';
    return `
      <div class="espacio">
        <div class="espacio-header">
          <span class="indicador" style="background:${colorIndicador};"></span>
          <span class="nombre">📦 ${nombre}</span>
          <span class="contador">${items.length} productos</span>
        </div>
        <div class="espacio-body">
            ${items.map(ing => `
            <div class="producto-item">
              <span class="nombre">${ing.nombre}</span>
              <span>${ing.stock} ${ing.unidad}</span>
              ${ing.stock <= ing.stock_minimo ? '<span class  ="stock-bajo">⚠ Bajo</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.espacio-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('abierto');
    });
  });
}

export function renderListaCompras(items) {
  const lista = document.getElementById('listaCompras');
  if (!lista) return;
  lista.innerHTML = items.map(item => `
    <div class="compra-item">
      <span class="nombre">${item}</span>
      <button class="btn-quitar" data-item="${item}">✕</button>
    </div>
  `).join('');
}

export function renderProveedores(proveedores) {
  const tab = document.getElementById('tab-proveedores');
  if (!tab) return;
  if (!proveedores || proveedores.length === 0) {
    tab.innerHTML = '<p style="color:var(--color-text-muted); padding:16px; text-align:center;">Sin proveedores registrados.</p>';
    return;
  }
  tab.innerHTML = proveedores.map(p => `
    <div class="item-card">
      <div class="avatar">${p.nombre.charAt(0).toUpperCase()}</div>
      <div class="info"><strong>${p.nombre}</strong><span>${p.productos || 0} productos</span></div>
    </div>
  `).join('');
}

export function renderProductosDisponibles(productos) {
  const tab = document.getElementById('tab-productos');
  if (!tab) return;
  if (!productos || productos.length === 0) {
    tab.innerHTML = '<p style="color:var(--color-text-muted); padding:16px; text-align:center;">Sin productos disponibles.</p>';
    return;
  }
  tab.innerHTML = productos.map(p => `
    <div class="item-card">
      <div class="avatar">📦</div>
      <div class="info"><strong>${p.nombre}</strong><span>${p.proveedores || 0} proveedores</span></div>
      <div class="precio">${formatearDinero(p.precio)}</div>
    </div>
  `).join('');
}

export function abrirPanelIzquierdo() {
  document.getElementById('panelIzquierdo')?.classList.add('abierto');
  document.getElementById('despensaOverlay')?.classList.add('activo');
}

export function abrirPanelDerecho() {
  document.getElementById('panelDerecho')?.classList.add('abierto');
  document.getElementById('despensaOverlay')?.classList.add('activo');
}

export function cerrarPaneles() {
  document.getElementById('panelIzquierdo')?.classList.remove('abierto');
  document.getElementById('panelDerecho')?.classList.remove('abierto');
  document.getElementById('despensaOverlay')?.classList.remove('activo');
}