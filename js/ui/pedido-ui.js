/* ================================================================
   PubPOS — MÓDULO: pedido-ui.js (v5.5 – sintaxis robusta)
   Propósito: Modal de pedido, revisar comandas, validación de stock.
              Usa funciones tradicionales y concatenación de strings
              para evitar errores de sintaxis al copiar/pegar.
   ================================================================ */
var Pedido = (function() {

  var _mesaAbriendo = null;
  var _comandasEnviadas = {};

  function _asegurarModalPedido() {
    if ($id('modalPedido')) return;

    var modal = document.createElement('div');
    modal.id = 'modalPedido';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="modal-pedido">' +
        '<div class="modal-header">' +
          '<div class="modal-title">' +
            '<i class="fas fa-chair"></i>' +
            '<span id="modalMesaTitulo">Mesa 1</span>' +
            '<span class="estado-badge" id="modalEstadoBadge">Libre</span>' +
          '</div>' +
          '<button class="btn-icon" onclick="Pedido.mostrarSelectorTransferencia()" title="Cambiar Mesa" style="background:transparent; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:6px 12px; color:var(--color-text-sec); margin-right:8px;" data-rol="admin,master">' +
            '<i class="fas fa-exchange-alt"></i> Cambiar Mesa' +
          '</button>' +
          '<button class="modal-close" onclick="Pedido.cerrar()" aria-label="Cerrar" style="margin-left: auto;">' +
            '<i class="fas fa-times"></i>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<section class="carta-panel">' +
            '<div class="carta-search"><i class="fas fa-search"></i><input type="text" id="searchProducto" placeholder="Buscar producto..." oninput="Carta.filtrar()" autocomplete="off"></div>' +
            '<div class="categorias-tabs" id="categoriasTabs"></div>' +
            '<div id="cartaProductos" class="carta-productos"></div>' +
          '</section>' +
          '<section class="comanda-panel">' +
            '<div class="comanda-header">' +
              '<div class="comanda-meta">' +
                '<span><i class="fas fa-user-tie"></i><select id="comandaMozo" onchange="Comanda.setMozo(this.value)"></select></span>' +
                '<span><i class="fas fa-users"></i><input type="number" id="comandaComensales" value="2" min="1" max="20" onchange="Comanda.setComensales(this.value)"> pax</span>' +
              '</div>' +
              '<div id="personaActivaContainer" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;"></div>' +
            '</div>' +
            '<div id="comandaItems" class="comanda-items"></div>' +
            '<div class="comanda-obs"><input type="text" id="comandaObs" placeholder="Observaciones generales..." oninput="Comanda.setObservacionGeneral(this.value)"></div>' +
            '<div class="comanda-footer">' +
              '<div class="comanda-total"><span>Subtotal</span><span class="total-monto" id="subtotalDisplay">$0</span></div>' +
              '<div class="comanda-actions">' +
                '<button class="btn-comanda btn-todo" onclick="Pedido.revisarComanda()" style="grid-column:span 3;">' +
                  '<i class="fas fa-check-double"></i> Revisar Comandas' +
                '</button>' +
              '</div>' +
              '<div class="comanda-actions-2">' +
                '<button class="btn-cuenta" onclick="Cuenta.pedirCuenta()" data-rol="mesero,admin,master,caja"><i class="fas fa-file-invoice-dollar"></i> Pedir Cuenta</button>' +
                '<button class="btn-cerrar-mesa" onclick="Cobro.abrirModalCierre()" data-rol="caja,admin,master"><i class="fas fa-check-circle"></i> Cerrar Mesa</button>' +
              '</div>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  /* ── MODAL DE APERTURA ───────────────────── */
  function _mostrarModalApertura(mesa) {
    var modal = $id('modalAperturaMesa');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modalAperturaMesa';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    var numMesa = mesa.numero;
    modal.innerHTML =
      '<div class="modal-small" style="max-width:400px;">' +
        '<div class="modal-header">' +
          '<h3><i class="fas fa-chair"></i> Abrir Mesa ' + numMesa + '</h3>' +
          '<button class="modal-close" onclick="Pedido._cancelarApertura()"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="modal-small-body">' +
          '<label for="aperturaComensales">Comensales</label>' +
          '<input type="number" id="aperturaComensales" value="2" min="1" max="20" step="1">' +
          '<label for="aperturaPersonas">' +
            'Nombres o apodos (opcional)' +
            '<span style="font-weight:normal;font-size:11px;color:var(--color-text-muted);">Separados por coma o uno por línea</span>' +
          '</label>' +
          '<textarea id="aperturaPersonas" rows="3" placeholder="Ej: Juan, María, Pedro"></textarea>' +
          '<div class="modal-small-footer">' +
            '<button class="btn-secondary" onclick="Pedido._cancelarApertura()">Cancelar</button>' +
            '<button class="btn-primary" onclick="Pedido._confirmarApertura(' + numMesa + ')">' +
              '<i class="fas fa-check-circle"></i> Abrir Mesa' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    setTimeout(function() {
      var input = $id('aperturaComensales');
      if (input) input.focus();
    }, 100);
  }

  function _cancelarApertura() {
    var modal = $id('modalAperturaMesa');
    if (modal) modal.remove();
    _mesaAbriendo = null;
  }

  async function _confirmarApertura(num) {
    var comensales = parseInt($id('aperturaComensales')?.value) || 2;
    var personasRaw = $id('aperturaPersonas')?.value || '';
    var personas = personasRaw.split(/[,\n]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
    _cancelarApertura();

    var mesa = DB.mesas.find(function(m) { return m.numero == num; });
    if (!mesa) { showToast('error', 'Mesa no encontrada'); return; }

    mesa.comensales = comensales;
    mesa.personas = personas;
    mesa.personaActiva = personas.length > 0 ? personas[0] : 'General';

    var comando = {
      type: 'crearPedidoMesa',
      datos: {
        numeroMesa: num,
        mozo: mesa.mozo || (DB.mozos[0]?.nombre || 'Mozo'),
        comensales: comensales
      }
    };

    Logger.debug('[Pedido] Ejecutando comando crearPedidoMesa...');
    var resultado = await CommandBus.ejecutar(comando);

    if (!resultado.exito || !resultado.data) {
      Logger.error('[Pedido] El comando crearPedidoMesa falló:', resultado.error);
      showToast('error', 'No se pudo abrir la mesa. Intenta de nuevo.');
      return;
    }

    mesa.pedidoId = resultado.data.id;
    mesa.estado = 'ocupada';
    mesa.abiertaEn = Date.now();
    mesa.items = [];
    mesa.observaciones = '';
    DB.saveMesas();

    _abrirModalPedido(mesa);
  }

  function _abrirModalPedido(mesa) {
    _asegurarModalPedido();

    var tituloEl = document.getElementById('modalMesaTitulo');
    var badgeEl = document.getElementById('modalEstadoBadge');
    if (tituloEl) tituloEl.textContent = mesa.esVirtual ? 'Mesas ' + mesa.mesasFusionadas.join(', ') : 'Mesa ' + mesa.numero;
    if (badgeEl) {
      badgeEl.textContent = Mesas.labelEstado(mesa.estado);
      badgeEl.className = 'estado-badge ' + mesa.estado;
    }

    EventBus.emit('mesa:abierta', mesa);
    if (window.Carta && typeof Carta.render === 'function') Carta.render();
    var modal = document.getElementById('modalPedido');
    if (modal) modal.style.display = 'flex';
  }

  async function abrirMesa(num) {
    if (_mesaAbriendo === num) return;
    _mesaAbriendo = num;

    try {
      var mesa = DB.mesas.find(function(m) { return m.numero == num; });
      if (!mesa) { Logger.error('[Pedido] Mesa ' + num + ' no encontrada.'); return; }

      if (mesa.estado === 'libre') {
        mesa.mozo = document.getElementById('mozoActivo')?.value || (DB.mozos[0]?.nombre || 'Mozo');
        _mostrarModalApertura(mesa);
      } else {
        _abrirModalPedido(mesa);
      }
    } finally {
      _mesaAbriendo = null;
    }
  }

  function cerrar() {
    var modal = document.getElementById('modalPedido');
    if (modal) {
      modal.style.display = 'none';
    } else {
      var overlays = document.querySelectorAll('.modal-overlay');
      overlays.forEach(function(o) {
        if (o.querySelector('.modal-pedido')) o.style.display = 'none';
      });
    }

    var mesa = Comanda.getMesaActiva();
    if (mesa && mesa.estado === 'libre' && (!mesa.items || mesa.items.length === 0)) {
      if (mesa.esVirtual) {
        DB.liberarMesasFusionadas(mesa);
      } else {
        var idx = DB.mesas.findIndex(function(m) { return m.numero === mesa.numero; });
        if (idx >= 0) {
          DB.mesas[idx] = mesaVacia(mesa.numero);
          DB.saveMesas();
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
          Mesas.render();
        }
      }
    }
    EventBus.emit('mesa:cerrada');
  }

  /* ── REVISAR COMANDA (con manejo de stock insuficiente) ── */
  async function revisarComanda() {
    var mesa = Comanda.getMesaActiva();
    if (!mesa) { showToast('warning', 'No hay mesa activa.'); return; }

    var pendientes = mesa.items.filter(function(it) { return !it.enviado; });

    if (pendientes.length > 0) {
      _mostrarRevisarPendientes(mesa, pendientes);
      return;
    }

    var comandasMesa = DB.comandas.filter(function(c) {
      return c.mesa == mesa.numero || c.mesa == String(mesa.numero);
    });
    if (comandasMesa.length > 0) {
      _mostrarReimprimir(comandasMesa);
      return;
    }

    showToast('warning', 'No hay comandas para revisar. Envía nuevos ítems primero.');
  }

  function _ejecutarEnvioComanda(mesa, pendientes, overrideStock) {
    overrideStock = overrideStock || false;
    var mozoSelect = document.getElementById('comandaMozo');
    var comensalesInput = document.getElementById('comandaComensales');
    var obsInput = document.getElementById('comandaObs');
    if (mozoSelect) mesa.mozo = mozoSelect.value;
    if (comensalesInput) mesa.comensales = parseInt(comensalesInput.value) || 1;
    if (obsInput) mesa.observaciones = obsInput.value;

    return CommandBus.ejecutar({
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
  }

  function _mostrarRevisarPendientes(mesa, pendientes) {
    function crearOpciones(comandaTemp) {
      var tempId = comandaTemp.id;
      var yaEnviada = !!_comandasEnviadas[tempId];
      return {
        textoEditar: 'Editar',
        editarCallback: function(html) { return _editarComandaCallback(comandaTemp, html); },
        textoImprimir: yaEnviada ? 'Reimprimir' : 'Enviar e Imprimir',
        claseImprimir: yaEnviada ? 'btn-secondary' : 'btn-print',
        esReimpresion: yaEnviada,
        onImprimir: async function() {
          if (!yaEnviada) {
            try {
              var resultado = await _ejecutarEnvioComanda(mesa, pendientes);
              if (!resultado.exito) {
                var err = resultado.error;
                if (err && err.faltantes) {
                  _mostrarDialogoStockInsuficiente(mesa, pendientes, err.faltantes, err.mensaje);
                  return false;
                }
                showToast('error', 'Error al enviar comanda: ' + (err?.message || err));
                return false;
              }
              _comandasEnviadas[tempId] = true;
              showToast('success', 'Comanda(s) enviada(s)');
              if (window.Comanda) Comanda.render();
              if (window.Mesas) Mesas.render();
              EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
              return true;
            } catch (e) {
              Logger.error('[Pedido] Error al enviar comanda:', e);
              showToast('error', 'Error al enviar comanda.');
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

    var cocinaItems = pendientes.filter(function(it) { return it.destino === 'cocina' || it.destino === 'ambos'; });
    var barraItems  = pendientes.filter(function(it) { return it.destino === 'barra'  || it.destino === 'ambos'; });

    if (cocinaItems.length && barraItems.length) {
      var comCocina = crearComandaTemp(cocinaItems, 'cocina');
      var comBarra  = crearComandaTemp(barraItems,  'barra');
      Tickets.mostrarDoble(
        Tickets.generarComanda(comCocina, 'cocina'), 'Cocina',
        crearOpciones(comCocina),
        Tickets.generarComanda(comBarra, 'barra'), 'Barra',
        crearOpciones(comBarra)
      );
    } else if (cocinaItems.length) {
      var comCocina2 = crearComandaTemp(cocinaItems, 'cocina');
      Tickets.mostrar(Tickets.generarComanda(comCocina2, 'cocina'), 'Cocina — Mesa ' + mesa.numero, crearOpciones(comCocina2));
    } else if (barraItems.length) {
      var comBarra2 = crearComandaTemp(barraItems, 'barra');
      Tickets.mostrar(Tickets.generarComanda(comBarra2, 'barra'), 'Barra — Mesa ' + mesa.numero, crearOpciones(comBarra2));
    }
  }

  function _mostrarDialogoStockInsuficiente(mesa, pendientes, faltantes, mensaje) {
    var itemsList = faltantes.map(function(f) {
      return '<li>' + f.ingrediente + ' — Faltan ' + f.faltante + ' ' + f.unidad + ' (Stock: ' + f.stockActual + ')</li>';
    }).join('');

    var modalId = 'modalStock_' + Date.now();
    var overlay = document.createElement('div');
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

    var closeModal = function() { overlay.remove(); };

    document.getElementById(modalId + '-close').onclick = closeModal;
    document.getElementById(modalId + '-cancel').onclick = closeModal;
    document.getElementById(modalId + '-force').onclick = async function() {
      closeModal();
      try {
        var resultado = await _ejecutarEnvioComanda(mesa, pendientes, true);
        if (resultado.exito) {
          showToast('success', 'Comanda(s) enviada(s) (stock ignorado)');
          if (window.Comanda) Comanda.render();
          if (window.Mesas) Mesas.render();
        } else {
          showToast('error', 'Error al enviar comanda: ' + (resultado.error?.message || resultado.error));
        }
      } catch (e) {
        Logger.error('[Pedido] Error al forzar envío:', e);
        showToast('error', 'Error al enviar comanda.');
      }
    };
  }

  function _mostrarReimprimir(comandas) {
    comandas.forEach(function(comanda) {
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

  function _editarComandaCallback(comanda, htmlActual) {
    if (!comanda) return htmlActual;
    var nota = prompt('Agregar comentario a la comanda:', comanda.observaciones || '');
    if (nota !== null) {
      comanda.observaciones = nota;
      return Tickets.generarComanda(comanda, comanda.destino);
    }
    return htmlActual;
  }

  function transferirMesa(mesaOrigenNum, mesaDestinoNum) {
    if (!Auth.esAdmin()) { showToast('error', 'Solo administradores pueden transferir pedidos entre mesas'); return false; }
    var mesaOrigen = DB.getMesa(mesaOrigenNum), mesaDestino = DB.getMesa(mesaDestinoNum);
    if (!mesaOrigen || !mesaDestino) { showToast('error', 'Una de las mesas no existe.'); return false; }
    if (mesaDestino.estado !== 'libre') { showToast('error', 'La mesa ' + mesaDestinoNum + ' no está libre.'); return false; }
    if (mesaOrigen.esVirtual || mesaDestino.esVirtual) { showToast('error', 'No se puede transferir desde/hacia una mesa fusionada.'); return false; }

    mesaDestino.estado = mesaOrigen.estado; mesaDestino.pedidoId = mesaOrigen.pedidoId;
    mesaDestino.items = mesaOrigen.items; mesaDestino.mozo = mesaOrigen.mozo;
    mesaDestino.comensales = mesaOrigen.comensales; mesaDestino.abiertaEn = mesaOrigen.abiertaEn;
    mesaDestino.observaciones = mesaOrigen.observaciones; mesaDestino.total = mesaOrigen.total;

    if (mesaDestino.pedidoId) {
      var pedido = DB.pedidos.find(function(p) { return p.id === mesaDestino.pedidoId; });
      if (pedido) { pedido.mesa = mesaDestinoNum; DB.savePedidos(); }
    }
    var idxOrigen = DB.mesas.findIndex(function(m) { return m.numero === mesaOrigenNum; });
    if (idxOrigen >= 0) DB.mesas[idxOrigen] = mesaVacia(mesaOrigenNum);
    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: mesaOrigenNum, estado: 'libre' });
    EventBus.emit('mesa:actualizada', { mesa: mesaDestinoNum, estado: mesaDestino.estado });
    if (window.Mesas) Mesas.render();
    var mesaActiva = Comanda.getMesaActiva();
    if (mesaActiva && mesaActiva.numero === mesaOrigenNum) abrirMesa(mesaDestinoNum);
    showToast('success', 'Pedido transferido de Mesa ' + mesaOrigenNum + ' a Mesa ' + mesaDestinoNum);
    return true;
  }

  function mostrarSelectorTransferencia() {
    var mesaActual = Comanda.getMesaActiva();
    if (!mesaActual) { showToast('warning', 'No hay mesa activa.'); return; }
    if (!Auth.esAdmin()) { showToast('error', 'Solo administradores pueden transferir mesas.'); return; }
    if (mesaActual.esVirtual) { showToast('info', 'No se puede transferir una mesa fusionada.'); return; }
    var mesasLibres = DB.mesas.filter(function(m) { return m.estado === 'libre' && !m.esVirtual && m.numero !== mesaActual.numero; });
    if (!mesasLibres.length) { showToast('info', 'No hay mesas libres para transferir.'); return; }
    var opciones = mesasLibres.map(function(m) { return m.numero; }).join(', ');
    var destino = prompt('Mesas libres: ' + opciones + '\nIngresa el número de mesa destino:');
    if (destino) {
      var numDestino = parseInt(destino);
      if (!isNaN(numDestino)) transferirMesa(mesaActual.numero, numDestino);
      else showToast('error', 'Número de mesa inválido.');
    }
  }

  function pedirCuenta() { if (window.Cuenta && typeof Cuenta.pedirCuenta === 'function') Cuenta.pedirCuenta(); }
  function cerrarMesa() { if (window.Cobro && typeof Cobro.abrirModalCierre === 'function') Cobro.abrirModalCierre(); }
  function _setCat(cat) { if (window.Carta && typeof Carta.setCategoria === 'function') Carta.setCategoria(cat); }
  function filtrarProductos() { if (window.Carta && typeof Carta.filtrar === 'function') Carta.filtrar(); }
  function actualizarObsGeneral(valor) { if (window.Comanda && typeof Comanda.setObservacionGeneral === 'function') Comanda.setObservacionGeneral(valor); }
  function _agregarItem(prodId) { var producto = DB.productos.find(function(p) { return p.id === prodId; }); if (producto && window.Comanda) Comanda.agregarItem(producto); }

  EventBus.on('mesa:seleccionada', abrirMesa);

  return {
    abrirMesa: abrirMesa,
    cerrar: cerrar,
    revisarComanda: revisarComanda,
    transferirMesa: transferirMesa,
    mostrarSelectorTransferencia: mostrarSelectorTransferencia,
    pedirCuenta: pedirCuenta,
    cerrarMesa: cerrarMesa,
    _setCat: _setCat,
    filtrarProductos: filtrarProductos,
    actualizarObsGeneral: actualizarObsGeneral,
    _agregarItem: _agregarItem,
    _confirmarApertura: _confirmarApertura,
    _cancelarApertura: _cancelarApertura
  };
})();

window.Pedido = Pedido;