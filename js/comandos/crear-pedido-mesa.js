/* ================================================================
   PubPOS — COMANDO: crear-pedido-mesa.js (v2.6 – logging + JSDoc)
   ================================================================ */

/**
 * Construye un comando para abrir una mesa.
 * @param {{ numeroMesa: number, mozo: string, comensales: number }} datos
 * @returns {{ type: string, datos: object }}
 */
function crearComandoPedidoMesa(datos) {
  return {
    type: 'crearPedidoMesa',
    datos: {
      numeroMesa: datos.numeroMesa,
      mozo: datos.mozo || 'Sin mozo',
      comensales: datos.comensales || 1
    }
  };
}

/**
 * Handler del comando 'crearPedidoMesa'.
 * Valida turno y mesa, crea el pedido y lo persiste.
 * @param {object} comando - { type, datos: { numeroMesa, mozo, comensales } }
 * @returns {Promise<object>} El pedido creado
 */
async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales } = comando.datos;

  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  if (typeof DB === 'undefined' || !DB.getMesa) {
    throw new Error('Base de datos no disponible');
  }
  const mesa = DB.getMesa(numeroMesa);
  if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
  if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  mesa.estado = 'ocupada';
  mesa.abiertaEn = Date.now();
  mesa.mozo = mozo;
  mesa.comensales = comensales;

  let pedido;
  try {
    pedido = await repo.crearPedidoMesa({
      mesa: numeroMesa,
      mozo: mozo || 'Sin mozo',
      comensales: comensales || 1
    });
  } catch (e) {
    throw new Error('Error al crear pedido: ' + e.message);
  }

  if (!pedido) throw new Error('No se pudo crear el pedido');
  mesa.pedidoId = pedido.id;

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
window.crearComandoPedidoMesa = crearComandoPedidoMesa;