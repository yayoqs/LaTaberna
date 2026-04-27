/* ================================================================
   PubPOS — MÓDULO: reparto.js (v1 – vista de Reparto / Delivery)
   Propósito: Gestionar pedidos de envío: crear, cambiar estado
              (pendiente → en preparación → en camino → entregado),
              y eliminar. Genera su propia vista.
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

    // Ordenar por fecha descendente
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

      // Botones según estado actual
      let botonesHTML = '';
      if (p.estado === 'pendiente') {
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

  /* ── MODAL NUEVO PEDIDO ──────────────────────────────────── */
  function mostrarModalNuevo() {
    // Crear modal dinámicamente si no existe
    let modal = $id('modalReparto');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalReparto';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header">
            <h3><i class="fas fa-plus"></i> Nuevo Pedido de Delivery</h3>
            <button class="modal-close" onclick="Reparto.cerrarModalNuevo()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Dirección</label><input type="text" id="repDireccion" placeholder="Calle, número, depto.">
            <label>Teléfono</label><input type="text" id="repTelefono" placeholder="+56 9 ...">
            <label>Productos (uno por línea: cantidad nombre)</label>
            <textarea id="repItems" rows="4" placeholder="2 Pizza Margarita&#10;1 Empanada de carne"></textarea>
            <label>Total ($)</label><input type="number" id="repTotal" step="0.01" value="0">
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
    $id('repItems').value = '';
    $id('repTotal').value = '0';
    $id('repRepartidor').value = '';
    $id('repObservaciones').value = '';
    modal.style.display = 'flex';
  }

  function cerrarModalNuevo() {
    const modal = $id('modalReparto');
    if (modal) modal.style.display = 'none';
  }

  function guardarNuevoPedido() {
    const direccion = $val('repDireccion');
    const telefono = $val('repTelefono');
    const itemsRaw = $id('repItems')?.value || '';
    const total = parseFloat($id('repTotal')?.value) || 0;
    const repartidor = $val('repRepartidor');
    const observaciones = $val('repObservaciones');

    if (!direccion) { showToast('error', 'La dirección es obligatoria'); return; }
    if (!itemsRaw.trim()) { showToast('error', 'Ingresá al menos un producto'); return; }

    // Parsear items (formato: "cantidad nombre")
    const lineas = itemsRaw.split('\n').filter(l => l.trim());
    const items = lineas.map(linea => {
      const match = linea.match(/^(\d+)\s+(.+)/);
      if (match) {
        return { qty: parseInt(match[1]), nombre: match[2].trim(), precio: 0 };
      }
      return { qty: 1, nombre: linea.trim(), precio: 0 };
    });

    if (total <= 0) { showToast('error', 'Total debe ser mayor a 0'); return; }

    const nuevo = DB.crearPedidoDelivery({
      direccion,
      telefono,
      items,
      total,
      repartidor,
      observaciones,
      estado: 'pendiente'
    });

    cerrarModalNuevo();
    render();
    showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
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
  }
  _initEventListeners();

  return {
    render,
    mostrarModalNuevo,
    cerrarModalNuevo,
    guardarNuevoPedido,
    cambiarEstado,
    eliminarPedido
  };
})();

window.Reparto = Reparto;