/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/crear-pedido-mesa.js
   Versión: 1.0.4
   Propósito: Comando para crear un pedido asociado a una mesa.
              v1.0.4: asigna tipo=salon, origen=staff, pedidoId en comandas.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { PedidoManager } from '../managers/pedido-manager.js';

export function crearComandoPedidoMesa(datos) {
  return {
    type: 'crearPedidoMesa',
    datos: {
      numeroMesa: datos.numeroMesa,
      mozo: datos.mozo || 'Sin mozo',
      comensales: datos.comensales || 1,
      tipo: 'salon',
      origen: 'staff'
    }
  };
}

async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales } = comando.datos;

  if (!PedidoManager || !PedidoManager.obtenerTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.obtenerTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }
  if (typeof repo.abrirMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación abrirMesa');
  }

  if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
    try {
      const mesas = await DBAppwrite.listar('mesas');
      const existe = mesas.some(m => m.numero == numeroMesa);
      if (!existe) {
        Logger.warn('[crearPedidoMesa] Mesa ' + numeroMesa + ' no encontrada en Appwrite. Recreando...');
        const mesaBase = (typeof DB !== 'undefined' && DB.mesaVacia)
          ? DB.mesaVacia(numeroMesa, 'salon')
          : {
              numero: String(numeroMesa),
              estado: 'libre',
              pedidoId: '',
              comensales: 1,
              zona: 'salon',
              esVirtual: false
            };
        await DBAppwrite.crear('mesas', String(numeroMesa), mesaBase);
        Logger.info('[crearPedidoMesa] Mesa ' + numeroMesa + ' recreada exitosamente.');
      }
    } catch (e) {
      Logger.error('[crearPedidoMesa] Error al verificar/recrear mesa:', e);
    }
  }

  let pedido;
  try {
    pedido = await repo.abrirMesa(numeroMesa, mozo || 'Sin mozo', comensales || 1);
  } catch (e) {
    throw new Error('Error al abrir la mesa: ' + e.message);
  }
  if (!pedido) throw new Error('No se pudo crear el pedido');

  if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
    await DBAppwrite.actualizar('mesas', String(numeroMesa), { estado: 'ocupada', pedidoId: pedido.id });
  }

  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo,
      comensales
    });
  }

  EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
  EventBus.emit('pedido:creado', pedido);

  return pedido;
}

CommandBus.registrar('crearPedidoMesa', handleCrearPedidoMesa);