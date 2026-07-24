/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/pedido-ui.js
   Versión: 2.1.7
   Propósito: Modal de pedido, revisar comandas, validación de stock.
              Migración a Store como fuente de verdad y
              reemplazo de prompt por mostrarEntrada.
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
          <div class="modal-title">
            <i class="fas fa-chair"></i>
            <span id="modalMesaTitulo">Mesa 1</span>
            <span class="estado-badge" id="modalEstadoBadge">Libre</span>
          </div>
          <button class="btn-icon" data-action="mostrarSelectorTransferencia" title="Cambiar Mesa" style="background:transparent; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:6px 12px; color:var(--color-text-sec); margin-right:8px;" data-rol="admin,master">
            <i class="fas fa-exchange-alt"></i> Cambiar Mesa
          </button>
          <button class="modal-close" data-action="cerrar" aria-label="Cerrar" style="margin-left: auto;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <section class="carta-panel">
            <div class="carta-search"><i class="fas fa-search"></i><input type="text" id="searchProducto" placeholder="Buscar producto..." autocomplete="off"></div>
            <div class="categorias-tabs" id="categoriasTabs"></div>
            <div id="cartaProductos" class="carta-productos"></div>
          </section>
          <section class="comanda-panel">
            <div class="comanda-header">
              <div class="comanda-meta">
                <span><i class="fas fa-user-tie"></i><select id="comandaMozo"></select></span>
                <span><i class="fas fa-users"></i><input type="number" id="comandaComensales" value="2" min="1" max="20"> pax</span>
              </div>
              <div id="personaActivaContainer" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;"></div>
            </div>
            <div id="comandaItems" class="comanda-items"></div>
            <div class="comanda-obs"><input type="text" id="comandaObs" placeholder="Observaciones generales..."></div>
            <div class="comanda-footer">
              <div class="comanda-total"><span>Subtotal</span><span class="total-monto" id="subtotalDisplay">$0</span></div>
              <div class="comanda-actions">
                <button class="btn-comanda btn-todo" data-action="revisarComanda" style="grid-column:span 3;">
                  <i class="fas fa-check-double"></i> Revisar Comandas
                </button>
              </div>
              <div class="comanda-actions-2">
                <button class="btn-cuenta" data-action="pedirCuenta" data-rol="mesero,admin,master,caja"><i class="fas fa-file-invoice-dollar"></i> Pedir Cuenta</button>
                <button class="btn-cerrar-mesa" data-action="cerrarMesa" data-rol="caja,admin,master"><i class="fas fa-check-circle"></i> Cerrar Mesa</button>
              </div>
            </div>
          </section>
        </div>
      </div>`;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      switch (action) {
        case 'cerrar':
          cerrar();
          break;
        case 'pedirCuenta':
          pedirCuenta();
          break;
        case 'cerrarMesa':
          cerrarMesa();
          break;
        case 'mostrarSelectorTransferencia':
          mostrarSelectorTransferencia();
          break;
        case 'revisarComanda':
          revisarComanda();
          break;
      }
    });

    $id('searchProducto').addEventListener('input', () => Carta.filtrar());
    $id('comandaMozo').addEventListener('change', function () {
      Comanda.establecerMozo(this.value);
    });
    $id('comandaComensales').addEventListener('change', function () {
      Comanda.establecerComensales(this.value);
    });
    $id('comandaObs').addEventListener('input', function () {
      Comanda.establecerObservacionGeneral(this.value);
    });
  }

  function _abrirModalPedido(mesa) {
    _asegurarModalPedido();

    const tituloEl = document.getElementById('modalMesaTitulo');
    const badgeEl = document.getElementById('modalEstadoBadge');
    if (tituloEl) tituloEl.textContent = mesa.esVirtual ? 'Mesas ' + mesa.mesasFusionadas.join(', ') : 'Mesa ' + mesa.numero;
    if (badgeEl) {
      badgeEl.textContent = Mesas.labelEstado(mesa.estado);
      badgeEl.className = 'estado-badge ' + mesa.estado;
    }

    Carta.activar();
    EventBus.emit('mesa:abierta', mesa);
    Carta.render();
    const modal = document.getElementById('modalPedido');
    if (modal) modal.style.display = 'flex';
  }

  function abrirMesa(num) {
    if (_panelDetalleAbierto) return;

    const mesas = Store.obtenerEstado().mesas || [];
    const mesa = mesas.find(m => m.numero == num);
    if (!mesa) { Logger.error('[Pedido] Mesa ' + num + ' no encontrada.'); return; }

    _abrirModalPedido(mesa);
  }

  function cerrar() {
    Carta.limpiar();

    const modal = document.getElementById('modalPedido');
    if (modal) {
      modal.style.display = 'none';
    } else {
      const overlays = document.querySelectorAll('.modal-overlay');
      overlays.forEach(o => {
        if (o.querySelector('.modal-pedido')) o.style.display = 'none';
      });
    }

    const mesa = Comanda.getMesaActiva();
    if (mesa && mesa.estado === 'libre' && (!mesa.items || mesa.items.length === 0)) {
      if (mesa.esVirtual) {
        DB.liberarMesasFusionadas(mesa);
      } else {
        const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
        if (idx >= 0) {
          DB.mesas[idx] = mesaVacia(mesa.numero);
          try {
            DB.saveMesas();
          } catch (e) {
            Logger.error('[Pedido] Error al guardar mesas al cerrar:', e);
          }
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
          Mesas.render();
        }
      }
    }
    EventBus.emit('mesa:cerrada');
  }

  async function revisarComanda() {
    const mesa = Comanda.getMesaActiva();
    if (!mesa) { mostrarToast('warning', 'No hay mesa activa.'); return; }

    const pendientes = mesa.items.filter(it => !it.enviado);

    if (pendientes.length > 0) {
      _mostrarRevisarPendientes(mesa, pendientes);
      return;
    }

    const comandas = Store.obtenerEstado().comandas || [];
    const comandasMesa = comandas.filter(c => {
      return c.mesa == mesa.numero || c.mesa == String(mesa.numero);
    });
    if (comandasMesa.length > 0) {
      _mostrarReimprimir(comandasMesa);
      return;
    }

    mostrarToast('warning', 'No hay comandas para revisar. Envía nuevos ítems primero.');
  }

  async function _ejecutarEnvioComanda(mesa, pendientes, overrideStock) {
    overrideStock = overrideStock || false;
    const mozoSelect = document.getElementById('comandaMozo');
    const comensalesInput = document.getElementById('comandaComensales');
    const obsInput = document.getElementById('comandaObs');
    if (mozoSelect) mesa.mozo = mozoSelect.value;
    if (comensalesInput) mesa.comensales = parseInt(comensalesInput.value) || 1;
    if (obsInput) mesa.observaciones = obsInput.value;

    try {
      return await CommandBus.ejecutar({
        type: 'enviarComanda',
        datos: {
          mesa: mesa,
          mozo: mesa.mozo,
          comensales: mesa.comensales,
          observaciones: mesa.observaciones || '',
          itemsPendientes: pendientes,
          overrideStock: overrideStock
        }
      });
    } catch (e) {
      Logger.error('[Pedido] Error al ejecutar envío de comanda:', e);
      return { exito: false, error: e.message };
    }
  }

  function _mostrarRevisarPendientes(mesa, pendientes) {
    function crearOpciones(comandaTemp) {
      const tempId = comandaTemp.id;
      const yaEnviada = !!_comandasEnviadas[tempId];
      return {
        textoEditar: 'Editar',
        editarCallback: function(html) { return _editarComandaCallback(comandaTemp, html); },
        textoImprimir: yaEnviada ? 'Reimprimir' : 'Enviar e Imprimir',
        claseImprimir: yaEnviada ? 'btn-secondary' : 'btn-print',
        esReimpresion: yaEnviada,
        onImprimir: async function() {
          if (!yaEnviada) {
            try {
              const resultado = await _ejecutarEnvioComanda(mesa, pendientes);
              if (!resultado.exito) {
                const err = resultado.error;
                if (err && err.faltantes) {
                  _mostrarDialogoStockInsuficiente(mesa, pendientes, err.faltantes, err.mensaje);
                  return false;
                }
                mostrarToast('error', 'Error al enviar comanda: ' + (err?.message || err));
                return false;
              }
              _comandasEnviadas[tempId] = true;
              mostrarToast('success', 'Comanda(s) enviada(s)');
              Comanda.render();
              Mesas.render();
              EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
              return true;
            } catch (e) {
              Logger.error('[Pedido] Error al enviar comanda:', e);
              mostrarToast('error', 'Error al enviar comanda.');
              return false;
            }
          }
          return true;
        }
      };
    }

    function crearComandaTemp(items, destino) {
      return {
        id: 'temp_' + Date.now(),
        mesa: mesa.numero,
        mozo: mesa.mozo,
        destino: destino,
        items: items,
        observaciones: mesa.observaciones || '',
        estado: 'nueva',
        ts: Date.now()
      };
    }

    const cocinaItems = pendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = pendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');

    if (cocinaItems.length && barraItems.length) {
      const comCocina = crearComandaTemp(cocinaItems, 'cocina');
      const comBarra  = crearComandaTemp(barraItems,  'barra');
      Tickets.mostrarDoble(
        Tickets.generarComanda(comCocina, 'cocina'), 'Cocina',
        crearOpciones(comCocina),
        Tickets.generarComanda(comBarra, 'barra'), 'Barra',
        crearOpciones(comBarra)
      );
    } else if (cocinaItems.length) {
      const comCocina2 = crearComandaTemp(cocinaItems, 'cocina');
      Tickets.mostrar(Tickets.generarComanda(comCocina2, 'cocina'), 'Cocina — Mesa ' + mesa.numero, crearOpciones(comCocina2));
    } else if (barraItems.length) {
      const comBarra2 = crearComandaTemp(barraItems, 'barra');
      Tickets.mostrar(Tickets.generarComanda(comBarra2, 'barra'), 'Barra — Mesa ' + mesa.numero, crearOpciones(comBarra2));
    }
  }

  function _mostrarDialogoStockInsuficiente(mesa, pendientes, faltantes, mensaje) {
    const itemsList = faltantes.map(f => {
      return '<li>' + f.ingrediente + ' — Faltan ' + f.faltante + ' ' + f.unidad + ' (Stock: ' + f.stockActual + ')</li>';
    }).join('');

    const modalId = 'modalStock_' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="modal-small" style="max-width:480px;">' +
        '<div class="modal-header">' +
          '<h3><i class="fas fa-exclamation-triangle" style="color:var(--color-warning);"></i> Stock Insuficiente</h3>' +
          '<button class="modal-close" id="' + modalId + '-close"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="modal-small-body">' +
          '<p>' + mensaje + '</p>' +
          '<ul style="margin:8px 0 16px 20px; font-size:13px;">' + itemsList + '</ul>' +
          '<p style="font-size:12px; color:var(--color-text-muted);">¿Forzar envío igualmente?</p>' +
          '<div class="modal-small-footer">' +
            '<button class="btn-secondary" id="' + modalId + '-cancel">Cancelar</button>' +
            '<button class="btn-primary" id="' + modalId + '-force" style="background:var(--color-warning); color:#000;">' +
              '<i class="fas fa-exclamation-circle"></i> Enviar igual' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const closeModal = function() { overlay.remove(); };

    document.getElementById(modalId + '-close').onclick = closeModal;
    document.getElementById(modalId + '-cancel').onclick = closeModal;
    document.getElementById(modalId + '-force').onclick = async function() {
      closeModal();
      try {
        const resultado = await _ejecutarEnvioComanda(mesa, pendientes, true);
        if (resultado.exito) {
          mostrarToast('success', 'Comanda(s) enviada(s) (stock ignorado)');
          Comanda.render();
          Mesas.render();
        } else {
          mostrarToast('error', 'Error al enviar comanda: ' + (resultado.error?.message || resultado.error));
        }
      } catch (e) {
        Logger.error('[Pedido] Error al forzar envío:', e);
        mostrarToast('error', 'Error al enviar comanda.');
      }
    };
  }

  function _mostrarReimprimir(comandas) {
    comandas.forEach(comanda => {
      Tickets.mostrar(
        Tickets.generarComanda(comanda, comanda.destino),
        (comanda.destino === 'cocina' ? 'Cocina' : 'Barra') + ' — Mesa ' + comanda.mesa,
        {
          textoEditar: 'Editar',
          editarCallback: function(html) { return _editarComandaCallback(comanda, html); },
          textoImprimir: 'Reimprimir',
          claseImprimir: 'btn-secondary',
          esReimpresion: true,
          onImprimir: function() { return true; }
        }
      );
    });
  }

  async function _editarComandaCallback(comanda, htmlActual) {
    if (!comanda) return htmlActual;
    try {
      const nota = await mostrarEntrada(
        'Comentario de comanda',
        'Agregar comentario a la comanda:',
        { placeholder: 'Ej: Sin sal', valorPredefinido: comanda.observaciones || '' }
      );
      if (nota !== null && nota !== undefined) {
        comanda.observaciones = nota;
        return Tickets.generarComanda(comanda, comanda.destino);
      }
      return htmlActual;
    } catch (e) {
      Logger.error('[Pedido] Error al editar comentario de comanda:', e);
      return htmlActual;
    }
  }

  function transferirMesa(mesaOrigenNum, mesaDestinoNum) {
    if (!Auth.esAdmin()) { mostrarToast('error', 'Solo administradores pueden transferir pedidos entre mesas'); return false; }
    const mesas = Store.obtenerEstado().mesas || [];
    const mesaOrigen = mesas.find(m => m.numero == mesaOrigenNum);
    const mesaDestino = mesas.find(m => m.numero == mesaDestinoNum);
    if (!mesaOrigen || !mesaDestino) { mostrarToast('error', 'Una de las mesas no existe.'); return false; }
    if (mesaDestino.estado !== 'libre') { mostrarToast('error', 'La mesa ' + mesaDestinoNum + ' no está libre.'); return false; }
    if (mesaOrigen.esVirtual || mesaDestino.esVirtual) { mostrarToast('error', 'No se puede transferir desde/hacia una mesa fusionada.'); return false; }

    // Persistir en DB
    const mesaDestinoDB = DB.mesas.find(m => m.numero == mesaDestinoNum);
    const mesaOrigenDB = DB.mesas.find(m => m.numero == mesaOrigenNum);
    if (mesaDestinoDB && mesaOrigenDB) {
      mesaDestinoDB.estado = mesaOrigenDB.estado;
      mesaDestinoDB.pedidoId = mesaOrigenDB.pedidoId;
      mesaDestinoDB.items = mesaOrigenDB.items;
      mesaDestinoDB.mozo = mesaOrigenDB.mozo;
      mesaDestinoDB.comensales = mesaOrigenDB.comensales;
      mesaDestinoDB.abiertaEn = mesaOrigenDB.abiertaEn;
      mesaDestinoDB.observaciones = mesaOrigenDB.observaciones;
      mesaDestinoDB.total = mesaOrigenDB.total;

      if (mesaDestinoDB.pedidoId) {
        const pedido = DB.pedidos.find(p => p.id === mesaDestinoDB.pedidoId);
        if (pedido) { pedido.mesa = mesaDestinoNum; DB.savePedidos(); }
      }
      const idxOrigen = DB.mesas.findIndex(m => m.numero === mesaOrigenNum);
      if (idxOrigen >= 0) DB.mesas[idxOrigen] = mesaVacia(mesaOrigenNum);
      try {
        DB.saveMesas();
      } catch (e) {
        Logger.error('[Pedido] Error al guardar mesas al transferir:', e);
      }
    }

    // Despachar al Store
    Store.despachar({ type: 'MESA_ACTUALIZAR', payload: { numero: mesaDestinoNum, cambios: { estado: mesaOrigen.estado, pedidoId: mesaOrigen.pedidoId, items: mesaOrigen.items, mozo: mesaOrigen.mozo, comensales: mesaOrigen.comensales, abiertaEn: mesaOrigen.abiertaEn, observaciones: mesaOrigen.observaciones, total: mesaOrigen.total } } });
    Store.despachar({ type: 'MESA_ACTUALIZAR', payload: { numero: mesaOrigenNum, cambios: { estado: 'libre', pedidoId: null, items: [], mozo: '', comensales: 0, abiertaEn: null, observaciones: '', total: 0 } } });

    EventBus.emit('mesa:actualizada', { mesa: mesaOrigenNum, estado: 'libre' });
    EventBus.emit('mesa:actualizada', { mesa: mesaDestinoNum, estado: mesaDestino.estado });
    Mesas.render();
    const mesaActiva = Comanda.getMesaActiva();
    if (mesaActiva && mesaActiva.numero === mesaOrigenNum) abrirMesa(mesaDestinoNum);
    mostrarToast('success', 'Pedido transferido de Mesa ' + mesaOrigenNum + ' a Mesa ' + mesaDestinoNum);
    return true;
  }

  async function mostrarSelectorTransferencia() {
    const mesaActual = Comanda.getMesaActiva();
    if (!mesaActual) { mostrarToast('warning', 'No hay mesa activa.'); return; }
    if (!Auth.esAdmin()) { mostrarToast('error', 'Solo administradores pueden transferir mesas.'); return; }
    if (mesaActual.esVirtual) { mostrarToast('info', 'No se puede transferir una mesa fusionada.'); return; }

    const mesas = Store.obtenerEstado().mesas || [];
    const mesasLibres = mesas.filter(m => m.estado === 'libre' && !m.esVirtual && m.numero !== mesaActual.numero);
    if (!mesasLibres.length) { mostrarToast('info', 'No hay mesas libres para transferir.'); return; }
    const opciones = mesasLibres.map(m => m.numero).join(', ');

    const destinoStr = await mostrarEntrada(
      'Transferir Mesa',
      `Mesas libres: ${opciones}\nIngresa el número de mesa destino:`,
      { placeholder: 'Número de mesa' }
    );

    if (destinoStr) {
      const numDestino = parseInt(destinoStr);
      if (!isNaN(numDestino)) transferirMesa(mesaActual.numero, numDestino);
      else mostrarToast('error', 'Número de mesa inválido.');
    }
  }

  function pedirCuenta() { Cuenta.pedirCuenta(); }
  function cerrarMesa() { Cobro.abrirModalCierre(); }
  function _establecerCat(cat) { Carta.establecerCategoria(cat); }
  function filtrarProductos() { Carta.filtrar(); }
  function actualizarObsGeneral(valor) { Comanda.establecerObservacionGeneral(valor); }

  EventBus.on('mesa-detalle:abierto', () => { _panelDetalleAbierto = true; });
  EventBus.on('mesa-detalle:cerrado', () => { _panelDetalleAbierto = false; });
  EventBus.on('mesa:tomar_pedido', (data) => { abrirMesa(data.mesa); });
  EventBus.on('pago:confirmado', () => { cerrar(); });

  return {
    abrirMesa,
    cerrar,
    revisarComanda,
    transferirMesa,
    mostrarSelectorTransferencia,
    pedirCuenta,
    cerrarMesa,
    _establecerCat,
    filtrarProductos,
    actualizarObsGeneral
  };
})();

export { Pedido };