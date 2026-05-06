/* ================================================================
   PubPOS — MÓDULO: tickets.js (v4.1 – fixes de undefined y defaults)
   Propósito: Renderizado de tickets y gestión de modales de impresión.
              Ahora todos los generadores usan valores por defecto para
              evitar que aparezca "undefined" en los comprobantes.
              También se asegura que los parámetros numéricos sean válidos.
   ================================================================ */
const Tickets = (() => {

  /* ═══════════════════════════════════════════════════════════
     RENDERER: genera HTML de tickets (puro, sin interacción con DOM)
     ═══════════════════════════════════════════════════════════ */
  const Renderer = {
    /**
     * Genera el HTML de una comanda para cocina o barra.
     * @param {object} comanda - { id, mesa, mozo, destino, items, observaciones, ts }
     * @param {'cocina'|'barra'} destino - destino para filtrar items
     * @returns {string} HTML del ticket
     */
    generarComanda(comanda, destino) {
      const hora  = fmtHoraCorta(Date.now());
      const fecha = fmtFechaCorta();
      let items = (comanda && comanda.items) ? comanda.items : [];
      if (destino === 'cocina') {
        items = items.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
      } else if (destino === 'barra') {
        items = items.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
      }
      if (!items.length) return '';

      const destLabel = destino === 'cocina' ? '*** COCINA ***' : '*** BARRA ***';
      const itemsHTML = items.map(it => `
        <div class="t-item-row t-mb1"><span class="t-bold">${it.qty || 1}x</span><span>${it.nombre || 'Producto'}</span><span></span></div>
        ${it.obs ? `<div class="t-item-obs">→ ${it.obs}</div>` : ''}
      `).join('');

      return `
        <div class="t-dest-header">${destLabel}</div>
        <div class="t-xl t-mb2">MESA ${comanda.mesa || '?'}</div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>${fecha} ${hora}</span><span>Mozo: ${comanda.mozo || '—'}</span></div>
        <hr class="t-hr-dash">
        ${itemsHTML}
        <hr class="t-hr-dash">
        ${comanda.observaciones ? `<div class="t-item-obs t-mb2">Obs: ${comanda.observaciones}</div>` : ''}
        <div class="t-center t-small t-mt2">— COMANDA —</div>
        <div class="t-spacer"></div>
      `;
    },

    /**
     * Genera el HTML de una pre‑cuenta (cuenta sin pago).
     * @param {object} mesa - datos de la mesa
     * @param {object} config - configuración del local { nombreLocal, direccion, cuit, pieTicket }
     * @returns {string} HTML del ticket
     */
    generarCuenta(mesa, config) {
      const cfg = config || {};
      const fecha = fmtFechaCorta();
      const hora = fmtHoraCorta(Date.now());
      const grupos = _agruparItems(mesa.items || []);
      const total = calcularTotal(mesa.items || []);
      const numTicket = String(Date.now()).slice(-6);

      const itemsHTML = grupos.map(g => `
        <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${g.nombre}</span><span>${fmtMoneyTicket(g.precio * g.qty)}</span></div>
      `).join('');

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
        <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">DETALLE DE CONSUMO</div><hr class="t-hr-dash">
        ${itemsHTML}<hr class="t-hr-dash">
        <div class="t-total-row"><span>TOTAL</span><span>${fmtMoneyTicket(total)}</span></div>
        <hr class="t-hr-solid"><div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
        <div class="t-footer t-small t-mt2">*** NO ES COMPROBANTE FISCAL ***</div><div class="t-spacer"></div>
      `;
    },

    /**
     * Genera el HTML de un comprobante de cierre de mesa.
     * @param {object} mesa - datos de la mesa
     * @param {number} totalFinal - monto total cobrado
     * @param {number} descuento - porcentaje de descuento aplicado
     * @param {string} formaPago - método de pago
     * @param {object} config - configuración del local
     * @returns {string} HTML del ticket
     */
    generarCierre(mesa, totalFinal, descuento, formaPago, config) {
      const cfg = config || {};
      const fecha = fmtFechaCorta();
      const hora = fmtHoraCorta(Date.now());
      const grupos = _agruparItems(mesa.items || []);
      const subtotal = calcularTotal(mesa.items || []);
      const numTicket = String(Date.now()).slice(-6);

      const itemsHTML = grupos.map(g => `
        <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${g.nombre}</span><span>${fmtMoneyTicket(g.precio * g.qty)}</span></div>
      `).join('');

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
        <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">CIERRE DE MESA</div><hr class="t-hr-dash">
        ${itemsHTML}<hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Subtotal</span><span>${fmtMoneyTicket(subtotal)}</span></div>
        ${descuento ? `<div class="t-row t-mb1"><span>Descuento (${descuento}%)</span><span>-${fmtMoneyTicket(subtotal * descuento / 100)}</span></div>` : ''}
        <div class="t-total-row"><span>TOTAL</span><span>${fmtMoneyTicket(totalFinal)}</span></div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>Forma de pago</span><span>${formaPago || 'Efectivo'}</span></div>
        <div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
        <div class="t-footer t-small t-mt2">*** COMPROBANTE NO FISCAL ***</div><div class="t-spacer"></div>
      `;
    },

    /**
     * Genera el HTML de un comprobante parcial (split bill).
     * @param {object} mesa - datos de la mesa
     * @param {object} pago - { persona, monto, formaPago }
     * @param {object} config - configuración del local
     * @returns {string} HTML del ticket
     */
    generarCierreParcial(mesa, pago, config) {
      const cfg = config || {};
      const fecha = fmtFechaCorta();
      const hora = fmtHoraCorta(Date.now());
      const numTicket = String(Date.now()).slice(-6);

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-subtitle">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-subtitle">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-dash">
        <div class="t-center t-bold">${pago.persona || 'Persona'}</div>
        <div class="t-total-row"><span>TOTAL</span><span>${fmtMoneyTicket(pago.monto || 0)}</span></div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>Forma de pago</span><span>${pago.formaPago || 'Efectivo'}</span></div>
        <div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
        <div class="t-spacer"></div>
      `;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     MODAL: gestiona la vista previa y la impresión (UI)
     ═══════════════════════════════════════════════════════════ */
  const Modal = {
    _modals: [],

    /**
     * Muestra un ticket en un modal con opciones (editar, imprimir).
     * @param {string} htmlContent - HTML del ticket
     * @param {string} titulo - título de la ventana
     * @param {object} [opciones] - { textoEditar, editarCallback }
     */
    mostrar(htmlContent, titulo, opciones = {}) {
      const modalId = 'ticket-modal-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const botonesHTML = this._construirBotones(modalId, opciones);

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
      this._modals.push(modalId);
      this._vincularEventos(modalId, opciones);
    },

    /**
     * Muestra dos tickets lado a lado (ej. cocina + barra) con edición independiente.
     */
    mostrarDoble(htmlIzquierda, tituloIzquierda, opcionesIzquierda, htmlDerecha, tituloDerecha, opcionesDerecha) {
      const modalId = 'ticket-dual-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const idIzq = modalId + '-izq';
      const idDer = modalId + '-der';

      const botonesIzq = this._construirBotones(idIzq, opcionesIzquierda);
      const botonesDer = this._construirBotones(idDer, opcionesDerecha);

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
      this._modals.push(modalId);

      this._vincularEventos(idIzq, opcionesIzquierda);
      this._vincularEventos(idDer, opcionesDerecha);

      document.getElementById(`${modalId}-close`).onclick = () => {
        modal.remove();
        this._modals = this._modals.filter(id => id !== modalId);
        if (typeof opcionesIzquierda.cancelCallback === 'function') opcionesIzquierda.cancelCallback();
        if (typeof opcionesDerecha.cancelCallback === 'function') opcionesDerecha.cancelCallback();
      };
    },

    /** Cierra el último modal abierto */
    cerrar() {
      if (this._modals.length > 0) {
        const lastId = this._modals[this._modals.length - 1];
        const modal = document.getElementById(lastId);
        if (modal) { modal.remove(); this._modals.pop(); }
      }
    },

    /* ── INTERNOS ────────────────────────────────────────── */
    _construirBotones(prefix, opciones = {}) {
      let html = '';
      if (typeof opciones.editarCallback === 'function') {
        html += `<button class="btn-secondary" id="${prefix}-editar"><i class="fas fa-pen"></i> ${opciones.textoEditar || 'Editar'}</button>`;
      }
      html += `<button class="btn-print" id="${prefix}-imprimir"><i class="fas fa-print"></i> Imprimir</button>`;
      return html;
    },

    _vincularEventos(prefix, opciones = {}) {
      const closeBtn = document.getElementById(`${prefix}-close`);
      const editBtn = document.getElementById(`${prefix}-editar`);
      const printBtn = document.getElementById(`${prefix}-imprimir`);

      if (closeBtn) {
        closeBtn.onclick = () => {
          const overlay = document.getElementById(prefix);
          if (overlay) overlay.style.display = 'none';
        };
      }

      if (printBtn) {
        printBtn.onclick = () => {
          const contentDiv = document.getElementById(`${prefix}-content`);
          if (!contentDiv) return;
          _imprimirEnVentana(contentDiv.innerHTML, 'Comanda');
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
  };

  /* ═══════════════════════════════════════════════════════════
     FUNCIONES AUXILIARES (privadas)
     ═══════════════════════════════════════════════════════════ */

  /** Agrupa ítems por nombre para el ticket */
  function _agruparItems(items) {
    const map = {};
    (items || []).forEach(it => {
      if (!map[it.nombre]) map[it.nombre] = { nombre: it.nombre, qty: 0, precio: it.precio };
      map[it.nombre].qty += it.qty;
    });
    return Object.values(map);
  }

  /** Abre una ventana nueva y dispara la impresión del ticket */
  function _imprimirEnVentana(contenido, titulo) {
    const win = window.open('', '_blank', 'width=420,height=680');
    if (!win) {
      showToast('error', 'El navegador bloqueó la ventana emergente.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
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
      <script>window.onload=function(){window.print();window.close();};<\/script></body></html>`);
    win.document.close();
  }

  /* ═══════════════════════════════════════════════════════════
     API PÚBLICA (compatibilidad hacia atrás)
     ═══════════════════════════════════════════════════════════ */
  return {
    // Renderer (puro)
    generarComanda: Renderer.generarComanda.bind(Renderer),
    generarCuenta: (mesa) => Renderer.generarCuenta(mesa, DB.config),
    generarCierre: (mesa, totalFinal, descuento, formaPago) => Renderer.generarCierre(mesa, totalFinal, descuento, formaPago, DB.config),
    generarCierreParcial: (mesa, pago) => Renderer.generarCierreParcial(mesa, pago, DB.config),

    // Modal (UI)
    mostrar: Modal.mostrar.bind(Modal),
    mostrarDoble: Modal.mostrarDoble.bind(Modal),
    cerrar: Modal.cerrar.bind(Modal),

    // Mantenido por compatibilidad (obsoleto, no usado)
    imprimir: () => Logger.warn('[Tickets] imprimir() obsoleto, usa los botones de cada modal.')
  };
})();

window.Tickets = Tickets;