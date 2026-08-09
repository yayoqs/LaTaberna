/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/liberar-mesa.js
   Versión: 1.0.4
   Propósito: Liberar una mesa después del pago.
              v1.0.4: corregido getTurnoActual → obtenerTurnoActual.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { PedidoManager } from '../managers/pedido-manager.js';

export function crearComandoLiberarMesa(datos) {
  return {
    type: 'liberarMesa',
    datos: {
      numeroMesa: datos.numeroMesa
    }
  };
}

async function handleLiberarMesa(comando) {
  const { numeroMesa } = comando.datos;

  if (!PedidoManager || !PedidoManager.obtenerTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.obtenerTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto');
  }

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.liberarMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación liberarMesa');
  }

  try {
    await repo.liberarMesa(numeroMesa);
  } catch (e) {
    throw new Error('Error al liberar la mesa: ' + e.message);
  }

  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:liberada', { mesa: numeroMesa });
  }

  return { numeroMesa, estado: 'libre' };
}

CommandBus.registrar('liberarMesa', handleLiberarMesa);