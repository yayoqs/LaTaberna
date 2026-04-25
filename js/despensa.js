/* ================================================================
   PubPOS — MÓDULO: despensa.js (v2.1 – ubicación, recetas visibles, sync)
   Propósito: Gestión de inventario (ingredientes, recetas, movimientos).
   ================================================================ */
const Despensa = (() => {

  function render() {
    _renderTablaIngredientes();
    _renderMovimientos();
    _renderAlertasStock();
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

    if (!ingredientes.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;">No hay ingredientes visibles para tu rol.</td></tr>`;
      return;
    }

    const ordenados = [...ingredientes].sort((a, b) => {
      const critA = a.stock <= a.stock_minimo ? 1 : 0;
      const critB = b.stock <= b.stock_minimo ? 1 : 0;
      return critB - critA || a.nombre.localeCompare(b.nombre);
    });

    tbody.innerHTML = ordenados.map(ing => {
      const bajoStock = ing.stock <= ing.stock_minimo;
      const rowClass = bajoStock ? 'stock-bajo' : '';
      return `
        <tr class="${rowClass}">
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
        </tr>
      `;
    }).join('');
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
        </div>
      `;
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
      </div>
    `).join('');
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

  function mostrarModalReceta() {
    let modal = document.getElementById('modalReceta');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReceta';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width: 500px;">
          <div class="modal-header"><h3>Asignar Receta</h3><button class="modal-close" onclick="Despensa.cerrarModalReceta()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Producto</label><select id="recProductoId" onchange="Despensa.mostrarRecetaActual()"></select>
            <div id="recetaActual" style="margin-bottom: 10px;"></div>
            <label>Ingrediente</label><select id="recIngredienteId"></select>
            <label>Cantidad necesaria</label><input type="number" id="recCantidad" step="0.01" placeholder="Ej: 0.2">
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
    mostrarRecetaActual();
    modal.style.display = 'flex';
  }

  function cerrarModalReceta() {
    document.getElementById('modalReceta').style.display = 'none';
  }

  function mostrarRecetaActual() {
    const productoId = document.getElementById('recProductoId').value;
    const receta = DB.recetas.find(r => r.productoId == productoId);
    const div = document.getElementById('recetaActual');
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
    if (!productoId || !insumoId || isNaN(cantidad) || cantidad <= 0) {
      showToast('error', 'Completá todos los campos correctamente');
      return;
    }

    const receta = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      productoId,
      insumoId,
      cantidad
    };

    try {
      await DB.syncGuardarReceta(receta);
      cerrarModalReceta();
      mostrarModalReceta(); // refrescar
      showToast('success', 'Receta asignada correctamente');
    } catch (e) {
      showToast('error', 'Error al asignar receta');
    }
  }

  async function quitarIngredienteReceta(productoId, ingredienteId) {
    const receta = DB.recetas.find(r => r.productoId == productoId);
    if (receta) {
      receta.ingredientes = receta.ingredientes.filter(ing => ing.ingredienteId != ingredienteId);
      DB.saveRecetas();
      mostrarRecetaActual();
      showToast('warning', 'Eliminado solo localmente. Próximamente se sincronizará.');
    }
  }

  function exportarMovimientos() {
    const movs = DB.movimientos || [];
    let csv = 'Fecha,Ingrediente,Tipo,Cantidad,Motivo,Usuario\n';
    movs.forEach(m => {
      const ing = DB.ingredientes.find(i => i.id === m.ingredienteId);
      csv += `${m.fecha},${ing?.nombre || m.ingredienteId},${m.tipo},${m.cantidad},${m.motivo},${m.usuario}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('ingredientes:actualizados', render);
    EventBus.on('inventario:actualizado', render);
    EventBus.on('inventario:stock_bajo', (data) => {
      showToast('warning', `⚠️ Stock bajo: ${data.ingrediente} (${data.stock} ${data.unidad})`);
    });
  }
  _initEventListeners();

  return {
    render, mostrarModalIngrediente, cerrarModalIngrediente, guardarIngrediente,
    editarIngrediente, ajusteRapido, mostrarModalReceta, cerrarModalReceta,
    guardarReceta, mostrarRecetaActual, quitarIngredienteReceta, exportarMovimientos
  };
})();

window.Despensa = Despensa;