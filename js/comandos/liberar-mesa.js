/* ================================================================
   PubPOS — COMANDO: liberar-mesa.js
   Propósito: Liberar una mesa después del pago, restaurándola al
              estado libre y quitando la virtual si corresponde.
   ================================================================ */

function crearComandoLiberarMesa(datos) {
  return {
    type: 'liberarMesa',
    datos: {
      numeroMesa: datos.numeroMesa
    }
  };
}

async function handleLiberarMesa(comando) {
  const { numeroMesa } = comando.datos;

  // ── 1. Validar turno ──────────────────────────────────
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto');
  }

  // ── 2. Obtener repositorio ────────────────────────────
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.liberarMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación liberarMesa');
  }

  // ── 3. Ejecutar liberación ────────────────────────────
  try {
    await repo.liberarMesa(numeroMesa);
  } catch (e) {
    throw new Error('Error al liberar la mesa: ' + e.message);
  }

  // ── 4. Auditoría ──────────────────────────────────────
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:liberada', { mesa: numeroMesa });
  }

  return { numeroMesa, estado: 'libre' };
}

CommandBus.registrar('liberarMesa', handleLiberarMesa);
window.crearComandoLiberarMesa = crearComandoLiberarMesa;