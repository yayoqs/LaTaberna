/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/modulos/interno/precarga-control.js
   Versión: 1.0.1
   Propósito: Gestionar la recepción de precargas del cliente y su
              integración con el mapa de mesas y la comanda.
   Dependencias: window.EventBus, window.CommandBus, window.DBAppwrite,
                 window.Logger, window.Mesas, window.Comanda, window.showToast
   ================================================================ */
const PrecargaControl = (() => {
  // Tomar dependencias del scope global
  const EventBus = window.EventBus;
  const CommandBus = window.CommandBus;
  const DBAppwrite = window.DBAppwrite;
  const Logger = window.Logger;
  const Mesas = window.Mesas;
  const Comanda = window.Comanda;
  // showToast se usa directamente desde window para permitir mock en tests

  const _precargas = new Map();

  function _onPrecargaEnviada(data) {
    if (!data || !data.id || !data.mesa || !Array.isArray(data.items)) {
      Logger.warn('[PrecargaControl] Payload inválido:', data);
      return;
    }

    const { id, mesa, items } = data;
    _precargas.set(id, { mesa, items, data });

    if (typeof Mesas !== 'undefined' && Mesas.setBadge) {
      Mesas.setBadge(mesa, items.length, id);
    }
    Logger.info(`[PrecargaControl] Precarga ${id} recibida para mesa ${mesa} con ${items.length} ítems.`);
  }

  async function _onBadgeClick(payload) {
    const { mesa, precargaId } = payload;
    const precarga = _precargas.get(precargaId);
    if (!precarga) {
      Logger.warn('[PrecargaControl] Precarga no encontrada:', precargaId);
      return;
    }

    const mesaActiva = Comanda.getMesaActiva();
    if (!mesaActiva || mesaActiva.numero !== mesa) {
      if (typeof window.showToast === 'function') {
        window.showToast('warning', `Abrí la mesa ${mesa} antes de cargar la precarga.`);
      }
      return;
    }

    const items = precarga.items;
    for (const item of items) {
      const producto = {
        id: item.prodId,
        nombre: item.nombre,
        precio: item.precio,
        categoria: item.categoria,
        destino: item.destino
      };

      for (let i = 0; i < (item.qty || 1); i++) {
        Comanda.agregarItem(producto);
      }

      const cantidadAgregada = item.qty || 1;
      const ultimoIndice = mesaActiva.items.length - 1;
      const primerIndice = ultimoIndice - cantidadAgregada + 1;

      if (item.obs && cantidadAgregada > 0) {
        Comanda.setObservacion(primerIndice, item.obs);
      }
    }

    const mozo = mesaActiva.mozo || 'Garzón';
    const resultado = await CommandBus.ejecutar({
      type: 'precarga:revisar',
      datos: { precargaId, revisadoPor: mozo }
    });

    if (resultado.exito) {
      if (typeof window.showToast === 'function') {
        window.showToast('success', `Precarga cargada en mesa ${mesa}.`);
      }
      Mesas.clearBadge(mesa);
      _precargas.delete(precargaId);
      Logger.info(`[PrecargaControl] Precarga ${precargaId} marcada como revisada.`);
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'No se pudo actualizar la precarga. Reintentá.');
      }
      Logger.error('[PrecargaControl] Error al revisar precarga:', resultado.error);
    }
  }

  // Registrar comando
  if (typeof CommandBus !== 'undefined') {
    CommandBus.registrar('precarga:revisar', async (datos) => {
      const { precargaId, revisadoPor } = datos;
      try {
        await DBAppwrite.actualizar('precargas_cliente', precargaId, {
          estado: 'revisado',
          revisadoPor
        });
        EventBus.emit('precarga:revisada', { precargaId, revisadoPor, timestamp: Date.now() });
        return { exito: true };
      } catch (error) {
        Logger.error('[PrecargaControl] Error al ejecutar precarga:revisar:', error);
        return { exito: false, error: error.message };
      }
    });
  }

  // Suscribirse a eventos
  EventBus.on('cliente:precarga_enviada', _onPrecargaEnviada);
  EventBus.on('mesa:badge_click', _onBadgeClick);

  Logger.info('[PrecargaControl] Módulo inicializado (v1.0.1).');

  return {
    _precargas
  };
})();

window.PrecargaControl = PrecargaControl;