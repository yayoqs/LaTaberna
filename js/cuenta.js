/* ================================================================
   PubPOS — MÓDULO: cuenta.js
   Propósito: Gestionar la acción de "Pedir Cuenta".
              Cambia el estado de la mesa a 'cuenta', genera el ticket
              de pre‑cuenta y lo muestra.
   Dependencias: DB, EventBus, Tickets, utils.js, Comanda (para obtener mesa activa)
   ----------------------------------------------------------------
   Este módulo es un ejemplo de "bajo acoplamiento, alta cohesión".
   Solo sabe cómo transformar una mesa en una cuenta y notificar al
   sistema. No conoce los detalles de la carta ni de la comanda.
   ================================================================ */

const Cuenta = (() => {

  /**
   * Acción principal: pedir la cuenta de la mesa actualmente activa.
   * Se llama desde el botón "Pedir Cuenta" en la interfaz.
   */
  function pedirCuenta() {
    // 1. Obtener la mesa activa desde el módulo Comanda.
    //    Esta es la única dependencia directa entre módulos de UI.
    const mesa = Comanda.getMesaActiva();

    // 2. Validaciones de negocio.
    if (!mesa) {
      showToast('warning', 'No hay ninguna mesa abierta.');
      return;
    }
    if (!mesa.items || mesa.items.length === 0) {
      showToast('warning', 'La mesa no tiene consumos para cobrar.');
      return;
    }

    // 3. Cambiar el estado de la mesa.
    mesa.estado = 'cuenta';
    // Asegurar que la observación general se capture del campo de texto.
    const obsInput = document.getElementById('comandaObs');
    if (obsInput) mesa.observaciones = obsInput.value;

    // 4. Persistir el cambio en la base de datos local.
    DB.saveMesas();

    // 5. Notificar al sistema que la mesa ha cambiado.
    //    Esto hará que la grilla de mesas (Mesas.js) se actualice
    //    y que el badge en el modal cambie a "Cuenta".
    EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'cuenta' });

    // 6. Actualizar la UI del modal (badge de estado).
    const badge = document.getElementById('modalEstadoBadge');
    if (badge) {
      badge.textContent = 'Cuenta';
      badge.className = 'estado-badge cuenta';
    }

    // 7. Generar el ticket de pre‑cuenta utilizando el módulo Tickets.
    //    Tickets.generarCuenta() devuelve un string HTML listo para mostrar.
    const ticketHTML = Tickets.generarCuenta(mesa);

    // 8. Mostrar el ticket en el modal de vista previa.
    Tickets.mostrar(ticketHTML, `Cuenta — Mesa ${mesa.numero}`);

    // 9. Feedback al usuario.
    showToast('info', `Cuenta generada para Mesa ${mesa.numero}`);
  }

  /* ── SUSCRIPCIÓN A EVENTOS ───────────────────────────────── */
  // Escuchamos un evento personalizado por si otro módulo quiere
  // solicitar la cuenta de forma programática (ej: doble clic en mesa).
  EventBus.on('cuenta:solicitada', pedirCuenta);

  /* ── API PÚBLICA ──────────────────────────────────────────── */
  return {
    pedirCuenta
  };

})();

// Exponer globalmente para que el onclick del HTML funcione.
window.Cuenta = Cuenta;