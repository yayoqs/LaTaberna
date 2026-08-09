/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/pedido-ui.js
   Versión: 2.2.3
   Propósito: Modal de pedido. Corrección NC1: invoca Comanda.activar()
              antes de usar los listeners de comanda.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';
import { Mesas } from './mesas.js';
import { Comanda } from './comanda.js';
import { Carta } from './carta.js';
import { Cuenta } from './cuenta.js';
import { Cobro } from './cobro.js';
import { Tickets } from './tickets.js';
import { Auth } from '../auth.js';
import { mesaVacia } from '../db-core.js';
import { mostrarToast, $id, mostrarEntrada } from '../utils.js';

const Pedido = (() => {
  let _comandasEnviadas = {};
  let _panelDetalleAbierto = false;

  function _asegurarModalPedido() {
    if ($id('modalPedido')) return;
    const modal = document.createElement('div');
    modal.id = 'modalPedido';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-pedido">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-chair"></i><span id="modalMesaTitulo">Mesa</span><span class="estado-badge" id="modalEstadoBadge">Libre</span></div>
          <button class="btn-icon" data-action="mostrarSelectorTransferencia" title="Cambiar Mesa" style="background:transparent; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:6px 12px; color:var(--color-text-sec); margin-right:8px;" data-rol="admin,master"><i class="fas fa-exchange-alt"></i> Cambiar Mesa</button>
          <button class="modal-close" data-action="cerrar" aria-label="Cerrar" style="margin-left: auto;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <section class="carta-panel"><div class="carta-search"><i class="fas fa-search"></i><input type="text" id="searchProducto" placeholder="Buscar producto..." autocomplete="off"></div><div class="categorias-tabs" id="categoriasTabs"></div><div id="cartaProductos" class="carta-productos"></div></section>
          <section class="comanda-panel">
            <div class="comanda-header"><div class="comanda-meta"><span><i class="fas fa-user-tie"></i><select id="comandaMozo"></select></span><span><i class="fas fa-users"></i><input type="number" id="comandaComensales" value="2" min="1" max="20"> pax</span></div><div id="personaActivaContainer" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;"></div></div>
            <div id="comandaItems" class="comanda-items"></div>
            <div class="comanda-obs"><input type="text" id="comandaObs" placeholder="Observaciones generales..."></div>
            <div class="comanda-footer">
              <div class="comanda-total"><span>Subtotal</span><span class="total-monto" id="subtotalDisplay">$0</span></div>
              <div class="comanda-actions"><button class="btn-comanda btn-todo" data-action="revisarComanda" style="grid-column:span 3;"><i class="fas fa-check-double"></i> Revisar Comandas</button></div>
              <div class="comanda-actions-2"><button class="btn-cuenta" data-action="pedirCuenta" data-rol="mesero,admin,master,caja"><i class="fas fa-file-invoice-dollar"></i> Pedir Cuenta</button><button class="btn-cerrar-mesa" data-action="cerrarMesa" data-rol="caja,admin,master"><i class="fas fa-check-circle"></i> Cerrar Mesa</button></div>
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      switch (btn.dataset.action) {
        case 'cerrar': cerrar(); break;
        case 'pedirCuenta': pedirCuenta(); break;
        case 'cerrarMesa': cerrarMesa(); break;
        case 'mostrarSelectorTransferencia': mostrarSelectorTransferencia(); break;
        case 'revisarComanda': revisarComanda(); break;
      }
    });

    $id('searchProducto').addEventListener('input', () => Carta.filtrar());
    $id('comandaMozo').addEventListener('change', function() { Comanda.establecerMozo(this.value); });
    $id('comandaComensales').addEventListener('change', function() { Comanda.establecerComensales(this.value); });
    $id('comandaObs').addEventListener('input', function() { Comanda.establecerObservacionGeneral(this.value); });
  }

  function _abrirModalPedido(mesa) {
    _asegurarModalPedido();
    // NC1: Activar los listeners de Comanda antes de usarlos
    Comanda.activar();
    document.getElementById('modalMesaTitulo').textContent = mesa.esVirtual ? 'Mesas ' + mesa.mesasFusionadas.join(', ') : 'Mesa ' + mesa.numero;
    const badge = document.getElementById('modalEstadoBadge');
    badge.textContent = Mesas.labelEstado(mesa.estado);
    badge.className = 'estado-badge ' + mesa.estado;
    Carta.activar();
    EventBus.emit('mesa:abierta', mesa);
    Carta.render();
    $id('modalPedido').style.display = 'flex';
  }

  function abrirMesa(num) {
    if (_panelDetalleAbierto) return;
    const mesa = (Store.obtenerEstado().mesas || []).find(m => m.numero == num);
    if (!mesa) { Logger.error('[Pedido] Mesa no encontrada:', num); return; }
    _abrirModalPedido(mesa);
  }

  function cerrar() {
    Carta.limpiar();
    const modal = $id('modalPedido');
    if (modal) modal.style.display = 'none';
    const mesa = Comanda.obtenerMesaActiva();
    const pedido = Comanda.obtenerPedidoActivo();
    if (mesa && mesa.estado === 'libre' && (!pedido || !pedido.items || pedido.items.length === 0)) {
      if (mesa.esVirtual) {
        DB.liberarMesasFusionadas(mesa);
      } else {
        const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
        if (idx >= 0) { DB.mesas[idx] = mesaVacia(mesa.numero); try { DB.saveMesas(); } catch (e) { Logger.error('[Pedido] Error al guardar:', e); } }
        EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
        Mesas.render();
      }
    }
    _comandasEnviadas = {};
    EventBus.emit('mesa:cerrada');
  }

  async function revisarComanda() {
    const mesa = Comanda.obtenerMesaActiva();
    if (!mesa) { mostrarToast('warning', 'No hay mesa activa.'); return; }
    const pedido = Comanda.obtenerPedidoActivo();
    const pendientes = (pedido?.items || []).filter(it => !it.enviado);
    if (pendientes.length) { _mostrarRevisarPendientes(mesa, pendientes); return; }
    const comandasMesa = (Store.obtenerEstado().comandas || []).filter(c => c.mesa == mesa.numero);
    if (comandasMesa.length) { _mostrarReimprimir(comandasMesa); return; }
    mostrarToast('warning', 'No hay comandas para revisar.');
  }

  async function _ejecutarEnvioComanda(mesa, pendientes, overrideStock) {
    const pedido = Comanda.obtenerPedidoActivo();
    if (pedido) {
      pedido.mozo = document.getElementById('comandaMozo')?.value || pedido.mozo;
      pedido.comensales = parseInt(document.getElementById('comandaComensales')?.value) || pedido.comensales;
      pedido.observaciones = document.getElementById('comandaObs')?.value || pedido.observaciones;
    }
    try {
      return await CommandBus.ejecutar({
        type: 'enviarComanda',
        datos: { mesa, mozo: pedido?.mozo, comensales: pedido?.comensales, observaciones: pedido?.observaciones || '', itemsPendientes: pendientes, overrideStock }
      });
    } catch (e) { return { exito: false, error: e.message }; }
  }

  function _mostrarRevisarPendientes(mesa, pendientes) {
    function crearOpciones(comandaTemp) {
      const yaEnviada = !!_comandasEnviadas[comandaTemp.id];
      return {
        textoEditar: 'Editar', editarCallback: (html) => _editarComandaCallback(comandaTemp, html),
        textoImprimir: yaEnviada ? 'Reimprimir' : 'Enviar e Imprimir', claseImprimir: yaEnviada ? 'btn-secondary' : 'btn-print', esReimpresion: yaEnviada,
        onImprimir: async () => {
          if (!yaEnviada) {
            try {
              const res = await _ejecutarEnvioComanda(mesa, pendientes);
              if (!res.exito) { mostrarToast('error', res.error?.message || 'Error'); return false; }
              _comandasEnviadas[comandaTemp.id] = true;
              mostrarToast('success', 'Comanda(s) enviada(s)'); Comanda.render(); Mesas.render();
              return true;
            } catch (e) { return false; }
          }
          return true;
        }
      };
    }
    function crearComandaTemp(items, destino) { return { id: 'temp_' + Date.now(), mesa: mesa.numero, mozo: mesa.mozo, destino, items, estado: 'nueva', ts: Date.now() }; }
    const cocina = pendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barra = pendientes.filter(it => it.destino === 'barra' || it.destino === 'ambos');
    if (cocina.length && barra.length) Tickets.mostrarDoble(Tickets.generarComanda(crearComandaTemp(cocina, 'cocina'), 'cocina'), 'Cocina', crearOpciones(crearComandaTemp(cocina, 'cocina')), Tickets.generarComanda(crearComandaTemp(barra, 'barra'), 'barra'), 'Barra', crearOpciones(crearComandaTemp(barra, 'barra')));
    else if (cocina.length) Tickets.mostrar(Tickets.generarComanda(crearComandaTemp(cocina, 'cocina'), 'cocina'), 'Cocina — Mesa ' + mesa.numero, crearOpciones(crearComandaTemp(cocina, 'cocina')));
    else if (barra.length) Tickets.mostrar(Tickets.generarComanda(crearComandaTemp(barra, 'barra'), 'barra'), 'Barra — Mesa ' + mesa.numero, crearOpciones(crearComandaTemp(barra, 'barra')));
  }

  function _mostrarDialogoStockInsuficiente(mesa, pendientes, faltantes, mensaje) {
    const itemsList = faltantes.map(f => {
      return '<li>' + f.insumo + ' — Faltan ' + f.faltante + ' ' + f.unidad + ' (Stock: ' + f.stockActual + ')</li>';
    }).join('');

    const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.style.display = 'flex';
    overlay.innerHTML = `<div class="modal-small" style="max-width:480px;"><div class="modal-header"><h3><i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i> Stock Insuficiente</h3><button class="modal-close" id="stockClose"><i class="fas fa-times"></i></button></div><div class="modal-small-body"><p>${mensaje}</p><ul>${itemsList}</ul><div class="modal-small-footer"><button class="btn-secondary" id="stockCancel">Cancelar</button><button class="btn-primary" id="stockForce" style="background:var(--color-warning); color:#000;"><i class="fas fa-exclamation-circle"></i> Enviar igual</button></div></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('stockClose').onclick = document.getElementById('stockCancel').onclick = () => overlay.remove();
    document.getElementById('stockForce').onclick = async () => { overlay.remove(); const res = await _ejecutarEnvioComanda(mesa, pendientes, true); if (res.exito) { mostrarToast('success', 'Comanda(s) enviada(s) (stock ignorado)'); Comanda.render(); Mesas.render(); } else mostrarToast('error', 'Error al enviar comanda.'); };
  }

  function _mostrarReimprimir(comandas) {
    comandas.forEach(c => Tickets.mostrar(Tickets.generarComanda(c, c.destino), (c.destino === 'cocina' ? 'Cocina' : 'Barra') + ' — Mesa ' + c.mesa, { textoEditar: 'Editar', editarCallback: (html) => _editarComandaCallback(c, html), textoImprimir: 'Reimprimir', claseImprimir: 'btn-secondary', esReimpresion: true, onImprimir: () => true }));
  }

  async function _editarComandaCallback(comanda, htmlActual) {
    if (!comanda) return htmlActual;
    const nota = await mostrarEntrada('Comentario de comanda', 'Agregar comentario:', { placeholder: 'Ej: Sin sal', valorPredefinido: comanda.observaciones || '' });
    if (nota !== null && nota !== undefined) { comanda.observaciones = nota; return Tickets.generarComanda(comanda, comanda.destino); }
    return htmlActual;
  }

  function transferirMesa(origen, destino) {
    if (!Auth.esAdmin()) return mostrarToast('error', 'Solo administradores pueden transferir pedidos');
    const mesas = Store.obtenerEstado().mesas || [];
    const mOrigen = mesas.find(m => m.numero == origen), mDestino = mesas.find(m => m.numero == destino);
    if (!mOrigen || !mDestino) return mostrarToast('error', 'Una de las mesas no existe.');
    if (mDestino.estado !== 'libre') return mostrarToast('error', 'Mesa destino no está libre.');
    const dbDestino = DB.mesas.find(m => m.numero == destino), dbOrigen = DB.mesas.find(m => m.numero == origen);
    if (dbDestino && dbOrigen) {
      dbDestino.estado = dbOrigen.estado; dbDestino.pedidoId = dbOrigen.pedidoId;
      const pedido = DB.pedidos.find(p => p.id === dbOrigen.pedidoId);
      if (pedido) { pedido.mesa = destino; DB.savePedidos(); }
      const idx = DB.mesas.findIndex(m => m.numero === origen);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(origen);
      try { DB.saveMesas(); } catch (e) { Logger.error('[Pedido] Error al guardar transferencia:', e); }
    }
    Store.despachar({ type: 'MESA_ACTUALIZAR', payload: { numero: destino, cambios: { estado: mOrigen.estado, pedidoId: mOrigen.pedidoId } } });
    Store.despachar({ type: 'MESA_ACTUALIZAR', payload: { numero: origen, cambios: { estado: 'libre', pedidoId: null } } });
    EventBus.emit('mesa:actualizada', { mesa: origen, estado: 'libre' });
    EventBus.emit('mesa:actualizada', { mesa: destino, estado: mOrigen.estado });
    Mesas.render();
    if (Comanda.obtenerMesaActiva()?.numero === origen) abrirMesa(destino);
    mostrarToast('success', `Pedido transferido de Mesa ${origen} a Mesa ${destino}`);
  }

  async function mostrarSelectorTransferencia() {
    const mesaActual = Comanda.obtenerMesaActiva();
    if (!mesaActual) return mostrarToast('warning', 'No hay mesa activa.');
    const libres = (Store.obtenerEstado().mesas || []).filter(m => m.estado === 'libre' && !m.esVirtual && m.numero !== mesaActual.numero);
    if (!libres.length) return mostrarToast('info', 'No hay mesas libres.');
    const destinoStr = await mostrarEntrada('Transferir Mesa', `Mesas libres: ${libres.map(m => m.numero).join(', ')}\nIngresa el número de mesa destino:`, { placeholder: 'Número de mesa' });
    if (destinoStr) { const num = parseInt(destinoStr); if (!isNaN(num)) transferirMesa(mesaActual.numero, num); else mostrarToast('error', 'Número inválido.'); }
  }

  function pedirCuenta() { Cuenta.pedirCuenta(); }
  function cerrarMesa() { Cobro.abrirModalCierre(); }
  function _establecerCat(cat) { Carta.establecerCategoria(cat); }
  function filtrarProductos() { Carta.filtrar(); }
  function actualizarObsGeneral(valor) { Comanda.establecerObservacionGeneral(valor); }

  EventBus.on('mesa-detalle:abierto', () => _panelDetalleAbierto = true);
  EventBus.on('mesa-detalle:cerrado', () => _panelDetalleAbierto = false);
  EventBus.on('mesa:tomar_pedido', (data) => abrirMesa(data.mesa));
  EventBus.on('pago:confirmado', () => cerrar());

  return { abrirMesa, cerrar, revisarComanda, transferirMesa, mostrarSelectorTransferencia, pedirCuenta, cerrarMesa, _establecerCat, filtrarProductos, actualizarObsGeneral };
})();

export { Pedido };