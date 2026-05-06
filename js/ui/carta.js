/* ================================================================
   PubPOS — MÓDULO: carta.js
   Propósito: Gestión de la interfaz de carta de productos (búsqueda,
              filtros por categoría y renderizado de tarjetas).
   Dependencias: DB, EventBus, utils.js
   ================================================================ */

const Carta = (() => {
  let _categoriaActiva = 'Todos';
  let _terminoBusqueda = '';

  function render() {
    _renderCategorias();
    _renderProductos();
  }

  function _renderCategorias() {
    const container = $id('categoriasTabs');
    if (!container) return;

    const categorias = ['Todos', ...new Set(
      DB.productos.filter(p => p.activo !== false).map(p => p.categoria)
    )].filter(Boolean);

    container.innerHTML = categorias
      .map(cat => `
        <button class="cat-tab${cat === _categoriaActiva ? ' active' : ''}"
                onclick="Carta.setCategoria('${cat}')">${cat}</button>
      `).join('');
  }

  function setCategoria(cat) {
    _categoriaActiva = cat;
    render();
  }

  function filtrar() {
    _terminoBusqueda = ($id('searchProducto')?.value || '').toLowerCase();
    _renderProductos();
  }

  function _renderProductos() {
    const cont = $id('cartaProductos');
    if (!cont) return;

    let productosFiltrados = DB.productos.filter(p => p.activo !== false);

    if (_categoriaActiva !== 'Todos') {
      productosFiltrados = productosFiltrados.filter(p => p.categoria === _categoriaActiva);
    }
    if (_terminoBusqueda) {
      productosFiltrados = productosFiltrados.filter(p =>
        p.nombre.toLowerCase().includes(_terminoBusqueda) ||
        (p.descripcion || '').toLowerCase().includes(_terminoBusqueda)
      );
    }

    if (!productosFiltrados.length) {
      cont.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--color-text-muted)">
          <i class="fas fa-search" style="font-size:32px;opacity:.25;display:block;margin-bottom:12px"></i>
          Sin resultados
        </div>`;
      return;
    }

    cont.innerHTML = productosFiltrados.map(_htmlProducto).join('');
  }

  function _htmlProducto(p) {
    const destinoIcon = { barra: 'fa-wine-glass', cocina: 'fa-fire-burner', ambos: 'fa-arrows-split-up-and-left' }[p.destino] || 'fa-fire-burner';
    return `
      <article class="prod-card" onclick="Carta.seleccionarProducto('${p.id}')" role="button" tabindex="0">
        <div class="prod-nombre">${p.nombre}</div>
        ${p.descripcion ? `<div class="prod-desc">${p.descripcion}</div>` : ''}
        <div class="prod-footer">
          <span class="prod-precio">${fmtMoney(p.precio)}</span>
          <span class="prod-destino-tag ${p.destino}">
            <i class="fas ${destinoIcon}"></i> ${p.destino}
          </span>
        </div>
      </article>`;
  }

  function seleccionarProducto(prodId) {
    const producto = DB.productos.find(p => p.id === prodId);
    if (producto) {
      EventBus.emit('producto:seleccionado', producto);
    }
  }

  EventBus.on('productos:cargados', render);

  return {
    render,
    setCategoria,
    filtrar,
    seleccionarProducto
  };
})();

window.Carta = Carta;