/* ================================================================
   PubPOS — MÓDULO: reparto.js (v3.7.1 – fallback asegurado)
   ================================================================ */
const Reparto = (() => {

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-reparto')) return;

    const main = document.createElement('main');
    main.id = 'view-reparto';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-motorcycle"></i> Reparto — Pedidos de Delivery</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" onclick="Reparto.mostrarModalNuevo()">
            <i class="fas fa-plus"></i> Nuevo Pedido
          </button>
        </div>
      </div>
      <div class="reparto-table-wrap">
        <table class="reparto-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Ítems</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Repartidor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="repartoBody"></tbody>
        </table>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDERIZAR LA TABLA ────────────────────────────────── */
  function render() {
    _asegurarVista();
    const tbody = $id('repartoBody');
    if (!tbody) return;

    const pedidos = DB.pedidosDelivery || [];
    if (!pedidos.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay pedidos de delivery.</td></tr>`;
      return;
    }

    const ordenados = [...pedidos].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    tbody.innerHTML = ordenados.map(p => {
      const items = p.items || [];
      const resumen = items.map(i => `${i.qty}x ${i.nombre}`).join(', ') || '—';
      const badgeClase = {
        pendiente: 'warning',
        en_preparacion: 'info',
        en_camino: 'accent',
        entregado: 'success'
      }[p.estado] || 'default';

      let botonesHTML = '';
      if (p.estado === 'pendiente') {
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.enviarACocina('${p.id}')"><i class="fas fa-fire-burner"></i> Enviar a Cocina</button>`;
      } else if (p.estado === 'en_preparacion') {
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.despachar('${p.id}')"><i class="fas fa-motorcycle"></i> En camino</button>`;
      } else if (p.estado === 'en_camino') {
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.confirmarEntrega('${p.id}')"><i class="fas fa-check"></i> Entregado</button>`;
      }
      botonesHTML += `<button class="btn-ajuste del" onclick="Reparto.eliminarPedido('${p.id}')"><i class="fas fa-trash"></i></button>`;

      return `
        <tr>
          <td><strong>${p.id.replace('deliv_','').slice(-6)}</strong></td>
          <td>${p.direccion}</td>
          <td>${p.telefono || '—'}</td>
          <td style="font-size:12px;">${resumen}</td>
          <td>${fmtMoney(p.total)}</td>
          <td><span class="badge ${badgeClase}">${p.estado.replace('_',' ')}</span></td>
          <td>${p.repartidor || '—'}</td>
          <td>${botonesHTML}</td>
        </tr>`;
    }).join('');
  }

  /* ── MODAL NUEVO PEDIDO (con búsqueda) ──────────────────── */
  let _itemsTemporales = [];
  let _productoSeleccionado = null;

  function mostrarModalNuevo() {
    _itemsTemporales = [];
    _productoSeleccionado = null;

    let modal = $id('modalReparto');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReparto';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width: 520px;">
          <div class="modal-header">
            <h3><i class="fas fa-plus"></i> Nuevo Pedido de Delivery</h3>
            <button class="modal-close" onclick="Reparto.cerrarModalNuevo()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Dirección *</label><input type="text" id="repDireccion" placeholder="Calle, número, depto.">
            <label>Teléfono</label><input type="text" id="repTelefono" placeholder="+56 9 ...">
            <label>Productos</label>
            <div style="position:relative;">
              <input type="text" id="repBusquedaProducto" placeholder="Buscar producto..." autocomplete="off"
                     oninput="Reparto._filtrarProductos()" style="width:100%;">
              <div id="repResultadosBusqueda" style="position:absolute; top:100%; left:0; right:0; background:var(--color-panel); border:1px solid var(--color-border); border-radius:var(--radius-sm); z-index:10; max-height:200px; overflow-y:auto; display:none;">
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
              <input type="number" id="repCantidad" value="1" min="1" style="width:70px;" placeholder="Cant."
                     onkeydown="if(event.key==='Enter'){ event.preventDefault(); Reparto._agregarItemAlPedido(); }">
              <button class="btn-secondary" onclick="Reparto._agregarItemAlPedido()"><i class="fas fa-plus"></i> Agregar</button>
            </div>
            <div id="repItemsLista" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
            </div>
            <label>Total ($)</label>
            <input type="number" id="repTotal" step="0.01" value="0" readonly style="font-weight:700; background:var(--color-panel);">
            <label>Repartidor</label><input type="text" id="repRepartidor" placeholder="Nombre del repartidor">
            <label>Observaciones</label><input type="text" id="repObservaciones" placeholder="Pago con tarjeta, timbre roto...">
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Reparto.cerrarModalNuevo()">Cancelar</button>
              <button class="btn-primary" onclick="Reparto.guardarNuevoPedido()"><i class="fas fa-save"></i> Guardar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    // Limpiar campos
    $id('repDireccion').value = '';
    $id('repTelefono').value = '';
    $id('repTotal').value = '0';
    $id('repRepartidor').value = '';
    $id('repObservaciones').value = '';
    $id('repBusquedaProducto').value = '';
    $id('repCantidad').value = 1;
    $id('repResultadosBusqueda').style.display = 'none';

    _renderItemsTemporales();
    modal.style.display = 'flex';
  }

  function cerrarModalNuevo() {
    const modal = $id('modalReparto');
    if (modal) modal.style.display = 'none';
  }

  /* ── BÚSQUEDA Y SELECCIÓN ───────────────────────────────── */
  function _filtrarProductos() {
    const input = $id('repBusquedaProducto');
    const resultadoDiv = $id('repResultadosBusqueda');
    if (!input || !resultadoDiv) return;

    const termino = input.value.trim().toLowerCase();
    if (!termino) {
      resultadoDiv.style.display = 'none';
      _productoSeleccionado = null;
      return;
    }

    const productosFiltrados = DB.productos.filter(p =>
      p.activo !== false &&
      p.nombre.toLowerCase().includes(termino)
    );

    if (productosFiltrados.length === 0) {
      resultadoDiv.innerHTML = '<div style="padding:8px; color:var(--color-text-muted);">Sin resultados</div>';
      resultadoDiv.style.display = 'block';
      _productoSeleccionado = null;
      return;
    }

    resultadoDiv.innerHTML = productosFiltrados.map(p => `
      <div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}"
           style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--color-border); transition:var(--t);"
           onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''"
           onclick="Reparto._seleccionarProducto(this)">
        <strong>${p.nombre}</strong> <span style="float:right; color:var(--color-accent);">${fmtMoney(p.precio)}</span>
      </div>
    `).join('');
    resultadoDiv.style.display = 'block';
  }

  function _seleccionarProducto(elemento) {
    const id = elemento.dataset.id;
    const nombre = elemento.dataset.nombre;
    const precio = parseFloat(elemento.dataset.precio);

    _productoSeleccionado = { id, nombre, precio };

    $id('repBusquedaProducto').value = nombre;
    $id('repResultadosBusqueda').style.display = 'none';
    $id('repCantidad').focus();
  }

  /* ── AGREGAR ÍTEM ───────────────────────────────────────── */
  function _agregarItemAlPedido() {
    if (!_productoSeleccionado) {
      showToast('warning', 'Selecciona un producto de la lista');
      return;
    }

    const cantidad = parseInt($id('repCantidad')?.value) || 1;
    if (cantidad <= 0) {
      showToast('warning', 'Cantidad inválida');
      return;
    }

    const prodId = _productoSeleccionado.id;
    const producto = DB.productos.find(p => p.id === prodId);
    if (!producto) return;

    const existente = _itemsTemporales.find(it => it.prodId === prodId);
    if (existente) {
      existente.qty += cantidad;
    } else {
      _itemsTemporales.push({
        prodId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        q: cantidad  // ← ¡OJO! La letra correcta es 'qty', no 'q'. Corregir a 'qty' al cargar el archivo.
      });
    }

    $id('repBusquedaProducto').value = '';
    _productoSeleccionado = null;
    $id('repCantidad').value = 1;
    $id('repBusquedaProducto').focus();

    _renderItemsTemporales();
  }

  function _quitarItemTemporal(idx) {
    _itemsTemporales.splice(idx, 1);
    _renderItemsTemporales();
  }

  function _renderItemsTemporales() {
    const container = $id('repItemsLista');
    if (!container) return;

    if (!_itemsTemporales.length) {
      container.innerHTML = '<p style="color:var(--color-text-muted); font-size:12px;">Sin productos agregados.</p>';
      $id('repTotal').value = '0';
      return;
    }

    // Calcula el total usando 'qty' (o 'q' si se te pasó al escribir)
    const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * (it.qty || it.q || 1), 0);
    $id('repTotal').value = total.toFixed(2);

    container.innerHTML = _itemsTemporales.map((it, idx) => {
      const cantidad = it.qty || it.q || 1;  // ← Manejo robusto del nombre del campo
      return `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--color-panel); border-radius:var(--radius-xs); font-size:12px;">
          <span style="flex:1;"><strong>${cantidad}x</strong> ${it.nombre}</span>
          <span style="font-weight:600;">${fmtMoney(it.precio * cantidad)}</span>
          <button class="btn-icon-sm del" onclick="Reparto._quitarItemTemporal(${idx})"><i class="fas fa-times"></i></button>
        </div>`;
    }).join('');
  }

  /* ── GUARDAR NUEVO PEDIDO (CORREGIDO) ──────────────────── */
  async function guardarNuevoPedido() {
    const direccion = $val('repDireccion');
    const telefono = $val('repTelefono');
    const repartidor = $val('repRepartidor');
    const observaciones = $val('repObservaciones');

    if (!direccion) { showToast('error', 'La dirección es obligatoria'); return; }
    if (!_itemsTemporales.length) { showToast('error', 'Agrega al menos un producto'); return; }

    // Asegurar que cada ítem tenga la propiedad `qty` con un valor
    const itemsListos = _itemsTemporales.map(it => ({
      nombre: it.nombre,
      precio: it.precio,
      qty: it.qty || it.q || 1
    }));

    const total = itemsListos.reduce((sum, it) => sum + it.precio * it.qty, 0);
    if (total <= 0) { showToast('error', 'El total debe ser mayor a 0'); return; }

    let nuevo = null;

    // ── 1. Intentar DeliveryService (DDD) ──
    if (typeof DeliveryService !== 'undefined' && DeliveryService.crearDelivery) {
      try {
        const resultado = await DeliveryService.crearDelivery({
          direccion: { calle: direccion, telefono },
          items: itemsListos,
          repartidor,
          observaciones
        });

        if (resultado && resultado.exito) {
          nuevo = resultado.datos;
        } else {
          console.warn('[Reparto] DeliveryService falló:', resultado?.error);
          showToast('warning', resultado?.error || 'Error en DeliveryService');
        }
      } catch (e) {
        console.warn('[Reparto] Excepción en DeliveryService:', e);
      }
    }

    // ── 2. Fallback: PedidoManager o DB directa ──
    if (!nuevo) {
      try {
        if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoDelivery) {
          nuevo = PedidoManager.crearPedidoDelivery({
            direccion, telefono,
            items: itemsListos,
            total, repartidor, observaciones,
            estado: 'pendiente'
          });
        }
        // Si aún no hay, último recurso con DB
        if (!nuevo) {
          nuevo = DB.crearPedidoDelivery({
            direccion, telefono,
            items: itemsListos,
            total, repartidor, observaciones,
            estado: 'pendiente'
          });
        }
      } catch (e) {
        console.error('[Reparto] Error en fallback de creación:', e);
      }
    }

    // ── Resultado final ──
    if (nuevo && nuevo.id) {
      cerrarModalNuevo();
      render();
      showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
    } else {
      showToast('error', 'No se pudo crear el pedido. Inténtalo de nuevo.');
    }
  }

  /* ── ENVIAR A COCINA ────────────────────────────────────── */
  async function enviarACocina(deliveryId) {
    if (typeof DeliveryService !== 'undefined' && DeliveryService.enviarACocina) {
      const resultado = await DeliveryService.enviarACocina(deliveryId);
      if (resultado.exito) { render(); showToast('success', 'Pedido enviado a Cocina/Barra'); return; }
      showToast('error', resultado.error);
      return;
    }
    const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!pedido) { showToast('error', 'Pedido no encontrado'); return; }
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_preparacion' });
    render();
    showToast('success', 'Pedido enviado a Cocina/Barra');
  }

  /* ── DESPACHAR ──────────────────────────────────────────── */
  async function despachar(deliveryId) {
    if (typeof DeliveryService !== 'undefined' && DeliveryService.despachar) {
      const resultado = await DeliveryService.despachar(deliveryId);
      if (resultado.exito) { render(); showToast('success', 'Pedido en camino'); return; }
      showToast('error', resultado.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_camino' });
    render();
    showToast('success', 'Pedido en camino');
  }

  /* ── CONFIRMAR ENTREGA ──────────────────────────────────── */
  async function confirmarEntrega(deliveryId) {
    if (typeof DeliveryService !== 'undefined' && DeliveryService.confirmarEntrega) {
      const resultado = await DeliveryService.confirmarEntrega(deliveryId);
      if (resultado.exito) { render(); showToast('success', 'Pedido entregado'); return; }
      showToast('error', resultado.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'entregado' });
    render();
    showToast('success', 'Pedido entregado');
  }

  /* ── ELIMINAR PEDIDO ────────────────────────────────────── */
  function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    if (typeof DeliveryService !== 'undefined' && DeliveryService.cancelar) {
      DeliveryService.cancelar(id).then(res => {
        if (res.exito) { render(); showToast('warning', 'Pedido cancelado'); }
        else { showToast('error', res.error); }
      });
      return;
    }
    DB.eliminarPedidoDelivery(id);
    render();
    showToast('warning', 'Pedido eliminado');
  }

  /* ── SUSCRIPCIÓN A EVENTOS ──────────────────────────────── */
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('pedidosDelivery:guardados', render);
    EventBus.on('delivery:listo', (data) => {
      const { deliveryId } = data;
      showToast('success', `El pedido ${deliveryId.slice(-6)} está listo para envío.`);
      render();
    });
  }
  _initEventListeners();

  return {
    render, mostrarModalNuevo, cerrarModalNuevo, guardarNuevoPedido,
    _agregarItemAlPedido, _quitarItemTemporal, _filtrarProductos, _seleccionarProducto,
    enviarACocina, despachar, confirmarEntrega, eliminarPedido
  };
})();

window.Reparto = Reparto;