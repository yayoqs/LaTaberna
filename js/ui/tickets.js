/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/tickets.js
   Versión: 1.5.0
   Propósito: Generación y visualización de tickets.
              v1.5.0: soporte de opciones (variantes), alergias
                      manuales y precio_unitario en los tickets.
   Dependencias:
     · js/utils.js
     · js/lib/store.js
     · js/lib/logger.js
   ================================================================ */

import { formatearDinero, formatearDineroTicket, formatearHoraCorta, formatearFechaCorta, mostrarToast } from '../utils.js';
import { Store } from '../lib/store.js';
import { Logger } from '../lib/logger.js';

const Tickets = (() => {

  let _ultimoHtml = null;
  let _ultimoTitulo = 'Comprobante';
  const _operacionesMostradas = new Set();

  function _obtenerConfig() {
    const state = Store.obtenerEstado();
    return state.config || {};
  }

  function _formatearOpciones(item) {
    const opciones = Array.isArray(item.opciones) ? item.opciones : [];
    if (opciones.length === 0) return '';
    const nombres = opciones.map(o => (o && o.opcionNombre) || '').filter(n => n);
    if (nombres.length === 0) return '';
    if (nombres.length > 4) {
      return nombres.slice(0, 3).join(' · ') + ' …';
    }
    return nombres.join(' · ');
  }

  function _formatearAlergias(item) {
    const alergias = Array.isArray(item.alergias_manuales) ? item.alergias_manuales : [];
    if (alergias.length === 0) return '';
    return alergias.filter(a => a).join(', ');
  }

  function _precioUnitario(item) {
    if (typeof item.precio_unitario === 'number' && item.precio_unitario > 0) {
      return item.precio_unitario;
    }
    return item.precio || 0;
  }

  function _calcularTotalLocal(items) {
    return (items || []).reduce((s, it) => s + _precioUnitario(it) * (it.qty || 1), 0);
  }

  const Renderer = {
    generarComanda(comanda, destino) {
      const hora  = formatearHoraCorta(Date.now());
      const fecha = formatearFechaCorta();
      let items = (comanda && comanda.items) ? comanda.items : [];
      if (destino === 'cocina') {
        items = items.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
      } else if (destino === 'barra') {
        items = items.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
      }
      if (!items.length) return '';

      const destLabel = destino === 'cocina' ? '*** COCINA ***' : '*** BARRA ***';
      const itemsHTML = items.map(it => {
        const opcionesTxt = _formatearOpciones(it);
        const alergiasTxt = _formatearAlergias(it);
        return `
          <div class="t-item-row t-mb1"><span class="t-bold">${it.qty || 1}x</span><span>${it.nombre || 'Producto'}</span><span></span></div>
          ${opcionesTxt ? `<div class="t-item-ops">${opcionesTxt}</div>` : ''}
          ${it.obs ? `<div class="t-item-sub">→ ${it.obs}</div>` : ''}
          ${alergiasTxt ? `<div class="t-item-alergia">⚠ Alergia: ${alergiasTxt}</div>` : ''}
        `;
      }).join('');

      return `
        <div class="t-dest-header">${destLabel}</div>
        <div class="t-xl t-mb2">MESA ${comanda.mesa || '?'}</div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>${fecha} ${hora}</span><span>Mozo: ${comanda.mozo || '—'}</span></div>
        <hr class="t-hr-dash">
        ${itemsHTML}
        <hr class="t-hr-dash">
        ${comanda.observaciones ? `<div class="t-item-sub t-mb2">Obs: ${comanda.observaciones}</div>` : ''}
        <div class="t-center t-small t-mt2">— COMANDA —</div>
        <div class="t-spacer"></div>
      `;
    },

    generarCuenta(mesa, config) {
      const cfg = config || _obtenerConfig();
      const fecha = formatearFechaCorta();
      const hora = formatearHoraCorta(Date.now());
      const grupos = _agruparItems(mesa.items || []);
      const total = _calcularTotalLocal(mesa.items || []);
      const numTicket = String(Date.now()).slice(-6);

      const itemsHTML = grupos.map(g => {
        const opcionesTxt = _formatearOpciones(g);
        const alergiasTxt = _formatearAlergias(g);
        const nombreConOpciones = opcionesTxt ? `${g.nombre} (${opcionesTxt})` : g.nombre;
        return `
          <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${nombreConOpciones}</span><span>${formatearDineroTicket(_precioUnitario(g) * g.qty)}</span></div>
          ${alergiasTxt ? `<div class="t-item-alergia">⚠ Alergia: ${alergiasTxt}</div>` : ''}
        `;
      }).join('');

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-sub">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-sub">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
        <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">DETALLE DE CONSUMO</div><hr class="t-hr-dash">
        ${itemsHTML}<hr class="t-hr-dash">
        <div class="t-total-row"><span>TOTAL</span><span>${formatearDineroTicket(total)}</span></div>
        <hr class="t-hr-solid"><div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
        <div class="t-footer t-small t-mt2">*** NO ES COMPROBANTE FISCAL ***</div><div class="t-spacer"></div>
      `;
    },

    generarCierre(mesa, totalFinal, descuento, formaPago, config, pagos = []) {
      const cfg = config || _obtenerConfig();
      const fecha = formatearFechaCorta();
      const hora = formatearHoraCorta(Date.now());
      const grupos = _agruparItems(mesa.items || []);
      const subtotal = _calcularTotalLocal(mesa.items || []);
      const numTicket = String(Date.now()).slice(-6);

      const itemsHTML = grupos.map(g => {
        const opcionesTxt = _formatearOpciones(g);
        const alergiasTxt = _formatearAlergias(g);
        const nombreConOpciones = opcionesTxt ? `${g.nombre} (${opcionesTxt})` : g.nombre;
        return `
          <div class="t-item-row t-mb1"><span>${g.qty}x</span><span>${nombreConOpciones}</span><span>${formatearDineroTicket(_precioUnitario(g) * g.qty)}</span></div>
          ${alergiasTxt ? `<div class="t-item-alergia">⚠ Alergia: ${alergiasTxt}</div>` : ''}
        `;
      }).join('');

      const pagosHTML = pagos.length > 0 ? `
        <div class="t-split-title">DIVISIÓN POR PERSONA</div>
        ${pagos.map(p => `
          <div class="t-row t-mb1"><span>${p.persona} · ${p.formaPago || 'Efectivo'}</span><span>${formatearDineroTicket(p.monto)}</span></div>
        `).join('')}
      ` : '';

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-sub">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-sub">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>Mozo: ${mesa.mozo || '—'}</span></div>
        <div class="t-row t-mb1"><span>Comensales: ${mesa.comensales || 1}</span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-solid"><div class="t-center t-bold t-mb1">CIERRE DE MESA</div><hr class="t-hr-dash">
        ${itemsHTML}<hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Subtotal</span><span>${formatearDineroTicket(subtotal)}</span></div>
        ${descuento ? `<div class="t-row t-mb1"><span>Descuento (${descuento}%)</span><span>-${formatearDineroTicket(subtotal * descuento / 100)}</span></div>` : ''}
        <div class="t-total-row"><span>TOTAL</span><span>${formatearDineroTicket(totalFinal)}</span></div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>Forma de pago</span><span>${formaPago || 'Efectivo'}</span></div>
        ${pagosHTML}
        <hr class="t-hr-dash">
        <div class="t-qr"></div>
        <div class="t-footer">Escaneá para calificar tu visita</div>
        <div class="t-footer t-bold">${cfg.pieTicket || '¡Gracias por venir a La Taberna!'}</div>
        <div class="t-footer">*** COMPROBANTE NO FISCAL ***</div><div class="t-spacer"></div>
      `;
    },

    generarCierreParcial(mesa, pago, config) {
      const cfg = config || _obtenerConfig();
      const fecha = formatearFechaCorta();
      const hora = formatearHoraCorta(Date.now());
      const numTicket = String(Date.now()).slice(-6);

      const items = Array.isArray(pago.items) ? pago.items : [];
      const itemsHTML = items.map(it => {
        const opcionesTxt = _formatearOpciones(it);
        const alergiasTxt = _formatearAlergias(it);
        const nombreConOpciones = opcionesTxt ? `${it.nombre} (${opcionesTxt})` : it.nombre;
        return `
          <div class="t-item-row t-mb1"><span>${it.qty || 1}x</span><span>${nombreConOpciones}</span><span>${formatearDineroTicket(_precioUnitario(it) * (it.qty || 1))}</span></div>
          ${alergiasTxt ? `<div class="t-item-alergia">⚠ Alergia: ${alergiasTxt}</div>` : ''}
        `;
      }).join('');

      return `
        <div class="t-title">${cfg.nombreLocal || 'La Taberna'}</div>
        ${cfg.direccion ? `<div class="t-sub">${cfg.direccion}</div>` : ''}
        ${cfg.cuit      ? `<div class="t-sub">CUIT: ${cfg.cuit}</div>` : ''}
        <hr class="t-hr-dash">
        <div class="t-row t-mb1"><span>Fecha: ${fecha}</span><span>Hora: ${hora}</span></div>
        <div class="t-row t-mb1"><span>Mesa: <strong>${mesa.numero || '?'}</strong></span><span>N° ${numTicket}</span></div>
        <hr class="t-hr-dash">
        <div class="t-center t-bold">${pago.persona || 'Persona'}</div>
        ${itemsHTML ? `<hr class="t-hr-dash">${itemsHTML}<hr class="t-hr-dash">` : ''}
        <div class="t-total-row"><span>TOTAL</span><span>${formatearDineroTicket(pago.monto || 0)}</span></div>
        <hr class="t-hr-solid">
        <div class="t-row t-mb1"><span>Forma de pago</span><span>${pago.formaPago || 'Efectivo'}</span></div>
        <div class="t-footer">${cfg.pieTicket || '¡Gracias por visitarnos!'}</div>
        <div class="t-spacer"></div>
      `;
    }
  };

  const Modal = {
    _modals: [],

    mostrar(htmlContent, titulo, opciones = {}) {
      const idOperacion = opciones.idOperacion || null;
      if (idOperacion) {
        if (_operacionesMostradas.has(idOperacion)) {
          Logger.info('[Tickets] Ticket ya mostrado para operación ' + idOperacion + ', se omite.');
          return;
        }
        _operacionesMostradas.add(idOperacion);
      }

      _ultimoHtml = htmlContent;
      _ultimoTitulo = titulo;

      const modalId = 'ticket-modal-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const botonesHTML = this._construirBotones(modalId, opciones);

      modal.innerHTML = `
        <div class="ticket-preview-modal">
          <div class="modal-header">
            <h3><i class="fas fa-print icon-accent"></i> ${titulo}</h3>
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

    cerrar() {
      if (this._modals.length > 0) {
        const lastId = this._modals[this._modals.length - 1];
        const modal = document.getElementById(lastId);
        if (modal) { modal.remove(); this._modals.pop(); }
      }
    },

    _construirBotones(prefix, opciones = {}) {
      let html = '';
      if (typeof opciones.editarCallback === 'function') {
        html += `<button class="btn-secondary" id="${prefix}-editar"><i class="fas fa-pen"></i> ${opciones.textoEditar || 'Editar'}</button>`;
      }
      if (typeof opciones.onExtra === 'function') {
        html += `<button class="btn-primary" id="${prefix}-extra" style="background:var(--color-success); border:none; color:#000;">
                  <i class="fas fa-check-circle"></i> ${opciones.textoExtra || 'Acción'}
                </button>`;
      }
      const textoImprimir = opciones.textoImprimir || 'Imprimir';
      const claseImprimir = opciones.claseImprimir || 'btn-primary';
      html += `<button class="${claseImprimir}" id="${prefix}-imprimir"><i class="fas fa-print"></i> ${textoImprimir}</button>`;
      return html;
    },

    _vincularEventos(prefix, opciones = {}) {
      const closeBtn = document.getElementById(`${prefix}-close`);
      const editBtn = document.getElementById(`${prefix}-editar`);
      const extraBtn = document.getElementById(`${prefix}-extra`);
      const printBtn = document.getElementById(`${prefix}-imprimir`);

      if (closeBtn) {
        closeBtn.onclick = () => {
          const overlay = document.getElementById(prefix);
          if (overlay) overlay.style.display = 'none';
        };
      }

      if (printBtn) {
        printBtn.onclick = async () => {
          if (typeof opciones.onImprimir === 'function') {
            await opciones.onImprimir();
          }
          const contentDiv = document.getElementById(`${prefix}-content`);
          if (!contentDiv) return;
          _imprimirConIframe(contentDiv.innerHTML, 'Comanda');
        };
      }

      if (extraBtn) {
        extraBtn.onclick = async () => {
          if (typeof opciones.onExtra === 'function') {
            await opciones.onExtra();
          }
          const overlay = document.getElementById(prefix);
          if (overlay) overlay.style.display = 'none';
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

  function _agruparItems(items) {
    const map = {};
    (items || []).forEach(it => {
      const opcionesTxt = _formatearOpciones(it);
      const precioUnit = _precioUnitario(it);
      const key = `${it.nombre || ''}||${opcionesTxt}||${precioUnit}`;
      if (!map[key]) {
        map[key] = {
          nombre: it.nombre,
          qty: 0,
          precio: it.precio,
          precio_unitario: it.precio_unitario,
          opciones: it.opciones,
          alergias_manuales: it.alergias_manuales
        };
      }
      map[key].qty += it.qty || 1;
    });
    return Object.values(map);
  }

  function _imprimirConIframe(contenido, titulo) {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; } * { box-sizing:border-box; margin:0; padding:0; }
          body { font-family:"Courier New",monospace; font-size:12px; line-height:1.5; width:80mm; color:#000; background:#fff; }
          .ticket-80mm { padding:8px 6px; width:100%; } .t-center { text-align:center; } .t-right { text-align:right; }
          .t-bold { font-weight:bold; } .t-small { font-size:10px; } .t-large { font-size:15px; }
          .t-xl { font-size:22px; font-weight:bold; text-align:center; } .t-title { font-size:16px; font-weight:bold; text-align:center; line-height:1.2; }
          .t-sub { font-size:10.5px; text-align:center; } .t-dest-header { background:#000; color:#fff; text-align:center; font-weight:bold; font-size:14px; padding:4px 0; letter-spacing:2px; }
          .t-hr-dash { border:none; border-top:1px dashed #000; margin:6px 0; } .t-hr-solid { border:none; border-top:2px solid #000; margin:6px 0; }
          .t-row { display:flex; justify-content:space-between; gap:4px; } .t-item-row { display:grid; grid-template-columns:3ch 1fr auto; gap:4px; margin-bottom:2px; }
          .t-item-sub { grid-column:2 / span 2; font-size:10.5px; color:#555; padding-left:2px; }
          .t-item-ops { font-size:10.5px; padding-left:28px; margin-bottom:3px; }
          .t-item-alergia { font-size:10px; font-weight:bold; padding-left:28px; margin-bottom:3px; }
          .t-total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; }
          .t-footer { text-align:center; font-size:11px; margin-top:5px; } .t-split-title { font-size:11px; font-weight:bold; margin-top:4px; }
          .t-qr { width:70px; height:70px; margin:8px auto; background:repeating-conic-gradient(#000 0% 25%,#fff 0% 50%) 0 0/10px 10px; }
        </style></head><body><div class="ticket-80mm">${contenido}</div></body></html>`);
      iframeDoc.close();

      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          Logger.error('[Tickets] Error al imprimir con iframe:', e);
          mostrarToast('error', 'Error al imprimir el ticket.');
        }
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      };

      setTimeout(() => {
        if (iframe.parentNode) {
          try {
            iframe.contentWindow.print();
          } catch (e) { /* ignorar */ }
          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 1000);
        }
      }, 500);

    } catch (e) {
      Logger.error('[Tickets] Error al crear iframe de impresión:', e);
      mostrarToast('error', 'El navegador no permite imprimir de esta forma. Intente de nuevo.');
    }
  }

  function mostrarUltimo() {
    if (_ultimoHtml) {
      Modal.mostrar(_ultimoHtml, _ultimoTitulo, {
        textoImprimir: 'Imprimir',
        claseImprimir: 'btn-primary',
        onImprimir: () => true
      });
    } else {
      mostrarToast('info', 'Aún no hay ticket generado para reimprimir.');
    }
  }

  return {
    generarComanda: Renderer.generarComanda.bind(Renderer),
    generarCuenta: (mesa, config) => Renderer.generarCuenta(mesa, config),
    generarCierre: (mesa, totalFinal, descuento, formaPago, config, pagos) => Renderer.generarCierre(mesa, totalFinal, descuento, formaPago, config, pagos),
    generarCierreParcial: (mesa, pago, config) => Renderer.generarCierreParcial(mesa, pago, config),
    mostrar: Modal.mostrar.bind(Modal),
    mostrarDoble: Modal.mostrarDoble.bind(Modal),
    cerrar: Modal.cerrar.bind(Modal),
    mostrarUltimo,
    imprimir: () => Logger.warn('[Tickets] imprimir() obsoleto')
  };
})();

export { Tickets };