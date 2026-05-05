/* ================================================================
   PubPOS — MÓDULO: pedido-manager.js (v3 – inyección de repositorio)
   Propósito: Fachada CQRS para pedidos, gestión de turnos y bitácora.
              Ahora acepta un repositorio de pedidos opcional. Si no
              se provee, usa PedidoRepositoryLocal por defecto.
   ================================================================ */
const PedidoManager = (() => {

  let turnoActual = null;
  let auditLog = [];
  let _pedidoRepo = null;   // repositorio inyectado

  /* ── INICIALIZACIÓN ─────────────────────────────────────── */
  /**
   * @param {object} options - Opciones de inicialización.
   * @param {object} [options.pedidoRepo] - Repositorio de pedidos (implementa PedidoRepository).
   */
  function init(options = {}) {
    // Seleccionar repositorio
    if (options.pedidoRepo) {
      _pedidoRepo = options.pedidoRepo;
    } else if (typeof PedidoRepositoryLocal !== 'undefined') {
      _pedidoRepo = PedidoRepositoryLocal;
    } else {
      console.error('[PedidoManager] No se encontró un repositorio de pedidos válido.');
      return null;
    }

    // Cargar o crear turno
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
    // Preferir CommandBus si existe y tiene handler registrado
    if (typeof CommandBus !== 'undefined' && CommandBus.ejecutar) {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa, mozo, comensales, repo: _pedidoRepo }
      });
      if (resultado.exito) return resultado.data;
      console.error('[PedidoManager] Error vía CommandBus:', resultado.error);
      return null;
    }

    // Fallback directo con el repositorio inyectado
    return _crearPedidoMesaDirecto(numeroMesa, mozo, comensales);
  }

  function _crearPedidoMesaDirecto(numeroMesa, mozo, comensales) {
    if (!turnoActual || turnoActual.estado !== 'abierto') {
      console.error('[PedidoManager] No hay turno abierto.');
      return null;
    }
    if (!_pedidoRepo) {
      console.error('[PedidoManager] Repositorio no disponible');
      return null;
    }

    const mesa = DB.getMesa(numeroMesa);
    if (mesa && mesa.estado === 'libre') {
      mesa.estado = 'ocupada';
      mesa.abiertaEn = Date.now();
      mesa.mozo = mozo;
      mesa.comensales = comensales;
    }

    // Usar el repositorio inyectado (no DB directamente)
    let pedido;
    try {
      pedido = _pedidoRepo.crearPedidoMesa({ mesa: numeroMesa, mozo, comensales });
    } catch (e) {
      console.error('[PedidoManager] Error al crear pedido:', e);
      return null;
    }
    if (!pedido) return null;

    // El repositorio ya sincroniza con Sheets internamente (PedidoRepositoryLocal)
    // Pero mantenemos la llamada a syncGuardarPedido si existe por compatibilidad
    if (typeof DB.syncGuardarPedido === 'function') {
      DB.syncGuardarPedido(pedido).catch(err => console.warn('[PedidoManager] Sync fallido:', err));
    }

    _registrarAuditoria('mesa:abierta', {
      mesa: numeroMesa, pedidoId: pedido.id, mozo, comensales
    });

    EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
    EventBus.emit('pedido:creado', pedido);
    return pedido;
  }

  function agregarItemAPedido(pedidoId, item) {
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) { console.warn('[PedidoManager] Pedido no encontrado:', pedidoId); return false; }

    let items = [];
    try { items = JSON.parse(pedido.items || '[]'); } catch {}
    items.push(item);
    pedido.items = JSON.stringify(items);
    pedido.total = items.reduce((sum, it) => sum + it.precio * it.qty, 0);
    DB.savePedidos();

    _registrarAuditoria('pedido:item_agregado', {
      pedidoId, item: item.nombre, qty: item.qty, precio: item.precio
    });

    EventBus.emit('pedido:actualizado', pedido);
    return true;
  }

  function cerrarPedidoMesa(pedidoId, formaPago, total, descuento) {
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) { console.warn('[PedidoManager] Pedido no encontrado para cerrar:', pedidoId); return null; }

    if (typeof DB.cerrarPedido !== 'function') {
      console.error('[PedidoManager] DB.cerrarPedido no disponible');
      return null;
    }

    DB.cerrarPedido(pedidoId, formaPago, total, descuento);

    _registrarAuditoria('pedido:cerrado', {
      pedidoId, mesa: pedido.mesa, total, formaPago, descuento
    });

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
  function crearPedidoDelivery(datos) {
    if (!turnoActual || turnoActual.estado !== 'abierto') {
      console.error('[PedidoManager] No hay turno abierto.');
      return null;
    }

    const nuevo = DB.crearPedidoDelivery(datos);

    _registrarAuditoria('delivery:creado', {
      deliveryId: nuevo.id, direccion: datos.direccion, total: datos.total
    });

    EventBus.emit('pedidosDelivery:guardados');
    return nuevo;
  }

  function enviarPedidoDeliveryACocina(deliveryId) {
    const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!pedido) { console.warn('[PedidoManager] Delivery no encontrado:', deliveryId); return false; }

    const comanda = {
      id: 'kds_deliv_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      mesa: `Delivery ${deliveryId.slice(-6)}`,
      mozo: pedido.repartidor || 'Delivery',
      destino: 'cocina',
      items: pedido.items.map(it => ({
        prodId: it.prodId || it.nombre,
        nombre: it.nombre, precio: it.precio || 0, qty: it.qty, obs: '', enviado: false
      })),
      observaciones: `${pedido.direccion} - ${pedido.telefono}`,
      estado: 'nueva', ts: Date.now(), deliveryId
    };

    DB.comandas.push(comanda);
    DB.saveComandas();
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_preparacion' });

    _registrarAuditoria('delivery:enviado_a_cocina', { deliveryId, comandaId: comanda.id });

    EventBus.emit('comanda:enviada', comanda);
    EventBus.emit('pedidosDelivery:guardados');
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
    cerrarPedidoMesa,

    crearPedidoDelivery,
    enviarPedidoDeliveryACocina,

    registrar: _registrarAuditoria,
    finalizarTurno
  };
})();

window.PedidoManager = PedidoManager;