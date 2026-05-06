/* ================================================================
   PubPOS — MÓDULO: reparto.js (v3.7 – DDD para Delivery)
   Propósito: Gestión de pedidos de envío. Ahora utiliza el servicio
              de dominio DeliveryService. Mantiene fallback a
              PedidoManager y DB original por compatibilidad.
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

  /* ── RENDERIZAR LA TABLA (igual que antes) ──────────────── */
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

  function mostrarModalNuevo() { /* ... igual que antes ... */ }
  function cerrarModalNuevo() { /* ... igual que antes ... */ }
  function _filtrarProductos() { /* ... igual ... */ }
  function _seleccionarProducto() { /* ... igual ... */ }
  function _agregarItemAlPedido() { /* ... igual ... */ }
  function _quitarItemTemporal() { /* ... igual ... */ }
  function _renderItemsTemporales() { /* ... igual ... */ }

  /* ── GUARDAR NUEVO PEDIDO (DELEGADO A DELIVERYSERVICE) ──── */
  async function guardarNuevoPedido() {
    const direccion = $val('repDireccion');
    const telefono = $val('repTelefono');
    const repartidor = $val('repRepartidor');
    const observaciones = $val('repObservaciones');

    if (!direccion) { showToast('error', 'La dirección es obligatoria'); return; }
    if (!_itemsTemporales.length) { showToast('error', 'Agrega al menos un producto'); return; }

    const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * it.qty, 0);
    if (total <= 0) { showToast('error', 'El total debe ser mayor a 0'); return; }

    // ── 1. Intentar DeliveryService (DDD) ──
    if (typeof DeliveryService !== 'undefined' && DeliveryService.crearDelivery) {
      const resultado = await DeliveryService.crearDelivery({
        direccion: { calle: direccion, telefono },
        items: _itemsTemporales.map(it => ({
          nombre: it.nombre,
          precio: it.precio,
          qty: it.qty
        })),
        repartidor,
        observaciones
      });

      if (resultado.exito) {
        cerrarModalNuevo();
        render();
        showToast('success', `Pedido ${resultado.datos.id.slice(-6)} creado`);
        return;
      } else {
        showToast('error', resultado.error);
        console.warn('[Reparto] DeliveryService falló, usando fallback…');
      }
    }

    // ── 2. Fallback: PedidoManager o DB directa ──
    let nuevo;
    if (typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoDelivery) {
      nuevo = PedidoManager.crearPedidoDelivery({
        direccion, telefono, items: _itemsTemporales.map(it => ({ ...it })),
        total, repartidor, observaciones, estado: 'pendiente'
      });
    } else {
      nuevo = DB.crearPedidoDelivery({
        direccion, telefono, items: _itemsTemporales.map(it => ({ ...it })),
        total, repartidor, observaciones, estado: 'pendiente'
      });
    }

    cerrarModalNuevo();
    render();
    showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
  }

  /* ── ENVIAR A COCINA ────────────────────────────────────── */
  async function enviarACocina(deliveryId) {
    if (typeof DeliveryService !== 'undefined' && DeliveryService.enviarACocina) {
      const resultado = await DeliveryService.enviarACocina(deliveryId);
      if (resultado.exito) { render(); showToast('success', 'Pedido enviado a Cocina/Barra'); return; }
      showToast('error', resultado.error);
      return;
    }
    // Fallback antiguo…
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
    // Fallback antiguo
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
    // Fallback antiguo
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'entregado' });
    render();
    showToast('success', 'Pedido entregado');
  }

  /* ── ELIMINAR PEDIDO ────────────────────────────────────── */
  function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    // Intentar cancelar con DeliveryService
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