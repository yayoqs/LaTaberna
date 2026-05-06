/* ================================================================
   PubPOS — COMANDO: enviar-comanda.js (CQRS)
   Propósito: Mover la lógica de envío de comandas fuera de la UI.
              El handler valida, crea las comandas, persiste en DB,
              actualiza el pedido y retorna los datos necesarios para
              que la UI muestre los tickets.
   ================================================================ */

/**
 * Crea un comando para enviar una comanda (cocina y/o barra).
 * @param {object} datos - { mesa, mozo, comensales, observaciones, itemsPendientes }
 * @returns {object} Comando con type 'enviarComanda'
 */
function crearComandoEnviarComanda(datos) {
  return {
    type: 'enviarComanda',
    datos: {
      mesa: datos.mesa,
      mozo: datos.mozo,
      comensales: datos.comensales,
      observaciones: datos.observaciones || '',
      itemsPendientes: datos.itemsPendientes  // array de ítems no enviados
    }
  };
}

/**
 * Handler del comando enviarComanda.
 * Realiza:
 *  1. Validar que haya ítems pendientes.
 *  2. Separar por destino (cocina / barra).
 *  3. Crear objetos comanda y agregarlos a DB.comandas.
 *  4. Marcar los ítems como enviados en la mesa.
 *  5. Actualizar el pedido asociado (si existe).
 *  6. Generar HTML de tickets para cocina y barra.
 *  7. Retornar un objeto con las comandas y los ticketsHTML.
 *
 * @param {object} comando - { type, datos: { mesa, mozo, comensales, observaciones, itemsPendientes } }
 * @returns {object} { comandas: [...], ticketsHTML: { cocina: string|null, barra: string|null } }
 */
async function handleEnviarComanda(comando) {
  const { mesa, mozo, comensales, observaciones, itemsPendientes } = comando.datos;

  // ── 1. Validaciones ────────────────────────────────────
  if (!mesa) throw new Error('Mesa no especificada');
  if (!itemsPendientes || !itemsPendientes.length) {
    throw new Error('No hay ítems pendientes para enviar');
  }

  // ── 2. Separar por destino ────────────────────────────
  const cocinaItems = itemsPendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
  const barraItems  = itemsPendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');

  if (!cocinaItems.length && !barraItems.length) {
    throw new Error('Los ítems no tienen un destino válido');
  }

  // ── 3. Función interna para crear una comanda ─────────
  const _crearComanda = (items, destinoKds) => {
    // Marcar como enviados en los ítems originales (la UI ya tiene referencia)
    items.forEach(it => {
      it.enviado = true;
      it.enviadoA = destinoKds;
      it.enviadoTs = Date.now();
    });

    const comanda = {
      id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
      mesa: mesa.numero,
      mozo: mozo,
      destino: destinoKds,
      items: items.map(it => ({ ...it })),  // copia
      observaciones: observaciones || '',
      estado: 'nueva',
      ts: Date.now()
    };

    // Persistir en DB
    if (typeof DB !== 'undefined' && DB.comandas) {
      DB.comandas.push(comanda);
      DB.saveComandas();
    }

    Logger.debug(`[EnviarComanda] Comanda creada para ${destinoKds}`, comanda);
    return comanda;
  };

  // ── 4. Crear comandas (según lo que haya) ─────────────
  const comandasCreadas = [];
  const ticketsGenerados = { cocina: null, barra: null };

  if (cocinaItems.length && barraItems.length) {
    // Ambos destinos → crear dos comandas separadas
    const comCocina = _crearComanda(cocinaItems, 'cocina');
    const comBarra  = _crearComanda(barraItems,  'barra');
    comandasCreadas.push(comCocina, comBarra);

    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.cocina = Tickets.generarComanda(comCocina, 'cocina');
      ticketsGenerados.barra  = Tickets.generarComanda(comBarra,  'barra');
    }
  } else if (cocinaItems.length) {
    const comCocina = _crearComanda(cocinaItems, 'cocina');
    comandasCreadas.push(comCocina);
    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.cocina = Tickets.generarComanda(comCocina, 'cocina');
    }
  } else if (barraItems.length) {
    const comBarra = _crearComanda(barraItems, 'barra');
    comandasCreadas.push(comBarra);
    if (typeof Tickets !== 'undefined') {
      ticketsGenerados.barra = Tickets.generarComanda(comBarra, 'barra');
    }
  }

  // ── 5. Actualizar estado de la mesa ──────────────────
  if (mesa.estado === 'libre') {
    mesa.estado = 'ocupada';
  }

  // ── 6. Persistir cambios en la mesa (DB) ────────────
  if (typeof DB !== 'undefined' && DB.saveMesas) {
    DB.saveMesas();
  }

  // ── 7. Actualizar pedido asociado (si existe) ───────
  if (mesa.pedidoId && typeof DB !== 'undefined' && DB.actualizarPedido) {
    try {
      await DB.actualizarPedido(mesa.pedidoId, {
        estado: 'en_proceso',
        items: JSON.stringify(mesa.items),
        total: calcularTotal(mesa.items),
        mozo: mesa.mozo,
        comensales: mesa.comensales,
        observaciones: mesa.observaciones
      });
      Logger.debug(`[EnviarComanda] Pedido ${mesa.pedidoId} actualizado.`);
    } catch (e) {
      Logger.warn('[EnviarComanda] No se pudo actualizar pedido:', e);
    }
  }

  // ── 8. Notificar a otros módulos ────────────────────
  EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
  comandasCreadas.forEach(c => EventBus.emit('comanda:enviada', c));

  Logger.info(`[EnviarComanda] ${comandasCreadas.length} comanda(s) enviada(s).`);

  return {
    comandas: comandasCreadas,
    ticketsHTML: ticketsGenerados
  };
}

// Registrar el handler en el CommandBus
CommandBus.registrar('enviarComanda', handleEnviarComanda);

// Exponer la función creadora para que otros módulos la usen
window.crearComandoEnviarComanda = crearComandoEnviarComanda;