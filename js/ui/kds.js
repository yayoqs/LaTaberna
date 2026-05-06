/* ================================================================
   PubPOS — MÓDULO: kds.js (v3.2 – notificación robusta a Reparto)
   ================================================================
   Cambios respecto a v3.1:
   • Al marcar una comanda como "lista", si pertenece a un delivery
     ahora se emite el evento 'delivery:listo' con el deliveryId y
     el estado 'listo', para que el módulo Reparto pueda actualizar
     automáticamente la tabla.
   • Se añade un comentario pedagógico explicando la integración.
   • El resto del código permanece igual. La actualización del estado
     del delivery se implementa en reparto.js (siguiente archivo).
   ================================================================ */
const KDS = (() => {
  const MINUTOS_URGENTE = 15;
  const MINUTOS_OCULTAR_LISTA = 10;

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
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

    let comandasFiltradas = DB.comandas.filter(c => {
      if (c.estado === 'lista') {
        return (ahora - c.ts) < MINUTOS_OCULTAR_LISTA * 60 * 1000;
      }
      return true;
    });

    if (rol === 'cocina') {
      comandasFiltradas = comandasFiltradas.filter(c => 
        c.destino === 'cocina' || c.destino === 'ambos'
      );
    } else if (rol === 'barra') {
      comandasFiltradas = comandasFiltradas.filter(c => 
        c.destino === 'barra' || c.destino === 'ambos'
      );
    }

    if (!comandasFiltradas.length) {
      cont.innerHTML = `<div class="kds-empty"><i class="fas fa-check-circle"></i><p class="kds-empty-title">Todo en orden</p><p>No hay comandas pendientes</p></div>`;
      return;
    }

    cont.innerHTML = comandasFiltradas.map(_htmlKdsCard).join('');
  }

  function _htmlKdsCard(c) {
    const minutos = Math.floor((Date.now() - c.ts) / 60000);
    const urgente = minutos > MINUTOS_URGENTE;
    const tiempoTxt = minutos === 0 ? 'Ahora' : `Hace ${minutos} min`;
    const destLabel = { cocina: 'Cocina', barra: 'Barra', ambos: 'Cocina + Barra' }[c.destino] || c.destino;
    const destCss = c.destino === 'barra' ? 'barra' : 'cocina';
    // Mostrar etiqueta si es delivery
    const esDelivery = !!c.deliveryId;
    const etiquetaDelivery = esDelivery ? `<span class="kds-destino-tag" style="background:rgba(34,197,94,.2);color:var(--color-success);">Delivery</span>` : '';

    const itemsHTML = c.items.map(it => {
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

  /* ── CAMBIAR ESTADO (con notificación a Reparto) ────────────
     Al marcar una comanda como "lista":
     - Si es de mesa, se actualiza el estado de la mesa a "esperando".
     - Si es de delivery, se emite el evento 'delivery:listo' con los
       datos necesarios para que Reparto actualice el estado del pedido.
  ─────────────────────────────────────────────────────────── */
  function _setEstado(id, estado) {
    const c = DB.comandas.find(x => x.id === id);
    if (!c) return;
    c.estado = estado;

    if (estado === 'lista') {
      // Si es una comanda de mesa normal
      const mesa = DB.getMesa(c.mesa);
      if (mesa && mesa.estado === 'ocupada') {
        mesa.estado = 'esperando';
        DB.saveMesas();
        EventBus.emit('mesa:actualizada', { mesa: c.mesa, estado: 'esperando' });
      }
      EventBus.emit('comanda:lista', { id, mesa: c.mesa });

      // ═══════════════════════════════════════════════════════
      // ✨ INTEGRACIÓN CON REPARTO
      // ═══════════════════════════════════════════════════════
      // Si la comanda pertenece a un delivery, emitimos un evento
      // específico para que el módulo Reparto reaccione automáticamente
      // (ver reparto.js para el manejo del evento).
      if (c.deliveryId) {
        EventBus.emit('delivery:listo', { 
          deliveryId: c.deliveryId, 
          comandaId: id,
          estado: 'listo'    // ← el nuevo estado que refleja "listo para recoger"
        });
        console.log(`[KDS] Delivery listo: ${c.deliveryId}`);
      }
    }

    DB.saveComandas();
    refresh();
    showToast('success', `<i class="fas fa-check"></i> Mesa ${c.mesa} → ${estado === 'lista' ? 'LISTA ✓' : 'En proceso'}`);
  }

  function _initEventListeners() {
    EventBus.on('comandas:guardadas', refresh);
    EventBus.on('comanda:enviada', refresh);
    EventBus.on('db:inicializada', refresh);
  }
  _initEventListeners();

  return { refresh, _setEstado };
})();

window.KDS = KDS;