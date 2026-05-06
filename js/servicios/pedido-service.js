/* ================================================================
   PubPOS — SERVICIO: PedidoService (v1.3 – usa PedidoAgregado)
   ================================================================ */
const PedidoService = (() => {

  let _pedidoRepo = null;

  function configurar(repo) { _pedidoRepo = repo; }

  async function crearPedidoMesa({ numeroMesa, mozo, comensales }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');

    const cantComensales = crearCantidad(comensales || 1);
    if (!cantComensales) return Resultado.fallo('Cantidad de comensales inválida');

    let pedido;
    try {
      pedido = new PedidoAgregado(     // ← Renombrado
        'ped_' + Date.now(),
        numeroMesa,
        mozo || 'Sin mozo',
        cantComensales
      );
    } catch (e) {
      return Resultado.fallo(`Error al crear pedido: ${e.message}`);
    }

    try {
      await _pedidoRepo.crearPedidoMesa(pedido.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar pedido: ${e.message}`);
    }

    EventBus.emit('pedido:creado', pedido.toJSON());
    return Resultado.ok(pedido);
  }

  async function agregarItem(pedidoId, { nombre, precio, cantidad }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _pedidoRepo.obtenerPorId(pedidoId);
    if (!datos) return Resultado.fallo('Pedido no encontrado');

    let pedido;
    try {
      pedido = _reconstruirPedido(datos);
    } catch (e) {
      return Resultado.fallo(`Error al reconstruir pedido: ${e.message}`);
    }

    const dineroPrecio = crearDinero(precio);
    const cant = crearCantidad(cantidad);
    if (!dineroPrecio || !cant) return Resultado.fallo('Datos de ítem inválidos');

    try {
      pedido.agregarItem(nombre, dineroPrecio, cant);
    } catch (e) {
      return Resultado.fallo(`No se pudo agregar el ítem: ${e.message}`);
    }

    try {
      await _pedidoRepo.guardarPedido(pedido.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar pedido: ${e.message}`);
    }

    EventBus.emit('pedido:item_agregado', { pedidoId, nombre, cantidad });
    return Resultado.ok(pedido);
  }

  async function cerrarPedido(pedidoId, { formaPago, totalFinal, descuento = 0 }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _pedidoRepo.obtenerPorId(pedidoId);
    if (!datos) return Resultado.fallo('Pedido no encontrado');

    let pedido;
    try {
      pedido = _reconstruirPedido(datos);
    } catch (e) {
      return Resultado.fallo(`Error al reconstruir pedido: ${e.message}`);
    }

    try {
      if (descuento > 0) pedido.aplicarDescuento(descuento);
      pedido.cerrar();
    } catch (e) {
      return Resultado.fallo(`No se pudo cerrar el pedido: ${e.message}`);
    }

    try {
      await _pedidoRepo.cerrarPedido(pedidoId, {
        formaPago,
        total: totalFinal,
        descuento,
        pedido: pedido.toJSON()
      });
    } catch (e) {
      return Resultado.fallo(`Error al guardar cierre: ${e.message}`);
    }

    EventBus.emit('pedido:cerrado', {
      mesa: pedido.mesa,
      pedidoId,
      total: totalFinal,
      formaPago
    });

    return Resultado.ok(pedido);
  }

  // ── UTILIDAD PRIVADA ──────────────────────────────────
  function _reconstruirPedido(datos) {
    const pedido = new PedidoAgregado(       // ← Renombrado
      datos.id,
      datos.mesa,
      datos.mozo,
      crearCantidad(datos.comensales)
    );
    (datos.items || []).forEach(it => {
      pedido.agregarItem(
        it.nombre,
        crearDinero(it.precio),
        crearCantidad(it.cantidad)
      );
    });
    if (datos.descuento) pedido.aplicarDescuento(datos.descuento);
    if (datos.estado === 'cerrado') pedido.cerrar();
    pedido.setObservaciones(datos.observaciones);
    return pedido;
  }

  return {
    configurar,
    crearPedidoMesa,
    agregarItem,
    cerrarPedido
  };
})();
window.PedidoService = PedidoService;