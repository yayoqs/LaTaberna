/* ================================================================
   PubPOS — MÓDULO: despensa.js (v7.1 – permite guardar instrucciones
              sin necesidad de añadir un ingrediente)
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
        <h2><i class="fas fa-boxes"></i> Despensa — Control de Stock</h2>
        <div class="toolbar-actions">
          <div style="display:flex; align-items:center; gap:8px;">
            <select id="despensaCatFilter" onchange="Despensa.filtrarPorCategoria(this.value)">
              <option value="todas">Todas</option>
              <option value="cocina">Cocina</option>
              <option value="barra">Barra</option>
              <option value="general">General</option>
            </select>
            <input type="text" id="ingredienteSearch" placeholder="Buscar ingrediente..." 
                   oninput="Despensa._buscar()">
          </div>
          <button class="btn-primary" onclick="Despensa.mostrarModalIngrediente()">
            <i class="fas fa-plus"></i> Nuevo
          </button>
          <button class="btn-secondary" onclick="Despensa.mostrarModalReceta()">
            <i class="fas fa-link"></i> Receta
          </button>
          <button class="btn-secondary" onclick="Despensa.exportarMovimientos()">
            <i class="fas fa-download"></i> Mov.
          </button>
          <button class="btn-secondary" onclick="Despensa.exportarIngredientes()">
            <i class="fas fa-download"></i> Ing.
          </button>
          <button class="btn-secondary" onclick="Despensa.render()">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      <div class="despensa-grid">
        <div class="despensa-main">
          <div id="despensaCounters" style="margin-bottom:8px; font-size:12px; display:flex; gap:16px; color:var(--color-text-muted)"></div>
          <table class="ingredientes-table" id="ingredientesTable">
            <thead>
              <tr>
                <th onclick="Despensa.ordenarTabla('nombre')">Ingrediente <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('categoria')">Categoría <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock')">Stock <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('unidad')">Unidad <i class="fas fa-sort"></i></th>
                <th onclick="Despensa.ordenarTabla('stock_minimo')">Mín. <i class="fas fa-sort"></i></th>
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
          <button class="btn-secondary" onclick="Despensa.ajusteRapido()">
            <i class="fas fa-pen"></i> Ajuste Rápido
          </button>
        </div>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    _renderTablaIngredientes();
    _renderMovimientos();
    _renderAlertasStock();
    _actualizarContadores();
  }

  function filtrarPorCategoria(cat) {
    _categoriaFiltro = cat;
    _renderTablaIngredientes();
    _actualizarContadores();
  }

  function _buscar() {
    _ordenColumna = null;
    _ordenDireccion = 1;
    _renderTablaIngredientes();
    _actualizarContadores();
  }

  function _renderTablaIngredientes() { /* ... igual que antes ... */ }
  function ordenarTabla(columna) { /* ... igual ... */ }
  function _renderMovimientos() { /* ... igual ... */ }
  function _renderAlertasStock() { /* ... igual ... */ }
  function _actualizarContadores() { /* ... igual ... */ }
  function _ajusteInline(ingId) { /* ... igual ... */ }

  // ── MODALES (incluyendo el de receta corregido) ─────────────
  function mostrarModalIngrediente(ingrediente = null) { /* ... igual ... */ }
  function cerrarModalIngrediente() { /* ... igual ... */ }
  function guardarIngrediente() { /* ... igual ... */ }
  function editarIngrediente(id) { /* ... igual ... */ }
  function ajusteRapido(id = null) { /* ... igual ... */ }

  /* ── MODAL RECETA (CORREGIDO) ────────────────────────────── */
  function mostrarModalReceta(productoId = null) {
    let modal = document.getElementById('modalReceta');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReceta';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width: 520px;">
          <div class="modal-header"><h3>Asignar Receta</h3><button class="modal-close" onclick="Despensa.cerrarModalReceta()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Producto</label><select id="recProductoId" onchange="Despensa.mostrarRecetaActual()"></select>
            <div id="recetaActual" style="margin-bottom: 10px;"></div>
            <label>Ingrediente (opcional para añadir)</label><select id="recIngredienteId"><option value="">— Ninguno —</option></select>
            <label>Cantidad necesaria</label><input type="number" id="recCantidad" step="0.01" placeholder="Solo si agregas ingrediente">
            <label>Instrucciones de preparación</label>
            <textarea id="recInstrucciones" rows="4" placeholder="1. Mezclar harina y huevos...&#10;2. Hornear a 180°C...&#10;3. Servir con salsa..."></textarea>
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Despensa.cerrarModalReceta()">Cancelar</button>
              <button class="btn-primary" onclick="Despensa.guardarReceta()">Guardar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    const selProd = document.getElementById('recProductoId');
    selProd.innerHTML = DB.productos.filter(p => p.activo !== false).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const selIng = document.getElementById('recIngredienteId');
    selIng.innerHTML = '<option value="">— Ninguno —</option>' + DB.ingredientes.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`).join('');

    // Limpiar campos
    document.getElementById('recCantidad').value = '';
    const recInst = document.getElementById('recInstrucciones');
    if (recInst) recInst.value = '';

    if (productoId) {
      selProd.value = productoId;
      // Cargar instrucciones existentes
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
    if (!productoId) {
      showToast('error', 'Selecciona un producto');
      return;
    }

    const insumoId = document.getElementById('recIngredienteId').value;
    const cantidad = parseFloat(document.getElementById('recCantidad').value);
    const instrucciones = document.getElementById('recInstrucciones')?.value?.trim() || '';

    // Si se ingresaron ingrediente y cantidad válidos, los sincronizamos
    if (insumoId && !isNaN(cantidad) && cantidad > 0) {
      const receta = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        productoId,
        insumoId,
        cantidad,
        instrucciones      // también enviamos instrucciones en el mismo objeto
      };

      try {
        await DB.syncGuardarReceta(receta);
      } catch (e) {
        showToast('error', 'Error al asignar ingrediente');
      }
    }

    // Siempre actualizamos las instrucciones en la receta local
    if (instrucciones) {
      const recetaLocal = DB.recetas.find(r => r.productoId == productoId);
      if (recetaLocal) {
        recetaLocal.instrucciones = instrucciones;
      } else {
        // Si aún no hay receta, creamos una vacía con instrucciones
        DB.recetas.push({
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
          productoId,
          ingredientes: [],
          instrucciones
        });
      }
      DB.saveRecetas();
      EventBus.emit('recetas:actualizadas');
    }

    cerrarModalReceta();
    showToast('success', 'Receta actualizada');
    // Refrescar si hay módulo de recetas abierto
    if (typeof Recetas !== 'undefined' && Recetas.render) Recetas.render();
  }

  async function quitarIngredienteReceta(productoId, ingredienteId) {
    const receta = DB.recetas.find(r => r.productoId == productoId);
    if (receta) {
      receta.ingredientes = receta.ingredientes.filter(ing => ing.ingredienteId != ingredienteId);
      DB.saveRecetas();
      mostrarRecetaActual();
      showToast('warning', 'Ingrediente eliminado localmente');
    }
  }

  function exportarMovimientos() { /* ... */ }
  function exportarIngredientes() { /* ... */ }

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
    _ajusteInline,
    mostrarModalIngrediente,
    cerrarModalIngrediente,
    guardarIngrediente,
    editarIngrediente,
    ajusteRapido,
    mostrarModalReceta,
    cerrarModalReceta,
    guardarReceta,
    mostrarRecetaActual,
    quitarIngredienteReceta,
    exportarMovimientos,
    exportarIngredientes,
    ordenarTabla
  };
})();
window.Despensa = Despensa;