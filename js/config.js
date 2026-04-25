/* ================================================================
   PubPOS — MÓDULO: config.js
   Propósito: Gestión de configuración del local y ABM de productos.
   ================================================================ */

const Config = (() => {
  const CATEGORIAS = ['Bebidas','Cervezas','Cocteles','Vinos','Entradas','Comidas','Postres'];

  function cargar() {
    const cfg = DB.config;
    $id('cfgNombreLocal').value = cfg.nombreLocal || '';
    $id('cfgDireccion').value = cfg.direccion || '';
    $id('cfgCuit').value = cfg.cuit || '';
    $id('cfgPie').value = cfg.pieTicket || '';
    $id('cfgMesas').value = cfg.cantidadMesas || 12;
    renderMozos();
  }

  function guardar() {
    const nuevaCant = parseInt($id('cfgMesas')?.value) || 12;
    DB.config = {
      ...DB.config,
      nombreLocal: $val('cfgNombreLocal'),
      direccion: $val('cfgDireccion'),
      cuit: $val('cfgCuit'),
      pieTicket: $val('cfgPie'),
      cantidadMesas: nuevaCant
    };
    if (nuevaCant > DB.mesas.length) {
      for (let i = DB.mesas.length + 1; i <= nuevaCant; i++) DB.mesas.push(mesaVacia(i));
    } else if (nuevaCant < DB.mesas.length) {
      DB.mesas = DB.mesas.slice(0, nuevaCant);
    }
    DB.saveConfig();
    DB.saveMesas();
    Mesas.render();
    showToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');
  }

  function renderProductos() {
    const cont = $id('productosLista');
    if (!cont) return;
    const todos = DB.productos;
    if (!todos.length) {
      cont.innerHTML = `<p style="text-align:center;padding:20px;">No hay productos</p>`;
      return;
    }
    const grupos = {};
    todos.forEach(p => { const cat = p.categoria || 'Sin categoría'; if (!grupos[cat]) grupos[cat] = []; grupos[cat].push(p); });
    cont.innerHTML = Object.entries(grupos).map(([cat, prods]) => `
      <div><p class="prod-config-group-title">${cat}</p>${prods.map(_htmlProdConfigItem).join('')}</div>
    `).join('');
  }

  function _htmlProdConfigItem(p) {
    return `
      <div class="prod-config-item${p.activo === false ? ' inactivo' : ''}">
        <span class="prod-config-nombre">${p.nombre}</span>
        <span class="prod-config-cat">${p.destino}</span>
        <span class="prod-config-precio">${fmtMoney(p.precio)}</span>
        <button class="btn-icon-sm edit" onclick="Config._editarProducto('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon-sm del" onclick="Config._eliminarProducto('${p.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
  }

  function abrirModalProducto(prod = null) {
    $id('productoModalTitulo').textContent = prod ? 'Editar Producto' : 'Nuevo Producto';
    $id('prodId').value = prod?.id || '';
    $id('prodNombre').value = prod?.nombre || '';
    $id('prodPrecio').value = prod?.precio || '';
    $id('prodCategoria').value = prod?.categoria || 'Comidas';
    $id('prodDestino').value = prod?.destino || 'cocina';
    $id('prodDescripcion').value = prod?.descripcion || '';
    $id('prodActivo').checked = prod ? (prod.activo !== false) : true;
    $id('modalProducto').style.display = 'flex';
  }

  function cerrarModalProducto() { $id('modalProducto').style.display = 'none'; }

  async function guardarProducto() {
    const nombre = $val('prodNombre');
    const precio = parseFloat($id('prodPrecio')?.value);
    if (!nombre) { showToast('error', 'Nombre obligatorio'); return; }
    if (!precio || precio <= 0) { showToast('error', 'Precio mayor a 0'); return; }

    const id = $val('prodId') || `prod_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    
    const producto = {
      id,
      nombre,
      precio,
      categoria: $id('prodCategoria')?.value || 'General',
      destino: $id('prodDestino')?.value || 'cocina',
      descripcion: $val('prodDescripcion'),
      activo: $id('prodActivo')?.checked ?? true
    };

    try {
      await DB.syncGuardarProducto(producto);
      showToast('success', 'Producto guardado y sincronizado');
    } catch (e) {
      showToast('error', 'Error guardando producto');
      return;
    }
    
    cerrarModalProducto();
    renderProductos();
    if (typeof Pedido !== 'undefined' && Pedido._setCat) Pedido._setCat('Todos');
  }

  async function _editarProducto(id) {
    const prod = DB.productos.find(p => p.id === id);
    if (prod) abrirModalProducto(prod);
  }

  async function _eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    DB.productos = DB.productos.filter(p => p.id !== id);
    localStorage.setItem('pubpos_cache_prod', JSON.stringify(DB.productos));
    renderProductos();
    showToast('success', 'Producto eliminado');
  }

  // Gestión de Mozos (nuevo)
  function renderMozos() {
    const cont = $id('mozosLista');
    if (!cont) return;
    cont.innerHTML = DB.mozos.map(m => `
      <div class="mozo-item">
        <span>${m}</span>
        <button onclick="Config.eliminarMozo('${m}')"><i class="fas fa-trash"></i></button>
      </div>`).join('');
  }

  function agregarMozo() {
    const nombre = prompt('Nombre del nuevo mozo:');
    if (!nombre) return;
    DB.mozos.push(nombre);
    DB.saveMozos();
    renderMozos();
    const sel = $id('mozoActivo');
    if (sel) sel.innerHTML = DB.mozos.map(m => `<option>${m}</option>`).join('');
  }

  function eliminarMozo(nombre) {
    DB.mozos = DB.mozos.filter(m => m !== nombre);
    DB.saveMozos();
    renderMozos();
  }

  return {
    cargar, guardar,
    renderProductos,
    abrirModalProducto, cerrarModalProducto, guardarProducto,
    _editarProducto, _eliminarProducto,
    renderMozos, agregarMozo, eliminarMozo
  };
})();
window.Config = Config;
