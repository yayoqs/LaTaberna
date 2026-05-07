/* ================================================================
   PubPOS — COMANDO: crear-pedido-mesa.js (v2.2 – unificado CQRS)
   Propósito: Handler del comando 'crearPedidoMesa'. Crea un pedido
              de mesa en estado 'abierta' usando exclusivamente el
              repositorio y el agregado PedidoAgregado. Ya no se
              disparan sincronizaciones extras aquí, porque el
              repositorio es el responsable de persistir en Sheets.
   ================================================================ */

// Constructor de comando (para que la UI pueda fabricarlo)
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

// Handler registrado en el CommandBus
async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales, repo } = comando.datos;

  // Validaciones de turno y mesa (sin cambios)
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

  // Actualizamos la mesa inmediatamente
  mesa.estado = 'ocupada';
  mesa.abiertaEn = Date.now();
  mesa.mozo = mozo;
  mesa.comensales = comensales;

  if (!repo || typeof repo.crearPedidoMesa !== 'function') {
    throw new Error('Repositorio de pedidos no disponible');
  }

  // Creamos el pedido usando el agregado de dominio
  let pedido;
  try {
    const cant = crearCantidad(comensales || 1);
    const agregado = new PedidoAgregado('ped_' + Date.now(), numeroMesa, mozo || 'Sin mozo', cant);
    pedido = agregado.toJSON();
    // Aseguramos campos obligatorios para el backend
    pedido.estado = 'abierta';
    pedido.items = '[]';               // string JSON vacío
    pedido.total = 0;
    pedido.created_at = new Date().toISOString();
    pedido.updated_at = pedido.created_at;

    // El repositorio se encarga de guardar localmente y sincronizar con Sheets
    repo.crearPedidoMesa(pedido);
  } catch (e) {
    throw new Error('Error al crear pedido: ' + e.message);
  }

  if (!pedido) throw new Error('No se pudo crear el pedido');
  mesa.pedidoId = pedido.id;

  // Registramos auditoría si está disponible
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo,
      comensales
    });
  }

  // Notificamos a otros módulos
  EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
  EventBus.emit('pedido:creado', pedido);

  return pedido;
}

// Registro en el bus
CommandBus.registrar('crearPedidoMesa', handleCrearPedidoMesa);

// Exponer fábrica global
window.crearComandoPedidoMesa = crearComandoPedidoMesa;