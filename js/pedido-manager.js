/* ================================================================
   PubPOS — MÓDULO: pedido-manager.js (v1 – Fase 1: PedidoManager + Bitácora)
   Propósito: Centraliza la creación y cierre de pedidos (mesas y delivery)
              y registra cada acción en una bitácora de auditoría por turno.
   ================================================================ */
const PedidoManager = (() => {

  let turnoActual = null;     // objeto turno { id, inicio, estado }
  let auditLog = [];          // bitácora en memoria

  /* ── INICIALIZACIÓN ─────────────────────────────────────── */
  function init() {
    // Intentar cargar turno existente
    const turnoGuardado = localStorage.getItem('pubpos_turno_actual');
    if (turnoGuardado) {
      try {
        turnoActual = JSON.parse(turnoGuardado);
        console.log(`[PedidoManager] Turno existente: ${turnoActual.id}`);
      } catch (e) {
        turnoActual = null;
      }
    }

    // Si no hay turno, crear uno nuevo
    if (!turnoActual || turnoActual.estado === 'cerrado') {
      _iniciarNuevoTurno();
    }

    // Cargar bitácora del turno actual
    _cargarAuditLog();

    EventBus.emit('turno:iniciado', turnoActual);
    console.log(`[PedidoManager] Turno activo: ${turnoActual.id} (${auditLog.length} registros en bitácora).`);
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

    turnoActual = {
      id: id,
      inicio: ahora.toISOString(),
      estado: 'abierto'
    };
    localStorage.setItem('pubpos_turno_actual', JSON.stringify(turnoActual));
    auditLog = [];
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
  }

  function _cargarAuditLog() {
    if (!turnoActual) return;
    const raw = localStorage.getItem('pubpos_audit_' + turnoActual.id);
    if (raw) {
      try { auditLog = JSON.parse(raw); } catch { auditLog = []; }
    } else {
      auditLog = [];
    }
  }

  function _guardarAuditLog() {
    if (!turnoActual) return;
    localStorage.setItem('pubpos_audit_' + turnoActual.id, JSON.stringify(auditLog));
    EventBus.emit('audit:actualizado', { turnoId: turnoActual.id, total: auditLog.length });
  }

  /* ── REGISTRO DE AUDITORÍA ─────────────────────────────── */
  function _registrarAuditoria(tipo, datos) {
    const entrada = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      timestamp: new Date().toISOString(),
      tipo: tipo,
      datos: datos,
      usuario: (typeof Auth !== 'undefined' && Auth.getNombre) ? Auth.getNombre() : 'sistema'
    };
    auditLog.push(entrada);
    _guardarAuditLog();
    console.log(`[Audit] ${tipo}:`, datos);
  }

  /* ── MÉTODOS DE PEDIDOS (MESA) ──────────────────────────── */
  /**
   * Crea un pedido para una mesa.
   * @returns {object} pedido creado
   */
  function crearPedidoMesa(numeroMesa, mozo, comensales) {
    if (!turnoActual || turnoActual.estado !== 'abierto') {
      console.error('[PedidoManager] No hay turno abierto.');
      return null;
    }

    // Usar la misma lógica de DB (core) para generar el pedido
    if (typeof DB === 'undefined' || !DB.crearPedido) {
      console.error('[PedidoManager] DB no disponible');
      return null;
    }

    // Buscar la mesa y marcarla como ocupada si está libre
    const mesa = DB.getMesa(numeroMesa);
    if (mesa && mesa.estado === 'libre') {
      mesa.estado = 'ocupada';
      mesa.abiertaEn = Date.now();
      mesa.mozo = mozo;
      mesa.comensales = comensales;
    }

    // Crear pedido en DB (core)
    const pedido = DB.crearPedido(numeroMesa, mozo, comensales);
    if (!pedido) return null;

    // Registrar en bitácora
    _registrarAuditoria('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo: mozo,
      comensales: comensales
    });

    // Emitir evento para UI
    EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
    EventBus.emit('pedido:creado', pedido);

    return pedido;
  }

  /**
   * Agrega un ítem a un pedido existente.
   */
  function agregarItemAPedido(pedidoId, item) {
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) {
      console.warn('[PedidoManager] Pedido no encontrado:', pedidoId);
      return false;
    }

    // Actualizar items en el pedido (core)
    let items = [];
    try { items = JSON.parse(pedido.items || '[]'); } catch {}
    items.push(item);
    pedido.items = JSON.stringify(items);
    pedido.total = items.reduce((sum, it) => sum + it.precio * it.qty, 0);
    DB.savePedidos();

    // Registrar en bitácora
    _registrarAuditoria('pedido:item_agregado', {
      pedidoId: pedidoId,
      item: item.nombre,
      qty: item.qty,
      precio: item.precio
    });

    EventBus.emit('pedido:actualizado', pedido);
    return true;
  }

  /**
   * Cierra un pedido de mesa y registra el pago.
   */
  function cerrarPedidoMesa(pedidoId, formaPago, total, descuento) {
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) {
      console.warn('[PedidoManager] Pedido no encontrado:', pedidoId);
      return null;
    }

    // Llamar a DB.cerrarPedido (orquestador) que descuenta stock
    if (typeof DB.cerrarPedido !== 'function') {
      console.error('[PedidoManager] DB.cerrarPedido no disponible');
      return null;
    }

    DB.cerrarPedido(pedidoId, formaPago, total, descuento);

    // Registrar en bitácora
    _registrarAuditoria('pedido:cerrado', {
      pedidoId: pedidoId,
      mesa: pedido.mesa,
      total: total,
      formaPago: formaPago,
      descuento: descuento
    });

    // Liberar mesa
    const mesa = DB.getMesa(pedido.mesa);
    if (mesa && !mesa.esVirtual) {
      const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(mesa.numero);
      DB.saveMesas();
    }

    EventBus.emit('pedido:cerrado', { mesa: pedido.mesa, pedidoId: pedidoId });
    return pedido;
  }

  /* ── MÉTODOS DE DELIVERY ────────────────────────────────── */
  /**
   * Crea un pedido de delivery (reparto).
   */
  function crearPedidoDelivery(datos) {
    if (!turnoActual || turnoActual.estado !== 'abierto') {
      console.error('[PedidoManager] No hay turno abierto.');
      return null;
    }

    const nuevo = DB.crearPedidoDelivery(datos);

    _registrarAuditoria('delivery:creado', {
      deliveryId: nuevo.id,
      direccion: datos.direccion,
      total: datos.total
    });

    EventBus.emit('pedidosDelivery:guardados');
    return nuevo;
  }

  /**
   * Envía un pedido de delivery a cocina/barra creando una comanda KDS.
   */
  function enviarPedidoDeliveryACocina(deliveryId) {
    const pedido = DB.pedidosDelivery.find(p => p.id === deliveryId);
    if (!pedido) {
      console.warn('[PedidoManager] Delivery no encontrado:', deliveryId);
      return false;
    }

    // (Opcional: validar stock como en reparto.js)
    // Crear comanda similar a reparto.enviarACocina
    const comanda = {
      id: 'kds_deliv_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      mesa: `Delivery ${deliveryId.slice(-6)}`,
      mozo: pedido.repartidor || 'Delivery',
      destino: 'cocina',
      items: pedido.items.map(it => ({
        prodId: it.prodId || it.nombre,
        nombre: it.nombre,
        precio: it.precio || 0,
        qty: it.qty,
        obs: '',
        enviado: false
      })),
      observaciones: `${pedido.direccion} - ${pedido.telefono}`,
      estado: 'nueva',
      ts: Date.now(),
      deliveryId: deliveryId
    };

    DB.comandas.push(comanda);
    DB.saveComandas();
    DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_preparacion' });

    _registrarAuditoria('delivery:enviado_a_cocina', {
      deliveryId: deliveryId,
      comandaId: comanda.id
    });

    EventBus.emit('comanda:enviada', comanda);
    EventBus.emit('pedidosDelivery:guardados');
    return true;
  }

  /* ── API PÚBLICA ────────────────────────────────────────── */
  return {
    init,
    getTurnoActual: () => turnoActual,
    getAuditLog: () => auditLog,

    // Mesa
    crearPedidoMesa,
    agregarItemAPedido,
    cerrarPedidoMesa,

    // Delivery
    crearPedidoDelivery,
    enviarPedidoDeliveryACocina,

    // Bitácora expuesta (debug / reportes)
    registrar: _registrarAuditoria
  };
})();

window.PedidoManager = PedidoManager;