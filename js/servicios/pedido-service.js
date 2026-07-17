/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/pedido-service.js
   Versión: 1.0.5
   Propósito: Servicio de casos de uso para pedidos de mesa.
              Corrección: Logger en todos los catch.
   ================================================================ */

import { PedidoAgregado } from '../dominio/pedido.js';
import { Cantidad, crearCantidad } from '../dominio/cantidad.js';
import { Dinero, crearDinero } from '../dominio/dinero.js';
import { Resultado } from '../dominio/resultado.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';

const PedidoService = (() => {
  let _pedidoRepo = null;

  function configurar(repo) { _pedidoRepo = repo; }

  async function crearPedidoMesa({ numeroMesa, mozo, comensales }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');
    const cantComensales = crearCantidad(comensales || 1);
    if (!cantComensales) return Resultado.fallo('Cantidad de comensales inválida');
    let pedido;
    try {
      pedido = new PedidoAgregado('ped_' + Date.now(), numeroMesa, mozo || 'Sin mozo', cantComensales);
    } catch (e) {
      Logger.error('[PedidoService] Error al crear PedidoAgregado:', e);
      return Resultado.fallo(`Error al crear pedido: ${e.message}`);
    }
    try {
      await _pedidoRepo.crearPedidoMesa(pedido.toJSON());
    } catch (e) {
      Logger.error('[PedidoService] Error al guardar pedido en repositorio:', e);
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
      Logger.error('[PedidoService] Error al reconstruir pedido:', e);
      return Resultado.fallo(`Error al reconstruir pedido: ${e.message}`);
    }
    const dineroPrecio = crearDinero(precio);
    const cant = crearCantidad(cantidad);
    if (!dineroPrecio || !cant) return Resultado.fallo('Datos de ítem inválidos');
    try {
      pedido.agregarItem(nombre, dineroPrecio, cant);
    } catch (e) {
      Logger.error('[PedidoService] Error al agregar ítem:', e);
      return Resultado.fallo(`No se pudo agregar el ítem: ${e.message}`);
    }
    try {
      await _pedidoRepo.guardarPedido(pedido.toJSON());
    } catch (e) {
      Logger.error('[PedidoService] Error al guardar pedido:', e);
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
      Logger.error('[PedidoService] Error al reconstruir pedido:', e);
      return Resultado.fallo(`Error al reconstruir pedido: ${e.message}`);
    }
    try {
      if (descuento > 0) pedido.aplicarDescuento(descuento);
      pedido.cerrar();
    } catch (e) {
      Logger.error('[PedidoService] Error al cerrar pedido:', e);
      return Resultado.fallo(`No se pudo cerrar el pedido: ${e.message}`);
    }
    try {
      await _pedidoRepo.cerrarPedido(pedidoId, { formaPago, total: totalFinal, descuento, pedido: pedido.toJSON() });
    } catch (e) {
      Logger.error('[PedidoService] Error al guardar cierre en repositorio:', e);
      return Resultado.fallo(`Error al guardar cierre: ${e.message}`);
    }
    EventBus.emit('pedido:cerrado', { mesa: pedido.mesa, pedidoId, total: totalFinal, formaPago });
    return Resultado.ok(pedido);
  }

  async function cerrarPedidoSinLiberar(pedidoId, { formaPago, totalFinal, descuento = 0 }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');
    const datos = await _pedidoRepo.obtenerPorId(pedidoId);
    if (!datos) return Resultado.fallo('Pedido no encontrado');
    let pedido;
    try {
      pedido = _reconstruirPedido(datos);
    } catch (e) {
      Logger.error('[PedidoService] Error al reconstruir pedido:', e);
      return Resultado.fallo(`Error al reconstruir pedido: ${e.message}`);
    }
    try {
      if (descuento > 0) pedido.aplicarDescuento(descuento);
      pedido.cerrar();
    } catch (e) {
      Logger.error('[PedidoService] Error al cerrar pedido:', e);
      return Resultado.fallo(`No se pudo cerrar el pedido: ${e.message}`);
    }
    try {
      await _pedidoRepo.cerrarPedidoSinLiberar(pedidoId, { formaPago, total: totalFinal, descuento, pedido: pedido.toJSON() });
    } catch (e) {
      Logger.error('[PedidoService] Error al guardar cierre sin liberar en repositorio:', e);
      return Resultado.fallo(`Error al guardar cierre: ${e.message}`);
    }
    EventBus.emit('pedido:cerrado', { mesa: pedido.mesa, pedidoId, total: totalFinal, formaPago });
    return Resultado.ok(pedido);
  }

  async function agregarTransaccion(pedidoId, { persona, monto, formaPago }) {
    if (!_pedidoRepo) return Resultado.fallo('Repositorio no configurado');
    if (!monto || monto <= 0) return Resultado.fallo('El monto debe ser mayor a cero');

    let datos;
    try {
      datos = await _pedidoRepo.obtenerPorId(pedidoId);
    } catch (e) {
      Logger.error('[PedidoService] Error al obtener pedido por ID:', e);
      return Resultado.fallo('Error al obtener el pedido');
    }
    if (!datos) return Resultado.fallo('Pedido no encontrado');

    try {
      const resultado = await _pedidoRepo.agregarTransaccion(pedidoId, {
        persona: persona || 'General',
        monto,
        formaPago: formaPago || 'efectivo',
        timestamp: Date.now()
      });

      if (!resultado.exito) {
        return Resultado.fallo(resultado.error || 'Error al agregar transacción');
      }

      EventBus.emit('pedido:transaccion_agregada', {
        pedidoId,
        persona,
        monto,
        formaPago,
        saldoRestante: resultado.saldoRestante,
        pedidoCerrado: resultado.pedidoCerrado
      });

      if (resultado.pedidoCerrado) {
        const pedidoCerrado = await _pedidoRepo.obtenerPorId(pedidoId);
        EventBus.emit('pedido:cerrado', {
          mesa: pedidoCerrado.mesa,
          pedidoId,
          total: pedidoCerrado.total,
          formaPago: 'Mixto'
        });
      }

      return Resultado.ok({
        saldoRestante: resultado.saldoRestante,
        pedidoCerrado: resultado.pedidoCerrado
      });
    } catch (e) {
      Logger.error('[PedidoService] Error al agregar transacción:', e);
      return Resultado.fallo(`Error al agregar transacción: ${e.message}`);
    }
  }

  function _reconstruirPedido(datos) {
    const pedido = new PedidoAgregado(
      datos.id,
      datos.mesa,
      datos.mozo,
      crearCantidad(datos.comensales)
    );
    (datos.items || []).forEach(it => {
      pedido.agregarItem(
        it.nombre,
        crearDinero(it.precio),
        crearCantidad(it.cantidad || it.qty)
      );
    });
    if (datos.descuento) pedido.aplicarDescuento(datos.descuento);
    if (datos.estado === 'cerrado') pedido.cerrar();
    pedido.setObservaciones(datos.observaciones);
    return pedido;
  }

  return { configurar, crearPedidoMesa, agregarItem, cerrarPedido, cerrarPedidoSinLiberar, agregarTransaccion };
})();

export { PedidoService };