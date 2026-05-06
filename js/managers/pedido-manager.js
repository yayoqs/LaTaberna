/* ================================================================
   PubPOS — MÓDULO: pedido-manager.js (v3.2 – sin cerrarPedidoMesa)
   ================================================================
   Cambios respecto a v3.1:
   • Eliminado el método depreciado cerrarPedidoMesa().
     Ahora el cierre de pedidos de mesa se hace EXCLUSIVAMENTE a
     través de PedidoService.cerrarPedido() (o DB.cerrarPedido como
     fallback simple en cobro.js), evitando la doble delegación que
     provocaba descuento de stock duplicado.
   • Eliminado el fallback _crearPedidoMesaDirecto (no se usaba).
   • Simplificada la creación de pedidos de mesa: se apoya en
     CommandBus si está presente, o usa directamente el repositorio.
   • La auditoría y la gestión de turnos se mantienen intactas.
   ================================================================ */
const PedidoManager = (() => {

  let turnoActual = null;
  let auditLog = [];
  let _pedidoRepo = null;

  /* ── INICIALIZACIÓN ─────────────────────────────────────── */
  function init(options = {}) {
    // Resolver repositorio
    if (options.pedidoRepo) {
      _pedidoRepo = options.pedidoRepo;
    } else if (typeof PedidoRepositoryLocal !== 'undefined') {
      _pedidoRepo = PedidoRepositoryLocal;
    } else {
      console.error('[PedidoManager] No se encontró un repositorio de pedidos válido.');
      return null;
    }

    // Cargar turno guardado o crear uno nuevo
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
    // Intentar vía CommandBus (CQRS) para validar turno y reglas de negocio
    if (typeof CommandBus !== 'undefined' && CommandBus.ejecutar) {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa, mozo, comensales, repo: _pedidoRepo }
      });
      if (resultado.exito) return resultado.data;
      console.error('[PedidoManager] Error vía CommandBus:', resultado.error);
      return null;
    }
    // Fallback: usar el repositorio directamente
    try {
      const pedido = await _pedidoRepo.crearPedidoMesa({
        mesa: numeroMesa,
        mozo: mozo || 'Sin mozo',
        comensales: comensales || 1
      });
      return pedido;
    } catch (e) {
      console.error('[PedidoManager] Error al crear pedido:', e);
      return null;
    }
  }

  function agregarItemAPedido(pedidoId, item) {
    // Por ahora, este método es un placeholder.
    // La gestión de ítems se realiza directamente en la UI (Comanda.agregarItem)
    // y el pedido se actualiza cuando se envía la comanda.
    // Si en el futuro se necesita lógica de negocio adicional, se implementará aquí.
    console.warn('[PedidoManager] agregarItemAPedido no implementado (se gestiona en UI).');
    return false;
  }

  /* ── MÉTODOS DE DELIVERY ────────────────────────────────── */
  function crearPedidoDelivery(datos) {
    // Normalizar datos y guardar en DB (o repositorio de delivery si existiera)
    const nuevo = {
      id: 'deliv_' + Date.now(),
      direccion: datos.direccion,
      telefono: datos.telefono || '',
      items: datos.items || [],
      total: datos.total || 0,
      estado: 'pendiente',
      repartidor: datos.repartidor || '',
      created_at: new Date().toISOString(),
      observaciones: datos.observaciones || ''
    };
    // Guardar en la lista local
    if (typeof DB !== 'undefined' && DB.pedidosDelivery) {
      DB.pedidosDelivery.push(nuevo);
      DB.savePedidosDelivery();
    }
    _registrarAuditoria('delivery:creado', { id: nuevo.id });
    return nuevo;
  }

  function enviarPedidoDeliveryACocina(deliveryId) {
    if (typeof DB === 'undefined' || !DB.pedidosDelivery) return false;
    const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!pedido) return false;
    if (pedido.estado !== 'pendiente') return false;

    pedido.estado = 'en_preparacion';
    DB.savePedidosDelivery();

    // Emitir evento para que el KDS lo muestre
    EventBus.emit('delivery:enviado_a_cocina', { deliveryId, items: pedido.items });
    _registrarAuditoria('delivery:enviado_a_cocina', { deliveryId });
    return true;
  }

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

    crearPedidoDelivery,
    enviarPedidoDeliveryACocina,

    registrar: _registrarAuditoria,
    finalizarTurno
  };
})();

window.PedidoManager = PedidoManager;