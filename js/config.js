/* ================================================================
   PubPOS — MÓDULO: config.js (v2.2 – logs para depurar ID en edición)
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
    // Asegurarse de que el ID se pasa correctamente (entre comillas)
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
    $id('prodId').value = prod?.id || '';  // Cargar ID correctamente
    $id('prodNombre').value = prod?.nombre || '';
    $id('prodPrecio').value = prod?.precio || '';
    $id('prodCategoria').value = prod?.categoria || 'Comidas';
    $id('prodDestino').value = prod?.destino || 'cocina';
    $id('prodDescripcion').value = prod?.descripcion || '';
    $id('prodActivo').checked = prod ? (prod.activo !== false) : true;
    $id('modalProducto').style.display = 'flex';
    console.log('📋 Editando producto con ID:', prod?.id, '| Producto completo:', prod);
  }

  function cerrarModalProducto() { $id('modalProducto').style.display = 'none'; }

  async function guardarProducto() {
    const nombre = $val('prodNombre');
    const precio = parseFloat($id('prodPrecio')?.value);
    if (!nombre) { showToast('error', 'Nombre obligatorio'); return; }
    if (!precio || precio <= 0) { showToast('error', 'Precio mayor a 0'); return; }

    // Tomar el ID del input; si está vacío, se genera uno nuevo
    const idInput = $id('prodId');
    const id = idInput && idInput.value.trim() ? idInput.value.trim() : `prod_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    console.log('💾 Guardando producto con ID:', id);

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
    console.log('🔍 Buscando producto con ID:', id, 'Tipo:', typeof id);
    // Usar comparación flexible (==) porque el ID puede venir como string
    const prod = DB.productos.find(p => p.id == id);
    if (prod) {
      console.log('✅ Producto encontrado:', prod);
      abrirModalProducto(prod);
    } else {
      showToast('error', 'Producto no encontrado');
      console.warn('❌ Producto no encontrado en DB.productos. IDs disponibles:', DB.productos.map(p => p.id));
    }
  }

  async function _eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    console.log('🗑️ Eliminando producto con ID:', id);
    try {
      await DB.syncEliminarProducto(id);
      renderProductos();
    } catch (e) {
      showToast('error', 'Error al eliminar');
    }
  }

  function renderMozos() { /* ... */ }
  function agregarMozo() { /* ... */ }
  function eliminarMozo(nombre) { /* ... */ }

  return {
    cargar, guardar,
    renderProductos,
    abrirModalProducto, cerrarModalProducto, guardarProducto,
    _editarProducto, _eliminarProducto,
    renderMozos, agregarMozo, eliminarMozo
  };
})();
window.Config = Config;