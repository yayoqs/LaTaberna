/* ================================================================
   PubPOS — COMANDO: crear-pedido-mesa.js (v2.3 – repo por defecto)
   ================================================================
   Cambio clave: si el comando no incluye un repositorio en "datos",
   se usa automáticamente PedidoRepositoryLocal. Esto evita que la
   UI tenga que conocer detalles de infraestructura.
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
  const { numeroMesa, mozo, comensales, repo } = comando.datos;

  // Validaciones de turno y mesa
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

  // ── Resolver repositorio ──────────────────────────
  // Si el comando no trae un repo explícito, usamos el adaptador local por defecto.
  const repoUsado = repo || (typeof PedidoRepositoryLocal !== 'undefined' ? PedidoRepositoryLocal : null);
  if (!repoUsado || typeof repoUsado.crearPedidoMesa !== 'function') {
    throw new Error('Repositorio de pedidos no disponible');
  }

  // Creamos el pedido usando el agregado de dominio
  let pedido;
  try {
    const cant = crearCantidad(comensales || 1);
    const agregado = new PedidoAgregado('ped_' + Date.now(), numeroMesa, mozo || 'Sin mozo', cant);
    pedido = agregado.toJSON();
    pedido.estado = 'abierta';
    pedido.items = '[]';
    pedido.total = 0;
    pedido.created_at = new Date().toISOString();
    pedido.updated_at = pedido.created_at;

    // Persistencia (local + Sheets) delegada al repositorio
    repoUsado.crearPedidoMesa(pedido);
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