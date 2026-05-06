/* ================================================================
   PubPOS — MÓDULO: tickets.js (v3.3 – modal dual + edición individual)
   Propósito: Generación y visualización de tickets. Ahora incluye
              mostrarDoble() para ver cocina y barra en un solo overlay,
              cada uno con sus propios botones [Editar] [Imprimir].
   ================================================================ */
const Tickets = (() => {

  /* ── ESTADO INTERNO ───────────────────────────────────────── */
  let _modals = [];

  /* ── MOSTRAR MODAL SIMPLE ───────────────────────────────── */
  function mostrar(htmlContent, titulo, opciones = {}) {
    const modalId = 'ticket-modal-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const botonesHTML = _construirBotones(modalId, opciones);

    modal.innerHTML = `
      <div class="modal-ticket">
        <div class="modal-header">
          <h3><i class="fas fa-print"></i> ${titulo}</h3>
          <button class="modal-close" id="${modalId}-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="ticket-preview-wrap">
          <div class="ticket-80mm" id="${modalId}-content">${htmlContent}</div>
        </div>
        <div class="ticket-actions" id="${modalId}-actions">
          ${botonesHTML}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    _modals.push(modalId);
    _vincularEventos(modalId, opciones);
  }

  /* ── MOSTRAR MODAL DUAL (COCINA + BARRA) ────────────────── */
  /**
   * Muestra dos tickets (cocina y barra) en un solo overlay.
   * @param {string} htmlIzquierda - HTML del ticket izquierdo
   * @param {string} tituloIzquierda - Título de la columna izquierda
   * @param {object} opcionesIzquierda - { editarCallback, textoEditar }
   * @param {string} htmlDerecha - HTML del ticket derecho
   * @param {string} tituloDerecha - Título de la columna derecha
   * @param {object} opcionesDerecha - { editarCallback, textoEditar }
   */
  function mostrarDoble(
    htmlIzquierda, tituloIzquierda, opcionesIzquierda,
    htmlDerecha,   tituloDerecha,   opcionesDerecha
  ) {
    const modalId = 'ticket-dual-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // IDs únicos para cada columna
    const idIzq = modalId + '-izq';
    const idDer = modalId + '-der';

    const botonesIzq = _construirBotones(idIzq, opcionesIzquierda);
    const botonesDer = _construirBotones(idDer, opcionesDerecha);

    modal.innerHTML = `
      <div class="modal-ticket-dual">
        <div class="modal-header">
          <h3><i class="fas fa-print"></i> Comanda — Mesa</h3>
          <button class="modal-close" id="${modalId}-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="ticket-dual-body">
          <div class="ticket-col">
            <div class="ticket-col-header">${tituloIzquierda}</div>
            <div class="ticket-preview-wrap">
              <div class="ticket-80mm" id="${idIzq}-content">${htmlIzquierda}</div>
            </div>
            <div class="ticket-actions" id="${idIzq}-actions">${botonesIzq}</div>
          </div>
          <div class="ticket-col">
            <div class="ticket-col-header">${tituloDerecha}</div>
            <div class="ticket-preview-wrap">
              <div class="ticket-80mm" id="${idDer}-content">${htmlDerecha}</div>
            </div>
            <div class="ticket-actions" id="${idDer}-actions">${botonesDer}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    _modals.push(modalId);

    // Vincular eventos para cada columna
    _vincularEventos(idIzq, opcionesIzquierda);
    _vincularEventos(idDer, opcionesDerecha);

    // Cerrar modal completo
    document.getElementById(`${modalId}-close`).onclick = () => {
      modal.remove();
      _modals = _modals.filter(id => id !== modalId);
      if (typeof opcionesIzquierda.cancelCallback === 'function') opcionesIzquierda.cancelCallback();
      if (typeof opcionesDerecha.cancelCallback === 'function') opcionesDerecha.cancelCallback();
    };
  }

  /* ── CONSTRUIR BOTONES ────────────────────────────────── */
  function _construirBotones(prefix, opciones = {}) {
    let html = '';
    if (typeof opciones.editarCallback === 'function') {
      html += `<button class="btn-secondary" id="${prefix}-editar"><i class="fas fa-pen"></i> ${opciones.textoEditar || 'Editar'}</button>`;
    }
    html += `<button class="btn-print" id="${prefix}-imprimir"><i class="fas fa-print"></i> Imprimir</button>`;
    return html;
  }

  /* ── VINCULAR EVENTOS ────────────────────────────────── */
  function _vincularEventos(prefix, opciones = {}) {
    const closeBtn = document.getElementById(`${prefix}-close`);
    const confirmBtn = document.getElementById(`${prefix}-confirmar`);
    const editBtn = document.getElementById(`${prefix}-editar`);
    const printBtn = document.getElementById(`${prefix}-imprimir`);

    if (printBtn) {
      printBtn.onclick = () => {
        const contentDiv = document.getElementById(`${prefix}-content`);
        if (!contentDiv) return;
        const win = window.open('', '_blank', 'width=420,height=680');
        if (!win) { showToast('error', 'El navegador bloqueó la ventana emergente.'); return; }
        win.document.write(_htmlVentanaImpresion(contentDiv.innerHTML, 'Comanda'));
        win.document.close();
      };
    }

    if (editBtn && typeof opciones.editarCallback === 'function') {
      editBtn.onclick = () => {
        const contentDiv = document.getElementById(`${prefix}-content`);
        if (!contentDiv) return;
        const nuevoHtml = opciones.editarCallback(contentDiv.innerHTML);
        if (nuevoHtml && typeof nuevoHtml === 'string') {
          contentDiv.innerHTML = nuevoHtml;
        }
      };
    }
  }

  function cerrar() {
    if (_modals.length > 0) {
      const lastId = _modals[_modals.length - 1];
      const modal = document.getElementById(lastId);
      if (modal) { modal.remove(); _modals.pop(); }
    }
  }

  function imprimir() { /* obsoleto */ }

  /* ── GENERADORES DE TICKETS (sin cambios) ──────────────── */
  function generarComanda(comanda, destino) {
    const hora  = fmtHoraCorta(Date.now());
    const fecha = fmtFechaCorta();
    let items = comanda.items;
    if (destino === 'cocina') items = items.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    else if (destino === 'barra') items = items.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
    if (!items.length) return '';

    const destLabel = destino === 'cocina' ? '*** COCINA ***' : '*** BARRA ***';
    const itemsHTML = items.map(it => `
      <div class="t-item-row t-mb1"><span class="t-bold">${it.qty}x</span><span>${it.nombre}</span><span></span></div>
      ${it.obs ? `<div class="t-item-obs">→ ${it.obs}</div>` : ''}
    `).join('');

    return `
      <div class="t-dest-header">${destLabel}</div>
      <div class="t-xl t-mb2">MESA ${comanda.mesa}</div>
      <hr class="t-hr-solid">
      <div class="t-row t-mb1"><span>${fecha} ${hora}</span><span>Mozo: ${comanda.mozo || '—'}</span></div>
      <hr class="t-hr-dash">
      ${itemsHTML}
      <hr class="t-hr-dash">
      ${comanda.observaciones ? `<div class="t-item-obs t-mb2">Obs: ${comanda.observaciones}</div>` : ''}
      <div class="t-center t-small t-mt2">— COMANDA —</div>
      <div class="t-spacer"></div>
    `;
  }

  function generarCuenta(mesa) {
    const cfg = DB.config; const fecha = fmtFechaCorta(); const hora = fmtHoraCorta(Date.now());
    const grupos = _agruparItems(mesa.items); const total = calcularTotal(mesa.items);
    const numTicket = String(Date.now()).slice(-6);
    const itemsHTML = grupos.map(g => `
      <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${g.nombre}</span><span>${fmtMoneyTicket(g.precio * g.qty)}</span></div>
    `).join('');
    return `
      <div class="t-title">${cfg.nombreLocal || 'Pub Restaurant'}</div>
      ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
      ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
      <hr class="t-hr-dash">
      <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
      <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
      <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
      <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">DETALLE DE CONSUMO</div><hr class="t-hr-dash">
      ${itemsHTML}<hr class="t-hr-dash">
      <div class="t-total-row"><span>TOTAL</span><span>${fmtMoneyTicket(total)}</span></div>
      <hr class="t-hr-solid"><div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
      <div class="t-footer t-small t-mt2">*** NO ES COMPROBANTE FISCAL ***</div><div class="t-spacer"></div>
    `;
  }

  function generarCierre(mesa, totalFinal, descuento, formaPago) {
    const cfg = DB.config; const fecha = fmtFechaCorta(); const hora = fmtHoraCorta(Date.now());
    const grupos = _agruparItems(mesa.items); const subtotal = calcularTotal(mesa.items);
    const numTicket = String(Date.now()).slice(-6); const descMonto = subtotal - totalFinal;
    const itemsHTML = grupos.map(g => `
      <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${g.nombre}</span><span>${fmtMoneyTicket(g.precio * g.qty)}</span></div>
    `).join('');
    const iconoPago = { 'Efectivo':'(EF)','Débito':'(DB)','Crédito':'(CR)','Transferencia':'(TR)','Mixto':'(MX)' }[formaPago] || '';
    return `
      <div class="t-title">${cfg.nombreLocal || 'Pub Restaurant'}</div>
      ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
      ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
      <hr class="t-hr-dash">
      <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
      <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
      <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
      <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">DETALLE</div><hr class="t-hr-dash">
      ${itemsHTML}<hr class="t-hr-dash">
      <div class="t-row t-mb1"><span>Subtotal</span><span>${fmtMoneyTicket(subtotal)}</span></div>
      ${descuento > 0 ? `<div class="t-row t-mb1"><span>Descuento (${descuento}%)</span><span>-${fmtMoneyTicket(descMonto)}</span></div>` : ''}
      <hr class="t-hr-solid">
      <div class="t-total-row"><span>TOTAL</span><span>${fmtMoneyTicket(totalFinal)}</span></div>
      <div class="t-row t-mt1 t-mb2 t-small"><span>Forma de pago:</span><span>${iconoPago} ${formaPago}</span></div>
      <hr class="t-hr-solid"><div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
      <div class="t-footer t-small t-mt2">*** NO ES COMPROBANTE FISCAL ***</div><div class="t-spacer"></div>
    `;
  }

  function generarCierreParcial(mesa, pago) {
    const cfg = DB.config; const fecha = fmtFechaCorta(); const hora = fmtHoraCorta(Date.now());
    const itemsPersona = mesa.items.filter(it => (it.persona || 'General') === pago.persona);
    if (!itemsPersona.length) return '';
    const grupos = _agruparItems(itemsPersona); const subtotal = calcularTotal(itemsPersona);
    const totalFinal = pago.monto; const numTicket = String(Date.now()).slice(-6);
    const itemsHTML = grupos.map(g => `
      <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${g.nombre}</span><span>${fmtMoneyTicket(g.precio * g.qty)}</span></div>
    `).join('');
    const iconoPago = { 'Efectivo':'(EF)','Débito':'(DB)','Crédito':'(CR)','Transferencia':'(TR)','Mixto':'(MX)' }[pago.formaPago] || '';
    return `
      <div class="t-title">${cfg.nombreLocal || 'Pub Restaurant'}</div>
      ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
      ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
      <hr class="t-hr-dash">
      <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
      <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero}</strong></span><span>Persona: ${pago.persona}</span></div>
      <hr class="t-hr-solid">${itemsHTML}<hr class="t-hr-dash">
      <div class="t-row t-mb1"><span>Subtotal</span><span>${fmtMoneyTicket(subtotal)}</span></div>
      <div class="t-total-row"><span>TOTAL PAGADO</span><span>${fmtMoneyTicket(totalFinal)}</span></div>
      <div class="t-row t-mt1 t-mb2 t-small"><span>Forma de pago:</span><span>${iconoPago} ${pago.formaPago}</span></div>
      <hr class="t-hr-solid"><div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
      <div class="t-spacer"></div>
    `;
  }

  function testImpresora(tipo) {
    const LABELS = { cocina: '*** COCINA ***', barra: '*** BARRA ***', caja: '*** CAJA ***' };
    const html = `
      <div class="t-dest-header">${LABELS[tipo] || '*** TEST ***'}</div>
      <div class="t-xl t-mb2">PRUEBA</div><hr class="t-hr-solid">
      <div class="t-center t-mb1">Impresora: ${tipo.toUpperCase()}</div>
      <div class="t-center t-mb2">Hora: ${fmtHoraCorta(Date.now())}</div><hr class="t-hr-dash">
      <div class="t-item-row t-mb1"><span>1x</span><span>Ítem de prueba</span><span>$100</span></div>
      <div class="t-item-row t-mb1"><span>2x</span><span>Ítem de prueba</span><span>$200</span></div>
      <hr class="t-hr-dash"><div class="t-total-row"><span>TOTAL</span><span>$300</span></div>
      <hr class="t-hr-solid"><div class="t-footer">Si ve esto, la impresora funciona ✓</div>
      <div class="t-spacer"></div>
    `;
    mostrar(html, `Prueba — ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
  }

  function _agruparItems(items) {
    const map = {};
    (items || []).forEach(it => {
      if (!map[it.nombre]) map[it.nombre] = { nombre: it.nombre, qty: 0, precio: it.precio };
      map[it.nombre].qty += it.qty;
    });
    return Object.values(map);
  }

  function _htmlVentanaImpresion(contenido, titulo) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
      <style>
        @page { size: 80mm auto; margin: 0; } * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:"Courier New",monospace; font-size:12px; line-height:1.45; width:80mm; color:#000; background:#fff; }
        .ticket-80mm { padding:8px 6px; width:100%; } .t-center { text-align:center; } .t-right { text-align:right; }
        .t-bold { font-weight:bold; } .t-small { font-size:10px; } .t-large { font-size:15px; }
        .t-xl { font-size:22px; font-weight:bold; text-align:center; } .t-title { font-size:16px; font-weight:bold; text-align:center; line-height:1.2; }
        .t-subtitle { font-size:11px; text-align:center; } .t-dest-header { background:#000; color:#fff; text-align:center; font-weight:bold; font-size:14px; padding:4px 0; letter-spacing:2px; }
        .t-hr-dash { border:none; border-top:1px dashed #000; margin:5px 0; } .t-hr-solid { border:none; border-top:2px solid #000; margin:5px 0; }
        .t-row { display:flex; justify-content:space-between; gap:4px; } .t-item-row { display:grid; grid-template-columns:3ch 1fr auto; gap:4px; margin-bottom:2px; }
        .t-item-obs { font-style:italic; font-size:10px; padding-left:28px; margin-bottom:3px; } .t-total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; }
        .t-footer { text-align:center; font-size:11px; margin-top:4px; } .t-spacer { height:16px; }
      </style></head><body><div class="ticket-80mm">${contenido}</div>
      <script>window.onload=function(){window.print();window.close();};<\/script></body></html>`;
  }

  return {
    mostrar, mostrarDoble, cerrar, imprimir,
    generarComanda, generarCuenta, generarCierre, generarCierreParcial, testImpresora
  };
})();