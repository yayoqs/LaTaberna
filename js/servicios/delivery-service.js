/* ================================================================
   PubPOS — SERVICIO: DeliveryService (v1.1 – DDD completo)
   Propósito: Coordina el flujo de pedidos de entrega usando el
              agregado Delivery y los Value Objects. Retorna Resultado.
   ================================================================ */
const DeliveryService = (() => {

  let _deliveryRepo = null;

  /** @param {object} repo - Implementación del repositorio de delivery */
  function configurar(repo) {
    _deliveryRepo = repo;
  }

  /**
   * Crea un nuevo pedido de delivery.
   * @param {object} datos - { direccion: {...}, items: [...], repartidor, observaciones }
   * @returns {Promise<Resultado>}
   */
  async function crearDelivery({ direccion, items, repartidor, observaciones }) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio de delivery no configurado');

    // 1. Validar dirección
    const dir = crearDireccion(
      direccion.calle, direccion.numero, direccion.depto,
      direccion.referencia, direccion.telefono
    );
    if (!dir) return Resultado.fallo('Dirección inválida');

    // 2. Validar ítems
    if (!items || items.length === 0) return Resultado.fallo('Debe incluir al menos un ítem');

    // 3. Crear el Agregado Delivery
    let delivery;
    try {
      delivery = new Delivery('deliv_' + Date.now(), dir, repartidor);
      for (const it of items) {
        const precio = crearDinero(it.precio);
        const cantidad = crearCantidad(it.qty);
        if (!precio || !cantidad) return Resultado.fallo(`Datos inválidos en ítem: ${it.nombre}`);
        delivery.agregarItem(it.nombre, precio, cantidad);
      }
      delivery.setObservaciones(observaciones);
    } catch (e) {
      return Resultado.fallo(`Error al crear delivery: ${e.message}`);
    }

    // 4. Persistir
    try {
      await _deliveryRepo.crearDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar delivery: ${e.message}`);
    }

    EventBus.emit('delivery:creado', delivery.toJSON());
    return Resultado.ok(delivery);
  }

  /**
   * Envía un pedido a cocina (cambia estado a 'en_preparacion').
   * @param {string} deliveryId
   * @returns {Promise<Resultado>}
   */
  async function enviarACocina(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = _reconstruirDelivery(datos);
      delivery.enviarACocina();
    } catch (e) {
      return Resultado.fallo(`No se pudo enviar a cocina: ${e.message}`);
    }

    try {
      await _deliveryRepo.guardarDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al actualizar delivery: ${e.message}`);
    }

    EventBus.emit('delivery:enviado_a_cocina', { deliveryId, items: delivery.items });
    return Resultado.ok(delivery);
  }

  /**
   * Despacha el pedido (en camino).
   * @param {string} deliveryId
   * @returns {Promise<Resultado>}
   */
  async function despachar(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = _reconstruirDelivery(datos);
      delivery.despachar();
    } catch (e) {
      return Resultado.fallo(`No se pudo despachar: ${e.message}`);
    }

    try {
      await _deliveryRepo.guardarDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al actualizar delivery: ${e.message}`);
    }

    return Resultado.ok(delivery);
  }

  /**
   * Confirma la entrega del pedido.
   * @param {string} deliveryId
   * @returns {Promise<Resultado>}
   */
  async function confirmarEntrega(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = _reconstruirDelivery(datos);
      delivery.confirmarEntrega();
    } catch (e) {
      return Resultado.fallo(`No se pudo confirmar entrega: ${e.message}`);
    }

    try {
      await _deliveryRepo.guardarDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al actualizar delivery: ${e.message}`);
    }

    return Resultado.ok(delivery);
  }

  /**
   * Cancela un pedido de delivery.
   * @param {string} deliveryId
   * @returns {Promise<Resultado>}
   */
  async function cancelar(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = _reconstruirDelivery(datos);
      delivery.cancelar();
    } catch (e) {
      return Resultado.fallo(`No se pudo cancelar: ${e.message}`);
    }

    try {
      await _deliveryRepo.guardarDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al actualizar delivery: ${e.message}`);
    }

    return Resultado.ok(delivery);
  }

  // ── UTILIDAD PRIVADA ──────────────────────────────────────
  function _reconstruirDelivery(datos) {
    const dir = new Direccion(
      datos.direccion?.calle || datos.direccion,
      datos.direccion?.numero || '',
      datos.direccion?.depto || '',
      datos.direccion?.referencia || '',
      datos.direccion?.telefono || ''
    );
    const delivery = new Delivery(datos.id, dir, datos.repartidor);
    (datos.items || []).forEach(it => {
      delivery.agregarItem(it.nombre, crearDinero(it.precio), crearCantidad(it.cantidad));
    });
    delivery.setObservaciones(datos.observaciones);
    // Forzar estado si es necesario
    if (datos.estado === 'en_preparacion') { delivery.enviarACocina(); }
    if (datos.estado === 'en_camino')       { delivery.enviarACocina(); delivery.despachar(); }
    if (datos.estado === 'entregado')       { delivery.enviarACocina(); delivery.despachar(); delivery.confirmarEntrega(); }
    if (datos.estado === 'cancelado')       { delivery.cancelar(); }
    return delivery;
  }

  return {
    configurar,
    crearDelivery,
    enviarACocina,
    despachar,
    confirmarEntrega,
    cancelar
  };
})();
window.DeliveryService = DeliveryService;