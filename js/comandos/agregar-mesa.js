/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/agregar-mesa.js
   Versión: 1.0.3
   Propósito: Comando para agregar una nueva mesa.
              Con imports explícitos. mesaVacia importado desde db-core.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { EventBus } from '../lib/eventBus.js';
import { mesaVacia } from '../db-core.js';

export function crearComandoAgregarMesa(datos) {
  return {
    type: 'agregarMesa',
    datos: {
      numero: datos.numero,
      zona: datos.zona || 'salon'
    }
  };
}

async function handleAgregarMesa(comando) {
  const { numero, zona } = comando.datos;

  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para agregar mesas');
  }

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.agregarMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación agregarMesa');
  }

  const nuevaMesa = {
    ...mesaVacia(numero, zona),
    numero,
    zona
  };

  try {
    await repo.agregarMesa(nuevaMesa);
  } catch (e) {
    throw new Error('Error al agregar la mesa: ' + e.message);
  }

  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:agregada', { numero, zona });
  }

  EventBus.emit('mesa:agregada', nuevaMesa);

  return nuevaMesa;
}

CommandBus.registrar('agregarMesa', handleAgregarMesa);