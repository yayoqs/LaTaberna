/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/mesa-detalles.js
   Versión: 2.0.6
   Propósito: Panel de detalle de la mesa. Centro de operaciones.
              Sin onclick. Comunicación vía EventBus.
              Desacoplado de Pedido y PrecargaControl.
   Dependencias: Store, EventBus, Logger, Mesas, Cuenta, Cobro
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Mesas } from './mesas.js';
import { Cuenta } from './cuenta.js';
import { Cobro } from './cobro.js';

const MesaDetalles = (() => {

  let _panelVisible = false;

  function _asegurarModal() {
    if (document.getElementById('modalMesaDetalles')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modalMesaDetalles';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="mesa-detalles-card">
        <div class="md-fondo"></div>
        <div class="md-contenido">
          <div class="md-header">
            <div class="md-mesa-info">
              <h2 id="mdTitulo">Mesa</h2>
              <span class="badge-estado libre" id="mdEstado">LIBRE</span>
            </div>
            <button class="md-cerrar" id="btnCerrarMesaDetalles">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="md-datos" id="mdDatos"></div>
          <div class="md-atencion" id="mdAtencion" style="display:none;"></div>
          <div class="md-acciones" id="mdAcciones"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnCerrarMesaDetalles').addEventListener('click', cerrar);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) cerrar();
    });

    document.getElementById('mdAcciones').addEventListener('click', function(e) {
      const actionCard = e.target.closest('.action-card');
      if (!actionCard) return;

      if (actionCard.classList.contains('primaria')) {
        const mesa = MesaDetalles._mesaActual;
        if (mesa && mesa.estado === 'libre') {
          cerrar();
          EventBus.emit('mesa:abrir_desde_detalle', { mesa: mesa.numero });
        } else {
          cerrar();
          EventBus.emit('mesa:tomar_pedido', { mesa: mesa.numero });
        }
      } else if (actionCard.classList.contains('verde')) {
        pedirCuenta();
      } else if (actionCard.classList.contains('roja')) {
        cerrarMesa();
      }
    });

    document.getElementById('mdAtencion').addEventListener('click', function(e) {
      const btnAtender = e.target.closest('.btn-atender');
      if (!btnAtender) return;

      if (btnAtender.classList.contains('precarga')) {
        const precargaId = btnAtender.dataset.precargaId;
        if (precargaId) cargarPrecarga(precargaId);
      } else {
        const numMesa = btnAtender.dataset.numMesa;
        if (numMesa) aceptarVinculacion(numMesa);
      }
    });
  }

  function _htmlDatos(mesa) {
    const mozo = mesa.mozo || 'Sin asignar';
    const comensales = mesa.comensales || '—';
    const zona = mesa.zona || 'Salón';
    let tiempo = '—';
    if (mesa.abiertaEn) {
      const min = Math.floor((Date.now() - mesa.abiertaEn) / 60000);
      tiempo = min === 0 ? 'Ahora' : `Hace ${min} min`;
    }
    return `
      <div class="md-dato"><span class="md-dato-label">Mozo</span><span class="md-dato-valor">${mozo}</span></div>
      <div class="md-dato"><span class="md-dato-label">Comensales</span><span class="md-dato-valor">${comensales}</span></div>
      <div class="md-dato"><span class="md-dato-label">Zona</span><span class="md-dato-valor">${zona}</span></div>
      <div class="md-dato"><span class="md-dato-label">Abierta hace</span><span class="md-dato-valor">${tiempo}</span></div>`;
  }

  function _htmlAcciones(mesa) {
    if (mesa.estado === 'pagada') {
      return `<div style="text-align:center; padding:16px; color:var(--color-text-sec);">
        <i class="fas fa-check-circle" style="font-size:24px; color:#10b981; display:block; margin-bottom:8px;"></i>
        <p style="font-size:14px; font-weight:600; color:#10b981;">Mesa pagada</p>
        <p style="font-size:12px; color:var(--color-text-muted);">Esperando liberación por el cajero</p></div>`;
    }
    if (mesa.estado === 'cuenta') {
      return `<div class="action-card roja"><div class="action-icon"><i class="fas fa-check-circle"></i></div><div class="action-details"><h4>Cerrar Mesa</h4><p>Procesar pago y liberar</p></div></div>`;
    }
    const libre = mesa.estado === 'libre';
    let html = '';
    if (libre) {
      html += `<div class="action-card primaria"><div class="action-icon"><i class="fas fa-door-open"></i></div><div class="action-details"><h4>Abrir Mesa</h4><p>Asignar mozo y comensales</p></div></div>`;
    } else {
      html += `<div class="action-card primaria"><div class="action-icon"><i class="fas fa-utensils"></i></div><div class="action-details"><h4>Tomar Pedido</h4><p>Agregar ítems a la comanda</p></div></div>`;
    }
    html += `<div class="action-card verde"><div class="action-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="action-details"><h4>Pedir Cuenta</h4><p>Generar pre-cuenta para la mesa</p></div></div>`;
    html += `<div class="action-card roja"><div class="action-icon"><i class="fas fa-check-circle"></i></div><div class="action-details"><h4>Cerrar Mesa</h4><p>Procesar pago y liberar</p></div></div>`;
    return html;
  }

  function abrir(numMesa) {
    _asegurarModal();
    const mesas = Store.getState().mesas || [];
    const mesa = mesas.find(m => m.numero == numMesa);
    if (!mesa) { Logger.warn('[MesaDetalles] Mesa no encontrada:', numMesa); return; }

    document.getElementById('mdTitulo').textContent = mesa.esVirtual ? `Mesas ${mesa.mesasFusionadas.join(' + ')}` : `Mesa ${mesa.numero}`;
    const badge = document.getElementById('mdEstado');
    badge.textContent = Mesas.labelEstado(mesa.estado);
    badge.className = `badge-estado ${mesa.estado}`;

    document.getElementById('mdDatos').innerHTML = _htmlDatos(mesa);

    const seccionAtencion = document.getElementById('mdAtencion');
    const infoAtencion = Mesas.getBadgeAtencion(numMesa);
    if (infoAtencion) {
      if (infoAtencion.tipo === 'esperando') {
        seccionAtencion.style.display = 'block';
        seccionAtencion.className = 'md-atencion';
        seccionAtencion.innerHTML = `<div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div><div class="atencion-texto"><strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere unirse a la Mesa ${numMesa}</div><button class="btn-atender" data-num-mesa="${numMesa}">Aceptar</button>`;
      } else if (infoAtencion.tipo === 'precarga') {
        seccionAtencion.style.display = 'block';
        seccionAtencion.className = 'md-atencion precarga';
        seccionAtencion.innerHTML = `<div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div><div class="atencion-texto"><strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere añadir un pedido a la Mesa ${numMesa}</div><button class="btn-atender precarga" data-precarga-id="${infoAtencion.precargaId}">Cargar Pedido</button>`;
      } else { seccionAtencion.style.display = 'none'; }
    } else { seccionAtencion.style.display = 'none'; }

    document.getElementById('mdAcciones').innerHTML = _htmlAcciones(mesa);
    MesaDetalles._mesaActual = mesa;
    document.getElementById('modalMesaDetalles').style.display = 'flex';
    _panelVisible = true;
    EventBus.emit('mesa-detalle:abierto');
  }

  function cerrar() {
    const overlay = document.getElementById('modalMesaDetalles');
    if (overlay) overlay.style.display = 'none';
    _panelVisible = false;
    EventBus.emit('mesa-detalle:cerrado');
  }

  function pedirCuenta() { cerrar(); if (Cuenta && Cuenta.pedirCuenta) Cuenta.pedirCuenta(); }
  function cerrarMesa() { cerrar(); if (Cobro && Cobro.abrirModalCierre) Cobro.abrirModalCierre(); }

  function aceptarVinculacion(numMesa) {
    cerrar();
    EventBus.emit('mesa:abrir_desde_detalle', { mesa: numMesa });
    Mesas.clearBadgeAtencion(numMesa);
  }

  function cargarPrecarga(precargaId) {
    EventBus.emit('precarga:cargar_en_comanda', {
      precargaId,
      mesa: MesaDetalles._mesaActual ? MesaDetalles._mesaActual.numero : null
    });
    cerrar();
  }

  // Suscribirse al evento que activa el panel
  EventBus.on('mesa:seleccionada', (numMesa) => {
    if (_panelVisible) return;
    abrir(numMesa);
  });

  Logger.info('[MesaDetalles] Módulo inicializado (ES6 v2.0.6).');

  return { abrir, cerrar, pedirCuenta, cerrarMesa, aceptarVinculacion, cargarPrecarga, _mesaActual: null };
})();

export { MesaDetalles };