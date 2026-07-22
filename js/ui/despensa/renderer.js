/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/renderer.js
   Versión: 4.2.0
   Propósito: Renderizado de la vista de despensa con panel izquierdo
              tipo acordeón (Proveedores/Productos) como la maqueta.
   ================================================================ */

import { formatearDinero, formatearHoraCorta } from '../../utils.js';
import { Store } from '../../lib/store.js';
import { DB } from '../../db.js';
import { getListaCompras } from './estado.js';

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
    <div class="despensa-header">
      <button class="icon-btn pc-only" id="btnToggleIzq" title="Proveedores">📦</button>
      <h2>🧺 Despensa</h2>
      <div class="header-actions">
        <button class="icon-btn" id="btnExportarCSV" title="Exportar CSV">📥</button>
        <button class="icon-btn" id="btnExportarPDF" title="Exportar PDF">🖨️</button>
        <button class="icon-btn pc-only" id="btnToggleDer" title="Lista de compras">🛒</button>
      </div>
    </div>
    <div class="main-layout" id="despensaMainLayout">
      <div class="panel-izquierdo" id="panelIzquierdo">
        <div class="panel-tabs">
          <button class="panel-tab activo" data-tab="proveedores">🏭 Proveedores</button>
          <button class="panel-tab" data-tab="productos">📦 Productos</button>
        </div>
        <div class="panel-tab-content activo" id="tab-proveedores"></div>
        <div class="panel-tab-content" id="tab-productos"></div>
      </div>
      <div class="panel-central">
        <div class="central-tabs">
          <button class="central-tab activo" data-tab="inventario">📦 Inventario</button>
          <button class="central-tab" data-tab="movimientos">📋 Movimientos</button>
        </div>
        <div class="central-tab-content activo" id="central-inventario">
          <div class="resumen-bar" id="resumenBar"></div>
          <div class="search-box">
            <i>🔍</i><input type="text" id="inventarioSearch" placeholder="Buscar ingredientes...">
          </div>
          <div id="espaciosContainer"></div>
        </div>
        <div class="central-tab-content" id="central-movimientos">
          <div class="movimientos-filtros">
            <button class="mov-filtro-btn activo" data-filtro="todos">Todos</button>
            <button class="mov-filtro-btn" data-filtro="entrada">Entradas</button>
            <button class="mov-filtro-btn" data-filtro="salida">Salidas</button>
            <button class="mov-filtro-btn" data-filtro="ajuste">Ajustes</button>
          </div>
          <div id="movimientosContainer"></div>
        </div>
      </div>
      <div class="panel-derecho" id="panelDerecho">
        <div class="panel-derecho-header">
          <h3>🛒 Lista de compras</h3>
          <button class="icon-btn" id="btnCerrarDer" style="border-radius:8px;">✕</button>
        </div>
        <div class="lista-compras" id="listaCompras"></div>
        <div class="add-compra">
          <button class="btn-sugerir" id="btnSugerirCompras">💡 Sugerir según stock bajo</button>
          <div class="input-row">
            <input type="text" id="inputCompra" placeholder="Agregar manual...">
            <button id="btnAddCompra">+</button>
          </div>
        </div>
      </div>
    </div>
    <div class="overlay" id="despensaOverlay"></div>
  `;

  main.classList.add('active');
}

// ── HELPERS ──────────────────────────────────────────────
function _normalizarIngredientes(ingredientes) {
  return ingredientes.map(ing => {
    if (!ing) return null;
    const copia = { ...ing };
    if (!copia.nombre?.trim()) copia.nombre = '(sin nombre)';
    if (!copia.ubicacion?.trim()) copia.ubicacion = 'Sin ubicación';
    return copia;
  }).filter(Boolean);
}

// ── PANEL CENTRAL (inventario) ──────────────────────────
export function renderResumen(ingredientes) {
  const bar = document.getElementById('resumenBar');
  if (!bar) return;
  const validos = _normalizarIngredientes(ingredientes);
  const total = validos.length;
  const bajoMin = validos.filter(i => i.stock <= i.stock_minimo).length;
  const valorTotal = validos.reduce((s, i) => s + i.stock * (i.valor_unitario || 0), 0);
  bar.innerHTML = `
    <div class="resumen-card"><div class="valor">${total}</div><div class="etiqueta">Total ítems</div></div>
    <div class="resumen-card"><div class="valor">${formatearDinero(valorTotal)}</div><div class="etiqueta">Valor inventario</div></div>
    <div class="resumen-card" style="border-color: var(--color-danger);"><div class="valor" style="color:var(--color-danger);">${bajoMin}</div><div class="etiqueta">Bajo mínimo</div></div>
  `;
}

export function renderEspacios(ingredientes) {
  const container = document.getElementById('espaciosContainer');
  if (!container) return;
  const validos = _normalizarIngredientes(ingredientes);
  if (!validos.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted); padding:20px; text-align:center;">No hay ingredientes en el inventario.</p>';
    return;
  }
  const espacios = {};
  validos.forEach(ing => {
    const ubi = ing.ubicacion || 'Sin ubicación';
    (espacios[ubi] ??= []).push(ing);
  });
  container.innerHTML = Object.entries(espacios).map(([nombre, items]) => {
    const algunBajo = items.some(i => i.stock <= i.stock_minimo);
    return `
      <div class="espacio">
        <div class="espacio-header">
          <span class="indicador" style="background:${algunBajo ? 'var(--color-danger)' : 'var(--color-success)'};"></span>
          <span class="nombre">📦 ${nombre}</span>
          <span class="contador">${items.length}</span>
        </div>
        <div class="espacio-body">
          ${items.map(ing => `
            <div class="producto-item">
              <span class="nombre">${ing.nombre}</span>
              <span>${ing.stock} ${ing.unidad}</span>
              ${ing.stock <= ing.stock_minimo ? '<span class="stock-bajo">⚠ Bajo</span>' : ''}
              <button class="btn-editar-insumo" data-id="${ing.id}">✎</button>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');
  container.querySelectorAll('.espacio-header').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('abierto')));
}

// ── MOVIMIENTOS ──────────────────────────────────────────
export function renderMovimientos(filtro = 'todos') {
  const cont = document.getElementById('movimientosContainer');
  if (!cont) return;
  const movs = (Store.obtenerEstado().movimientos || DB.movimientos || []);
  const filtrados = filtro === 'todos' ? movs : movs.filter(m => m.tipo === filtro);
  if (!filtrados.length) {
    cont.innerHTML = '<p style="color:var(--color-text-muted); padding:20px; text-align:center;">Sin movimientos registrados.</p>';
    return;
  }
  const grupos = {};
  filtrados.forEach(m => {
    const fecha = new Date(m.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
    (grupos[fecha] ??= []).push(m);
  });
  cont.innerHTML = Object.entries(grupos).map(([fecha, movs]) => `
    <div class="mov-grupo">
      <div class="mov-grupo-titulo">${fecha}</div>
      ${movs.map(m => {
        const icono = m.tipo === 'entrada' ? '↑' : m.tipo === 'salida' ? '↓' : '↻';
        const color = m.tipo === 'entrada' ? 'var(--color-success)' : m.tipo === 'salida' ? 'var(--color-danger)' : 'var(--color-info)';
        const signo = m.tipo === 'salida' ? '-' : '+';
        return `
          <div class="movimiento-item">
            <div class="icono-mov" style="color:${color}; background:rgba(${m.tipo === 'entrada' ? '34,197,94' : m.tipo === 'salida' ? '239,68,68' : '59,130,246'},.2)">${icono}</div>
            <div class="detalle"><div class="ingrediente">${m.ingrediente || m.ingredienteId}</div><div class="meta">${formatearHoraCorta(m.fecha)} — ${m.motivo || ''} (${m.usuario || 'sistema'})</div></div>
            <div class="cantidad cantidad-${m.tipo}">${signo}${Math.abs(m.cantidad)} ${m.unidad || ''}</div>
          </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ── LISTA DE COMPRAS ────────────────────────────────────
export function renderListaCompras(items) {
  const lista = document.getElementById('listaCompras');
  if (!lista) return;
  lista.innerHTML = items.map(item => `
    <div class="compra-item">
      <span class="nombre">${item.nombre}${item.stock ? ` <span class="stock-info">(${item.stock})</span>` : ''}</span>
      <button class="btn-quitar" data-item="${item.nombre}">✕</button>
    </div>
  `).join('');
}

// ── PANEL IZQUIERDO (PROVEEDORES) ──────────────────────
export function renderProveedores(proveedores) {
  const tab = document.getElementById('tab-proveedores');
  if (!tab) return;
  if (!proveedores?.length) {
    tab.innerHTML = '<p style="color:var(--color-text-muted); padding:16px; text-align:center;">Sin proveedores.</p>';
    return;
  }
  tab.innerHTML = proveedores.map(p => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="avatar">${(p.nombre.charAt(0) || '?').toUpperCase()}</div>
        <div class="info"><strong>${p.nombre}</strong><span>${p.productos} productos</span></div>
      </div>
      <div class="detalle">
        ${(p.ingredientes || []).map(ing => `
          <div class="detalle-item"><span>${ing.nombre}</span><span class="precio">${formatearDinero(ing.precio_proveedor)}</span></div>
        `).join('')}
      </div>
    </div>
  `).join('')
  + '<button class="btn-accion" id="btnNuevoProveedor">+ Añadir Proveedor</button>';
  tab.querySelectorAll('.item-card').forEach(card => card.addEventListener('click', () => card.classList.toggle('abierto')));
}

// ── PANEL IZQUIERDO (PRODUCTOS) ─────────────────────────
export function renderProductosDisponibles(productos) {
  const tab = document.getElementById('tab-productos');
  if (!tab) return;
  if (!productos?.length) {
    tab.innerHTML = '<p style="color:var(--color-text-muted); padding:16px; text-align:center;">Sin productos.</p>';
    return;
  }
  tab.innerHTML = productos.map(p => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="avatar">📦</div>
        <div class="info"><strong>${p.nombre}</strong><span>${p.proveedores} proveedores</span></div>
      </div>
      <div class="detalle">
        ${(p.proveedoresLista || []).map(prov => `
          <div class="detalle-item"><span>${prov.nombre}</span><span class="precio">${formatearDinero(prov.precio)}</span></div>
        `).join('')}
      </div>
    </div>
  `).join('')
  + '<button class="btn-accion" id="btnNuevoProducto">+ Añadir Producto</button>';
  tab.querySelectorAll('.item-card').forEach(card => card.addEventListener('click', () => card.classList.toggle('abierto')));
}

// ── GESTIÓN DE PANELES ─────────────────────────────────
function _calcularTopPanel() {
  const appHeader = document.querySelector('.app-header');
  if (!appHeader) return '0';
  return window.getComputedStyle(appHeader).display === 'none' ? '0' : appHeader.offsetHeight + 'px';
}
function _ajustarPosicionPanel(panel) {
  if (!panel || window.innerWidth > 768) return;
  const top = _calcularTopPanel();
  panel.style.top = top;
  panel.style.height = top === '0' ? '100%' : `calc(100% - ${top})`;
}
export function abrirPanelIzquierdo() {
  const panel = document.getElementById('panelIzquierdo');
  if (panel) { _ajustarPosicionPanel(panel); panel.classList.add('abierto'); document.getElementById('despensaOverlay')?.classList.add('activo'); }
}
export function abrirPanelDerecho() {
  const panel = document.getElementById('panelDerecho');
  if (panel) { _ajustarPosicionPanel(panel); panel.classList.add('abierto'); document.getElementById('despensaOverlay')?.classList.add('activo'); }
}
export function cerrarPaneles() {
  document.getElementById('panelIzquierdo')?.classList.remove('abierto');
  document.getElementById('panelDerecho')?.classList.remove('abierto');
  document.getElementById('despensaOverlay')?.classList.remove('activo');
}