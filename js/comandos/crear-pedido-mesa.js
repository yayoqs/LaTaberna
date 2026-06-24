/* ================================================================
   LaTaberna - PubPOS — COMANDO JS
   Archivo: js/comandos/crear-pedido-mesa.js
   Versión: 1.0.0
   Propósito: Comando para crear un pedido asociado a una mesa, con recreación automática de la mesa en Appwrite si faltara.
   Dependencias: CommandBus, Deps, EventBus, PedidoManager, DBAppwrite, DB, Logger
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

  // 1. Validar turno
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  // 2. Obtener repositorio
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }
  if (typeof repo.abrirMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación abrirMesa');
  }

  // 3. Asegurar que la mesa existe en Appwrite (anti-desaparición)
  if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
    try {
      const mesas = await DBAppwrite.listar('mesas');
      const existe = mesas.some(m => m.numero == numeroMesa);
      if (!existe) {
        Logger.warn('[crearPedidoMesa] Mesa ' + numeroMesa + ' no encontrada en Appwrite. Recreando...');
        const mesaBase = (typeof DB !== 'undefined' && DB.mesaVacia)
          ? DB.mesaVacia(numeroMesa, 'salon')
          : {
              numero: numeroMesa,
              estado: 'libre',
              pedidoId: '',
              items: '[]',
              mozo: '',
              comensales: 1,
              abiertaEn: new Date().toISOString(),
              observaciones: '',
              zona: 'salon',
              esVirtual: false,
              permite_prepedidos: false
            };
        await DBAppwrite.crear('mesas', String(numeroMesa), mesaBase);
        Logger.info('[crearPedidoMesa] Mesa ' + numeroMesa + ' recreada exitosamente.');
      }
    } catch (e) {
      Logger.error('[crearPedidoMesa] Error al verificar/recrear mesa:', e);
    }
  }

  // 4. Delegar creación del pedido
  let pedido;
  try {
    pedido = await repo.abrirMesa(numeroMesa, mozo || 'Sin mozo', comensales || 1);
  } catch (e) {
    throw new Error('Error al abrir la mesa: ' + e.message);
  }
  if (!pedido) throw new Error('No se pudo crear el pedido');

  // 5. Activar permite_prepedidos
  if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
    await DBAppwrite.actualizar('mesas', String(numeroMesa), { permite_prepedidos: true });
  }

  // 6. Auditoría
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo,
      comensales
    });
  }

  // 7. Notificar
  EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
  EventBus.emit('pedido:creado', pedido);

  return pedido;
}

CommandBus.registrar('crearPedidoMesa', handleCrearPedidoMesa);
window.crearComandoPedidoMesa = crearComandoPedidoMesa;