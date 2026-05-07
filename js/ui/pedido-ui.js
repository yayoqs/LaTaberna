/* ================================================================
   PubPOS — MÓDULO: pedido-ui.js (v3.2 – unificado con CQRS)
   Cambios:
   - En abrirMesa, se eliminaron los fallbacks a PedidoManager y
     DB.crearPedido. Ahora solo se usa el CommandBus (CQRS) que
     a su vez invoca el repositorio. Si el comando falla, se muestra
     un error y no se generan pedidos basura.
   - Se mantiene el resto de la funcionalidad (comandas, cierre, etc.).
   ================================================================ */
const Pedido = (() => {

  let _mesaAbriendo = null;

  function _asegurarModalPedido() {
    // ... exactamente igual que en v3.1 ...
  }

  async function abrirMesa(num) {
    if (_mesaAbriendo === num) return;
    _mesaAbriendo = num;
    try {
      _asegurarModalPedido();
      let mesa = DB.mesas.find(m => m.numero == num);
      if (!mesa) { Logger.error(`[Pedido] Mesa ${num} no encontrada.`); return; }

      if (mesa.estado === 'libre') {
        mesa.abiertaEn = Date.now();
        mesa.mozo = document.getElementById('mozoActivo')?.value || (DB.mozos[0]?.nombre || 'Mozo');
        mesa.comensales = 2;
        mesa.items = [];
        mesa.observaciones = '';

        // ── UNICO PUNTO DE CREACIÓN (CQRS) ────────────────
        const comando = {
          type: 'crearPedidoMesa',
          datos: {
            numeroMesa: num,
            mozo: mesa.mozo,
            comensales: mesa.comensales
          }
        };
        const resultado = await CommandBus.ejecutar(comando);
        if (resultado.exito && resultado.data) {
          mesa.pedidoId = resultado.data.id;
        } else {
          Logger.error('[Pedido] El comando crearPedidoMesa falló:', resultado.error);
          showToast('error', 'No se pudo abrir la mesa. Intente de nuevo.');
          // No asignamos pedidoId y no continuamos
          return;
        }
        DB.saveMesas();
      }

      const tituloEl = document.getElementById('modalMesaTitulo');
      const badgeEl = document.getElementById('modalEstadoBadge');
      if (tituloEl) tituloEl.textContent = mesa.esVirtual ? `Mesas ${mesa.mesasFusionadas.join(', ')}` : `Mesa ${num}`;
      if (badgeEl) { badgeEl.textContent = Mesas.labelEstado(mesa.estado); badgeEl.className = `estado-badge ${mesa.estado}`; }

      EventBus.emit('mesa:abierta', mesa);
      if (window.Carta && typeof Carta.render === 'function') Carta.render();
      const modal = document.getElementById('modalPedido');
      if (modal) modal.style.display = 'flex';
    } finally { _mesaAbriendo = null; }
  }

  // ── El resto de funciones (cerrar, enviarComanda, etc.) se mantienen igual que en v3.1 ──
  // ...

  return {
    abrirMesa, cerrar, enviarComanda, transferirMesa,
    mostrarSelectorTransferencia, pedirCuenta, cerrarMesa,
    _setCat, filtrarProductos, actualizarObsGeneral, _agregarItem
  };
})();

window.Pedido = Pedido;