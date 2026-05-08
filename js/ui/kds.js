/* ================================================================
   PubPOS — MÓDULO: kds.js (v4.3 – escucha también EventBus)
   ================================================================ */
const KDS = (() => {
  const MINUTOS_URGENTE = 15;
  const MINUTOS_OCULTAR_LISTA = 10;

  function _asegurarVista() {
    if ($id('view-cocina')) return;

    const main = document.createElement('main');
    main.id = 'view-cocina';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-fire-burner"></i> Monitor de Cocina</h2>
        <div class="toolbar-actions">
          <button class="btn-secondary" onclick="KDS.refresh()">
            <i class="fas fa-sync-alt"></i> Actualizar
          </button>
        </div>
      </div>
      <div id="cocinaKDS" class="kds-grid"></div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function refresh() {
    _asegurarVista();
    const cont = $id('cocinaKDS');
    if (!cont) return;

    const ahora = Date.now();
    const rol = Auth.getRol();

    let comandas = Store.getState().comandas || [];

    // Filtrar comandas que no tengan items
    comandas = comandas.filter(c => c && Array.isArray(c.items));

    // Filtrar las que ya expiraron
    comandas = comandas.filter(c => {
      if (c.estado === 'lista') {
        return (ahora - c.ts) < MINUTOS_OCULTAR_LISTA * 60 * 1000;
      }
      return true;
    });

    // Filtrar por rol
    if (rol === 'cocina') {
      comandas = comandas.filter(c => c.destino === 'cocina' || c.destino === 'ambos');
    } else if (rol === 'barra') {
      comandas = comandas.filter(c => c.destino === 'barra' || c.destino === 'ambos');
    }

    Logger.debug(`[KDS] ${comandas.length} comandas activas en Store.`);

    if (!comandas.length) {
      cont.innerHTML = `<div class="kds-empty"><i class="fas fa-check-circle"></i><p class="kds-empty-title">Todo en orden</p><p>No hay comandas pendientes</p></div>`;
      return;
    }

    cont.innerHTML = comandas.map(_htmlKdsCard).join('');
  }

  function _htmlKdsCard(c) {
    const minutos = Math.floor((Date.now() - c.ts) / 60000);
    const urgente = minutos > MINUTOS_URGENTE;
    const tiempoTxt = minutos === 0 ? 'Ahora' : `Hace ${minutos} min`;
    const destLabel = { cocina: 'Cocina', barra: 'Barra', ambos: 'Cocina + Barra' }[c.destino] || c.destino;
    const destCss = c.destino === 'barra' ? 'barra' : 'cocina';
    const esDelivery = !!c.deliveryId;
    const etiquetaDelivery = esDelivery ? `<span class="kds-destino-tag" style="background:rgba(34,197,94,.2);color:var(--color-success);">Delivery</span>` : '';

    const items = c.items || [];
    const itemsHTML = items.map(it => {
      const receta = DB.recetas?.find(r => r.productoId == it.prodId);
      let recetaHTML = '';
      if (receta && receta.ingredientes && receta.ingredientes.length) {
        recetaHTML = receta.ingredientes.map(ing => {
          const ingData = DB.ingredientes.find(i => i.id == ing.ingredienteId);
          return ingData
            ? `<li>${ingData.nombre}: ${ing.cantidad} ${ingData.unidad}</li>`
            : '';
        }).join('');
        recetaHTML = `<details style="font-size:11px;margin-top:4px;"><summary>📋 Receta</summary><ul>${recetaHTML}</ul></details>`;
      }

      const icono = it.enviadoA === 'barra' ? '🍹' : '🍳';
      return `
        <div class="kds-item">
          <span class="kds-qty">${it.qty}</span>
          <div>
            <div class="kds-item-name">${it.nombre} ${icono}</div>
            ${it.obs ? `<div class="kds-item-obs"><i class="fas fa-exclamation-circle"></i> ${it.obs}</div>` : ''}
            ${recetaHTML}
          </div>
        </div>`;
    }).join('');

    let botonesHTML = '';
    if (c.estado !== 'lista') {
      botonesHTML += c.estado === 'nueva'
        ? `<button class="kds-btn kds-btn-proceso" onclick="KDS._setEstado('${c.id}','en-proceso')"><i class="fas fa-fire"></i> En proceso</button>`
        : '';
      botonesHTML += `<button class="kds-btn kds-btn-lista" onclick="KDS._setEstado('${c.id}','lista')"><i class="fas fa-check"></i> Listo</button>`;
    } else {
      botonesHTML = `<div class="kds-lista-ok"><i class="fas fa-check-circle"></i> LISTO</div>`;
    }

    return `
      <article class="kds-card ${c.estado}" id="kds-${c.id}">
        <div class="kds-header">
          <div class="kds-mesa"><i class="fas fa-chair"></i> ${c.mesa} ${etiquetaDelivery} <span class="kds-mozo">${c.mozo}</span></div>
          <div class="kds-meta"><span class="kds-destino-tag ${destCss}">${destLabel}</span><span class="kds-time${urgente ? ' urgente' : ''}">${tiempoTxt}</span></div>
        </div>
        <div class="kds-items">${itemsHTML}</div>
        ${c.observaciones ? `<p class="kds-obs"><i class="fas fa-comment"></i> ${c.observaciones}</p>` : ''}
        <div class="kds-footer">${botonesHTML}</div>
      </article>`;
  }

  function _setEstado(id, estado) {
    const comandas = Store.getState().comandas || [];
    const c = comandas.find(x => x.id === id);
    if (!c) return;

    Store.dispatch({ type: 'COMANDA_ACTUALIZADA', payload: { id, cambios: { estado } } });

    if (estado === 'lista') {
      const mesa = DB.getMesa(c.mesa);
      if (mesa && mesa.estado === 'ocupada') {
        mesa.estado = 'esperando';
        DB.saveMesas();
        EventBus.emit('mesa:actualizada', { mesa: c.mesa, estado: 'esperando' });
      }
      EventBus.emit('comanda:lista', { id, mesa: c.mesa });

      if (c.deliveryId) {
        EventBus.emit('delivery:listo', { deliveryId: c.deliveryId, comandaId: id, estado: 'listo' });
        Logger.info(`[KDS] Delivery listo: ${c.deliveryId}`);
      }
    }

    const idx = DB.comandas.findIndex(x => x.id === id);
    if (idx >= 0) {
      DB.comandas[idx].estado = estado;
      DB.saveComandas();
    }

    showToast('success', `<i class="fas fa-check"></i> ${c.mesa} → ${estado === 'lista' ? 'LISTA ✓' : 'En proceso'}`);
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('COMANDA')) {
        Logger.debug('[KDS] Cambio detectado en Store, refrescando...');
        refresh();
      }
    });

    EventBus.on('comanda:enviada', (comanda) => {
      Logger.debug(`[KDS] Evento comanda:enviada recibido: ${comanda.id}`);
      refresh();
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(refresh, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'cocina') refresh();
    });
  }

  _initListeners();

  return { refresh, _setEstado };
})();

window.KDS = KDS;