/* ================================================================
   PubPOS — MÓDULO: reparto.js (v3 – pedido con selección de menú)
   Propósito: Gestionar pedidos de envío. Ahora el modal de nuevo
              pedido permite buscar y agregar productos del catálogo,
              calculando el total automáticamente.
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
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.cambiarEstado('${p.id}','en_preparacion')"><i class="fas fa-fire"></i> Preparar</button>`;
      } else if (p.estado === 'en_preparacion') {
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.cambiarEstado('${p.id}','en_camino')"><i class="fas fa-motorcycle"></i> En camino</button>`;
      } else if (p.estado === 'en_camino') {
        botonesHTML += `<button class="btn-ajuste" onclick="Reparto.cambiarEstado('${p.id}','entregado')"><i class="fas fa-check"></i> Entregado</button>`;
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

  /* ── MODAL NUEVO PEDIDO (MEJORADO CON MENÚ) ─────────────── */
  let _itemsTemporales = [];  // items acumulados antes de guardar

  function mostrarModalNuevo() {
    _itemsTemporales = [];

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
            <div style="display:flex; gap:8px; align-items:flex-end;">
              <select id="repProductoSelect" style="flex:1;">
                <option value="">— Seleccionar producto —</option>
              </select>
              <input type="number" id="repCantidad" value="1" min="1" style="width:60px;" placeholder="Cant.">
              <button class="btn-secondary" onclick="Reparto._agregarItemAlPedido()" style="white-space:nowrap;">
                <i class="fas fa-plus"></i> Agregar
              </button>
            </div>

            <!-- Lista de items agregados (dinámica) -->
            <div id="repItemsLista" style="display:flex; flex-direction:column; gap:6px; margin-top:8px; max-height:160px; overflow-y:auto;">
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

    // Llenar select de productos
    const select = $id('repProductoSelect');
    select.innerHTML = '<option value="">— Seleccionar producto —</option>' +
      DB.productos.filter(p => p.activo !== false).map(p =>
        `<option value="${p.id}">${p.nombre} (${fmtMoney(p.precio)})</option>`
      ).join('');

    $id('repCantidad').value = 1;
    _renderItemsTemporales();
    modal.style.display = 'flex';
  }

  function cerrarModalNuevo() {
    const modal = $id('modalReparto');
    if (modal) modal.style.display = 'none';
  }

  /* ── AGREGAR ÍTEM AL PEDIDO ─────────────────────────────── */
  function _agregarItemAlPedido() {
    const productoId = $id('repProductoSelect')?.value;
    const cantidad = parseInt($id('repCantidad')?.value) || 1;

    if (!productoId) {
      showToast('warning', 'Selecciona un producto');
      return;
    }
    if (cantidad <= 0) {
      showToast('warning', 'Cantidad inválida');
      return;
    }

    const producto = DB.productos.find(p => p.id === productoId);
    if (!producto) return;

    // Buscar si ya existe en la lista
    const existente = _itemsTemporales.find(it => it.prodId === productoId);
    if (existente) {
      existente.qty += cantidad;
    } else {
      _itemsTemporales.push({
        prodId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        qty: cantidad
      });
    }
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

    const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * it.qty, 0);
    $id('repTotal').value = total.toFixed(2);

    container.innerHTML = _itemsTemporales.map((it, idx) => `
      <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--color-panel); border-radius:var(--radius-xs); font-size:12px;">
        <span style="flex:1;"><strong>${it.qty}x</strong> ${it.nombre}</span>
        <span style="font-weight:600;">${fmtMoney(it.precio * it.qty)}</span>
        <button class="btn-icon-sm del" onclick="Reparto._quitarItemTemporal(${idx})"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  function guardarNuevoPedido() {
    const direccion = $val('repDireccion');
    const telefono = $val('repTelefono');
    const repartidor = $val('repRepartidor');
    const observaciones = $val('repObservaciones');

    if (!direccion) { showToast('error', 'La dirección es obligatoria'); return; }
    if (!_itemsTemporales.length) { showToast('error', 'Agrega al menos un producto'); return; }

    const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * it.qty, 0);
    if (total <= 0) { showToast('error', 'El total debe ser mayor a 0'); return; }

    const nuevo = DB.crearPedidoDelivery({
      direccion,
      telefono,
      items: _itemsTemporales.map(it => ({ ...it })), // copia
      total,
      repartidor,
      observaciones,
      estado: 'pendiente'
    });

    cerrarModalNuevo();
    render();
    showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
  }

  /* ── ENVIAR A COCINA ────────────────────────────────────── */
  function enviarACocina(deliveryId) {
    const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!pedido) {
      showToast('error', 'Pedido no encontrado');
      return;
    }

    const comanda = {
      id: 'kds_deliv_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      mesa: `Delivery ${deliveryId.slice(-6)}`,
      mozo: pedido.repartidor || 'Delivery',
      destino: 'cocina',
      items: pedido.items.map(it => ({
        prodId: it.prodId || it.nombre,
        nombre: it.nombre,
        precio: it.precio || 0,
        qty: it.qty,
        obs: '',
        enviado: false,
        enviadoA: null,
        enviadoTs: null,
        persona: 'Delivery'
      })),
      observaciones: `${pedido.direccion} - ${pedido.telefono}`,
      estado: 'nueva',
      ts: Date.now(),
      deliveryId: deliveryId
    };

    DB.comandas.push(comanda);
    DB.saveComandas();
    EventBus.emit('comanda:enviada', comanda);

    DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_preparacion' });
    render();
    showToast('success', 'Pedido enviado a Cocina/Barra');
  }

  /* ── CAMBIAR ESTADO ──────────────────────────────────────── */
  function cambiarEstado(id, nuevoEstado) {
    const labels = {
      en_preparacion: 'En preparación',
      en_camino: 'En camino',
      entregado: 'Entregado'
    };
    DB.actualizarPedidoDelivery(id, { estado: nuevoEstado });
    render();
    showToast('success', `Pedido → ${labels[nuevoEstado] || nuevoEstado}`);
  }

  /* ── ELIMINAR PEDIDO ─────────────────────────────────────── */
  function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    DB.eliminarPedidoDelivery(id);
    render();
    showToast('warning', 'Pedido eliminado');
  }

  /* ── SUSCRIPCIÓN A EVENTOS ───────────────────────────────── */
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('pedidosDelivery:guardados', render);
    EventBus.on('delivery:listo', (data) => {
      const { deliveryId } = data;
      const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
      if (pedido && pedido.estado === 'en_preparacion') {
        showToast('success', `El pedido ${deliveryId.slice(-6)} está listo para envío.`);
        render();
      }
    });
  }
  _initEventListeners();

  return {
    render,
    mostrarModalNuevo,
    cerrarModalNuevo,
    guardarNuevoPedido,
    _agregarItemAlPedido,
    _quitarItemTemporal,
    cambiarEstado,
    eliminarPedido,
    enviarACocina
  };
})();

window.Reparto = Reparto;