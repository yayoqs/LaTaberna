/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/agregar-mesa.js
   Versión: 1.0.8
   Propósito: Comando para agregar una nueva mesa.
              v1.0.8: asegura espacioId del local activo y loguea
                      persistencia.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { Deps } from '../lib/deps.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';
import { mesaVacia } from '../db-core.js';
import { Auth } from '../auth.js';
import { Logger } from '../lib/logger.js';

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

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.agregarMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación agregarMesa');
  }

  const local = Auth.obtenerLocalActivo();
  const espacioId = local?.id || 'lataberna';

  const nuevaMesa = {
    ...mesaVacia(numero, zona),
    numero,
    zona,
    espacioId
  };

  try {
    await repo.agregarMesa(nuevaMesa);
    Logger.info(`[agregarMesa] Mesa ${numero} persistida con espacioId ${espacioId}.`);
  } catch (e) {
    throw new Error('Error al agregar la mesa: ' + e.message);
  }

  Store.despachar({ type: 'MESA_AGREGAR', payload: nuevaMesa });
  EventBus.emit('mesa:agregada', nuevaMesa);

  return nuevaMesa;
}

CommandBus.registrar('agregarMesa', handleAgregarMesa);