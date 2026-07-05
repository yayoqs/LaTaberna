/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/despensa.js
   Versión: 1.0.4
   Propósito: Vista de inventario: ingredientes, movimientos, filtros, exportación.
              v1.0.4: _asegurarVista corregida según estándar B1.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Auth } from '../auth.js';
import { fmtMoney, showToast } from '../utils.js';
import { DB } from '../db.js';
import { InventarioService } from '../servicios/inventario-service.js';

const Despensa = (() => {

  let _ordenColumnas = [];
  let _categoriaFiltro = 'todas';
  let _paginaMovimientos = 0;
  const _MOVS_POR_PAGINA = 10;

  function _asegurarVista() {
    let main = document.getElementById('view-despensa');
    // Si ya tiene contenido, no lo regeneramos
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

    _vincularEventos();
  }

  function _vincularEventos() {
    document.getElementById('despensaCatFilter').addEventListener('change', function() {
      _categoriaFiltro = this.value;
      _aplicarFiltros();
    });
    document.getElementById('ingredienteSearch').addEventListener('input', function() {
      _ordenColumnas = [];
      _aplicarFiltros();
    });
    document.getElementById('filtroBajoMinimo').addEventListener('change', _aplicarFiltros);
    document.getElementById('filtroConValor').addEventListener('change', _aplicarFiltros);
    document.getElementById('filtroUbicacion').addEventListener('input', _aplicarFiltros);
    document.getElementById('btnNuevoIngrediente').addEventListener('click', () => mostrarModalIngrediente());
    document.getElementById('btnExportarCSV').addEventListener('click', exportarIngredientes);
    document.getElementById('btnExportarPDF').addEventListener('click', exportarPDF);

    document.getElementById('ingredientesTableHead').addEventListener('click', function(e) {
      const th = e.target.closest('th[data-columna]');
      if (th) {
        ordenarTabla(th.dataset.columna, e);
      }
    });

    document.getElementById('ingredientesBody').addEventListener('click', function(e) {
      const editBtn = e.target.closest('.btn-ajuste[data-accion="editar"]');
      const ajusteBtn = e.target.closest('.btn-ajuste[data-accion="ajuste"]');
      if (editBtn) {
        editarIngrediente(editBtn.dataset.id);
      }
      if (ajusteBtn) {
        ajusteRapido(ajusteBtn.dataset.id);
      }
    });

    document.getElementById('movimientosPaginador').addEventListener('click', function(e) {
      const btn = e.target.closest('#btnVerMasMovimientos');
      if (btn) {
        _mostrarMasMovimientos();
      }
    });

    document.getElementById('btnAjusteRapidoSidebar').addEventListener('click', () => ajusteRapido());
  }

  function render() {
    _asegurarVista();
    _renderResumen();
    _renderTablaIngredientes();
    _renderMovimientos();
    _renderAlertasStock();
  }

  function _renderResumen() {
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

  function filtrarPorCategoria(cat) {
    _categoriaFiltro = cat;
    _aplicarFiltros();
  }

  function _buscar() {
    _ordenColumnas = [];
    _aplicarFiltros();
  }

  function _aplicarFiltros() {
    _renderTablaIngredientes();
    _renderResumen();
  }

  function _renderTablaIngredientes() {
    const tbody = document.getElementById('ingredientesBody');
    if (!tbody) return;

    let ingredientes = Store.getState().ingredientes || [];
    const rol = Auth.getRol();

    if (rol === 'cocina') {
      ingredientes = ingredientes.filter(i => i.categoria === 'cocina');
    } else if (rol === 'barra') {
      ingredientes = ingredientes.filter(i => i.categoria === 'barra');
    }

    if (_categoriaFiltro !== 'todas') {
      ingredientes = ingredientes.filter(i => (i.categoria || 'general') === _categoriaFiltro);
    }

    const termino = (document.getElementById('ingredienteSearch')?.value || '').trim().toLowerCase();
    if (termino) {
      ingredientes = ingredientes.filter(i =>
        i.nombre.toLowerCase().includes(termino) ||
        (i.categoria || '').toLowerCase().includes(termino) ||
        (i.ubicacion || '').toLowerCase().includes(termino)
      );
    }

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

    if (_ordenColumnas.length > 0) {
      ingredientes.sort((a, b) => {
        for (const ord of _ordenColumnas) {
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

  function ordenarTabla(columna, event) {
    if (event && event.shiftKey) {
      const existente = _ordenColumnas.findIndex(o => o.columna === columna);
      if (existente >= 0) {
        if (_ordenColumnas[existente].direccion === 1) {
          _ordenColumnas[existente].direccion = -1;
        } else {
          _ordenColumnas.splice(existente, 1);
        }
      } else {
        _ordenColumnas.push({ columna, direccion: 1 });
      }
    } else {
      if (_ordenColumnas.length === 1 && _ordenColumnas[0].columna === columna) {
        _ordenColumnas[0].direccion *= -1;
      } else {
        _ordenColumnas = [{ columna, direccion: 1 }];
      }
    }
    _renderTablaIngredientes();
  }

  function _renderMovimientos() {
    const cont = document.getElementById('movimientosList');
    const paginador = document.getElementById('movimientosPaginador');
    if (!cont) return;

    const movs = Store.getState().movimientos || DB.movimientos || [];
    const recientes = [...movs].reverse();

    const totalMovs = recientes.length;
    const fin = (_paginaMovimientos + 1) * _MOVS_POR_PAGINA;
    const movsPaginados = recientes.slice(0, Math.min(fin, totalMovs));

    if (!movsPaginados.length) {
      cont.innerHTML = `<p style="color:var(--color-text-muted);">Sin movimientos</p>`;
      if (paginador) paginador.innerHTML = '';
      return;
    }

    cont.innerHTML = movsPaginados.map(mov => {
      const ing = (Store.getState().ingredientes || DB.ingredientes || []).find(i => i.id === mov.ingredienteId);
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

  function _mostrarMasMovimientos() {
    _paginaMovimientos++;
    _renderMovimientos();
  }

  function _renderAlertasStock() {
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

  function mostrarModalIngrediente(ingrediente = null) {
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

      document.getElementById('btnCerrarModalIng').addEventListener('click', cerrarModalIngrediente);
      document.getElementById('btnCancelarModalIng').addEventListener('click', cerrarModalIngrediente);
      document.getElementById('btnGuardarModalIng').addEventListener('click', guardarIngrediente);
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

  function cerrarModalIngrediente() {
    const modal = document.getElementById('modalIngrediente');
    if (modal) modal.style.display = 'none';
  }

  async function guardarIngrediente() {
    const id = document.getElementById('ingId').value;
    const nombre = document.getElementById('ingNombre').value.trim();
    if (!nombre) { showToast('error', 'Nombre obligatorio'); return; }

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

    if (typeof InventarioService !== 'undefined' && InventarioService.guardarIngrediente) {
      const resultado = await InventarioService.guardarIngrediente(datos);
      if (resultado.exito) {
        cerrarModalIngrediente();
        showToast('success', 'Ingrediente guardado');
        return;
      } else {
        showToast('error', resultado.error);
      }
    }

    try {
      await DB.syncGuardarIngrediente(datos);
      cerrarModalIngrediente();
      showToast('success', 'Ingrediente guardado');
    } catch (e) {
      showToast('error', 'Error al guardar ingrediente');
    }
  }

  function editarIngrediente(id) {
    const ing = DB.ingredientes.find(i => i.id == id);
    if (ing) mostrarModalIngrediente(ing);
  }

  async function ajusteRapido(ingredienteId = null) {
    if (!ingredienteId) {
      const nombre = prompt('Ingrediente a ajustar (nombre exacto):');
      if (!nombre) return;
      const ing = DB.ingredientes.find(i => i.nombre.toLowerCase() === nombre.toLowerCase());
      if (!ing) { showToast('error', 'Ingrediente no encontrado'); return; }
      ingredienteId = ing.id;
    }
    const ing = DB.ingredientes.find(i => i.id === ingredienteId);
    if (!ing) return;

    const delta = prompt(`Ajustar stock de ${ing.nombre} (actual: ${ing.stock} ${ing.unidad}). Ingresá cantidad (positiva para agregar, negativa para quitar):`);
    if (delta === null) return;
    const cantidad = parseFloat(delta);
    if (isNaN(cantidad)) { showToast('error', 'Cantidad inválida'); return; }
    const motivo = prompt('Motivo (opcional):') || 'Ajuste rápido';

    if (typeof InventarioService !== 'undefined' && InventarioService.ajustarStock) {
      const resultado = await InventarioService.ajustarStock(ingredienteId, cantidad, motivo);
      if (resultado.exito) {
        showToast('success', `Stock de ${ing.nombre} actualizado`);
        return;
      } else {
        showToast('error', resultado.error);
      }
    }

    DB.ajustarStock(ingredienteId, cantidad, motivo);
    showToast('success', `Stock de ${ing.nombre} actualizado`);
  }

  function exportarIngredientes() {
    const ing = DB.ingredientes || [];
    let csv = 'Nombre,Categoría,Stock,Unidad,Stock Mínimo,Ubicación,Valor Unitario,Valor Total\n';
    ing.forEach(i => {
      csv += `"${i.nombre}","${i.categoria || ''}",${i.stock},"${i.unidad}",${i.stock_minimo},"${i.ubicacion || ''}",${i.valor_unitario || 0},${i.stock * (i.valor_unitario || 0)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    const ingredientes = Store.getState().ingredientes || DB.ingredientes || [];

    const html = `
      <html>
      <head><title>Inventario</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; }
      </style>
      </head>
      <body>
        <h1>Inventario — ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead><tr><th>Ingrediente</th><th>Cat.</th><th>Stock</th><th>Uni.</th><th>Mín.</th><th>Ubicación</th><th>Valor Un.</th><th>Valor Total</th></tr></thead>
          <tbody>
            ${ingredientes.map(i => `
              <tr>
                <td>${i.nombre}</td>
                <td>${i.categoria || ''}</td>
                <td>${i.stock}</td>
                <td>${i.unidad}</td>
                <td>${i.stock_minimo}</td>
                <td>${i.ubicacion || ''}</td>
                <td>${i.valor_unitario || ''}</td>
                <td>${(i.stock * (i.valor_unitario || 0)).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank', 'width=800,height=600');
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('INGREDIENTE') || action.type.startsWith('MOVIMIENTO')) {
        render();
      }
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'despensa') {
        _paginaMovimientos = 0;
        render();
      }
    });
  }

  _initListeners();

  return {
    render,
    filtrarPorCategoria,
    _buscar,
    _aplicarFiltros,
    mostrarModalIngrediente,
    cerrarModalIngrediente,
    guardarIngrediente,
    editarIngrediente,
    ajusteRapido,
    exportarIngredientes,
    exportarPDF,
    ordenarTabla,
    _mostrarMasMovimientos
  };
})();

export { Despensa };