/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/renderer.js
   Versión: 1.0.0
   Propósito: Renderizado de la vista de despensa: tabla, resumen,
              alertas de stock bajo y movimientos.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { Auth } from '../../auth.js';
import { fmtMoney } from '../../utils.js';
import {
  getCategoriaFiltro,
  getOrdenColumnas,
  getPaginaMovimientos,
  getMovsPorPagina
} from './estado.js';

// ── CONSTRUCCIÓN DEL DOM ──────────────────────────────────

export function asegurarVista() {
  let main = document.getElementById('view-despensa');
  if (main && main.querySelector('.view-toolbar')) return;

  if (!main) {
    main = document.createElement('main');
    main.id = 'view-despensa';
    main.className = 'view';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  main.innerHTML = `
    <div class="view-toolbar">
      <h2><i class="fas fa-boxes"></i> Despensa — Inventario</h2>
      <div class="toolbar-actions">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <select id="despensaCatFilter">
            <option value="todas">Todas las categorías</option>
            <option value="cocina">Cocina</option>
            <option value="barra">Barra</option>
            <option value="general">General</option>
          </select>
          <input type="text" id="ingredienteSearch" placeholder="Buscar ingrediente...">
          <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--color-text-muted);">
            <input type="checkbox" id="filtroBajoMinimo"> Bajo mínimo
          </label>
          <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--color-text-muted);">
            <input type="checkbox" id="filtroConValor"> Con valor > 0
          </label>
          <input type="text" id="filtroUbicacion" placeholder="Filtrar ubicación..." style="width:140px;">
        </div>
        <button class="btn-primary" id="btnNuevoIngrediente">
          <i class="fas fa-plus"></i> Nuevo Ingrediente
        </button>
        <button class="btn-secondary" id="btnExportarCSV">
          <i class="fas fa-download"></i> Exportar CSV
        </button>
        <button class="btn-secondary" id="btnExportarPDF">
          <i class="fas fa-print"></i> Exportar PDF
        </button>
      </div>
    </div>
    <div class="inventario-resumen" id="inventarioResumen"></div>
    <div class="despensa-grid">
      <div class="despensa-main">
        <table class="ingredientes-table" id="ingredientesTable">
          <thead>
            <tr id="ingredientesTableHead">
              <th data-columna="nombre">Ingrediente <i class="fas fa-sort"></i></th>
              <th data-columna="categoria">Cat. <i class="fas fa-sort"></i></th>
              <th data-columna="stock">Stock <i class="fas fa-sort"></i></th>
              <th data-columna="unidad">Uni. <i class="fas fa-sort"></i></th>
              <th data-columna="stock_minimo">Mín. <i class="fas fa-sort"></i></th>
              <th data-columna="ubicacion">Ubicación <i class="fas fa-sort"></i></th>
              <th data-columna="valor_unitario">Valor Un. <i class="fas fa-sort"></i></th>
              <th>Valor Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="ingredientesBody"></tbody>
        </table>
      </div>
      <div class="despensa-sidebar">
        <h4><i class="fas fa-history"></i> Últimos movimientos</h4>
        <div id="movimientosList"></div>
        <div id="movimientosPaginador" style="margin-top:8px;"></div>
        <h4><i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i> Alertas Stock Bajo</h4>
        <div id="alertasStockList"></div>
        <button class="btn-secondary" id="btnAjusteRapidoSidebar" style="width:100%;">
          <i class="fas fa-pen"></i> Ajuste Rápido
        </button>
      </div>
    </div>
  `;
}

// ── TABLA DE INGREDIENTES ─────────────────────────────────

export function renderTabla() {
  const tbody = document.getElementById('ingredientesBody');
  if (!tbody) return;

  let ingredientes = Store.getState().ingredientes || [];
  const rol = Auth.getRol();

  // Filtro por rol (para modo operativo de cocina/barra)
  if (rol === 'cocina') {
    ingredientes = ingredientes.filter(i => i.categoria === 'cocina');
  } else if (rol === 'barra') {
    ingredientes = ingredientes.filter(i => i.categoria === 'barra');
  }

  // Filtro de categoría
  const catFiltro = getCategoriaFiltro();
  if (catFiltro !== 'todas') {
    ingredientes = ingredientes.filter(i => (i.categoria || 'general') === catFiltro);
  }

  // Filtro de búsqueda textual
  const termino = (document.getElementById('ingredienteSearch')?.value || '').trim().toLowerCase();
  if (termino) {
    ingredientes = ingredientes.filter(i =>
      i.nombre.toLowerCase().includes(termino) ||
      (i.categoria || '').toLowerCase().includes(termino) ||
      (i.ubicacion || '').toLowerCase().includes(termino)
    );
  }

  // Filtros avanzados (checkboxes + ubicación)
  const filtroBajo = document.getElementById('filtroBajoMinimo')?.checked;
  const filtroValor = document.getElementById('filtroConValor')?.checked;
  const filtroUbicacion = (document.getElementById('filtroUbicacion')?.value || '').trim().toLowerCase();

  if (filtroBajo) {
    ingredientes = ingredientes.filter(i => i.stock <= i.stock_minimo);
  }
  if (filtroValor) {
    ingredientes = ingredientes.filter(i => (i.valor_unitario || 0) > 0);
  }
  if (filtroUbicacion) {
    ingredientes = ingredientes.filter(i => (i.ubicacion || '').toLowerCase().includes(filtroUbicacion));
  }

  // Ordenamiento
  const orden = getOrdenColumnas();
  if (orden.length > 0) {
    ingredientes.sort((a, b) => {
      for (const ord of orden) {
        let valA = a[ord.columna];
        let valB = b[ord.columna];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * ord.direccion;
        if (valA > valB) return 1 * ord.direccion;
      }
      return 0;
    });
  } else {
    // Orden por defecto: críticos primero
    ingredientes.sort((a, b) => {
      const critA = a.stock <= a.stock_minimo ? 1 : 0;
      const critB = b.stock <= b.stock_minimo ? 1 : 0;
      return critB - critA || a.nombre.localeCompare(b.nombre);
    });
  }

  if (!ingredientes.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;">Sin ingredientes</td></tr>`;
    return;
  }

  tbody.innerHTML = ingredientes.map(ing => {
    const bajoStock = ing.stock <= ing.stock_minimo;
    const maxBar = Math.max(ing.stock, ing.stock_minimo * 2, 1);
    const porcentaje = Math.min(100, (ing.stock / maxBar) * 100);
    const barColor = bajoStock ? 'var(--color-danger)' : 'var(--color-success)';
    const valorUnitario = ing.valor_unitario || 0;
    const valorTotal = ing.stock * valorUnitario;

    return `
      <tr class="${bajoStock ? 'stock-bajo' : ''}">
        <td><strong>${ing.nombre}</strong></td>
        <td>${ing.categoria || 'general'}</td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span>${ing.stock.toFixed(2)}</span>
            <div style="flex:1; background:var(--color-border); border-radius:4px; height:6px; min-width:40px;">
              <div style="width:${porcentaje}%; height:100%; background:${barColor}; border-radius:4px;"></div>
            </div>
          </div>
        </td>
        <td>${ing.unidad}</td>
        <td>${ing.stock_minimo}</td>
        <td>${ing.ubicacion || '—'}</td>
        <td>${valorUnitario ? fmtMoney(valorUnitario) : '—'}</td>
        <td><strong>${valorTotal ? fmtMoney(valorTotal) : '—'}</strong></td>
        <td>
          <button class="btn-ajuste" data-accion="editar" data-id="${ing.id}"><i class="fas fa-edit"></i></button>
          <button class="btn-ajuste" data-accion="ajuste" data-id="${ing.id}"><i class="fas fa-pen"></i></button>
        </td>
      </tr>`;
  }).join('');
}

// ── RESUMEN SUPERIOR ──────────────────────────────────────

export function renderResumen() {
  const cont = document.getElementById('inventarioResumen');
  if (!cont) return;

  const ingredientes = Store.getState().ingredientes || [];
  const totalItems = ingredientes.length;
  const bajoMin = ingredientes.filter(i => i.stock <= i.stock_minimo).length;
  const valorTotal = ingredientes.reduce((sum, i) => sum + (i.stock * (i.valor_unitario || 0)), 0);

  cont.innerHTML = `
    <div class="resumen-card">
      <span><i class="fas fa-cubes"></i> Total ítems: <strong>${totalItems}</strong></span>
      <span><i class="fas fa-dollar-sign"></i> Valor inventario: <strong>${fmtMoney(valorTotal)}</strong></span>
      <span style="color:var(--color-warning);"><i class="fas fa-exclamation-triangle"></i> Bajo mínimo: <strong>${bajoMin}</strong></span>
    </div>
  `;
}

// ── ALERTAS DE STOCK BAJO ─────────────────────────────────

export function renderAlertas() {
  const cont = document.getElementById('alertasStockList');
  if (!cont) return;
  const ingredientes = Store.getState().ingredientes || [];
  const criticos = ingredientes.filter(i => i.stock <= i.stock_minimo);
  if (!criticos.length) {
    cont.innerHTML = `<p style="color:var(--color-text-muted);"><i class="fas fa-check-circle"></i> Todo en orden</p>`;
    return;
  }
  cont.innerHTML = criticos.map(i => `
    <div style="padding:6px 0; border-bottom:1px solid var(--color-border);">
      <i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i>
      <strong>${i.nombre}</strong><br>
      <span style="font-size:11px;">Quedan ${i.stock} ${i.unidad} (mínimo ${i.stock_minimo})</span>
    </div>`).join('');
}

// ── ÚLTIMOS MOVIMIENTOS ───────────────────────────────────

export function renderMovimientos() {
  const cont = document.getElementById('movimientosList');
  const paginador = document.getElementById('movimientosPaginador');
  if (!cont) return;

  const movs = Store.getState().movimientos || [];
  const recientes = [...movs].reverse();

  const totalMovs = recientes.length;
  const pagina = getPaginaMovimientos();
  const porPagina = getMovsPorPagina();
  const fin = (pagina + 1) * porPagina;
  const movsPaginados = recientes.slice(0, Math.min(fin, totalMovs));

  if (!movsPaginados.length) {
    cont.innerHTML = `<p style="color:var(--color-text-muted);">Sin movimientos</p>`;
    if (paginador) paginador.innerHTML = '';
    return;
  }

  cont.innerHTML = movsPaginados.map(mov => {
    const ing = (Store.getState().ingredientes || []).find(i => i.id === mov.ingredienteId);
    const nombre = ing ? ing.nombre : mov.ingredienteId;
    const signo = mov.cantidad >= 0 ? '+' : '';
    const clase = mov.cantidad >= 0 ? 'success' : 'danger';
    return `
      <div class="movimiento-item">
        <div style="display:flex; justify-content:space-between;">
          <span><strong>${nombre}</strong></span>
          <span style="color:var(--color-${clase});">${signo}${mov.cantidad.toFixed(2)}</span>
        </div>
        <div style="font-size:10px; color:var(--color-text-muted);">${mov.motivo} · ${new Date(mov.fecha).toLocaleString()}</div>
      </div>`;
  }).join('');

  if (paginador && totalMovs > fin) {
    paginador.innerHTML = `<button class="btn-ajuste" id="btnVerMasMovimientos" style="width:100%;">Ver más (${totalMovs - fin} restantes)</button>`;
  } else if (paginador) {
    paginador.innerHTML = '';
  }
}

// ── RENDER COMPLETO ───────────────────────────────────────

export function renderCompleto() {
  renderResumen();
  renderTabla();
  renderMovimientos();
  renderAlertas();
}