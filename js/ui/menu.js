/* ================================================================
   PubPOS — MÓDULO: menu.js (v2.0 – reactivo al Store)
   Propósito: Vista de menú digital. Ahora obtiene los productos del
              Store y se re-renderiza automáticamente cuando cambian.
   ================================================================ */
const Menu = (() => {

  let _categoriaActiva = 'Todas';
  let _terminoBusqueda = '';

  function _asegurarVista() {
    if ($id('view-menu')) return;

    const main = document.createElement('main');
    main.id = 'view-menu';
    main.className = 'view';
    main.innerHTML = `
      <div class="menu-banner">
        <div class="menu-banner-content">
          <p>🗺️ “Donde cada trago es una aventura”</p>
          <div class="menu-banner-search">
            <i class="fas fa-search"></i>
            <input type="text" id="menuSearch" placeholder="Buscar en el menú..." oninput="Menu.filtrar()">
          </div>
        </div>
      </div>
      <div class="menu-categorias" id="menuCategorias"></div>
      <div class="menu-grid" id="menuGrid"></div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    _renderCategorias();
    _renderProductos();
  }

  function _renderCategorias() {
    const container = $id('menuCategorias');
    if (!container) return;

    const productos = Store.getState().productos || [];
    const categorias = ['Todas', ...new Set(
      productos.filter(p => p.activo !== false).map(p => p.categoria)
    )].filter(Boolean);

    container.innerHTML = categorias.map(cat => `
      <button class="menu-cat-btn ${cat === _categoriaActiva ? 'active' : ''}"
              onclick="Menu.setCategoria('${cat}')">${cat}</button>
    `).join('');
  }

  function setCategoria(cat) {
    _categoriaActiva = cat;
    _terminoBusqueda = $id('menuSearch')?.value?.trim() || '';
    _renderProductos();
    _renderCategorias();
  }

  function filtrar() {
    _terminoBusqueda = $id('menuSearch')?.value?.trim() || '';
    _renderProductos();
  }

  function _renderProductos() {
    const grid = $id('menuGrid');
    if (!grid) return;

    let productos = (Store.getState().productos || []).filter(p => p.activo !== false);

    if (_categoriaActiva !== 'Todas') {
      productos = productos.filter(p => p.categoria === _categoriaActiva);
    }
    if (_terminoBusqueda) {
      const term = _terminoBusqueda.toLowerCase();
      productos = productos.filter(p =>
        p.nombre.toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term)
      );
    }

    if (!productos.length) {
      grid.innerHTML = `<div class="menu-empty"><i class="fas fa-search"></i><p>No se encontraron productos</p></div>`;
      return;
    }

    productos.sort((a,b) => a.nombre.localeCompare(b.nombre));

    grid.innerHTML = productos.map(prod => {
      const desc = prod.descripcion || 'Consulta a nuestro personal para más detalles.';
      const tieneImagen = prod.imagen && prod.imagen.trim() !== '';
      const estiloImagen = tieneImagen
        ? `background-image: url('${prod.imagen}');`
        : `background-color: ${_getColorFromName(prod.nombre)};`;
      const contenidoImagen = tieneImagen
        ? ''
        : `<span class="menu-card-inicial" style="display:block;font-size:52px;font-weight:800;color:rgba(255,255,255,.85);text-shadow:0 4px 12px rgba(0,0,0,.35);">${prod.nombre.charAt(0).toUpperCase()}</span>`;

      return `
        <div class="menu-card" onclick="Menu.mostrarDetalle('${prod.id}')">
          <div class="menu-card-img" style="${estiloImagen}">
            ${contenidoImagen}
            <span class="menu-card-precio">${fmtMoney(prod.precio)}</span>
          </div>
          <div class="menu-card-body">
            <h3>${prod.nombre}</h3>
            <p>${desc.length > 60 ? desc.substring(0,60)+'...' : desc}</p>
          </div>
        </div>
      `;
    }).join('');
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

  function mostrarDetalle(prodId) {
    const state = Store.getState();
    const producto = (state.productos || []).find(p => p.id == prodId);
    if (!producto) return;

    let modal = $id('modalMenuDetalle');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalMenuDetalle';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-menu-detalle">
          <div class="modal-header">
            <h3 id="menuDetalleTitulo"></h3>
            <button class="modal-close" onclick="Menu.cerrarDetalle()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body menu-detalle-body">
            <div id="menuDetalleImg" class="menu-detalle-img"></div>
            <p id="menuDetalleDesc" class="menu-detalle-desc"></p>
            <div id="menuDetallePrecio" class="menu-detalle-precio"></div>
            <div id="menuDetalleExtra" class="menu-detalle-extra"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="Menu.cerrarDetalle()">Cerrar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const tieneImagen = producto.imagen && producto.imagen.trim() !== '';
    $id('menuDetalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${producto.nombre}`;
    const imgEl = $id('menuDetalleImg');
    if (tieneImagen) {
      imgEl.style.backgroundImage = `url('${producto.imagen}')`;
      imgEl.style.backgroundColor = '';
      imgEl.innerHTML = '';
    } else {
      imgEl.style.backgroundImage = '';
      imgEl.style.backgroundColor = _getColorFromName(producto.nombre);
      imgEl.innerHTML = `<span style="font-size:64px;font-weight:800;color:rgba(255,255,255,.9);text-shadow:0 4px 12px rgba(0,0,0,.4);">${producto.nombre.charAt(0)}</span>`;
    }
    $id('menuDetalleDesc').textContent = producto.descripcion || 'Sin descripción disponible.';
    $id('menuDetallePrecio').innerHTML = `<span class="precio-etiqueta">${fmtMoney(producto.precio)}</span>`;

    const receta = (state.recetas || []).find(r => r.productoId == prodId);
    if (receta && receta.ingredientes.length) {
      const nombres = receta.ingredientes.map(ing => {
        const ingData = (state.ingredientes || []).find(i => i.id == ing.ingredienteId);
        return ingData ? ingData.nombre : ing.ingredienteId;
      }).join(', ');
      $id('menuDetalleExtra').innerHTML = `<p style="font-size:12px;color:var(--color-text-muted);margin-top:12px;"><strong>Ingredientes principales:</strong> ${nombres}</p>`;
    } else {
      $id('menuDetalleExtra').innerHTML = '';
    }

    modal.style.display = 'flex';
  }

  function cerrarDetalle() {
    const modal = $id('modalMenuDetalle');
    if (modal) modal.style.display = 'none';
  }

  /* ── SUSCRIPCIÓN AL STORE ──────────────────────────────── */
  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('PRODUCTO')) {
        render();
      }
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'menu') render();
    });
  }

  _initListeners();

  return {
    render,
    filtrar,
    setCategoria,
    mostrarDetalle,
    cerrarDetalle
  };
})();

window.Menu = Menu;