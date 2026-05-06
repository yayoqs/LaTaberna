/* ================================================================
   PubPOS — MÓDULO: reparto.js (v3.7.2 – corrección definitiva)
   ================================================================ */
const Reparto = (() => {
  // ── CREACIÓN DINÁMICA DE LA VISTA ─────────────────────────
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
    const pedidos = DB.pedidosDelivery || [];
    if (!pedidos.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay pedidos de delivery.</td></tr>`;
      return;
    }
    const ordenados = [...pedidos].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    tbody.innerHTML = ordenados.map(p => {
      const items = p.items || [];
      const resumen = items.map(i => `${i.qty}x ${i.nombre}`).join(', ') || '—';
      const badgeClase = { pendiente:'warning', en_preparacion:'info', en_camino:'accent', entregado:'success' }[p.estado] || 'default';
      let botones = '';
      if (p.estado === 'pendiente') botones += `<button class="btn-ajuste" onclick="Reparto.enviarACocina('${p.id}')"><i class="fas fa-fire-burner"></i> Enviar a Cocina</button>`;
      else if (p.estado === 'en_preparacion') botones += `<button class="btn-ajuste" onclick="Reparto.despachar('${p.id}')"><i class="fas fa-motorcycle"></i> En camino</button>`;
      else if (p.estado === 'en_camino') botones += `<button class="btn-ajuste" onclick="Reparto.confirmarEntrega('${p.id}')"><i class="fas fa-check"></i> Entregado</button>`;
      botones += `<button class="btn-ajuste del" onclick="Reparto.eliminarPedido('${p.id}')"><i class="fas fa-trash"></i></button>`;
      return `<tr><td><strong>${p.id.replace('deliv_','').slice(-6)}</strong></td><td>${p.direccion}</td><td>${p.telefono||'—'}</td><td style="font-size:12px;">${resumen}</td><td>${fmtMoney(p.total)}</td><td><span class="badge ${badgeClase}">${p.estado.replace('_',' ')}</span></td><td>${p.repartidor||'—'}</td><td>${botones}</td></tr>`;
    }).join('');
  }

  // ── MODAL NUEVO PEDIDO ──────────────────────────────────
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
        <div class="modal-small" style="max-width:520px;">
          <div class="modal-header"><h3><i class="fas fa-plus"></i> Nuevo Pedido de Delivery</h3><button class="modal-close" onclick="Reparto.cerrarModalNuevo()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Dirección *</label><input type="text" id="repDireccion" placeholder="Calle, número, depto.">
            <label>Teléfono</label><input type="text" id="repTelefono" placeholder="+56 9 ...">
            <label>Productos</label>
            <div style="position:relative;"><input type="text" id="repBusquedaProducto" placeholder="Buscar producto..." autocomplete="off" oninput="Reparto._filtrarProductos()" style="width:100%;"><div id="repResultadosBusqueda" style="position:absolute;top:100%;left:0;right:0;background:var(--color-panel);border:1px solid var(--color-border);border-radius:var(--radius-sm);z-index:10;max-height:200px;overflow-y:auto;display:none;"></div></div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="number" id="repCantidad" value="1" min="1" style="width:70px;" onkeydown="if(event.key==='Enter'){event.preventDefault();Reparto._agregarItemAlPedido();}"><button class="btn-secondary" onclick="Reparto._agregarItemAlPedido()"><i class="fas fa-plus"></i> Agregar</button></div>
            <div id="repItemsLista" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
            <label>Total ($)</label><input type="number" id="repTotal" step="0.01" value="0" readonly style="font-weight:700;background:var(--color-panel);">
            <label>Repartidor</label><input type="text" id="repRepartidor" placeholder="Nombre del repartidor">
            <label>Observaciones</label><input type="text" id="repObservaciones" placeholder="Pago con tarjeta, timbre roto...">
            <div class="modal-small-footer"><button class="btn-secondary" onclick="Reparto.cerrarModalNuevo()">Cancelar</button><button class="btn-primary" onclick="Reparto.guardarNuevoPedido()"><i class="fas fa-save"></i> Guardar</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
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
  function cerrarModalNuevo() { const modal=$id('modalReparto'); if(modal) modal.style.display='none'; }

  function _filtrarProductos() {
    const input=$id('repBusquedaProducto'), res=$id('repResultadosBusqueda');
    if(!input||!res) return;
    const term = input.value.trim().toLowerCase();
    if(!term) { res.style.display='none'; _productoSeleccionado=null; return; }
    const prod = DB.productos.filter(p=>p.activo!==false && p.nombre.toLowerCase().includes(term));
    if(prod.length===0) { res.innerHTML='<div style="padding:8px;color:var(--color-text-muted);">Sin resultados</div>'; res.style.display='block'; _productoSeleccionado=null; }
    else { res.innerHTML=prod.map(p=>`<div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border);" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''" onclick="Reparto._seleccionarProducto(this)"><strong>${p.nombre}</strong> <span style="float:right;color:var(--color-accent);">${fmtMoney(p.precio)}</span></div>`).join(''); res.style.display='block'; }
  }

  function _seleccionarProducto(el) {
    _productoSeleccionado = { id:el.dataset.id, nombre:el.dataset.nombre, precio:parseFloat(el.dataset.precio) };
    $id('repBusquedaProducto').value = el.dataset.nombre;
    $id('repResultadosBusqueda').style.display = 'none';
    $id('repCantidad').focus();
  }

  function _agregarItemAlPedido() {
    if (!_productoSeleccionado) { showToast('warning','Selecciona un producto'); return; }
    const cant = parseInt($id('repCantidad')?.value) || 1;
    if (cant<=0) { showToast('warning','Cantidad inválida'); return; }
    const prod = DB.productos.find(p=>p.id===_productoSeleccionado.id);
    if(!prod) return;
    const existente = _itemsTemporales.find(it=>it.prodId===prod.id);
    if(existente) existente.qty += cant;
    else _itemsTemporales.push({ prodId:prod.id, nombre:prod.nombre, precio:prod.precio, qty:cant });
    $id('repBusquedaProducto').value=''; _productoSeleccionado=null; $id('repCantidad').value=1; $id('repBusquedaProducto').focus();
    _renderItemsTemporales();
  }
  function _quitarItemTemporal(idx) { _itemsTemporales.splice(idx,1); _renderItemsTemporales(); }
  function _renderItemsTemporales() {
    const container=$id('repItemsLista'); if(!container) return;
    if(!_itemsTemporales.length) { container.innerHTML='<p style="color:var(--color-text-muted);font-size:12px;">Sin productos agregados.</p>'; $id('repTotal').value='0'; return; }
    const total=_itemsTemporales.reduce((sum,it)=>sum+it.precio*(it.qty||1),0);
    $id('repTotal').value=total.toFixed(2);
    container.innerHTML=_itemsTemporales.map((it,idx)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-panel);border-radius:var(--radius-xs);font-size:12px;">
        <span style="flex:1;"><strong>${it.qty||1}x</strong> ${it.nombre}</span>
        <span style="font-weight:600;">${fmtMoney(it.precio*(it.qty||1))}</span>
        <button class="btn-icon-sm del" onclick="Reparto._quitarItemTemporal(${idx})"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }

  // ── GUARDAR NUEVO PEDIDO (CORREGIDO) ────────────────────
  async function guardarNuevoPedido() {
    const dir = $val('repDireccion'), tel = $val('repTelefono'), rep = $val('repRepartidor'), obs = $val('repObservaciones');
    if(!dir) { showToast('error','Dirección obligatoria'); return; }
    if(!_itemsTemporales.length) { showToast('error','Agrega al menos un producto'); return; }
    const itemsListos = _itemsTemporales.map(it=>({ nombre:it.nombre, precio:it.precio, qty:it.qty||1 }));
    const total = itemsListos.reduce((s,i)=>s+i.precio*i.qty,0);
    if(total<=0) { showToast('error','Total inválido'); return; }

    let nuevo = null;
    // 1. Intentar DeliveryService
    if(typeof DeliveryService!=='undefined' && DeliveryService.crearDelivery) {
      try {
        const res = await DeliveryService.crearDelivery({ direccion:{calle:dir,telefono:tel}, items:itemsListos, repartidor:rep, observaciones:obs });
        if(res.exito) nuevo = res.datos;
        else console.warn('[Reparto] DeliveryService falló:', res.error);
      } catch(e) { console.warn('[Reparto] Excepción DeliveryService:', e); }
    }
    // 2. Fallback a PedidoManager
    if(!nuevo && typeof PedidoManager!=='undefined' && PedidoManager.crearPedidoDelivery) {
      try { nuevo = PedidoManager.crearPedidoDelivery({ direccion:dir, telefono:tel, items:itemsListos, total, repartidor:rep, observaciones:obs, estado:'pendiente' }); } catch(e) {}
    }
    // 3. Fallback a DB directa
    if(!nuevo) {
      try { nuevo = DB.crearPedidoDelivery({ direccion:dir, telefono:tel, items:itemsListos, total, repartidor:rep, observaciones:obs, estado:'pendiente' }); } catch(e) {}
    }

    if(nuevo && nuevo.id) {
      cerrarModalNuevo(); render();
      showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
    } else {
      showToast('error', 'No se pudo crear el pedido. Intenta de nuevo.');
    }
  }

  async function enviarACocina(deliveryId) {
    if(typeof DeliveryService!=='undefined' && DeliveryService.enviarACocina) {
      const r = await DeliveryService.enviarACocina(deliveryId);
      if(r.exito) { render(); showToast('success','Enviado a Cocina'); return; }
      else showToast('error',r.error);
      return;
    }
    const ped = DB.pedidosDelivery.find(p=>p.id===deliveryId);
    if(!ped) { showToast('error','No encontrado'); return; }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'en_preparacion'});
    render(); showToast('success','Enviado a Cocina');
  }
  async function despachar(deliveryId) {
    if(typeof DeliveryService!=='undefined' && DeliveryService.despachar) {
      const r = await DeliveryService.despachar(deliveryId);
      if(r.exito) { render(); showToast('success','En camino'); return; }
      else showToast('error',r.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'en_camino'});
    render(); showToast('success','En camino');
  }
  async function confirmarEntrega(deliveryId) {
    if(typeof DeliveryService!=='undefined' && DeliveryService.confirmarEntrega) {
      const r = await DeliveryService.confirmarEntrega(deliveryId);
      if(r.exito) { render(); showToast('success','Entregado'); return; }
      else showToast('error',r.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'entregado'});
    render(); showToast('success','Entregado');
  }
  function eliminarPedido(id) {
    if(!confirm('¿Eliminar este pedido?')) return;
    if(typeof DeliveryService!=='undefined' && DeliveryService.cancelar) {
      DeliveryService.cancelar(id).then(r=>{ if(r.exito){ render(); showToast('warning','Cancelado'); } else showToast('error',r.error); });
      return;
    }
    DB.eliminarPedidoDelivery(id);
    render(); showToast('warning','Eliminado');
  }

  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('pedidosDelivery:guardados', render);
    EventBus.on('delivery:listo', (data) => {
      showToast('success', `El pedido ${data.deliveryId.slice(-6)} está listo para envío.`);
      render();
    });
  }
  _initEventListeners();

  return { render, mostrarModalNuevo, cerrarModalNuevo, guardarNuevoPedido, _agregarItemAlPedido, _quitarItemTemporal, _filtrarProductos, _seleccionarProducto, enviarACocina, despachar, confirmarEntrega, eliminarPedido };
})();

window.Reparto = Reparto;