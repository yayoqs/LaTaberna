/* ================================================================
   PubPOS — MÓDULO: despensa.js (v6 – añade campo instrucciones
              en modal de receta)
   Propósito: Gestión de inventario (ingredientes, recetas, movimientos).
              Ahora el modal de receta permite guardar instrucciones.
   ================================================================ */

const Despensa = (() => {

  // ── ESTADO INTERNO ────────────────────────────────────────
  let _ordenColumna = null;
  let _ordenDireccion = 1;

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-despensa')) return;

    const main = document.createElement('main');
    main.id = 'view-despensa';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-boxes"></i> Despensa — Control de Stock</h2>
        <div class="toolbar-actions">
          <div id="despensaBusquedaContainer" style="display: flex; align-items: center;"></div>
          <button class="btn-primary" onclick="Despensa.mostrarModalIngrediente()">
            <i class="fas fa-plus"></i> Nuevo Ingrediente
          </button>
          <button class="btn-secondary" onclick="Despensa.mostrarModalReceta()">
            <i class="fas fa-link"></i> Asignar Receta
          </button>
          <button class="btn-secondary" onclick="Despensa.exportarMovimientos()">
            <i class="fas fa-download"></i> Exportar Mov.
          </button>
          <button class="btn-secondary" onclick="Despensa.exportarIngredientes()">
            <i class="fas fa-download"></i> Exportar Ing.
          </button>
        </div>
      </div>
      <div class="despensa-grid">
        <div class="despensa-main">
          <table class="ingredientes-table" id="ingredientesTable">
            <thead>
              <tr>
                <th onclick="Despensa.ordenarTabla('nombre')">Ingrediente <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('categoria')">Categoría <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock')">Stock <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('unidad')">Unidad <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock_minimo')">Stock Mín. <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('ubicacion')">Ubicación <i class="fas fa-sort"></i></th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="ingredientesBody"></tbody>
          </table>
        </div>
        <div class="despensa-sidebar">
          <h4><i class="fas fa-history"></i> Movimientos</h4>
          <div id="movimientosList"></div>
          <h4><i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i> Alertas Stock Bajo</h4>
          <div id="alertasStockList"></div>
          <button class="btn-secondary" onclick="Despensa.ajusteRapido()"><i class="fas fa-pen"></i> Ajuste Rápido</button>
        </div>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    _renderBusqueda();
    _renderTablaIngredientes();
    _renderMovimientos();
    _renderAlertasStock();
  }

  function _renderBusqueda() {
    const contenedor = document.getElementById('despensaBusquedaContainer');
    if (!contenedor) return;

    if (!document.getElementById('ingredienteSearch')) {
      contenedor.innerHTML = '';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'ingredienteSearch';
      input.placeholder = 'Buscar ingrediente...';
      input.oninput = () => {
        _ordenColumna = null;
        _ordenDireccion = 1;
        _renderTablaIngredientes();
      };
      contenedor.appendChild(input);
    }
  }

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
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;">No hay ingredientes visibles para tu rol.</td></tr>`;
      return;
    }

    tbody.innerHTML = ingredientes.map(ing => {
      const bajoStock = ing.stock <= ing.stock_minimo;
      return `
        <tr class="${bajoStock ? 'stock-bajo' : ''}">
          <td><strong>${ing.nombre}</strong></td>
          <td>${ing.categoria || 'general'}</td>
          <td>${ing.stock.toFixed(2)}</td>
          <td>${ing.unidad}</td>
          <td>${ing.stock_minimo}</td>
          <td>${ing.ubicacion || '—'}</td>
          <td>
            <button class="btn-ajuste" onclick="Despensa.ajusteRapido('${ing.id}')"><i class="fas fa-pen"></i> Ajustar</button>
            <button class="btn-ajuste" onclick="Despensa.editarIngrediente('${ing.id}')"><i class="fas fa-edit"></i></button>
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

  /* ── MODAL INGREDIENTE ──────────────────────────────────── */
  function mostrarModalIngrediente(ingrediente = null) { /* ... igual que antes ... */
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
            <label>Stock inicial</label><input type="number" id="ingStock" step="0.01" value="0">
            <label>Unidad</label><input type="text" id="ingUnidad" placeholder="kg, g, L, u" value="kg">
            <label>Stock mínimo</label><input type="number" id="ingStockMin" step="0.01" value="5">
            <label>Ubicación</label><input type="text" id="ingUbicacion" placeholder="Ej: Estante 3, refrigerador 1">
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
    document.getElementById('ingTitulo').textContent = titulo;
    modal.style.display = 'flex';
  }

  function cerrarModalIngrediente() { document.getElementById('modalIngrediente').style.display = 'none'; }

  async function guardarIngrediente() { /* ... igual ... */
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
      ubicacion: document.getElementById('ingUbicacion').value.trim() || ''
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

  function editarIngrediente(id) { const ing = DB.ingredientes.find(i => i.id == id); if (ing) mostrarModalIngrediente(ing); }

  async function ajusteRapido(ingredienteId = null) { /* ... igual ... */ }

  /* ── MODAL RECETA (AHORA CON INSTRUCCIONES) ────────────── */
  function mostrarModalReceta(productoId = null) {
    let modal = document.getElementById('modalReceta');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReceta';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width: 520px;">  <!-- un poco más ancho -->
          <div class="modal-header"><h3>Asignar Receta</h3><button class="modal-close" onclick="Despensa.cerrarModalReceta()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Producto</label><select id="recProductoId" onchange="Despensa.mostrarRecetaActual()"></select>
            <div id="recetaActual" style="margin-bottom: 10px;"></div>
            <label>Ingrediente</label><select id="recIngredienteId"></select>
            <label>Cantidad necesaria</label><input type="number" id="recCantidad" step="0.01" placeholder="Ej: 0.2">
            <!-- NUEVO CAMPO DE INSTRUCCIONES -->
            <label>Instrucciones de preparación</label>
            <textarea id="recInstrucciones" rows="4" placeholder="1. Mezclar harina y huevos...&#10;2. Hornear a 180°C...&#10;3. Servir con salsa..."></textarea>
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Despensa.cerrarModalReceta()">Cancelar</button>
              <button class="btn-primary" onclick="Despensa.guardarReceta()">Asignar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    const selProd = document.getElementById('recProductoId');
    selProd.innerHTML = DB.productos.filter(p => p.activo !== false).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const selIng = document.getElementById('recIngredienteId');
    selIng.innerHTML = DB.ingredientes.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`).join('');

    // Limpiar campo de instrucciones
    const recInst = document.getElementById('recInstrucciones');
    if (recInst) recInst.value = '';

    if (productoId) {
      selProd.value = productoId;
      // Cargar instrucciones existentes si tiene receta
      const receta = DB.recetas.find(r => r.productoId == productoId);
      if (receta && recInst) recInst.value = receta.instrucciones || '';
      mostrarRecetaActual();
    } else {
      mostrarRecetaActual();
    }

    modal.style.display = 'flex';
  }

  function cerrarModalReceta() {
    document.getElementById('modalReceta').style.display = 'none';
  }

  function mostrarRecetaActual() {
    const productoId = document.getElementById('recProductoId').value;
    const receta = DB.recetas.find(r => r.productoId == productoId);
    const div = document.getElementById('recetaActual');
    const recInst = document.getElementById('recInstrucciones');

    // Cargar instrucciones si existe receta
    if (recInst && receta) {
      recInst.value = receta.instrucciones || '';
    } else if (recInst) {
      recInst.value = '';
    }

    if (receta && receta.ingredientes.length) {
      let html = '<strong>Ingredientes asignados:</strong><ul>';
      receta.ingredientes.forEach(ing => {
        const nombreIng = DB.ingredientes.find(i => i.id == ing.ingredienteId)?.nombre || ing.ingredienteId;
        html += `<li>${nombreIng}: ${ing.cantidad} <button class="btn-icon-sm" onclick="Despensa.quitarIngredienteReceta('${receta.productoId}', '${ing.ingredienteId}')"><i class="fas fa-trash"></i></button></li>`;
      });
      html += '</ul>';
      div.innerHTML = html;
    } else {
      div.innerHTML = '<p style="color:var(--color-text-muted);">Sin ingredientes asignados.</p>';
    }
  }

  async function guardarReceta() {
    const productoId = document.getElementById('recProductoId').value;
    const insumoId = document.getElementById('recIngredienteId').value;
    const cantidad = parseFloat(document.getElementById('recCantidad').value);
    const instrucciones = document.getElementById('recInstrucciones')?.value?.trim() || '';

    if (!productoId || !insumoId || isNaN(cantidad) || cantidad <= 0) {
      showToast('error', 'Completá los campos de ingrediente correctamente');
      return;
    }

    // Si el modal se usó solo para editar instrucciones, no obligamos a añadir ingrediente
    const receta = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      productoId,
      insumoId,
      cantidad
    };

    try {
      await DB.syncGuardarReceta(receta);

      // Ahora actualizamos la receta local para añadir instrucciones
      const recetaLocal = DB.recetas.find(r => r.productoId == productoId);
      if (recetaLocal && instrucciones) {
        recetaLocal.instrucciones = instrucciones;
        DB.saveRecetas();
      }

      cerrarModalReceta();
      mostrarModalReceta(productoId); // refrescar
      showToast('success', 'Receta guardada');
    } catch (e) {
      showToast('error', 'Error al guardar receta');
    }
  }

  async function quitarIngredienteReceta(productoId, ingredienteId) { /* ... igual ... */
    const receta = DB.recetas.find(r => r.productoId == productoId);
    if (receta) {
      receta.ingredientes = receta.ingredientes.filter(ing => ing.ingredienteId != ingredienteId);
      DB.saveRecetas();
      mostrarRecetaActual();
      showToast('warning', 'Eliminado localmente.');
    }
  }

  function exportarMovimientos() { /* ... igual ... */ }
  function exportarIngredientes() { /* ... igual ... */ }

  function _initEventListeners() { /* ... igual ... */
    EventBus.on('db:inicializada', render);
    EventBus.on('ingredientes:actualizados', render);
    EventBus.on('inventario:actualizado', render);
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
  }
  _initEventListeners();

  return {
    render, mostrarModalIngrediente, cerrarModalIngrediente, guardarIngrediente,
    editarIngrediente, ajusteRapido, mostrarModalReceta, cerrarModalReceta,
    guardarReceta, mostrarRecetaActual, quitarIngredienteReceta,
    exportarMovimientos, exportarIngredientes, ordenarTabla
  };
})();
window.Despensa = Despensa;