/* ================================================================
   PubPOS — MÓDULO: cuenta.js
   Propósito: Pedir la cuenta (pre‑cuenta) y cambiar estado de mesa.
   Cambios (2026-04-23):
     • En pedirCuenta() se verifica que el rol sea mesero, admin, master o caja.
       Un cajero también puede pedir la cuenta si la mesa está activa.
       Cocina y barra no tienen esta acción.
   ================================================================ */

const Cuenta = (() => {

  function pedirCuenta() {
    // 🔒 VERIFICACIÓN DE ROL: solo personal autorizado
    const rol = Auth.getRol();
    const rolesPermitidos = ['mesero', 'admin', 'master', 'caja'];
    if (!rolesPermitidos.includes(rol)) {
      showToast('error', 'No tienes permiso para pedir la cuenta');
      return;
    }

    const mesa = Comanda.getMesaActiva();
    if (!mesa) {
      showToast('warning', 'No hay ninguna mesa abierta.');
      return;
    }
    if (!mesa.items || mesa.items.length === 0) {
      showToast('warning', 'La mesa no tiene consumos para cobrar.');
      return;
    }

    mesa.estado = 'cuenta';
    const obsInput = document.getElementById('comandaObs');
    if (obsInput) mesa.observaciones = obsInput.value;

    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'cuenta' });

    const badge = document.getElementById('modalEstadoBadge');
    if (badge) {
      badge.textContent = 'Cuenta';
      badge.className = 'estado-badge cuenta';
    }

    const ticketHTML = Tickets.generarCuenta(mesa);
    Tickets.mostrar(ticketHTML, `Cuenta — Mesa ${mesa.numero}`);
    showToast('info', `Cuenta generada para Mesa ${mesa.numero}`);
  }

  EventBus.on('cuenta:solicitada', pedirCuenta);

  return { pedirCuenta };
})();

window.Cuenta = Cuenta;