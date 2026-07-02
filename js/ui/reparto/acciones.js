/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/acciones.js
   Versión: 1.0.0
   Propósito: Acciones sobre pedidos de delivery: enviar a cocina,
              despachar, confirmar entrega, eliminar.
   ================================================================ */

import { DB } from '../../db.js';
import { DeliveryService } from '../../servicios/delivery-service.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { showToast } from '../../utils.js';

export async function enviarACocina(deliveryId) {
  if (typeof DB !== 'undefined' && DB.comandas) {
    const existeComanda = DB.comandas.find(c => c.deliveryId === deliveryId);
    if (existeComanda) {
      showToast('warning', 'Este pedido ya tiene una comanda en cocina.');
      return;
    }
  }

  if (typeof DeliveryService !== 'undefined' && DeliveryService.enviarACocina) {
    const r = await DeliveryService.enviarACocina(deliveryId);
    if (r.exito) {
      _crearComandaParaDelivery(deliveryId);
      showToast('success', 'Enviado a Cocina');
      return;
    } else {
      showToast('error', r.error);
      return;
    }
  }

  const ped = DB.pedidosDelivery.find(p => p.id === deliveryId);
  if (!ped) { showToast('error', 'No encontrado'); return; }
  DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_preparacion' });
  _crearComandaParaDelivery(deliveryId);
  showToast('success', 'Enviado a Cocina');
}

function _crearComandaParaDelivery(deliveryId) {
  const ped = DB.pedidosDelivery.find(p => p.id === deliveryId);
  if (!ped) return;

  const destino = 'cocina';
  const itemsParaComanda = ped.items.map(it => ({
    prodId: it.prodId || '',
    nombre: it.nombre,
    precio: it.precio,
    qty: it.qty,
    destino: destino,
    obs: '',
    enviado: true,
    enviadoA: destino,
    enviadoTs: Date.now()
  }));

  const comanda = {
    id: 'kds_deliv_' + deliveryId,
    mesa: 'Deliv #' + deliveryId.slice(-6),
    mozo: ped.repartidor || 'Delivery',
    destino: destino,
    items: itemsParaComanda,
    observaciones: ped.observaciones || '',
    estado: 'nueva',
    ts: Date.now(),
    deliveryId: deliveryId
  };

  if (typeof DB !== 'undefined' && DB.comandas) {
    DB.comandas.push(comanda);
    DB.saveComandas();
  }
  EventBus.emit('comanda:enviada', comanda);
  Logger.debug(`[Reparto] Comanda de delivery creada: ${comanda.id}`);
}

export async function despachar(deliveryId) {
  if (typeof DeliveryService !== 'undefined' && DeliveryService.despachar) {
    const r = await DeliveryService.despachar(deliveryId);
    if (r.exito) {
      DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_camino' });
      showToast('success', 'En camino');
      return;
    } else {
      showToast('error', r.error);
      return;
    }
  }
  DB.actualizarPedidoDelivery(deliveryId, { estado: 'en_camino' });
  showToast('success', 'En camino');
}

export async function confirmarEntrega(deliveryId) {
  if (typeof DeliveryService !== 'undefined' && DeliveryService.confirmarEntrega) {
    const r = await DeliveryService.confirmarEntrega(deliveryId);
    if (r.exito) {
      DB.actualizarPedidoDelivery(deliveryId, { estado: 'entregado' });
      showToast('success', 'Entregado');
      return;
    } else {
      showToast('error', r.error);
      return;
    }
  }
  DB.actualizarPedidoDelivery(deliveryId, { estado: 'entregado' });
  showToast('success', 'Entregado');
}

export function eliminarPedido(id) {
  if (!confirm('¿Eliminar este pedido?')) return;
  if (typeof DeliveryService !== 'undefined' && DeliveryService.cancelar) {
    DeliveryService.cancelar(id).then(r => {
      if (r.exito) {
        DB.eliminarPedidoDelivery(id);
        showToast('warning', 'Cancelado');
      } else {
        showToast('error', r.error);
      }
    });
    return;
  }
  DB.eliminarPedidoDelivery(id);
  showToast('warning', 'Eliminado');
}