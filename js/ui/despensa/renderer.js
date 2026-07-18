/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/renderer.js
   Versión: 2.0.0
   Propósito: Renderizado de la nueva vista de despensa con tres paneles.
              Panel izquierdo: proveedores/productos.
              Panel central: inventario por espacios.
              Panel derecho: lista de compras.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { formatearDinero } from '../../utils.js';
import { getListaCompras } from './estado.js';

// ── CONSTRUCCIÓN DEL DOM ──────────────────────────────────

export function asegurarVista() {
  let main = document.getElementById('view-despensa');
  if (main && main.querySelector('.main-layout')) return;

  if (!main) {
    main = document.createElement('main');
    main.id = 'view-despensa';
    main.className = 'view';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  main.innerHTML = `
    <!-- Header -->
    <div class="despensa-header">
      <button class="icon-btn pc-only" id="btnToggleIzq" title="Proveedores">📦</button>
      <h2>🧺 Despensa</h2>
      <button class="icon-btn pc-only" id="btnToggleDer" title="Lista de compras">🛒</button>
    </div>

    <!-- Layout principal -->
    <div class="main-layout">
      <!-- Panel izquierdo (Proveedores / Productos) -->
      <div class="panel-izquierdo" id="panelIzquierdo">
        <div class="panel-tabs">
          <button class="panel-tab activo" data-tab="proveedores">🏭 Proveedores</button>
          <button class="panel-tab" data-tab="productos">📦 Productos</button>
        </div>
        <div class="panel-tab-content activo" id="tab-proveedores"></div>
        <div class="panel-tab-content" id="tab-productos"></div>
      </div>

      <!-- Panel central (Inventario por espacios) -->
      <div class="panel-central">
        <div class="resumen-bar" id="resumenBar"></div>
        <div class="search-box">
          <i>🔍</i>
          <input type="text" id="inventarioSearch" placeholder="Buscar en el inventario...">
        </div>
        <div id="espaciosContainer"></div>
      </div>

      <!-- Panel derecho (Lista de compras) -->
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

    <!-- Overlay -->
    <div class="overlay" id="despensaOverlay"></div>

    <!-- Botones flotantes (móvil) -->
    <button class="fab-izquierdo" id="fabIzquierdo">📦</button>
    <button class="fab-derecho" id="fabDerecho">🛒</button>
  `;

  _inyectarEstilos();
}

function _inyectarEstilos() {
  if (document.getElementById('despensa-v2-styles')) return;
  const style = document.createElement('style');
  style.id = 'despensa-v2-styles';
  style.textContent = `
    .despensa-header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--color-card); border-bottom: 1px solid var(--color-border); z-index: 20; flex-shrink: 0; }
    .despensa-header h2 { font-size: 16px; margin: 0; flex: 1; }
    .despensa-header .icon-btn { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; }
    .despensa-header .icon-btn.activo { background: var(--color-accent); color: #000; border-color: var(--color-accent); }
    .main-layout { display: flex; flex: 1; overflow: hidden; position: relative; }
    .panel-izquierdo { width: 300px; flex-shrink: 0; background: var(--color-card); border-right: 1px solid var(--color-border); display: flex; flex-direction: column; transition: transform .3s; z-index: 30; }
    .panel-tabs { display: flex; border-bottom: 1px solid var(--color-border); }
    .panel-tab { flex: 1; padding: 10px; text-align: center; font-weight: 600; font-size: 13px; cursor: pointer; background: transparent; border: none; color: var(--color-text-muted); border-bottom: 2px solid transparent; transition: .2s; }
    .panel-tab.activo { color: var(--color-accent); border-bottom-color: var(--color-accent); }
    .panel-tab-content { flex: 1; overflow-y: auto; padding: 8px; display: none; }
    .panel-tab-content.activo { display: block; }
    .item-card { background: #252535; border-radius: 8px; padding: 10px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .item-card:active { background: #2e2e42; }
    .item-card .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--color-accent); display: flex; align-items: center; justify-content: center; color: #000; font-weight: 700; font-size: 18px; }
    .item-card .info { flex: 1; }
    .item-card .info strong { font-size: 13px; display: block; }
    .item-card .info span { font-size: 11px; color: var(--color-text-muted); }
    .item-card .precio { font-weight: 700; color: var(--color-success); font-size: 13px; }
    .panel-central { flex: 1; overflow-y: auto; padding: 12px; background: var(--color-bg); }
    .resumen-bar { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .resumen-card { flex: 1; min-width: 100px; background: var(--color-card); border-radius: 8px; padding: 12px; text-align: center; border: 1px solid var(--color-border); }
    .resumen-card .valor { font-size: 20px; font-weight: 700; color: var(--color-accent); }
    .resumen-card .etiqueta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
    .search-box { display: flex; align-items: center; gap: 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 24px; padding: 8px 14px; margin-bottom: 12px; }
    .search-box input { flex: 1; background: transparent; border: none; color: var(--color-text); font-size: 14px; outline: none; }
    .search-box i { color: var(--color-text-muted); }
    .espacio { background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; margin-bottom: 10px; overflow: hidden; }
    .espacio-header { padding: 12px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; font-size: 14px; }
    .espacio-header .indicador { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .espacio-header .nombre { flex: 1; }
    .espacio-header .contador { font-size: 12px; color: var(--color-text-muted); }
    .espacio-body { display: none; padding: 0 16px 12px; }
    .espacio.abierto .espacio-body { display: block; }
    .producto-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--color-border); font-size: 13px; }
    .producto-item:last-child { border-bottom: none; }
    .producto-item .stock-bajo { color: var(--color-danger); font-weight: 600; }
    .producto-item .nombre { flex: 1; }
    .panel-derecho { width: 280px; flex-shrink: 0; background: var(--color-card); border-left: 1px solid var(--color-border); display: flex; flex-direction: column; transition: transform .3s; z-index: 30; }
    .panel-derecho-header { padding: 12px; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; }
    .panel-derecho-header h3 { margin: 0; font-size: 14px; }
    .lista-compras { flex: 1; overflow-y: auto; padding: 8px; }
    .compra-item { display: flex; align-items: center; gap: 8px; padding: 8px; background: #252535; border-radius: 8px; margin-bottom: 6px; font-size: 13px; }
    .compra-item .nombre { flex: 1; }
    .compra-item .btn-quitar { background: transparent; border: none; color: var(--color-danger); cursor: pointer; font-size: 16px; }
    .add-compra { display: flex; gap: 8px; padding: 8px; }
    .add-compra input { flex: 1; background: #252535; border: 1px solid var(--color-border); color: var(--color-text); padding: 8px 12px; border-radius: 20px; font-size: 13px; outline: none; }
    .add-compra button { background: var(--color-accent); border: none; color: #000; border-radius: 20px; padding: 8px 14px; font-weight: 600; cursor: pointer; font-size: 13px; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 25; display: none; }
    .overlay.activo { display: block; }
    .fab-izquierdo, .fab-derecho { position: fixed; bottom: 24px; width: 48px; height: 48px; border-radius: 50%; display: none; align-items: center; justify-content: center; cursor: pointer; z-index: 35; border: none; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
    .fab-izquierdo { left: 24px; background: var(--color-info); color: #fff; }
    .fab-derecho { right: 24px; background: var(--color-accent); color: #000; }
    @media (max-width: 768px) {
      .panel-izquierdo { position: fixed; top: 0; left: 0; bottom: 0; transform: translateX(-100%); width: 300px; }
      .panel-izquierdo.abierto { transform: translateX(0); }
      .panel-derecho { position: fixed; top: 0; right: 0; bottom: 0; transform: translateX(100%); width: 280px; }
      .panel-derecho.abierto { transform: translateX(0); }
      .fab-izquierdo, .fab-derecho { display: flex; }
    }
    @media (min-width: 769px) {
      .fab-izquierdo, .fab-derecho { display: none; }
    }
  `;
  document.head.appendChild(style);
}

// ── RENDERIZADO DE COMPONENTES ────────────────────────────

export function renderResumen(ingredientes) {
  const bar = document.getElementById('resumenBar');
  if (!bar) return;
  const total = ingredientes.length;
  const bajoMin = ingredientes.filter(i => i.stock <= i.stock_minimo).length;
  const valorTotal = ingredientes.reduce((sum, i) => sum + (i.stock * (i.valor_unitario || 0)), 0);

  bar.innerHTML = `
    <div class="resumen-card"><div class="valor">${total}</div><div class="etiqueta">Total ítems</div></div>
    <div class="resumen-card"><div class="valor">${formatearDinero(valorTotal)}</div><div class="etiqueta">Valor inventario</div></div>
    <div class="resumen-card" style="border-color: var(--color-danger);"><div class="valor" style="color:var(--color-danger);">${bajoMin}</div><div class="etiqueta">Bajo mínimo</div></div>
  `;
}

export function renderEspacios(ingredientes) {
  const container = document.getElementById('espaciosContainer');
  if (!container) return;

  // Agrupar por ubicación
  const espacios = {};
  ingredientes.forEach(ing => {
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
              ${ing.stock <= ing.stock_minimo ? '<span class="stock-bajo">⚠ Bajo</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Eventos para expandir/colapsar espacios
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

// ── TOGGLES DE PANELES ────────────────────────────────────

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