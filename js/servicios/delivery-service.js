/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/delivery-service.js
   Versión: 1.0.1
   Propósito: Servicio de casos de uso para pedidos de delivery.
              Sin asignaciones window.
   Dependencias: js/dominio/delivery.js, js/dominio/direccion.js,
                 js/dominio/dinero.js, js/dominio/cantidad.js,
                 js/dominio/resultado.js, js/lib/eventBus.js,
                 js/lib/logger.js
   ================================================================ */

import { Delivery, reconstruirDelivery } from '../dominio/delivery.js';
import { Direccion, crearDireccion } from '../dominio/direccion.js';
import { Dinero, crearDinero } from '../dominio/dinero.js';
import { Cantidad, crearCantidad } from '../dominio/cantidad.js';
import { Resultado } from '../dominio/resultado.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';

const DeliveryService = (() => {
  let _deliveryRepo = null;

  function configurar(repo) { _deliveryRepo = repo; }

  async function crearDelivery({ direccion, items, repartidor, observaciones }) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio de delivery no configurado');

    const dir = crearDireccion(
      direccion.calle, direccion.numero, direccion.depto,
      direccion.referencia, direccion.telefono
    );
    if (!dir) return Resultado.fallo('Dirección inválida');

    if (!items || items.length === 0) return Resultado.fallo('Debe incluir al menos un ítem');

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

    try {
      await _deliveryRepo.crearDelivery(delivery.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar delivery: ${e.message}`);
    }

    EventBus.emit('delivery:creado', delivery.toJSON());
    return Resultado.ok(delivery);
  }

  async function enviarACocina(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');
    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = reconstruirDelivery(datos);
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

  async function despachar(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');
    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = reconstruirDelivery(datos);
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

  async function confirmarEntrega(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');
    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = reconstruirDelivery(datos);
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

  async function cancelar(deliveryId) {
    if (!_deliveryRepo) return Resultado.fallo('Repositorio no configurado');
    const datos = await _deliveryRepo.obtenerPorId(deliveryId);
    if (!datos) return Resultado.fallo('Delivery no encontrado');

    let delivery;
    try {
      delivery = reconstruirDelivery(datos);
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

  return { configurar, crearDelivery, enviarACocina, despachar, confirmarEntrega, cancelar };
})();

export { DeliveryService };