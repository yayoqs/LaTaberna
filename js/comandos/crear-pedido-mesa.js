/* ================================================================
   PubPOS — COMANDO: crear-pedido-mesa.js (v2.4 – delegación total al repo)
   ================================================================
   El handler ya no construye el agregado. Solo valida turno y mesa,
   y luego invoca al repositorio para que cree y persista el pedido.
   El repositorio es responsable de normalizar los datos para Sheets.
   ================================================================ */

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

async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales } = comando.datos;

  // Validaciones de turno
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  // Validación de mesa
  if (typeof DB === 'undefined' || !DB.getMesa) {
    throw new Error('Base de datos no disponible');
  }
  const mesa = DB.getMesa(numeroMesa);
  if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
  if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

  // Resolver repositorio
  const repo = comando.datos.repo || 
               (typeof PedidoRepositoryLocal !== 'undefined' ? PedidoRepositoryLocal : null);
  if (!repo || typeof repo.crearPedidoMesa !== 'function') {
    throw new Error('Repositorio de pedidos no disponible');
  }

  // Actualizar la mesa en memoria (el repositorio también lo hará, pero así reflejamos el cambio inmediato)
  mesa.estado = 'ocupada';
  mesa.abiertaEn = Date.now();
  mesa.mozo = mozo;
  mesa.comensales = comensales;

  // Delegar creación y persistencia al repositorio
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

  // Auditoría
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