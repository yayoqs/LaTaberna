/* ================================================================
   PubPOS — MÓDULO: menu.js (v1.1 – imágenes placeholder, eslogan)
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

    const categorias = ['Todas', ...new Set(
      DB.productos.filter(p => p.activo !== false).map(p => p.categoria)
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

  function _generarImagenURL(nombre) {
    // Usamos un placeholder de Unsplash con palabras clave de comida/bebida
    // Más un seed único basado en el nombre del producto para consistencia
    const seed = encodeURIComponent(nombre + '-food');
    return `https://source.unsplash.com/featured/400x300/?food,drink&sig=${nombre.length}`;
    // Alternativa con picsum (comentada):
    // const idx = Math.abs(nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 1000;
    // return `https://picsum.photos/seed/${seed}/400/300`;
  }

  function _renderProductos() {
    const grid = $id('menuGrid');
    if (!grid) return;

    let productos = DB.productos.filter(p => p.activo !== false);
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
      const imgUrl = _generarImagenURL(prod.nombre);
      const desc = prod.descripcion || 'Consulta a nuestro personal para más detalles.';
      return `
        <div class="menu-card" onclick="Menu.mostrarDetalle('${prod.id}')">
          <div class="menu-card-img" style="background-image: url('${imgUrl}');">
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

  function mostrarDetalle(prodId) {
    const producto = DB.productos.find(p => p.id == prodId);
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

    const imgUrl = _generarImagenURL(producto.nombre);
    $id('menuDetalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${producto.nombre}`;
    $id('menuDetalleImg').style.backgroundImage = `url('${imgUrl}')`;
    $id('menuDetalleDesc').textContent = producto.descripcion || 'Sin descripción disponible.';
    $id('menuDetallePrecio').innerHTML = `<span class="precio-etiqueta">${fmtMoney(producto.precio)}</span>`;

    // Mostrar ingredientes principales si hay receta
    const receta = DB.recetas.find(r => r.productoId == prodId);
    if (receta && receta.ingredientes.length) {
      const nombres = receta.ingredientes.map(ing => {
        const ingData = DB.ingredientes.find(i => i.id == ing.ingredienteId);
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

  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('productos:cargados', render);
  }
  _initEventListeners();

  return {
    render,
    filtrar,
    setCategoria,
    mostrarDetalle,
    cerrarDetalle
  };
})();

window.Menu = Menu;