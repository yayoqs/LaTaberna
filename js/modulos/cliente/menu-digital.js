/* ================================================================
   LaTaberna - PubPOS — Módulo
   Archivo: js/modulos/cliente/menu-digital.js
   Versión: 1.1.1
   Propósito: Menú digital interactivo con botón de retorno a la bienvenida.
   Dependencias: Store, EventBus, App, ClienteModulo (Orden, PantallaBienvenida)
   ================================================================ */

const MenuDigital = (() => {
  let _vista = null;
  let _panelOrden = null;
  let _categoriaActiva = 'Todas';
  let _terminoBusqueda = '';

  function render() {
    if (_vista) return _vista;

    _vista = document.createElement('main');
    _vista.id = 'view-menu-digital';
    _vista.className = 'view';
    _vista.innerHTML = `
      <button class="btn-volver" id="btnVolverMenu" style="position:absolute; top:10px; left:10px; z-index:10; background:transparent; border:none; color:var(--color-text-sec); font-size:1.3rem; cursor:pointer; transition: color 0.2s;" title="Volver a la bienvenida">
        <i class="fas fa-arrow-left"></i>
      </button>

      <div class="menu-estado" id="menuEstado">
        <span id="menuEstadoCliente"></span>
        <span id="menuEstadoMesa"></span>
      </div>

      <div class="menu-banner-espera" id="menuBannerEspera">
        <i class="fas fa-clock"></i>
        <p>Ponte cómodo. El garzón activará tu pantalla en unos instantes.</p>
      </div>

      <div class="menu-banner">
        <div class="menu-banner-content">
          <p>🗺️ "Donde cada trago es una aventura"</p>
          <div class="menu-banner-search">
            <i class="fas fa-search"></i>
            <input type="text" id="menuDigitalSearch" placeholder="Buscar en el menú..." />
          </div>
        </div>
      </div>

      <div class="menu-categorias" id="menuDigitalCategorias"></div>
      <div class="menu-grid" id="menuDigitalGrid"></div>

      <button class="btn-toggle-orden" id="btnToggleOrden" title="Ver mi orden">
        🛒 <span id="contadorOrden">0</span>
      </button>
    `;

    document.body.appendChild(_vista);

    _crearPanelOrden();

    document.getElementById('menuDigitalSearch').addEventListener('input', () => {
      _terminoBusqueda = document.getElementById('menuDigitalSearch')?.value?.trim() || '';
      _renderProductos();
    });

    document.getElementById('btnToggleOrden').addEventListener('click', _togglePanelOrden);
    document.getElementById('btnVolverMenu').addEventListener('click', () => {
      if (typeof window.App !== 'undefined' && typeof window.App.showView === 'function') {
        window.App.showView('bienvenida');
      }
    });

    _initRealtime();
    return _vista;
  }

  /* ── Panel de la orden ────────────────────────────────── */
  function _crearPanelOrden() {
    _panelOrden = document.createElement('aside');
    _panelOrden.id = 'panelOrden';
    _panelOrden.className = 'orden-panel oculto';
    _panelOrden.innerHTML = `
      <div class="orden-cabecera">
        <h3><i class="fas fa-clipboard-list"></i> Mi Orden</h3>
        <button class="btn-cerrar-orden" id="btnCerrarOrden"><i class="fas fa-times"></i></button>
      </div>
      <div class="orden-items" id="ordenItems"></div>
      <div class="orden-pie">
        <div class="orden-total">
          <span>Total</span>
          <span id="ordenTotal">$0</span>
        </div>
        <button class="btn-primary" id="btnConfirmarOrden">Confirmar Orden</button>
      </div>
    `;
    document.body.appendChild(_panelOrden);

    document.getElementById('btnCerrarOrden').addEventListener('click', () => _panelOrden.classList.add('oculto'));
    document.getElementById('btnConfirmarOrden').addEventListener('click', _confirmarOrden);
  }

  function _togglePanelOrden() {
    _panelOrden.classList.toggle('oculto');
    _renderizarItemsOrden();
  }

  function _renderizarItemsOrden() {
    const container = document.getElementById('ordenItems');
    const totalEl = document.getElementById('ordenTotal');
    const items = window.ClienteModulo?.Orden?.obtenerItems() || [];
    const total = window.ClienteModulo?.Orden?.obtenerTotal() || 0;

    if (totalEl) totalEl.textContent = window.fmtMoney?.(total) || '$' + total;

    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="orden-vacia">
          <i class="fas fa-inbox"></i>
          <p>Tu orden está vacía</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="orden-item">
        <div class="orden-item-info">
          <div class="orden-item-nombre">${item.nombre}</div>
          <div class="orden-item-precio">${window.fmtMoney?.(item.precio) || '$' + item.precio} c/u</div>
          <div class="orden-item-cantidad">
            <button data-id="${item.prodId}" data-accion="restar">−</button>
            <span>${item.qty}</span>
            <button data-id="${item.prodId}" data-accion="sumar">+</button>
          </div>
          <div class="orden-item-obs">
            <input type="text" placeholder="Observación (ej: sin cebolla)" value="${item.obs || ''}" data-id="${item.prodId}" />
          </div>
        </div>
        <button class="btn-quitar-item" data-id="${item.prodId}" title="Quitar">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = items.find(i => i.prodId === id);
        if (!item) return;
        const nuevaCantidad = btn.dataset.accion === 'sumar' ? item.qty + 1 : item.qty - 1;
        window.ClienteModulo?.Orden?.modificarCantidad(id, nuevaCantidad);
        _renderizarItemsOrden();
        _actualizarContador();
      });
    });

    container.querySelectorAll('.orden-item-obs input').forEach(input => {
      input.addEventListener('input', () => {
        window.ClienteModulo?.Orden?.modificarObservacion(input.dataset.id, input.value);
      });
    });

    container.querySelectorAll('.btn-quitar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        window.ClienteModulo?.Orden?.quitarItem(btn.dataset.id);
        _renderizarItemsOrden();
        _actualizarContador();
      });
    });
  }

  function _actualizarContador() {
    const items = window.ClienteModulo?.Orden?.obtenerItems() || [];
    const totalCantidad = items.reduce((sum, i) => sum + i.qty, 0);
    const contador = document.getElementById('contadorOrden');
    if (contador) contador.textContent = totalCantidad;
  }

  /* ── Confirmación de la orden ─────────────────────────── */
  async function _confirmarOrden() {
    const permite = window.ClienteModulo?.PantallaBienvenida?.permitePrepedidos?.() || false;
    if (!permite) {
      _mostrarToast('error', 'Tu mesa ya no admite pedidos. Contactá al garzón.');
      return;
    }

    const items = window.ClienteModulo?.Orden?.obtenerItems() || [];
    if (!items.length) {
      _mostrarToast('error', 'Agregá productos a tu orden antes de confirmar.');
      return;
    }

    let idUsuario;
    try {
      idUsuario = await window.Auth?.getAppwriteUserId?.();
    } catch (e) {
      idUsuario = null;
    }
    if (!idUsuario) {
      _mostrarToast('error', 'No se pudo obtener tu sesión. Intentá de nuevo.');
      return;
    }

    const mesa = window.ClienteModulo?.PantallaBienvenida?.obtenerMesa?.() || 0;
    if (!mesa) {
      _mostrarToast('error', 'No se pudo obtener el número de mesa.');
      return;
    }

    const nombreComensal = window.Auth?.getNombre?.() || 'comensal';

    const payload = {
      mesa: mesa,
      items: items,
      clienteId: nombreComensal,
      id_usuario: idUsuario,
      nombre_comensal: nombreComensal,
      observaciones: '',
      timestamp: Date.now()
    };

    try {
      const resultado = await window.DBAppwrite?.crear?.('precargas_cliente', 'unique()', {
        id_mesa: mesa,
        id_usuario: idUsuario,
        nombre_comensal: nombreComensal,
        productos: JSON.stringify(items),
        estado: 'por_confirmar',
        timestamp: payload.timestamp
      });

      if (!resultado) {
        _mostrarToast('error', 'Error al enviar tu orden. Intentá de nuevo.');
        return;
      }

      payload.id = resultado.id || 'pre_' + Date.now();

      if (typeof window.EventBus !== 'undefined') {
        window.EventBus.emit('cliente:precarga_enviada', payload);
      }

      window.ClienteModulo?.Orden?.vaciar();
      _actualizarContador();
      _panelOrden.classList.add('oculto');
      _mostrarToast('success', '✅ ¡Orden enviada! El garzón la revisará pronto.');
    } catch (e) {
      console.error('[MenuDigital] Error al confirmar orden:', e);
      _mostrarToast('error', 'Error de conexión. Revisá tu internet.');
    }
  }

  function _mostrarToast(tipo, mensaje) {
    const contenedor = document.getElementById('toastContainer');
    if (!contenedor) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<i class="fas fa-${tipo === 'success' ? 'check-circle' : 'info-circle'}"></i> ${mensaje}`;
    contenedor.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  function mostrar() {
    const viewMenu = document.getElementById('view-menu');
    if (viewMenu) viewMenu.classList.remove('active');

    if (_vista) {
      _vista.classList.add('active');
      _actualizarEstado();
      _verificarPermiso();
      _renderCategorias();
      _renderProductos();
      _actualizarContador();
    }
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    if (_panelOrden) _panelOrden.classList.add('oculto');
  }

  function _actualizarEstado() {
    const nombre = window.Auth?.getNombre?.() || 'comensal';
    const mesa = window.ClienteModulo?.PantallaBienvenida?.obtenerMesa?.() || '?';
    document.getElementById('menuEstadoCliente').textContent = `👤 ${nombre}`;
    document.getElementById('menuEstadoMesa').textContent = `🪑 Mesa ${mesa}`;
  }

  function _verificarPermiso() {
    const permite = window.ClienteModulo?.PantallaBienvenida?.permitePrepedidos?.() || false;
    const banner = document.getElementById('menuBannerEspera');
    if (banner) {
      banner.style.display = permite ? 'none' : 'flex';
    }
    _renderProductos();
  }

  function _renderCategorias() {
    const container = document.getElementById('menuDigitalCategorias');
    if (!container) return;

    const productos = window.Store?.getState?.().productos || [];
    const categorias = ['Todas', ...new Set(
      productos.filter(p => p.activo !== false).map(p => p.categoria)
    )].filter(Boolean);

    container.innerHTML = categorias.map(cat => `
      <button class="menu-cat-btn ${cat === _categoriaActiva ? 'active' : ''}" data-categoria="${cat}">${cat}</button>
    `).join('');

    container.querySelectorAll('.menu-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _categoriaActiva = btn.dataset.categoria;
        _renderCategorias();
        _renderProductos();
      });
    });
  }

  function _renderProductos() {
    const grid = document.getElementById('menuDigitalGrid');
    if (!grid) return;

    const permite = window.ClienteModulo?.PantallaBienvenida?.permitePrepedidos?.() || false;
    let productos = (window.Store?.getState?.().productos || []).filter(p => p.activo !== false);

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
      grid.innerHTML = '<div class="menu-empty"><i class="fas fa-search"></i><p>No se encontraron productos</p></div>';
      return;
    }

    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    grid.innerHTML = productos.map(prod => {
      const disponible = prod.disponible !== false;
      const puedeAgregar = permite && disponible;
      const desc = prod.descripcion || 'Consulta a nuestro personal.';
      const tieneImagen = prod.imagen && prod.imagen.trim() !== '';
      const estiloImagen = tieneImagen
        ? `background-image: url('${prod.imagen}');`
        : `background-color: ${_getColorFromName(prod.nombre)};`;
      const contenidoImagen = tieneImagen
        ? ''
        : `<span class="menu-card-inicial">${prod.nombre.charAt(0).toUpperCase()}</span>`;

      return `
        <div class="menu-card ${!disponible ? 'menu-card-atenuado' : ''}">
          <div class="menu-card-img" style="${estiloImagen}">
            ${contenidoImagen}
            <span class="menu-card-precio">${window.fmtMoney?.(prod.precio) || '$' + prod.precio}</span>
          </div>
          <div class="menu-card-body">
            <h3>${prod.nombre}</h3>
            <p>${desc.length > 60 ? desc.substring(0, 60) + '...' : desc}</p>
            <button class="btn-agregar-orden ${!puedeAgregar ? 'btn-deshabilitado' : ''}"
                    ${!puedeAgregar ? 'disabled' : ''}
                    data-id="${prod.id}"
                    data-nombre="${prod.nombre}"
                    data-precio="${prod.precio}"
                    data-categoria="${prod.categoria}"
                    data-destino="${prod.destino || prod.categoria || 'general'}">
              🛒 Agregar a mi orden
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-agregar-orden:not(.btn-deshabilitado)').forEach(btn => {
      btn.addEventListener('click', () => {
        const producto = {
          id: btn.dataset.id,
          nombre: btn.dataset.nombre,
          precio: parseInt(btn.dataset.precio, 10),
          categoria: btn.dataset.categoria,
          destino: btn.dataset.destino
        };
        window.ClienteModulo?.Orden?.agregarItem(producto);
        _mostrarToast('success', `${producto.nombre} agregado a tu orden`);
        _actualizarContador();
        _renderizarItemsOrden();
      });
    });
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

  function _initRealtime() {
    if (typeof window.EventBus !== 'undefined') {
      window.EventBus.on('productos:actualizada', () => {
        if (_vista?.classList.contains('active')) {
          _renderCategorias();
          _renderProductos();
        }
      });
      window.EventBus.on('mesas:actualizada', () => {
        if (_vista?.classList.contains('active')) {
          _verificarPermiso();
        }
      });
    }
  }

  return { render, mostrar, ocultar };
})();

export { MenuDigital };