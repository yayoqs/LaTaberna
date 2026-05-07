/* ================================================================
   PubPOS — MÓDULO: recetas.js (v5 – reactivo al Store)
   Propósito: Vista de recetario. Ahora obtiene productos y recetas
              del Store y se re-renderiza automáticamente al cambiar
              esos datos. Incluye modal de creación/edición de recetas.
   ================================================================ */

const Recetas = (() => {

  let _terminoBusqueda = '';

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-recetas')) return;

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
          <button class="btn-secondary" onclick="Recetas.mostrarModalReceta()"><i class="fas fa-plus"></i> Nueva Receta</button>
        </div>
      </div>
      <div id="recetasGrid" class="recetas-grid"></div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDERIZAR LA CUADRÍCULA ────────────────────────────── */
  function render() {
    _asegurarVista();
    const grid = $id('recetasGrid');
    if (!grid) return;

    const state = Store.getState();
    const rol = Auth.getRol();
    let productos = (state.productos || []).filter(p => p.activo !== false);

    // Filtrar por destino según el rol
    if (rol === 'cocina') {
      productos = productos.filter(p => p.destino === 'cocina' || p.destino === 'ambos');
    } else if (rol === 'barra') {
      productos = productos.filter(p => p.destino === 'barra' || p.destino === 'ambos');
    }

    // Solo productos con receta
    const recetas = state.recetas || [];
    productos = productos.filter(prod => {
      const receta = recetas.find(r => r.productoId == prod.id);
      return receta && receta.ingredientes && receta.ingredientes.length > 0;
    });

    // Búsqueda
    if (_terminoBusqueda) {
      const term = _terminoBusqueda.toLowerCase();
      productos = productos.filter(p => p.nombre.toLowerCase().includes(term));
    }

    if (!productos.length) {
      grid.innerHTML = `<div class="recetas-empty"><i class="fas fa-utensils"></i><p>No se encontraron recetas</p></div>`;
      return;
    }

    // Orden alfabético
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

  /* ── FILTRAR POR BÚSQUEDA ────────────────────────────────── */
  function filtrar() {
    _terminoBusqueda = $id('recetasSearch')?.value?.trim() || '';
    render();
  }

  /* ── COLOR BASADO EN EL NOMBRE ───────────────────────────── */
  function _getColorFromName(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 45%)`;
  }

  /* ── ÍCONO SEGÚN CATEGORÍA DE INGREDIENTE ────────────────── */
  function _iconoPorCategoria(categoria) {
    const mapa = {
      cocina: 'fa-fire-burner',
      barra: 'fa-wine-glass',
      general: 'fa-box'
    };
    return mapa[categoria] || 'fa-box';
  }

  /* ── MOSTRAR DETALLE DE RECETA (MODAL) ───────────────────── */
  function mostrarDetalle(prodId) {
    const state = Store.getState();
    const producto = (state.productos || []).find(p => p.id == prodId);
    if (!producto) return;

    const receta = (state.recetas || []).find(r => r.productoId == prodId);
    if (!receta) {
      showToast('error', 'No hay receta asignada a este producto');
      return;
    }

    let modal = $id('modalRecetaDetalle');
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
            <div id="detalleInstrucciones"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="Recetas.cerrarDetalle()">Cerrar</button>
            <button class="btn-primary" onclick="Recetas.editarRecetaDesdeDetalle('${prodId}')"><i class="fas fa-edit"></i> Editar Receta</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    $id('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${producto.nombre}`;

    // Ingredientes
    let htmlIng = '<h4><i class="fas fa-list-ul"></i> Ingredientes</h4><ul class="receta-ingredientes-lista">';
    receta.ingredientes.forEach(ing => {
      const ingData = (state.ingredientes || []).find(i => i.id == ing.ingredienteId);
      if (ingData) {
        const suficiente = ingData.stock >= ing.cantidad;
        const claseStock = suficiente ? 'stock-suficiente' : 'stock-insuficiente';
        const iconoCat = _iconoPorCategoria(ingData.categoria || 'general');
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
    $id('detalleIngredientes').innerHTML = htmlIng;

    // Instrucciones
    const instrucciones = receta.instrucciones || 'Sin instrucciones de preparación.';
    const pasosHTML = instrucciones
      .split('\n')
      .filter(line => line.trim())
      .map((line, i) => `<div class="paso-item"><span class="paso-num">${i+1}</span><span class="paso-texto">${line}</span></div>`)
      .join('');
    $id('detalleInstrucciones').innerHTML = `
      <h4><i class="fas fa-tasks"></i> Preparación</h4>
      <div class="receta-pasos">${pasosHTML || '<p>Sin instrucciones.</p>'}</div>
    `;

    modal.dataset.productoId = prodId;
    modal.style.display = 'flex';
  }

  function cerrarDetalle() {
    const modal = $id('modalRecetaDetalle');
    if (modal) modal.style.display = 'none';
  }

  function editarRecetaDesdeDetalle(prodId) {
    cerrarDetalle();
    Recetas.mostrarModalReceta(prodId);
  }

  /* ── MODAL DE CREACIÓN/EDICIÓN DE RECETA ──────────────────── */
  function _asegurarModalReceta() {
    if ($id('modalReceta')) return;

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
    // El Store se actualizará automáticamente vía DB.saveRecetas()
    showToast('success', 'Receta actualizada');
  }

  async function _quitarIngrediente(productoId, ingredienteId) {
    const receta = DB.recetas.find(r => r.productoId == productoId);
    if (receta) {
      receta.ingredientes = receta.ingredientes.filter(ing => ing.ingredienteId != ingredienteId);
      DB.saveRecetas();
      _mostrarRecetaActual();
      showToast('warning', 'Ingrediente eliminado localmente');
    }
  }

  /* ── SUSCRIPCIÓN AL STORE ───────────────────────────────── */
  function _initListeners() {
    Store.subscribe((state, action) => {
      // Re-renderizar cuando cambien productos o recetas
      if (action.type.startsWith('PRODUCTO') || action.type.startsWith('RECETA')) {
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
    mostrarDetalle,
    cerrarDetalle,
    editarRecetaDesdeDetalle,
    mostrarModalReceta,
    cerrarModalReceta,
    guardarReceta,
    _mostrarRecetaActual,
    _quitarIngrediente
  };
})();

window.Recetas = Recetas;