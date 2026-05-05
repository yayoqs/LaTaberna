/* ================================================================
   PubPOS — MÓDULO: crear-pedido-mesa.js (v2 – usa repositorio inyectado)
   Propósito: Comando + handler para crear un pedido de mesa.
              Ahora recibe el repositorio a través de los datos del
              comando, desacoplándose de DB directamente.
   ================================================================ */

/**
 * Comando: CrearPedidoMesa
 * @param {object} datos - { numeroMesa, mozo, comensales }
 * @returns {object} comando para enviar al CommandBus
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

/* ── HANDLER ──────────────────────────────────────────────── */
/**
 * Ejecuta la lógica de creación de pedido de mesa.
 * Ahora usa el repositorio que viene en el comando (inyectado por PedidoManager).
 * Si no hay repositorio, falla de forma controlada.
 */
async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales, repo } = comando.datos;

  // 1. Validar turno
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  // 2. Validar mesa
  if (typeof DB === 'undefined' || !DB.getMesa) {
    throw new Error('Base de datos no disponible');
  }
  const mesa = DB.getMesa(numeroMesa);
  if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
  if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

  // 3. Marcar mesa como ocupada
  mesa.estado = 'ocupada';
  mesa.abiertaEn = Date.now();
  mesa.mozo = mozo;
  mesa.comensales = comensales;

  // 4. Crear pedido a través del repositorio inyectado
  if (!repo || typeof repo.crearPedidoMesa !== 'function') {
    throw new Error('Repositorio de pedidos no disponible');
  }

  let pedido;
  try {
    pedido = repo.crearPedidoMesa({ mesa: numeroMesa, mozo, comensales });
  } catch (e) {
    throw new Error('Error al crear pedido: ' + e.message);
  }

  if (!pedido) throw new Error('No se pudo crear el pedido');
  mesa.pedidoId = pedido.id;

  // 5. Sincronizar con Google Sheets (si el método existe, por retrocompatibilidad)
  if (typeof DB.syncGuardarPedido === 'function') {
    DB.syncGuardarPedido(pedido).catch(err => console.warn('[CrearPedidoMesa] Sync Sheets falló:', err));
  }

  // 6. Registrar en bitácora del turno
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo, comensales
    });
  }

  // 7. Emitir eventos para la UI
  EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
  EventBus.emit('pedido:creado', pedido);

  return pedido;
}

/* ── REGISTRO EN EL BUS (mantiene la suscripción previa) ──── */
// Si ya estaba registrado, no pasa nada porque commandBus.registrar reemplaza.
CommandBus.registrar('crearPedidoMesa', handleCrearPedidoMesa);

window.crearComandoPedidoMesa = crearComandoPedidoMesa;