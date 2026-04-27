/* ================================================================
   PubPOS — MÓDULO: config.js (v2.5 – gestión de múltiples zonas)
   ================================================================ */
const Config = (() => {
  const CATEGORIAS = ['Bebidas','Cervezas','Cocteles','Vinos','Entradas','Comidas','Postres'];

  // ── INICIALIZACIÓN (crea la vista si no existe) ───────────
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
            <!-- ZONAS (nueva sección) -->
            <label>Zonas / Espacios</label>
            <div id="zonasContainer" style="display:flex; flex-direction:column; gap:6px;"></div>
            <button class="btn-secondary" onclick="Config.agregarZona()"><i class="fas fa-plus"></i> Añadir Zona</button>
            <button class="btn-primary" onclick="Config.guardar()"><i class="fas fa-save"></i> Guardar</button>
          </div>
        </section>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  // ── CARGA DE DATOS (incluye migración de zonas) ──────────
  function cargar() {
    _asegurarVista();
    const cfg = DB.config;

    // Migración única: si existe cantidadMesas pero no zonas
    if (cfg.cantidadMesas && !cfg.zonas) {
      cfg.zonas = [
        { nombre: 'salon',   cantidad: cfg.cantidadMesas },
        { nombre: 'terraza', cantidad: 0 }
      ];
      delete cfg.cantidadMesas;
      DB.saveConfig();
    }

    $id('cfgNombreLocal').value = cfg.nombreLocal || '';
    $id('cfgDireccion').value = cfg.direccion || '';
    $id('cfgCuit').value = cfg.cuit || '';
    $id('cfgPie').value = cfg.pieTicket || '';
    _renderZonas();
    renderMozos();
  }

  // ── RENDERIZAR ZONAS EN EL FORMULARIO ────────────────────
  function _renderZonas() {
    const container = $id('zonasContainer');
    if (!container) return;
    const zonas = DB.config.zonas || [];
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

  // ── ACTUALIZAR VALOR DE UNA ZONA (en memoria) ────────────
  function _updateZona(idx, campo, valor) {
    if (!DB.config.zonas) return;
    if (campo === 'cantidad') {
      DB.config.zonas[idx].cantidad = parseInt(valor) || 0;
    } else {
      DB.config.zonas[idx].nombre = valor.trim() || `zona_${idx+1}`;
    }
  }

  // ── AGREGAR NUEVA ZONA ──────────────────────────────────
  function agregarZona() {
    if (!DB.config.zonas) DB.config.zonas = [];
    const nombre = prompt('Nombre de la nueva zona (ej: Terraza, Patio, VIP):');
    if (!nombre) return;
    const cantidad = parseInt(prompt('Cantidad de mesas inicial:') || '0');
    if (isNaN(cantidad)) return;
    DB.config.zonas.push({ nombre: nombre.trim(), cantidad });
    _renderZonas();
  }

  // ── ELIMINAR ZONA ───────────────────────────────────────
  function eliminarZona(idx) {
    if (!DB.config.zonas || DB.config.zonas.length <= 1) {
      showToast('error', 'Debe existir al menos una zona.');
      return;
    }
    if (!confirm(`¿Eliminar la zona "${DB.config.zonas[idx].nombre}"? Las mesas de esa zona quedarán sin zona asignada.`)) return;
    DB.config.zonas.splice(idx, 1);
    _renderZonas();
  }

  // ── GUARDAR CONFIGURACIÓN (incluye zonas) ────────────────
  function guardar() {
    // Leer valores de los inputs de zona (por si no se disparó onchange)
    const zonasContainer = $id('zonasContainer');
    if (zonasContainer) {
      const filas = zonasContainer.querySelectorAll('div');
      DB.config.zonas = Array.from(filas).map(fila => {
        const inputs = fila.querySelectorAll('input');
        return {
          nombre: inputs[0]?.value || 'sin_nombre',
          cantidad: parseInt(inputs[1]?.value) || 0
        };
      });
    }

    DB.config = {
      ...DB.config,
      nombreLocal: $val('cfgNombreLocal'),
      direccion: $val('cfgDireccion'),
      cuit: $val('cfgCuit'),
      pieTicket: $val('cfgPie'),
      zonas: DB.config.zonas || [{ nombre: 'salon', cantidad: 12 }]
    };

    // Eliminar clave obsoleta si existiera por migración
    delete DB.config.cantidadMesas;

    // Reconstruir mesas según las nuevas zonas
    DB._inicializarMesas();   // ← sincroniza las mesas reales

    DB.saveConfig();
    DB.saveMesas();
    if (window.Mesas) Mesas.render();
    showToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');
  }

  // ── RESTO DE FUNCIONES (sin cambios) ──────────────────────
  function renderProductos() {
    _asegurarVista();
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
      id, nombre, precio,
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

  function renderMozos() { /* ... igual ... */ }
  function agregarMozo() { /* ... */ }
  function eliminarMozo(nombre) { /* ... */ }

  return {
    cargar, guardar, renderProductos,
    abrirModalProducto, cerrarModalProducto, guardarProducto,
    _editarProducto, _eliminarProducto,
    renderMozos, agregarMozo, eliminarMozo,
    agregarZona, eliminarZona, _updateZona
  };
})();

window.Config = Config;