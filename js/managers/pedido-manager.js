/* ================================================================
   PubPOS — MÓDULO: pedido-manager.js (v3.1 – cierre delegado a DDD)
   ================================================================ */
const PedidoManager = (() => {

  let turnoActual = null;
  let auditLog = [];
  let _pedidoRepo = null;

  /* ── INICIALIZACIÓN ─────────────────────────────────────── */
  function init(options = {}) {
    if (options.pedidoRepo) {
      _pedidoRepo = options.pedidoRepo;
    } else if (typeof PedidoRepositoryLocal !== 'undefined') {
      _pedidoRepo = PedidoRepositoryLocal;
    } else {
      console.error('[PedidoManager] No se encontró un repositorio de pedidos válido.');
      return null;
    }

    const turnoGuardado = localStorage.getItem('pubpos_turno_actual');
    if (turnoGuardado) {
      try { turnoActual = JSON.parse(turnoGuardado); } catch { turnoActual = null; }
    }

    if (!turnoActual || turnoActual.estado === 'cerrado') {
      _iniciarNuevoTurno();
    }

    _cargarAuditLog();

    EventBus.emit('turno:iniciado', turnoActual);
    console.log(`[PedidoManager] Turno activo: ${turnoActual.id} (${auditLog.length} registros).`);
    return turnoActual;
  }

  function _iniciarNuevoTurno() {
    const ahora = new Date();
    const id = 'turno_' +
      ahora.getFullYear() +
      String(ahora.getMonth() + 1).padStart(2, '0') +
      String(ahora.getDate()).padStart(2, '0') + '_' +
      String(ahora.getHours()).padStart(2, '0') +
      String(ahora.getMinutes()).padStart(2, '0') +
      String(ahora.getSeconds()).padStart(2, '0');

    turnoActual = { id, inicio: ahora.toISOString(), estado: 'abierto' };
    localStorage.setItem('pubpos_turno_actual', JSON.stringify(turnoActual));
    auditLog = [];
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
  }

  function _cargarAuditLog() {
    if (!turnoActual) return;
    const raw = localStorage.getItem('pubpos_audit_' + turnoActual.id);
    auditLog = raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
  }

  function _guardarAuditLog() {
    if (!turnoActual) return;
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
    EventBus.emit('audit:actualizado', { turnoId: turnoActual.id, total: auditLog.length });
  }

  function _registrarAuditoria(tipo, datos) {
    const entrada = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      timestamp: new Date().toISOString(),
      tipo, datos,
      usuario: (typeof Auth !== 'undefined' && Auth.getNombre) ? Auth.getNombre() : 'sistema'
    };
    auditLog.push(entrada);
    _guardarAuditLog();
    console.log(`[Audit] ${tipo}:`, datos);
  }

  /* ── MÉTODOS DE PEDIDOS (MESA) ──────────────────────────── */
  async function crearPedidoMesa(numeroMesa, mozo, comensales) {
    if (typeof CommandBus !== 'undefined' && CommandBus.ejecutar) {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa, mozo, comensales, repo: _pedidoRepo }
      });
      if (resultado.exito) return resultado.data;
      console.error('[PedidoManager] Error vía CommandBus:', resultado.error);
      return null;
    }
    return _crearPedidoMesaDirecto(numeroMesa, mozo, comensales);
  }

  function _crearPedidoMesaDirecto(numeroMesa, mozo, comensales) { /* ... igual ... */ }

  function agregarItemAPedido(pedidoId, item) { /* ... igual ... */ return true; }

  /**
   * @deprecated Usar PedidoService.cerrarPedido() en su lugar.
   * Se mantiene por compatibilidad con código que aún no migró.
   */
  function cerrarPedidoMesa(pedidoId, formaPago, total, descuento) {
    // Redirigir a PedidoService si está disponible
    if (typeof PedidoService !== 'undefined' && PedidoService.cerrarPedido) {
      console.log('[PedidoManager] Delegando cierre a PedidoService (DDD).');
      return PedidoService.cerrarPedido(pedidoId, {
        formaPago,
        totalFinal: total,
        descuento: descuento || 0
      });
    }

    // Fallback: lógica antigua (debería ser eliminada en futuras versiones)
    console.warn('[PedidoManager] PedidoService no disponible, usando cierre directo.');
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) { console.warn('[PedidoManager] Pedido no encontrado:', pedidoId); return null; }
    if (typeof DB.cerrarPedido !== 'function') { console.error('[PedidoManager] DB.cerrarPedido no disponible'); return null; }
    DB.cerrarPedido(pedidoId, formaPago, total, descuento);

    _registrarAuditoria('pedido:cerrado', { pedidoId, mesa: pedido.mesa, total, formaPago, descuento });
    const mesa = DB.getMesa(pedido.mesa);
    if (mesa && !mesa.esVirtual) {
      const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(mesa.numero);
      DB.saveMesas();
    }
    EventBus.emit('pedido:cerrado', { mesa: pedido.mesa, pedidoId });
    return pedido;
  }

  /* ── MÉTODOS DE DELIVERY ────────────────────────────────── */
  function crearPedidoDelivery(datos) { /* ... igual ... */ return nuevo; }
  function enviarPedidoDeliveryACocina(deliveryId) { /* ... igual ... */ return true; }

  /* ── CIERRE DE TURNO ────────────────────────────────────── */
  async function finalizarTurno() {
    if (typeof TurnoManager === 'undefined') {
      return { exito: false, mensaje: 'TurnoManager no disponible.' };
    }
    return await TurnoManager.cerrarTurno();
  }

  /* ── API PÚBLICA ────────────────────────────────────────── */
  return {
    init,
    getTurnoActual: () => turnoActual,
    getAuditLog: () => auditLog,

    crearPedidoMesa,
    agregarItemAPedido,
    cerrarPedidoMesa,   // @deprecated, usa PedidoService.cerrarPedido()

    crearPedidoDelivery,
    enviarPedidoDeliveryACocina,

    registrar: _registrarAuditoria,
    finalizarTurno
  };
})();

window.PedidoManager = PedidoManager;