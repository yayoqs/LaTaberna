/* ================================================================
   Raíz — MÓDULO: reparto.js (v4.1 – corrección items.map)
   ================================================================ */
const Reparto = (() => {
  let _deliveryFlags = {};

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
          <thead><tr><th>Pedido</th><th>Dirección</th><th>Teléfono</th><th>Ítems</th><th>Total</th><th>Estado</th><th>Repartidor</th><th>Acciones</th></tr></thead>
          <tbody id="repartoBody"></tbody>
        </table>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    const tbody = $id('repartoBody'); if (!tbody) return;
    const pedidos = Store.getState().pedidosDelivery || [];
    const pedidosValidos = pedidos.filter(p => p && p.id);
    if (!pedidosValidos.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay pedidos de delivery.</td></tr>`;
      return;
    }
    const ordenados = [...pedidosValidos].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    tbody.innerHTML = ordenados.map(p => {
      // Normalizar items: puede ser string JSON, array, o undefined
      var items = p.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items)) items = [];
      const resumen = items.map(i => `${i.qty}x ${i.nombre}`).join(', ') || '—';

      const badgeClase = { pendiente:'warning', en_preparacion:'info', en_camino:'accent', entregado:'success' }[p.estado] || 'default';

      const estaListo = _deliveryFlags[p.id]?.listoParaRecoger === true;
      const estadoMostrado = estaListo && p.estado === 'en_preparacion' ? 'listo' : p.estado;
      const badgeExtra = estaListo && p.estado === 'en_preparacion' ? ' <span class="badge success" style="margin-left:4px;">✓ Listo</span>' : '';

      let botones = '';
      if (p.estado === 'pendiente') {
        botones += `<button class="btn-ajuste" onclick="Reparto.enviarACocina('${p.id}')"><i class="fas fa-fire-burner"></i> Enviar a Cocina</button>`;
      } else if (p.estado === 'en_preparacion') {
        botones += `<button class="btn-ajuste" onclick="Reparto.despachar('${p.id}')"><i class="fas fa-motorcycle"></i> ${estaListo ? 'Despachar ahora' : 'En camino'}</button>`;
      } else if (p.estado === 'en_camino') {
        botones += `<button class="btn-ajuste" onclick="Reparto.confirmarEntrega('${p.id}')"><i class="fas fa-check"></i> Entregado</button>`;
      }
      botones += `<button class="btn-ajuste del" onclick="Reparto.eliminarPedido('${p.id}')"><i class="fas fa-trash"></i></button>`;

      return `<tr>
        <td><strong>${p.id.replace('deliv_','').slice(-6)}</strong></td>
        <td>${p.direccion}</td>
        <td>${p.telefono||'—'}</td>
        <td style="font-size:12px;">${resumen}</td>
        <td>${fmtMoney(p.total)}</td>
        <td><span class="badge ${badgeClase}">${estadoMostrado.replace('_',' ')}</span>${badgeExtra}</td>
        <td>${p.repartidor||'—'}</td>
        <td>${botones}</td>
      </tr>`;
    }).join('');
  }

  let _itemsTemporales = [];
  let _productoSeleccionado = null;

  function mostrarModalNuevo() { /* ... igual que antes ... */ }
  function cerrarModalNuevo() { /* ... igual que antes ... */ }
  function _filtrarProductos() { /* ... igual que antes ... */ }
  function _seleccionarProducto(el) { /* ... igual que antes ... */ }
  function _agregarItemAlPedido() { /* ... igual que antes ... */ }
  function _quitarItemTemporal(idx) { /* ... igual que antes ... */ }
  function _renderItemsTemporales() { /* ... igual que antes ... */ }
  async function guardarNuevoPedido() { /* ... igual que antes ... */ }
  async function enviarACocina(deliveryId) { /* ... igual que antes ... */ }
  function _crearComandaParaDelivery(deliveryId) { /* ... igual que antes ... */ }
  async function despachar(deliveryId) { /* ... igual que antes ... */ }
  async function confirmarEntrega(deliveryId) { /* ... igual que antes ... */ }
  function eliminarPedido(id) { /* ... igual que antes ... */ }
  function _onDeliveryListo(data) { /* ... igual que antes ... */ }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('DELIVERY') || action.type.startsWith('PEDIDOSDELIVERY')) {
        render();
      }
    });
    EventBus.on('db:inicializada', () => { setTimeout(render, 100); });
    EventBus.on('vista:cambiada', (vista) => { if (vista === 'reparto') render(); });
    EventBus.on('delivery:listo', _onDeliveryListo);
  }

  _initListeners();

  return {
    render,
    mostrarModalNuevo,
    cerrarModalNuevo,
    guardarNuevoPedido,
    _agregarItemAlPedido,
    _quitarItemTemporal,
    _filtrarProductos,
    _seleccionarProducto,
    enviarACocina,
    despachar,
    confirmarEntrega,
    eliminarPedido
  };
})();

window.Reparto = Reparto;