/* ================================================================
   PubPOS — MÓDULO: config.js (v2.4 – vista generada dinámicamente)
   Propósito: Gestión de configuración (productos, impresoras, local).
   Ahora la vista #view-config se crea programáticamente al inicializar
   el módulo, eliminando la dependencia de HTML estático.
   ================================================================ */
const Config = (() => {
  const CATEGORIAS = ['Bebidas','Cervezas','Cocteles','Vinos','Entradas','Comidas','Postres'];

  // ── INICIALIZACIÓN (crea la vista si no existe) ───────────
  function _asegurarVista() {
    if ($id('view-config')) return; // ya existe

    const main = document.createElement('main');
    main.id = 'view-config';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-sliders"></i> Configuración</h2>
      </div>
      <div class="config-grid">
        <section class="config-card">
          <h3><i class="fas fa-utensils"></i> Productos / Carta</h3>
          <div class="config-actions">
            <button class="btn-primary" onclick="Config.abrirModalProducto()" data-rol="admin,master">
              <i class="fas fa-plus"></i> Nuevo Producto
            </button>
          </div>
          <div id="productosLista" class="productos-config-lista"></div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-print"></i> Impresoras</h3>
          <div class="impresoras-config">
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-fire-burner"></i>Cocina</span><input type="text" id="impCocinaIP" placeholder="IP o nombre" value="192.168.1.100"><select id="impCocinaProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" onclick="Tickets.testImpresora('cocina')"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-wine-glass"></i>Barra</span><input type="text" id="impBarraIP" placeholder="IP o nombre" value="192.168.1.101"><select id="impBarraProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" onclick="Tickets.testImpresora('barra')"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-cash-register"></i>Caja</span><input type="text" id="impCajaIP" placeholder="IP o nombre" value="192.168.1.102"><select id="impCajaProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" onclick="Tickets.testImpresora('caja')"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="info-box"><i class="fas fa-info-circle"></i><p>Para impresión directa instalá QZ Tray.</p></div>
          </div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-store"></i> Datos del Local</h3>
          <div class="local-config">
            <label>Nombre del Local</label><input type="text" id="cfgNombreLocal" value="Mi Pub Restaurant">
            <label>Dirección</label><input type="text" id="cfgDireccion" value="Av. Corrientes 1234, CABA">
            <label>CUIT / RUT</label><input type="text" id="cfgCuit" value="30-12345678-9">
            <label>Pie de ticket</label><input type="text" id="cfgPie" value="¡Gracias por visitarnos!">
            <label>Cantidad de Mesas</label><input type="number" id="cfgMesas" value="6" min="1" max="60">
            <button class="btn-primary" onclick="Config.guardar()"><i class="fas fa-save"></i> Guardar</button>
          </div>
        </section>
      </div>
    `;
    // Insertar antes del toastContainer (o al final del body)
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  // ── CARGA DE DATOS (se llama desde app.init) ──────────────
  function cargar() {
    _asegurarVista(); // crea la vista si es necesario
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
    _asegurarVista(); // por si se llama antes de cargar
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

  // ── MODAL PRODUCTO ────────────────────────────────────────
  function abrirModalProducto(prod = null) {
    // Aseguramos que el modal existe (puede crearse dinámicamente si falta)
    let modal = $id('modalProducto');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalProducto';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header"><h3><i class="fas fa-utensils"></i> <span id="productoModalTitulo">Nuevo Producto</span></h3><button class="modal-close" onclick="Config.cerrarModalProducto()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <input type="hidden" id="prodId">
            <label for="prodNombre">Nombre *</label><input type="text" id="prodNombre" placeholder="Nombre del producto" autocomplete="off">
            <label for="prodPrecio">Precio *</label><input type="number" id="prodPrecio" placeholder="0.00" min="0" step="0.01">
            <label for="prodCategoria">Categoría *</label><select id="prodCategoria"><option>Bebidas</option><option>Cervezas</option><option>Cocteles</option><option>Vinos</option><option>Entradas</option><option>Comidas</option><option>Postres</option></select>
            <label for="prodDestino">Destino Comanda *</label><select id="prodDestino"><option value="barra">Barra</option><option value="cocina">Cocina</option><option value="ambos">Ambos</option></select>
            <label for="prodDescripcion">Descripción</label><input type="text" id="prodDescripcion" placeholder="Descripción breve (opcional)">
            <div class="prod-activo-row"><label for="prodActivo">Activo</label><input type="checkbox" id="prodActivo" checked></div>
            <div class="modal-small-footer"><button class="btn-secondary" onclick="Config.cerrarModalProducto()">Cancelar</button><button class="btn-primary" onclick="Config.guardarProducto()"><i class="fas fa-save"></i> Guardar</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    $id('productoModalTitulo').textContent = prod ? 'Editar Producto' : 'Nuevo Producto';
    $id('prodId').value = prod?.id || '';
    $id('prodNombre').value = prod?.nombre || '';
    $id('prodPrecio').value = prod?.precio || '';
    $id('prodCategoria').value = prod?.categoria || 'Comidas';
    $id('prodDestino').value = prod?.destino || 'cocina';
    $id('prodDescripcion').value = prod?.descripcion || '';
    $id('prodActivo').checked = prod ? (prod.activo !== false) : true;
    modal.style.display = 'flex';
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
    try {
      await DB.syncEliminarProducto(id);
      renderProductos();
    } catch (e) {
      showToast('error', 'Error al eliminar producto');
    }
  }

  // Gestión de Mozos (se mantiene igual)
  function renderMozos() { /* ... igual ... */ }
  function agregarMozo() { /* ... */ }
  function eliminarMozo(nombre) { /* ... */ }

  // ── EXPORTACIÓN ───────────────────────────────────────────
  return {
    cargar,
    guardar,
    renderProductos,
    abrirModalProducto,
    cerrarModalProducto,
    guardarProducto,
    _editarProducto,
    _eliminarProducto,
    renderMozos,
    agregarMozo,
    eliminarMozo
  };
})();

window.Config = Config;