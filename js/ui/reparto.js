
   /* ================================================================
   LaTaberna - PubPOS — UI JS
   Archivo: js/ui/reparto.js
   Versión: 1.0.2
   Propósito: Gestión de pedidos de delivery con filtros, edición y
              prevención de duplicación de comandas.
              v1.0.2: protege replace() contra id nulo.
   Dependencias: js/lib/store.js, js/lib/eventBus.js, js/lib/logger.js,
                 js/db.js, js/servicios/delivery-service.js
   ================================================================ */
const Reparto = (() => {
  let _estadoFiltro = 'todos';
  let _itemsTemporales = [];
  let _productoSeleccionado = null;

  function _asegurarVista() {
    if (document.getElementById('view-reparto')) return;
    const main = document.createElement('main');
    main.id = 'view-reparto';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-motorcycle"></i> Reparto — Pedidos de Delivery</h2>
        <div class="toolbar-actions">
          <select id="repartoEstadoFilter" onchange="Reparto.filtrarPorEstado(this.value)">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_preparacion">En preparación</option>
            <option value="en_camino">En camino</option>
            <option value="entregado">Entregado</option>
          </select>
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
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    const tbody = document.getElementById('repartoBody'); if (!tbody) return;
    let pedidos = Store.getState().pedidosDelivery || [];

    // Protección doble: eliminar nulos y elementos sin id válido
    pedidos = pedidos.filter(p => p && p.id);

    if (_estadoFiltro !== 'todos') {
      pedidos = pedidos.filter(p => p.estado === _estadoFiltro);
    }

    if (!pedidos.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay pedidos de delivery.</td></tr>`;
      return;
    }

    const ordenados = [...pedidos].sort((a,b) => {
      const fechaA = a.creadoEn || a.created_at || '';
      const fechaB = b.creadoEn || b.created_at || '';
      return new Date(fechaB) - new Date(fechaA);
    });

    tbody.innerHTML = ordenados.map(p => {
      // Seguridad adicional: si aun así el id es nulo, mostrar texto alternativo
      const idSeguro = (p.id || '').toString();
      const idCorto = idSeguro.replace('deliv_','').slice(-6) || '—';

      var items = p.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items)) items = [];
      const resumen = items.map(i => `${i.qty}x ${i.nombre}`).join(', ') || '—';

      const badgeClase = { pendiente:'warning', en_preparacion:'info', en_camino:'accent', entregado:'success' }[p.estado] || 'default';

      let btnEditar = '';
      if (p.estado === 'pendiente') {
        btnEditar = `<button class="btn-ajuste" onclick="Reparto.editarItems('${idSeguro}')"><i class="fas fa-edit"></i> Editar</button>`;
      }

      let botones = '';
      if (p.estado === 'pendiente') {
        botones += `<button class="btn-ajuste" onclick="Reparto.enviarACocina('${idSeguro}')"><i class="fas fa-fire-burner"></i> Enviar a Cocina</button>`;
      } else if (p.estado === 'en_preparacion') {
        botones += `<button class="btn-ajuste" onclick="Reparto.despachar('${idSeguro}')"><i class="fas fa-motorcycle"></i> En camino</button>`;
      } else if (p.estado === 'en_camino') {
        botones += `<button class="btn-ajuste" onclick="Reparto.confirmarEntrega('${idSeguro}')"><i class="fas fa-check"></i> Entregado</button>`;
      }
      botones += `<button class="btn-ajuste del" onclick="Reparto.eliminarPedido('${idSeguro}')"><i class="fas fa-trash"></i></button>`;

      return `<tr>
        <td><strong>${idCorto}</strong></td>
        <td>${p.direccion || '—'}</td>
        <td>${p.telefono||'—'}</td>
        <td style="font-size:12px;">${resumen}</td>
        <td>${fmtMoney(p.total)}</td>
        <td><span class="badge ${badgeClase}">${(p.estado || '').replace('_',' ')}</span></td>
        <td>${p.repartidor||'—'}</td>
        <td>${btnEditar} ${botones}</td>
      </tr>`;
    }).join('');
  }

  function filtrarPorEstado(estado) {
    _estadoFiltro = estado;
    render();
  }

  /** Muestra el modal para crear un nuevo pedido de delivery */
  function mostrarModalNuevo() {
    _itemsTemporales = [];
    _productoSeleccionado = null;
    let modal = document.getElementById('modalReparto');
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
    document.getElementById('repDireccion').value = '';
    document.getElementById('repTelefono').value = '';
    document.getElementById('repTotal').value = '0';
    document.getElementById('repRepartidor').value = '';
    document.getElementById('repObservaciones').value = '';
    document.getElementById('repBusquedaProducto').value = '';
    document.getElementById('repCantidad').value = 1;
    document.getElementById('repResultadosBusqueda').style.display = 'none';
    _renderItemsTemporales();
    modal.style.display = 'flex';
  }

  function cerrarModalNuevo() { const modal=document.getElementById('modalReparto'); if(modal) modal.style.display='none'; }

  function _filtrarProductos() {
    const input=document.getElementById('repBusquedaProducto'), res=document.getElementById('repResultadosBusqueda');
    if(!input||!res) return;
    const term = input.value.trim().toLowerCase();
    if(!term) { res.style.display='none'; _productoSeleccionado=null; return; }
    const prod = DB.productos.filter(p=>p.activo!==false && p.nombre.toLowerCase().includes(term));
    if(prod.length===0) { res.innerHTML='<div style="padding:8px;color:var(--color-text-muted);">Sin resultados</div>'; res.style.display='block'; _productoSeleccionado=null; }
    else { res.innerHTML=prod.map(p=>`<div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border);" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''" onclick="Reparto._seleccionarProducto(this)"><strong>${p.nombre}</strong> <span style="float:right;color:var(--color-accent);">${fmtMoney(p.precio)}</span></div>`).join(''); res.style.display='block'; }
  }

  function _seleccionarProducto(el) {
    _productoSeleccionado = { id:el.dataset.id, nombre:el.dataset.nombre, precio:parseFloat(el.dataset.precio) };
    document.getElementById('repBusquedaProducto').value = el.dataset.nombre;
    document.getElementById('repResultadosBusqueda').style.display = 'none';
    document.getElementById('repCantidad').focus();
  }

  function _agregarItemAlPedido() {
    if (!_productoSeleccionado) { showToast('warning','Selecciona un producto'); return; }
    const cant = parseInt(document.getElementById('repCantidad')?.value) || 1;
    if (cant<=0) { showToast('warning','Cantidad inválida'); return; }
    const prod = DB.productos.find(p=>p.id===_productoSeleccionado.id);
    if(!prod) return;
    const existente = _itemsTemporales.find(it=>it.prodId===prod.id);
    if(existente) existente.qty += cant;
    else _itemsTemporales.push({ prodId:prod.id, nombre:prod.nombre, precio:prod.precio, qty:cant });
    document.getElementById('repBusquedaProducto').value=''; _productoSeleccionado=null; document.getElementById('repCantidad').value=1; document.getElementById('repBusquedaProducto').focus();
    _renderItemsTemporales();
  }

  function _quitarItemTemporal(idx) { _itemsTemporales.splice(idx,1); _renderItemsTemporales(); }

  function _renderItemsTemporales() {
    const container=document.getElementById('repItemsLista'); if(!container) return;
    if(!_itemsTemporales.length) { container.innerHTML='<p style="color:var(--color-text-muted);font-size:12px;">Sin productos agregados.</p>'; document.getElementById('repTotal').value='0'; return; }
    const total=_itemsTemporales.reduce((sum,it)=>sum+it.precio*(it.qty||1),0);
    document.getElementById('repTotal').value=total.toFixed(2);
    container.innerHTML=_itemsTemporales.map((it,idx)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-panel);border-radius:var(--radius-xs);font-size:12px;">
        <span style="flex:1;"><strong>${it.qty||1}x</strong> ${it.nombre}</span>
        <span style="font-weight:600;">${fmtMoney(it.precio*(it.qty||1))}</span>
        <button class="btn-icon-sm del" onclick="Reparto._quitarItemTemporal(${idx})"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }

  /** Guarda el nuevo pedido de delivery */
  async function guardarNuevoPedido() {
    const dir = document.getElementById('repDireccion').value.trim();
    const tel = document.getElementById('repTelefono').value.trim();
    const rep = document.getElementById('repRepartidor').value.trim();
    const obs = document.getElementById('repObservaciones').value.trim();
    if(!dir) { showToast('error','Dirección obligatoria'); return; }
    if(!_itemsTemporales.length) { showToast('error','Agrega al menos un producto'); return; }
    const itemsListos = _itemsTemporales.map(it=>({ nombre:it.nombre, precio:it.precio, qty:it.qty||1 }));
    const total = itemsListos.reduce((s,i)=>s+i.precio*i.qty,0);
    if(total<=0) { showToast('error','Total inválido'); return; }

    let nuevo = null;
    if(typeof DeliveryService!=='undefined' && DeliveryService.crearDelivery) {
      try {
        const res = await DeliveryService.crearDelivery({ direccion:{calle:dir,telefono:tel}, items:itemsListos, repartidor:rep, observaciones:obs });
        if(res.exito) nuevo = res.datos;
        else Logger.warn('[Reparto] DeliveryService falló:', res.error);
      } catch(e) { Logger.warn('[Reparto] Excepción DeliveryService:', e); }
    }
    if(!nuevo && typeof PedidoManager!=='undefined' && PedidoManager.crearPedidoDelivery) {
      try { nuevo = PedidoManager.crearPedidoDelivery({ direccion:dir, telefono:tel, items:itemsListos, total, repartidor:rep, observaciones:obs, estado:'pendiente' }); } catch(e) {}
    }
    if(!nuevo) {
      try { nuevo = DB.crearPedidoDelivery({ direccion:dir, telefono:tel, items:itemsListos, total, repartidor:rep, observaciones:obs, estado:'pendiente' }); } catch(e) {}
    }

    if(nuevo && nuevo.id) {
      cerrarModalNuevo();
      showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
    } else {
      showToast('error', 'No se pudo crear el pedido. Intenta de nuevo.');
    }
  }

  /** Envía un pedido de delivery a cocina (con prevención de duplicado) */
  async function enviarACocina(deliveryId) {
    if (typeof DB !== 'undefined' && DB.comandas) {
      const existeComanda = DB.comandas.find(c => c.deliveryId === deliveryId);
      if (existeComanda) {
        showToast('warning', 'Este pedido ya tiene una comanda en cocina.');
        return;
      }
    }

    if(typeof DeliveryService!=='undefined' && DeliveryService.enviarACocina) {
      const r = await DeliveryService.enviarACocina(deliveryId);
      if(r.exito) {
        _crearComandaParaDelivery(deliveryId);
        showToast('success','Enviado a Cocina'); return;
      }
      else showToast('error',r.error);
      return;
    }
    const ped = DB.pedidosDelivery.find(p=>p.id===deliveryId);
    if(!ped) { showToast('error','No encontrado'); return; }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'en_preparacion'});
    _crearComandaParaDelivery(deliveryId);
    showToast('success','Enviado a Cocina');
  }

  function _crearComandaParaDelivery(deliveryId) {
    const ped = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!ped) return;

    const destino = 'cocina';
    const itemsParaComanda = ped.items.map(it => ({
      prodId: it.prodId || '',
      nombre: it.nombre,
      precio: it.precio,
      qty: it.qty,
      destino: destino,
      obs: '',
      enviado: true,
      enviadoA: destino,
      enviadoTs: Date.now()
    }));

    const comanda = {
      id: 'kds_deliv_' + deliveryId,
      mesa: 'Deliv #' + deliveryId.slice(-6),
      mozo: ped.repartidor || 'Delivery',
      destino: destino,
      items: itemsParaComanda,
      observaciones: ped.observaciones || '',
      estado: 'nueva',
      ts: Date.now(),
      deliveryId: deliveryId
    };

    if (typeof DB !== 'undefined' && DB.comandas) {
      DB.comandas.push(comanda);
      DB.saveComandas();
    }
    EventBus.emit('comanda:enviada', comanda);
    Logger.debug(`[Reparto] Comanda de delivery creada: ${comanda.id}`);
  }

  /** Despacha un pedido (estado 'en camino') */
  async function despachar(deliveryId) {
    if(typeof DeliveryService!=='undefined' && DeliveryService.despachar) {
      const r = await DeliveryService.despachar(deliveryId);
      if(r.exito) {
        DB.actualizarPedidoDelivery(deliveryId,{estado:'en_camino'});
        showToast('success','En camino');
        return;
      }
      else showToast('error',r.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'en_camino'});
    showToast('success','En camino');
  }

  /** Confirma la entrega de un pedido */
  async function confirmarEntrega(deliveryId) {
    if(typeof DeliveryService!=='undefined' && DeliveryService.confirmarEntrega) {
      const r = await DeliveryService.confirmarEntrega(deliveryId);
      if(r.exito) {
        DB.actualizarPedidoDelivery(deliveryId,{estado:'entregado'});
        showToast('success','Entregado'); return;
      }
      else showToast('error',r.error);
      return;
    }
    DB.actualizarPedidoDelivery(deliveryId,{estado:'entregado'});
    showToast('success','Entregado');
  }

  /** Elimina un pedido de delivery */
  function eliminarPedido(id) {
    if(!confirm('¿Eliminar este pedido?')) return;
    if(typeof DeliveryService!=='undefined' && DeliveryService.cancelar) {
      DeliveryService.cancelar(id).then(r=>{ if(r.exito){ DB.eliminarPedidoDelivery(id); showToast('warning','Cancelado'); } else showToast('error',r.error); });
      return;
    }
    DB.eliminarPedidoDelivery(id);
    showToast('warning','Eliminado');
  }

  /** Permite editar los ítems de un pedido pendiente */
  function editarItems(deliveryId) {
    const ped = (Store.getState().pedidosDelivery || []).find(p => p.id === deliveryId);
    if (!ped || ped.estado !== 'pendiente') {
      showToast('error', 'Solo se pueden editar pedidos pendientes');
      return;
    }

    _itemsTemporales = (ped.items || []).map(it => ({
      prodId: it.prodId || '',
      nombre: it.nombre,
      precio: it.precio,
      qty: it.qty || 1
    }));
    _productoSeleccionado = null;

    let modal = document.getElementById('modalEditarItems');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEditarItems';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width:520px;">
          <div class="modal-header"><h3>Editar ítems del pedido</h3><button class="modal-close" onclick="Reparto.cerrarEditarItems()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Productos</label>
            <div style="position:relative;"><input type="text" id="editBusquedaProducto" placeholder="Buscar producto..." autocomplete="off" oninput="Reparto._filtrarProductosEdicion()" style="width:100%;"><div id="editResultadosBusqueda" style="position:absolute;top:100%;left:0;right:0;background:var(--color-panel);border:1px solid var(--color-border);border-radius:var(--radius-sm);z-index:10;max-height:200px;overflow-y:auto;display:none;"></div></div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="number" id="editCantidad" value="1" min="1" style="width:70px;" onkeydown="if(event.key==='Enter'){event.preventDefault();Reparto._agregarItemEdicion();}"><button class="btn-secondary" onclick="Reparto._agregarItemEdicion()"><i class="fas fa-plus"></i> Agregar</button></div>
            <div id="editItemsLista" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
            <label>Total ($)</label><input type="number" id="editTotal" step="0.01" value="0" readonly style="font-weight:700;background:var(--color-panel);">
            <div class="modal-small-footer"><button class="btn-secondary" onclick="Reparto.cerrarEditarItems()">Cancelar</button><button class="btn-primary" onclick="Reparto.guardarEdicionItems('${deliveryId}')"><i class="fas fa-save"></i> Guardar cambios</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    document.getElementById('editBusquedaProducto').value = '';
    document.getElementById('editCantidad').value = 1;
    document.getElementById('editResultadosBusqueda').style.display = 'none';
    _productoSeleccionado = null;
    _renderItemsEdicion();
    modal.style.display = 'flex';
  }

  function cerrarEditarItems() {
    const modal = document.getElementById('modalEditarItems');
    if (modal) modal.style.display = 'none';
  }

  function _filtrarProductosEdicion() {
    const input = document.getElementById('editBusquedaProducto');
    const res = document.getElementById('editResultadosBusqueda');
    if (!input || !res) return;
    const term = input.value.trim().toLowerCase();
    if (!term) { res.style.display = 'none'; _productoSeleccionado = null; return; }
    const prod = DB.productos.filter(p => p.activo !== false && p.nombre.toLowerCase().includes(term));
    if (prod.length === 0) {
      res.innerHTML = '<div style="padding:8px;color:var(--color-text-muted);">Sin resultados</div>';
      res.style.display = 'block';
      _productoSeleccionado = null;
    } else {
      res.innerHTML = prod.map(p => `<div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border);" onclick="Reparto._seleccionarProductoEdicion(this)"><strong>${p.nombre}</strong> <span style="float:right;color:var(--color-accent);">${fmtMoney(p.precio)}</span></div>`).join('');
      res.style.display = 'block';
    }
  }

  function _seleccionarProductoEdicion(el) {
    _productoSeleccionado = {
      id: el.dataset.id,
      nombre: el.dataset.nombre,
      precio: parseFloat(el.dataset.precio)
    };
    document.getElementById('editBusquedaProducto').value = el.dataset.nombre;
    document.getElementById('editResultadosBusqueda').style.display = 'none';
    document.getElementById('editCantidad').focus();
  }

  function _agregarItemEdicion() {
    if (!_productoSeleccionado) { showToast('warning', 'Selecciona un producto'); return; }
    const cant = parseInt(document.getElementById('editCantidad')?.value) || 1;
    if (cant <= 0) { showToast('warning', 'Cantidad inválida'); return; }
    const prod = DB.productos.find(p => p.id === _productoSeleccionado.id);
    if (!prod) return;
    const existente = _itemsTemporales.find(it => it.prodId === prod.id);
    if (existente) existente.qty += cant;
    else _itemsTemporales.push({ prodId: prod.id, nombre: prod.nombre, precio: prod.precio, qty: cant });
    document.getElementById('editBusquedaProducto').value = '';
    document.getElementById('editCantidad').value = 1;
    _productoSeleccionado = null;
    _renderItemsEdicion();
  }

  function _quitarItemEdicion(idx) {
    _itemsTemporales.splice(idx, 1);
    _renderItemsEdicion();
  }

  function _renderItemsEdicion() {
    const container = document.getElementById('editItemsLista');
    if (!container) return;
    if (!_itemsTemporales.length) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;">Sin productos.</p>';
      document.getElementById('editTotal').value = '0';
      return;
    }
    const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * (it.qty || 1), 0);
    document.getElementById('editTotal').value = total.toFixed(2);
    container.innerHTML = _itemsTemporales.map((it, idx) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-panel);border-radius:var(--radius-xs);font-size:12px;">
        <span style="flex:1;"><strong>${it.qty || 1}x</strong> ${it.nombre}</span>
        <span style="font-weight:600;">${fmtMoney(it.precio * (it.qty || 1))}</span>
        <button class="btn-icon-sm del" onclick="Reparto._quitarItemEdicion(${idx})"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }

  async function guardarEdicionItems(deliveryId) {
    if (!_itemsTemporales.length) { showToast('error', 'Agrega al menos un producto'); return; }
    const nuevosItems = _itemsTemporales.map(it => ({
      nombre: it.nombre,
      precio: it.precio,
      qty: it.qty || 1
    }));
    const total = nuevosItems.reduce((sum, i) => sum + i.precio * i.qty, 0);

    try {
      if (typeof DeliveryService !== 'undefined' && DeliveryService.actualizarItems) {
        const res = await DeliveryService.actualizarItems(deliveryId, nuevosItems, total);
        if (res.exito) {
          cerrarEditarItems();
          showToast('success', 'Ítems actualizados');
          return;
        }
      }
      // Fallback local
      DB.actualizarPedidoDelivery(deliveryId, { items: nuevosItems, total });
      cerrarEditarItems();
      showToast('success', 'Ítems actualizados');
    } catch (e) {
      showToast('error', 'Error al actualizar ítems');
    }
  }

  // Helpers para tests
  function _getItemsTemporales() { return _itemsTemporales; }
  function _setItemsTemporales(items) { _itemsTemporales = items; }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('DELIVERY') || action.type.startsWith('PEDIDOSDELIVERY')) {
        render();
      }
    });
    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'reparto') render();
    });
  }

  _initListeners();

  return {
    render,
    filtrarPorEstado,
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
    eliminarPedido,
    editarItems,
    cerrarEditarItems,
    _filtrarProductosEdicion,
    _seleccionarProductoEdicion,
    _agregarItemEdicion,
    _quitarItemEdicion,
    guardarEdicionItems,
    _getItemsTemporales,
    _setItemsTemporales
  };
})();

window.Reparto = Reparto;