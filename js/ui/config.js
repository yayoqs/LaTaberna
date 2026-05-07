/* ================================================================
   PubPOS — MÓDULO: config.js (v3 – reactivo al Store)
   Propósito: Vista de configuración (productos, mozos, zonas).
              Ahora lee del Store y persiste cambios a través de DB,
              que a su vez actualiza el Store automáticamente.
   ================================================================ */
const Config = (() => {
  function _asegurarVista() {
    if ($id('view-config')) return;

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
            <label>Zonas / Espacios</label>
            <div id="zonasContainer" style="display:flex; flex-direction:column; gap:6px;"></div>
            <button class="btn-secondary" onclick="Config.agregarZona()"><i class="fas fa-plus"></i> Añadir Zona</button>
            <button class="btn-primary" onclick="Config.guardar()"><i class="fas fa-save"></i> Guardar</button>
          </div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-user-tie"></i> Mozos</h3>
          <div class="local-config">
            <div id="mozosLista" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto;"></div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <input type="text" id="nuevoMozoNombre" placeholder="Nombre del mozo">
              <button class="btn-secondary" onclick="Config.agregarMozo()"><i class="fas fa-plus"></i> Añadir</button>
            </div>
          </div>
        </section>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function cargar() {
    _asegurarVista();
    const config = Store.getState().config || DB.config || {};
    if (config.cantidadMesas && !config.zonas) {
      config.zonas = [
        { nombre: 'salon',   cantidad: config.cantidadMesas },
        { nombre: 'terraza', cantidad: 0 }
      ];
      delete config.cantidadMesas;
      DB.saveConfig(); // persiste y actualiza Store
    }
    $id('cfgNombreLocal').value = config.nombreLocal || '';
    $id('cfgDireccion').value = config.direccion || '';
    $id('cfgCuit').value = config.cuit || '';
    $id('cfgPie').value = config.pieTicket || '';
    _renderZonas();
    renderMozos();
    renderProductos();
  }

  function _renderZonas() {
    const container = $id('zonasContainer');
    if (!container) return;
    const config = Store.getState().config || {};
    const zonas = config.zonas || [];
    container.innerHTML = zonas.map((z, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="text" value="${z.nombre}" placeholder="Nombre zona" 
               onchange="Config._updateZona(${idx}, 'nombre', this.value)" style="flex:1;">
        <input type="number" value="${z.cantidad}" min="0" step="1" style="width:80px;"
               onchange="Config._updateZona(${idx}, 'cantidad', this.value)">
        <button class="btn-icon-sm del" onclick="Config.eliminarZona(${idx})"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function _updateZona(idx, campo, valor) {
    const config = Store.getState().config || {};
    if (!config.zonas) return;
    if (campo === 'cantidad') config.zonas[idx].cantidad = parseInt(valor) || 0;
    else config.zonas[idx].nombre = valor.trim() || `zona_${idx+1}`;
    // No persistimos aún, solo modificamos en memoria; se guardará al hacer clic en "Guardar"
  }

  function agregarZona() {
    const config = Store.getState().config || {};
    if (!config.zonas) config.zonas = [];
    const nombre = prompt('Nombre de la nueva zona (ej: Terraza, Patio, VIP):');
    if (!nombre) return;
    const cantidad = parseInt(prompt('Cantidad de mesas inicial:') || '0');
    if (isNaN(cantidad)) return;
    config.zonas.push({ nombre: nombre.trim(), cantidad });
    _renderZonas();
  }

  function eliminarZona(idx) {
    const config = Store.getState().config || {};
    if (!config.zonas || config.zonas.length <= 1) { showToast('error', 'Debe existir al menos una zona.'); return; }
    if (!confirm(`¿Eliminar la zona "${config.zonas[idx].nombre}"?`)) return;
    config.zonas.splice(idx, 1);
    _renderZonas();
  }

  function guardar() {
    const zonasContainer = $id('zonasContainer');
    let config = Store.getState().config || {};

    if (zonasContainer) {
      const filas = zonasContainer.querySelectorAll('div');
      config.zonas = Array.from(filas).map(fila => {
        const inputs = fila.querySelectorAll('input');
        return {
          nombre: inputs[0]?.value || 'sin_nombre',
          cantidad: parseInt(inputs[1]?.value) || 0
        };
      });
    }
    config = {
      ...config,
      nombreLocal: $val('cfgNombreLocal'),
      direccion: $val('cfgDireccion'),
      cuit: $val('cfgCuit'),
      pieTicket: $val('cfgPie'),
      zonas: config.zonas || [{ nombre: 'salon', cantidad: 12 }]
    };
    delete config.cantidadMesas;

    // Persistir en DB (esto actualizará el Store automáticamente)
    DB.config = config;
    DB._inicializarMesas();
    DB.saveConfig();
    DB.saveMesas();
    if (window.Mesas) Mesas.render();
    showToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');
  }

  function renderProductos() {
    _asegurarVista();
    const cont = $id('productosLista');
    if (!cont) return;
    const todos = Store.getState().productos || [];
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
        ${p.imagen ? '<span class="prod-config-img"><i class="fas fa-image"></i></span>' : ''}
        <button class="btn-icon-sm edit" onclick="Config._editarProducto('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon-sm del" onclick="Config._eliminarProducto('${p.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
  }

  function abrirModalProducto(prod = null) {
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
            <label for="prodImagen">Imagen (URL)</label><input type="text" id="prodImagen" placeholder="https://... (opcional)">
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
    $id('prodImagen').value = prod?.imagen || '';
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
      id, nombre, precio,
      categoria: $id('prodCategoria')?.value || 'General',
      destino: $id('prodDestino')?.value || 'cocina',
      descripcion: $val('prodDescripcion'),
      imagen: $val('prodImagen'),
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
    // El Store se actualizará automáticamente vía DB.syncGuardarProducto -> DB.save
    renderProductos();
    if (typeof Pedido !== 'undefined' && Pedido._setCat) Pedido._setCat('Todos');
  }

  async function _editarProducto(id) {
    const prod = (Store.getState().productos || []).find(p => p.id === id);
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

  function renderMozos() {
    const container = $id('mozosLista');
    if (!container) return;
    const mozos = Store.getState().mozos || [];
    container.innerHTML = mozos.map((m, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">${m.nombre}</span>
        <span style="font-size:10px; color:${m.activo !== false ? 'var(--color-success)' : 'var(--color-text-muted)'};">
          ${m.activo !== false ? 'Activo' : 'Inactivo'}
        </span>
        <button class="btn-icon-sm del" onclick="Config.eliminarMozo(${idx})"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function agregarMozo() {
    const nombre = $val('nuevoMozoNombre');
    if (!nombre) return;
    DB.mozos.push({ id: 'mozo_' + Date.now(), nombre, activo: true });
    DB.saveMozos();
    $id('nuevoMozoNombre').value = '';
    // El Store se actualizará automáticamente
    showToast('success', 'Mozo añadido');
  }

  function eliminarMozo(idx) {
    if (!confirm('¿Eliminar mozo?')) return;
    DB.mozos.splice(idx, 1);
    DB.saveMozos();
    // El Store se actualizará automáticamente
    showToast('warning', 'Mozo eliminado');
  }

  /* ── SUSCRIPCIÓN AL STORE ──────────────────────────────── */
  function _initListeners() {
    Store.subscribe((state, action) => {
      // Re-renderizar productos si cambian
      if (action.type.startsWith('PRODUCTO')) {
        renderProductos();
      }
      // Re-renderizar mozos si cambian
      if (action.type.startsWith('MOZO')) {
        renderMozos();
      }
      // Re-renderizar zonas si cambia la configuración
      if (action.type === 'CONFIG_INICIALIZAR') {
        _renderZonas();
      }
    });

    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'config') cargar();
    });
  }

  _initListeners();

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
    eliminarMozo,
    agregarZona,
    eliminarZona,
    _updateZona
  };
})();

window.Config = Config;