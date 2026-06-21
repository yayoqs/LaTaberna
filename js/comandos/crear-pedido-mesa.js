/* ================================================================
   PubPOS — COMANDO: crear-pedido-mesa.js (v3.1 – activa prepedidos)
   ================================================================
   Cambios:
   • Eliminado el acceso directo a DB para obtener/modificar la mesa.
   • Ahora usa repo.abrirMesa() que se encarga de toda la persistencia.
   • Mantiene validación de turno abierto.
   • Agregada activación de permite_prepedidos en Appwrite (canónico).
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
 * Valida turno abierto y delega toda la persistencia al repositorio.
 * @param {object} comando - { type, datos: { numeroMesa, mozo, comensales } }
 * @returns {Promise<object>} El pedido creado
 */
async function handleCrearPedidoMesa(comando) {
  const { numeroMesa, mozo, comensales } = comando.datos;

  // ── 1. Validar turno ──────────────────────────────────
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para crear pedidos');
  }

  // ── 2. Obtener repositorio ────────────────────────────
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.abrirMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación abrirMesa');
  }

  // ── 3. Delegar creación y cambio de estado ────────────
  let pedido;
  try {
    pedido = await repo.abrirMesa(numeroMesa, mozo || 'Sin mozo', comensales || 1);
  } catch (e) {
    throw new Error('Error al abrir la mesa: ' + e.message);
  }

  if (!pedido) throw new Error('No se pudo crear el pedido');

  // ── 3.1 Activar permite_prepedidos en Appwrite ────────
  await DBAppwrite.actualizar('mesas', String(numeroMesa), { permite_prepedidos: true });

  // ── 4. Auditoría ──────────────────────────────────────
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:abierta', {
      mesa: numeroMesa,
      pedidoId: pedido.id,
      mozo,
      comensales
    });
  }

  // ── 5. Notificar a otros módulos ──────────────────────
  EventBus.emit('mesa:actualizada', { mesa: numeroMesa, estado: 'ocupada' });
  EventBus.emit('pedido:creado', pedido);

  return pedido;
}

CommandBus.registrar('crearPedidoMesa', handleCrearPedidoMesa);
window.crearComandoPedidoMesa = crearComandoPedidoMesa;