/* ================================================================
   PubPOS — MÓDULO: despensa.js (v9 – solo inventario, sin recetas)
   ================================================================ */

const Despensa = (() => {

  let _ordenColumna = null;
  let _ordenDireccion = 1;
  let _categoriaFiltro = 'todas';

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-despensa')) return;

    const main = document.createElement('main');
    main.id = 'view-despensa';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-boxes"></i> Despensa — Inventario</h2>
        <div class="toolbar-actions">
          <div style="display:flex; align-items:center; gap:8px;">
            <select id="despensaCatFilter" onchange="Despensa.filtrarPorCategoria(this.value)">
              <option value="todas">Todas las categorías</option>
              <option value="cocina">Cocina</option>
              <option value="barra">Barra</option>
              <option value="general">General</option>
            </select>
            <input type="text" id="ingredienteSearch" placeholder="Buscar ingrediente..." 
                   oninput="Despensa._buscar()">
          </div>
          <button class="btn-primary" onclick="Despensa.mostrarModalIngrediente()">
            <i class="fas fa-plus"></i> Nuevo Ingrediente
          </button>
          <button class="btn-secondary" onclick="Despensa.exportarIngredientes()">
            <i class="fas fa-download"></i> Exportar
          </button>
          <button class="btn-secondary" onclick="Despensa.render()">
            <i class="fas fa-sync-alt"></i> Refrescar
          </button>
        </div>
      </div>

      <!-- RESUMEN DE INVENTARIO -->
      <div class="inventario-resumen" id="inventarioResumen"></div>

      <div class="despensa-grid">
        <div class="despensa-main">
          <table class="ingredientes-table" id="ingredientesTable">
            <thead>
              <tr>
                <th onclick="Despensa.ordenarTabla('nombre')">Ingrediente <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('categoria')">Cat. <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock')">Stock <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('unidad')">Uni. <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock_minimo')">Mín. <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('ubicacion')">Ubicación <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('valor_unitario')">Valor Un. <i class="fas fa-sort"></i></th>
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
          <h4><i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i> Alertas Stock Bajo</h4>
          <div id="alertasStockList"></div>
          <button class="btn-secondary" onclick="Despensa.ajusteRapido()" style="width:100%;">
            <i class="fas fa-pen"></i> Ajuste Rápido
          </button>
        </div>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDER PRINCIPAL ───────────────────────────────────── */
  function render() {
    _asegurarVista();
    _renderResumen();
    _renderTablaIngredientes();
    _renderMovimientos();
    _renderAlertasStock();
  }

  /* ── RESUMEN SUPERIOR (valor total del inventario) ───────── */
  function _renderResumen() {
    const cont = $id('inventarioResumen');
    if (!cont) return;

    const ingredientes = DB.ingredientes || [];
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

  /* ── FILTROS ────────────────────────────────────────────── */
  function filtrarPorCategoria(cat) {
    _categoriaFiltro = cat;
    _renderTablaIngredientes();
    _renderResumen();
  }

  function _buscar() {
    _ordenColumna = null;
    _ordenDireccion = 1;
    _renderTablaIngredientes();
    _renderResumen();
  }

  /* ── TABLA DE INGREDIENTES ─────────────────────────────── */
  function _renderTablaIngredientes() {
    const tbody = document.getElementById('ingredientesBody');
    if (!tbody) return;

    let ingredientes = DB.ingredientes || [];
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

    if (_ordenColumna) {
      ingredientes.sort((a, b) => {
        let valA = a[_ordenColumna];
        let valB = b[_ordenColumna];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * _ordenDireccion;
        if (valA > valB) return 1 * _ordenDireccion;
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
            <button class="btn-ajuste" onclick="Despensa.editarIngrediente('${ing.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-ajuste" onclick="Despensa.ajusteRapido('${ing.id}')"><i class="fas fa-pen"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  function ordenarTabla(columna) {
    if (_ordenColumna === columna) {
      _ordenDireccion *= -1;
    } else {
      _ordenColumna = columna;
      _ordenDireccion = 1;
    }
    _renderTablaIngredientes();
  }

  /* ── MOVIMIENTOS ────────────────────────────────────────── */
  function _renderMovimientos() {
    const cont = document.getElementById('movimientosList');
    if (!cont) return;
    const movs = DB.movimientos || [];
    const recientes = [...movs].reverse().slice(0, 10);
    if (!recientes.length) {
      cont.innerHTML = `<p style="color:var(--color-text-muted);">Sin movimientos</p>`;
      return;
    }
    cont.innerHTML = recientes.map(mov => {
      const ing = DB.ingredientes.find(i => i.id === mov.ingredienteId);
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
  }

  function _renderAlertasStock() {
    const cont = document.getElementById('alertasStockList');
    if (!cont) return;
    const criticos = DB.ingredientes.filter(i => i.stock <= i.stock_minimo);
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

  /* ── MODAL INGREDIENTE (con valor unitario) ─────────────── */
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
          <div class="modal-header"><h3 id="ingTitulo">${titulo}</h3><button class="modal-close" onclick="Despensa.cerrarModalIngrediente()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <input type="hidden" id="ingId">
            <label>Nombre</label><input type="text" id="ingNombre" placeholder="Ej: Harina 000">
            <label>Categoría</label><select id="ingCategoria"><option value="cocina">Cocina</option><option value="barra">Barra</option><option value="general">General</option></select>
            <label>Stock actual</label><input type="number" id="ingStock" step="0.01" value="0">
            <label>Unidad</label><input type="text" id="ingUnidad" placeholder="kg, g, L, u" value="kg">
            <label>Stock mínimo</label><input type="number" id="ingStockMin" step="0.01" value="5">
            <label>Ubicación</label><input type="text" id="ingUbicacion" placeholder="Ej: Estante 3">
            <label>Valor unitario ($)</label><input type="number" id="ingValorUnitario" step="0.01" value="0" placeholder="0.00">
            <div class="modal-small-footer"><button class="btn-secondary" onclick="Despensa.cerrarModalIngrediente()">Cancelar</button><button class="btn-primary" onclick="Despensa.guardarIngrediente()">Guardar</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
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
    document.getElementById('modalIngrediente').style.display = 'none';
  }

  async function guardarIngrediente() {
    const id = document.getElementById('ingId').value;
    const nombre = document.getElementById('ingNombre').value.trim();
    if (!nombre) { showToast('error', 'Nombre obligatorio'); return; }
    const ingrediente = {
      id: id || `ins_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      nombre,
      categoria: document.getElementById('ingCategoria').value,
      stock: parseFloat(document.getElementById('ingStock').value) || 0,
      unidad: document.getElementById('ingUnidad').value.trim() || 'u',
      stock_minimo: parseFloat(document.getElementById('ingStockMin').value) || 0,
      ubicacion: document.getElementById('ingUbicacion').value.trim() || '',
      valor_unitario: parseFloat(document.getElementById('ingValorUnitario').value) || 0
    };
    try {
      await DB.syncGuardarIngrediente(ingrediente);
      cerrarModalIngrediente();
      render();
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
    const motivo = prompt('Motivo (opcional):') || 'Ajuste manual';
    DB.ajustarStock(ingredienteId, cantidad, motivo);
    render();
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

  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('ingredientes:actualizados', render);
    EventBus.on('inventario:actualizado', render);
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
  }
  _initEventListeners();

  return {
    render,
    filtrarPorCategoria,
    _buscar,
    mostrarModalIngrediente,
    cerrarModalIngrediente,
    guardarIngrediente,
    editarIngrediente,
    ajusteRapido,
    exportarIngredientes,
    ordenarTabla
  };
})();

window.Despensa = Despensa;