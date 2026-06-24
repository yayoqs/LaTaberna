
/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/managers/pedido-manager.js
   Versión: 1.0.0
   Propósito: Gestor de pedidos de mesa y delivery, turnos y auditoría.
   Dependencias: js/lib/command-bus.js, js/lib/logger.js, js/db.js, js/lib/eventBus.js, js/auth.js (Auth.getNombre), js/managers/turno-manager.js, js/repositorios/pedido-repository.js
   ================================================================ */


const PedidoManager = (() => {

  let turnoActual = null;
  let auditLog = [];
  let _pedidoRepo = null;

  /**
   * Inicializa el gestor de pedidos: carga el turno actual o crea uno nuevo.
   * @param {object} options - Opciones { pedidoRepo }
   * @returns {object|null} El turno actual o null si falla
   */
  function init(options = {}) {
    if (options.pedidoRepo) {
      _pedidoRepo = options.pedidoRepo;
    } else if (typeof PedidoRepositoryLocal !== 'undefined') {
      _pedidoRepo = PedidoRepositoryLocal;
    } else {
      Logger.error('[PedidoManager] No se encontró un repositorio de pedidos válido.');
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
    Logger.info(`[PedidoManager] Turno activo: ${turnoActual.id} (${auditLog.length} registros).`);
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
    Logger.debug(`[Audit] ${tipo}:`, datos);
  }

  async function crearPedidoMesa(numeroMesa, mozo, comensales) {
    if (typeof CommandBus !== 'undefined' && CommandBus.ejecutar) {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa, mozo, comensales, repo: _pedidoRepo }
      });
      if (resultado.exito) return resultado.data;
      Logger.error('[PedidoManager] Error vía CommandBus:', resultado.error);
      return null;
    }
    try {
      const pedido = await _pedidoRepo.crearPedidoMesa({
        mesa: numeroMesa,
        mozo: mozo || 'Sin mozo',
        comensales: comensales || 1
      });
      return pedido;
    } catch (e) {
      Logger.error('[PedidoManager] Error al crear pedido:', e);
      return null;
    }
  }

  function agregarItemAPedido(pedidoId, item) {
    Logger.warn('[PedidoManager] agregarItemAPedido no implementado (se gestiona en UI).');
    return false;
  }

  /**
   * Crea un pedido de delivery y lo guarda en DB.
   * @param {object} datos - Datos del delivery
   * @returns {object} El pedido de delivery creado
   */
  function crearPedidoDelivery(datos) {
    const nuevo = {
      id: 'deliv_' + Date.now(),
      direccion: datos.direccion,
      telefono: datos.telefono || '',
      items: datos.items || [],
      total: datos.total || 0,
      estado: 'pendiente',
      repartidor: datos.repartidor || '',
      creadoEn: new Date().toISOString(),
      observaciones: datos.observaciones || ''
    };
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

    EventBus.emit('delivery:enviado_a_cocina', { deliveryId, items: pedido.items });
    _registrarAuditoria('delivery:enviado_a_cocina', { deliveryId });
    return true;
  }

  async function finalizarTurno() {
    if (typeof TurnoManager === 'undefined') {
      return { exito: false, mensaje: 'TurnoManager no disponible.' };
    }
    return await TurnoManager.cerrarTurno();
  }

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