/* ================================================================
   LaTaberna - PubPOS — UI JS
   Archivo: js/ui/recetas.js
   Versión: 1.0.0
   Propósito: Vista unificada de recetario (modo consulta y administración).
   Dependencias: js/lib/store.js, js/lib/eventBus.js, js/auth.js, js/db.js, js/utils.js, js/lib/logger.js
   ================================================================ */
   
   
const Recetas = (() => {

  let _terminoBusqueda = '';
  let _terminoIngrediente = '';
  let _modo = null; // 'administracion' | 'consulta' | null (autodetectar)

  function _asegurarVista() {
    if (document.getElementById('view-recetas')) return;

    const main = document.createElement('main');
    main.id = 'view-recetas';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-book"></i> Recetas</h2>
        <div class="toolbar-actions">
          <div class="recetas-search">
            <i class="fas fa-search"></i>
            <input type="text" id="recetasSearch" placeholder="Buscar receta..." oninput="Recetas.filtrar()">
          </div>
          <div class="recetas-search" style="margin-left:8px;">
            <i class="fas fa-boxes"></i>
            <input type="text" id="recetasIngredienteSearch" placeholder="Buscar por ingrediente..." oninput="Recetas.filtrarPorIngrediente()">
          </div>
          <button class="btn-secondary" id="btnNuevaReceta" onclick="Recetas.mostrarModalReceta()"><i class="fas fa-plus"></i> Nueva Receta</button>
        </div>
      </div>
      <div id="recetasGrid" class="recetas-grid"></div>
    `;
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /**
   * Renderiza la cuadrícula de recetas.
   * @param {string} [modo] - 'administracion', 'consulta' o undefined (autodetectar según rol).
   */
  function render(modo) {
    // Determinar modo
    if (modo) {
      _modo = modo;
    } else {
      const rol = Auth.getRol();
      _modo = (rol === 'admin' || rol === 'master') ? 'administracion' : 'consulta';
    }

    _asegurarVista();

    // Mostrar/ocultar botón Nueva Receta según modo
    const btnNueva = document.getElementById('btnNuevaReceta');
    if (btnNueva) {
      btnNueva.style.display = (_modo === 'administracion') ? '' : 'none';
    }

    const grid = document.getElementById('recetasGrid');
    if (!grid) return;

    const state = Store.getState();
    const rol = Auth.getRol();
    let productos = (state.productos || []).filter(p => p.activo !== false);

    if (rol === 'cocina') {
      productos = productos.filter(p => p.destino === 'cocina' || p.destino === 'ambos');
    } else if (rol === 'barra') {
      productos = productos.filter(p => p.destino === 'barra' || p.destino === 'ambos');
    }

    const recetas = state.recetas || [];
    const ingredientes = state.ingredientes || [];

    if (_terminoBusqueda) {
      const term = _terminoBusqueda.toLowerCase();
      productos = productos.filter(p => p.nombre.toLowerCase().includes(term));
    }

    if (_terminoIngrediente) {
      const termIng = _terminoIngrediente.toLowerCase();
      productos = productos.filter(prod => {
        const receta = recetas.find(r => r.productoId == prod.id);
        if (!receta || !receta.ingredientes) return false;
        return receta.ingredientes.some(ing => {
          const ingData = ingredientes.find(i => i.id == ing.ingredienteId);
          return ingData && ingData.nombre.toLowerCase().includes(termIng);
        });
      });
    }

    productos = productos.filter(prod => {
      const receta = recetas.find(r => r.productoId == prod.id);
      return receta && receta.ingredientes && receta.ingredientes.length > 0;
    });

    if (!productos.length) {
      grid.innerHTML = `<div class="recetas-empty"><i class="fas fa-utensils"></i><p>No se encontraron recetas</p></div>`;
      return;
    }

    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    grid.innerHTML = productos.map(prod => {
      const receta = recetas.find(r => r.productoId == prod.id);
      const numIng = receta ? receta.ingredientes.length : 0;
      const inicial = prod.nombre.charAt(0).toUpperCase();
      const color = _getColorFromName(prod.nombre);

      return `
        <div class="receta-card" onclick="Recetas.mostrarDetalle('${prod.id}')">
          <div class="receta-card-img" style="background-color: ${color};">
            <span class="receta-card-inicial">${inicial}</span>
            <span class="receta-card-badge" title="${numIng} ingrediente(s)">${numIng} <i class="fas fa-boxes"></i></span>
          </div>
          <div class="receta-card-nombre">${prod.nombre}</div>
        </div>
      `;
    }).join('');
  }

  function filtrar() {
    _terminoBusqueda = document.getElementById('recetasSearch')?.value?.trim() || '';
    render();
  }

  function filtrarPorIngrediente() {
    _terminoIngrediente = document.getElementById('recetasIngredienteSearch')?.value?.trim() || '';
    render();
  }

  function _getColorFromName(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 45%)`;
  }

  function _iconoPorCategoria(categoria) {
    const mapa = {
      cocina: 'fa-fire-burner',
      barra: 'fa-wine-glass',
      general: 'fa-box'
    };
    return mapa[categoria] || 'fa-box';
  }

  /** Muestra el modal de detalle de una receta */
  function mostrarDetalle(prodId) {
    const state = Store.getState();
    const producto = (state.productos || []).find(p => p.id == prodId);
    if (!producto) return;

    const receta = (state.recetas || []).find(r => r.productoId == prodId);
    if (!receta) {
      showToast('error', 'No hay receta asignada a este producto');
      return;
    }

    let modal = document.getElementById('modalRecetaDetalle');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalRecetaDetalle';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-receta-detalle">
          <div class="modal-header">
            <h3 id="detalleTitulo"></h3>
            <button class="modal-close" onclick="Recetas.cerrarDetalle()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body receta-detalle-body">
            <div id="detalleIngredientes"></div>
            <div id="detalleCosto"></div>
            <div id="detalleInstrucciones"></div>
          </div>
          <div class="modal-footer" id="detalleFooter">
            <button class="btn-secondary" id="btnCerrarDetalle" onclick="Recetas.cerrarDetalle()">Cerrar</button>
            <button class="btn-secondary" id="btnExportarPDF" onclick="Recetas.exportarRecetaPDF('${prodId}')"><i class="fas fa-print"></i> Exportar PDF</button>
            <button class="btn-primary" id="btnEditarReceta" onclick="Recetas.editarRecetaDesdeDetalle('${prodId}')"><i class="fas fa-edit"></i> Editar Receta</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${producto.nombre}`;

    const ingredientesState = state.ingredientes || [];
    let costoTotal = 0;

    let htmlIng = '<h4><i class="fas fa-list-ul"></i> Ingredientes</h4><ul class="receta-ingredientes-lista">';
    receta.ingredientes.forEach(ing => {
      const ingData = ingredientesState.find(i => i.id == ing.ingredienteId);
      if (ingData) {
        const suficiente = ingData.stock >= ing.cantidad;
        const claseStock = suficiente ? 'stock-suficiente' : 'stock-insuficiente';
        const iconoCat = _iconoPorCategoria(ingData.categoria || 'general');
        const costoIng = ing.cantidad * (ingData.valor_unitario || 0);
        costoTotal += costoIng;
        htmlIng += `
          <li>
            <span class="ing-nombre"><i class="fas ${iconoCat}"></i> ${ingData.nombre}</span>
            <span class="ing-cantidad">${ing.cantidad} ${ingData.unidad}</span>
            <span class="ing-stock ${claseStock}">
              <i class="fas ${suficiente ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
              Stock: ${ingData.stock} ${ingData.unidad}
            </span>
          </li>`;
      } else {
        htmlIng += `<li><span class="ing-nombre">${ing.ingredienteId}</span><span class="ing-cantidad">${ing.cantidad}</span></li>`;
      }
    });
    htmlIng += '</ul>';
    document.getElementById('detalleIngredientes').innerHTML = htmlIng;

    document.getElementById('detalleCosto').innerHTML = `
      <h4><i class="fas fa-dollar-sign"></i> Costo estimado</h4>
      <p style="font-size:14px; font-weight:600;">Total: ${fmtMoney(costoTotal)}</p>
    `;

    const instrucciones = receta.instrucciones || 'Sin instrucciones de preparación.';
    const pasosHTML = instrucciones
      .split('\n')
      .filter(line => line.trim())
      .map((line, i) => `<div class="paso-item"><span class="paso-num">${i+1}</span><span class="paso-texto">${line}</span></div>`)
      .join('');
    document.getElementById('detalleInstrucciones').innerHTML = `
      <h4><i class="fas fa-tasks"></i> Preparación</h4>
      <div class="receta-pasos">${pasosHTML || '<p>Sin instrucciones.</p>'}</div>
    `;

    // Ajustar visibilidad según modo
    const btnEditar = document.getElementById('btnEditarReceta');
    if (btnEditar) {
      btnEditar.style.display = (_modo === 'administracion') ? '' : 'none';
    }

    modal.dataset.productoId = prodId;
    modal.style.display = 'flex';
  }

  function cerrarDetalle() {
    const modal = document.getElementById('modalRecetaDetalle');
    if (modal) modal.style.display = 'none';
  }

  function editarRecetaDesdeDetalle(prodId) {
    if (_modo !== 'administracion') {
      showToast('error', 'No tienes permisos para editar recetas');
      return;
    }
    cerrarDetalle();
    Recetas.mostrarModalReceta(prodId);
  }

  function exportarRecetaPDF(prodId) {
    const state = Store.getState();
    const producto = (state.productos || []).find(p => p.id == prodId);
    if (!producto) return;
    const receta = (state.recetas || []).find(r => r.productoId == prodId);
    if (!receta) return;

    const ingredientesState = state.ingredientes || [];
    let costoTotal = 0;
    let filasIngredientes = '';
    receta.ingredientes.forEach(ing => {
      const ingData = ingredientesState.find(i => i.id == ing.ingredienteId);
      const nombre = ingData ? ingData.nombre : ing.ingredienteId;
      const costo = ingData ? ing.cantidad * (ingData.valor_unitario || 0) : 0;
      costoTotal += costo;
      filasIngredientes += `<tr><td>${nombre}</td><td>${ing.cantidad} ${ingData ? ingData.unidad : ''}</td><td>${costo > 0 ? fmtMoney(costo) : '—'}</td></tr>`;
    });

    const html = `
      <html>
      <head><title>Receta: ${producto.nombre}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
      </style>
      </head>
      <body>
        <h1>${producto.nombre}</h1>
        <h2>Ingredientes</h2>
        <table>
          <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Costo</th></tr></thead>
          <tbody>${filasIngredientes}</tbody>
        </table>
        <p><strong>Costo total estimado: ${fmtMoney(costoTotal)}</strong></p>
        <h2>Preparación</h2>
        <p>${(receta.instrucciones || '').replace(/\n/g, '<br>')}</p>
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

  function _asegurarModalReceta() {
    if (_modo !== 'administracion') {
      showToast('error', 'Acceso denegado');
      return;
    }
    if (document.getElementById('modalReceta')) return;

    const modal = document.createElement('div');
    modal.id = 'modalReceta';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small" style="max-width: 520px;">
        <div class="modal-header"><h3>Asignar Receta</h3><button class="modal-close" onclick="Recetas.cerrarModalReceta()"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <label>Producto</label><select id="recProductoId" onchange="Recetas._mostrarRecetaActual()"></select>
          <div id="recetaActual" style="margin-bottom: 10px;"></div>
          <label>Ingrediente (opcional para añadir)</label><select id="recIngredienteId"><option value="">— Ninguno —</option></select>
          <label>Cantidad necesaria</label><input type="number" id="recCantidad" step="0.01" placeholder="Solo si agregas ingrediente">
          <label>Instrucciones de preparación</label>
          <textarea id="recInstrucciones" rows="4" placeholder="1. Mezclar harina y huevos...&#10;2. Hornear a 180°C...&#10;3. Servir con salsa..."></textarea>
          <div class="modal-small-footer">
            <button class="btn-secondary" onclick="Recetas.cerrarModalReceta()">Cancelar</button>
            <button class="btn-primary" onclick="Recetas.guardarReceta()">Guardar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function mostrarModalReceta(productoId = null) {
    _asegurarModalReceta();
    if (_modo !== 'administracion') return;

    const state = Store.getState();
    const selProd = document.getElementById('recProductoId');
    selProd.innerHTML = (state.productos || []).filter(p => p.activo !== false).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const selIng = document.getElementById('recIngredienteId');
    selIng.innerHTML = '<option value="">— Ninguno —</option>' + (state.ingredientes || []).map(i => `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`).join('');

    document.getElementById('recCantidad').value = '';
    const recInst = document.getElementById('recInstrucciones');
    if (recInst) recInst.value = '';

    if (productoId) {
      selProd.value = productoId;
      const receta = (state.recetas || []).find(r => r.productoId == productoId);
      if (receta && recInst) recInst.value = receta.instrucciones || '';
      _mostrarRecetaActual();
    } else {
      _mostrarRecetaActual();
    }

    document.getElementById('modalReceta').style.display = 'flex';
  }

  function cerrarModalReceta() {
    const modal = document.getElementById('modalReceta');
    if (modal) modal.style.display = 'none';
  }

  function _mostrarRecetaActual() {
    const state = Store.getState();
    const productoId = document.getElementById('recProductoId').value;
    const receta = (state.recetas || []).find(r => r.productoId == productoId);
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
        const nombreIng = (state.ingredientes || []).find(i => i.id == ing.ingredienteId)?.nombre || ing.ingredienteId;
        html += `<li>${nombreIng}: ${ing.cantidad} <button class="btn-icon-sm" onclick="Recetas._quitarIngrediente('${receta.productoId}', '${ing.ingredienteId}')"><i class="fas fa-trash"></i></button></li>`;
      });
      html += '</ul>';
      div.innerHTML = html;
    } else {
      div.innerHTML = '<p style="color:var(--color-text-muted);">Sin ingredientes asignados.</p>';
    }
  }

  async function guardarReceta() {
    if (_modo !== 'administracion') {
      showToast('error', 'Acceso denegado');
      return;
    }
    const productoId = document.getElementById('recProductoId').value;
    if (!productoId) {
      showToast('error', 'Selecciona un producto');
      return;
    }

    const insumoId = document.getElementById('recIngredienteId').value;
    const cantidad = parseFloat(document.getElementById('recCantidad').value);
    const instrucciones = document.getElementById('recInstrucciones')?.value?.trim() || '';

    if (insumoId && !isNaN(cantidad) && cantidad > 0) {
      const receta = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        productoId,
        insumoId,
        cantidad,
        instrucciones
      };

      try {
        await DB.syncGuardarReceta(receta);
      } catch (e) {
        showToast('error', 'Error al asignar ingrediente');
      }
    }

    if (instrucciones) {
      const recetaLocal = DB.recetas.find(r => r.productoId == productoId);
      if (recetaLocal) {
        recetaLocal.instrucciones = instrucciones;
      } else {
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
  }

  async function _quitarIngrediente(productoId, ingredienteId) {
    if (_modo !== 'administracion') {
      showToast('error', 'Acceso denegado');
      return;
    }
    const receta = DB.recetas.find(r => r.productoId == productoId);
    if (receta) {
      receta.ingredientes = receta.ingredientes.filter(ing => ing.ingredienteId != ingredienteId);
      DB.saveRecetas();
      _mostrarRecetaActual();
      showToast('warning', 'Ingrediente eliminado localmente');
    }
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('PRODUCTO') || action.type.startsWith('RECETA') || action.type.startsWith('INGREDIENTE')) {
        render();
      }
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'recetas') render();
    });
  }

  _initListeners();

  return {
    render,
    filtrar,
    filtrarPorIngrediente,
    mostrarDetalle,
    cerrarDetalle,
    editarRecetaDesdeDetalle,
    exportarRecetaPDF,
    mostrarModalReceta,
    cerrarModalReceta,
    guardarReceta,
    _mostrarRecetaActual,
    _quitarIngrediente
  };
})();

window.Recetas = Recetas;