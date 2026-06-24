/* ================================================================
   LaTaberna - PubPOS — COMANDO JS
   Archivo: js/comandos/agregar-mesa.js
   Versión: 1.0.0
   Propósito: Comando para agregar una nueva mesa validando turno y zona.
   Dependencias: CommandBus, Deps, EventBus, PedidoManager
   ================================================================ */

/**
 * Construye un comando para agregar una mesa.
 * @param {{ numero: number, zona: string }} datos
 * @returns {{ type: string, datos: object }}
 */
function crearComandoAgregarMesa(datos) {
  return {
    type: 'agregarMesa',
    datos: {
      numero: datos.numero,
      zona: datos.zona || 'salon'
    }
  };
}

/**
 * Handler del comando 'agregarMesa'.
 * Valida turno abierto, crea la mesa y la persiste usando el repositorio.
 */
async function handleAgregarMesa(comando) {
  const { numero, zona } = comando.datos;

  // ── 1. Validar turno ──────────────────────────────────
  if (typeof PedidoManager === 'undefined' || !PedidoManager.getTurnoActual) {
    throw new Error('Sistema de turnos no disponible');
  }
  const turno = PedidoManager.getTurnoActual();
  if (!turno || turno.estado !== 'abierto') {
    throw new Error('No hay turno abierto para agregar mesas');
  }

  // ── 2. Obtener repositorio ────────────────────────────
  let repo;
  try {
    repo = Deps.obtener('pedidoRepo');
  } catch (e) {
    throw new Error('Repositorio de pedidos no disponible: ' + e.message);
  }

  if (typeof repo.agregarMesa !== 'function') {
    throw new Error('El repositorio no soporta la operación agregarMesa');
  }

  // ── 3. Delegar persistencia ───────────────────────────
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

  // ── 4. Auditoría ──────────────────────────────────────
  if (typeof PedidoManager.registrar === 'function') {
    PedidoManager.registrar('mesa:agregada', { numero, zona });
  }

  // ── 5. Notificar a la UI ──────────────────────────────
  EventBus.emit('mesa:agregada', nuevaMesa);

  return nuevaMesa;
}

// Registrar el comando
CommandBus.registrar('agregarMesa', handleAgregarMesa);
window.crearComandoAgregarMesa = crearComandoAgregarMesa;