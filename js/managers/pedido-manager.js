/* ================================================================
   PubPOS — MÓDULO: pedido-manager.js (v3.3 – logging unificado + JSDoc)
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

  /**
   * Registra un evento en la bitácora de auditoría.
   * @param {string} tipo - Tipo de evento (ej. 'mesa:abierta')
   * @param {object} datos - Datos asociados al evento
   */
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

  /**
   * Crea un pedido de mesa. Intenta usar CommandBus; si falla, usa el repositorio directamente.
   * @param {number} numeroMesa
   * @param {string} mozo
   * @param {number} comensales
   * @returns {Promise<object|null>}
   */
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

  /**
   * Agrega un ítem a un pedido (placeholder, la gestión real se hace en UI).
   * @param {string} pedidoId
   * @param {object} item
   * @returns {boolean}
   */
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
      created_at: new Date().toISOString(),
      observaciones: datos.observaciones || ''
    };
    if (typeof DB !== 'undefined' && DB.pedidosDelivery) {
      DB.pedidosDelivery.push(nuevo);
      DB.savePedidosDelivery();
    }
    _registrarAuditoria('delivery:creado', { id: nuevo.id });
    return nuevo;
  }

  /**
   * Envía un pedido de delivery a cocina cambiando su estado.
   * @param {string} deliveryId
   * @returns {boolean}
   */
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

  /**
   * Finaliza el turno actual delegando en TurnoManager.
   * @returns {Promise<{exito: boolean, mensaje: string}>}
   */
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