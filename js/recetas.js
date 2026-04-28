/* ================================================================
   PubPOS — MÓDULO: recetas.js (v3.1 – soporte para íconos y badges)
   Propósito: Cuadrícula de recetas con detalle inmersivo.
              Ahora incluye badge con cantidad de ingredientes en
              las tarjetas e íconos de categoría en la lista.
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
          <button class="btn-secondary" onclick="Despensa.mostrarModalReceta()"><i class="fas fa-plus"></i> Nueva Receta</button>
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

    const rol = Auth.getRol();
    let productos = DB.productos.filter(p => p.activo !== false);

    // Filtrar por destino según el rol
    if (rol === 'cocina') {
      productos = productos.filter(p => p.destino === 'cocina' || p.destino === 'ambos');
    } else if (rol === 'barra') {
      productos = productos.filter(p => p.destino === 'barra' || p.destino === 'ambos');
    }

    // Solo productos con receta
    productos = productos.filter(prod => {
      const receta = DB.recetas.find(r => r.productoId == prod.id);
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
    productos.sort((a,b) => a.nombre.localeCompare(b.nombre));

    grid.innerHTML = productos.map(prod => {
      const receta = DB.recetas.find(r => r.productoId == prod.id);
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
    const producto = DB.productos.find(p => p.id == prodId);
    if (!producto) return;

    const receta = DB.recetas.find(r => r.productoId == prodId);
    if (!receta) {
      showToast('error', 'No hay receta asignada a este producto');
      return;
    }

    // Construir modal si no existe
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

    // Título
    $id('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${producto.nombre}`;

    // Ingredientes
    let htmlIng = '<h4><i class="fas fa-list-ul"></i> Ingredientes</h4><ul class="receta-ingredientes-lista">';
    receta.ingredientes.forEach(ing => {
      const ingData = DB.ingredientes.find(i => i.id == ing.ingredienteId);
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

    // Guardar referencia para editar
    modal.dataset.productoId = prodId;

    modal.style.display = 'flex';
  }

  function cerrarDetalle() {
    const modal = $id('modalRecetaDetalle');
    if (modal) modal.style.display = 'none';
  }

  function editarRecetaDesdeDetalle(prodId) {
    cerrarDetalle();
    if (typeof Despensa !== 'undefined' && Despensa.mostrarModalReceta) {
      Despensa.mostrarModalReceta(prodId);
    } else {
      showToast('error', 'Módulo de Despensa no disponible');
    }
  }

  /* ── SUSCRIPCIÓN A EVENTOS ───────────────────────────────── */
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('productos:cargados', render);
    EventBus.on('recetas:actualizadas', render);
  }
  _initEventListeners();

  return {
    render,
    filtrar,
    mostrarDetalle,
    cerrarDetalle,
    editarRecetaDesdeDetalle
  };
})();

window.Recetas = Recetas;