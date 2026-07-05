/* ================================================================
   LaTaberna - PubPOS — UTILIDADES COMPARTIDAS (ES6)
   Archivo: js/utils.js
   Versión: 1.2.1
   Propósito: Utilidades compartidas entre todas las células.
              Incluye mostrarConfirmacion (modal de confirmación
              estilizado) y obtenerColorDesdeNombre (unificada).
   ================================================================ */

export function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

export function fmtMoneyTicket(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

export function fmtFechaLarga() {
  const now = new Date();
  const s = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtHoraCompleta() {
  return new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export function fmtHoraCorta(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtFechaCorta() {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

export function tiempoDesde(ts) {
  const ms  = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export function calcularTotal(items) {
  return (items || []).reduce((sum, it) => sum + it.precio * it.qty, 0);
}

export function showToast(tipo, htmlMsg, ms = 3500) {
  const cont  = document.getElementById('toastContainer');
  if (!cont) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = htmlMsg;
  cont.appendChild(toast);
  setTimeout(() => {
    toast.style.cssText = 'opacity:0;transform:translateX(40px);transition:all .3s ease';
    setTimeout(() => toast.remove(), 360);
  }, ms);
}

export function $id(id) { return document.getElementById(id); }

export function $val(id) { return ($id(id)?.value || '').trim(); }

/**
 * Genera un color HSL consistente a partir de un nombre.
 * Útil para fondos de tarjetas de producto, recetas, etc.
 * @param {string} nombre - El nombre desde el cual generar el color.
 * @returns {string} Color en formato HSL (ej: "hsl(210, 55%, 45%)").
 */
export function obtenerColorDesdeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

/**
 * Muestra un modal de confirmación estilizado con el tema de La Taberna.
 * Reemplaza window.confirm() de forma no bloqueante.
 *
 * @param {string} titulo   - Título del modal.
 * @param {string} mensaje  - Texto descriptivo.
 * @param {object} [opciones] - Opciones adicionales.
 * @param {string} [opciones.textoConfirmar="Confirmar"] - Texto del botón de confirmación.
 * @param {string} [opciones.textoCancelar="Cancelar"]   - Texto del botón de cancelación.
 * @param {string} [opciones.claseConfirmar="btn-primary"] - Clase CSS para el botón de confirmación.
 * @returns {Promise<boolean>} true si el usuario confirma, false si cancela o cierra.
 */
export function mostrarConfirmacion(titulo, mensaje, opciones = {}) {
  const {
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    claseConfirmar = 'btn-primary'
  } = opciones;

  return new Promise((resolve) => {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-confirm-overlay';

    // Crear tarjeta del modal
    const card = document.createElement('div');
    card.className = 'modal-confirm-card';

    card.innerHTML = `
      <div class="modal-confirm-header">
        <h3>${titulo}</h3>
        <button class="modal-confirm-close">&times;</button>
      </div>
      <div class="modal-confirm-body">
        <p>${mensaje}</p>
      </div>
      <div class="modal-confirm-footer">
        <button class="btn-secondary cancelar-btn">${textoCancelar}</button>
        <button class="${claseConfirmar} confirmar-btn">${textoConfirmar}</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Eventos
    const cerrar = (confirmado) => {
      overlay.remove();
      resolve(confirmado);
    };

    card.querySelector('.confirmar-btn').addEventListener('click', () => cerrar(true));
    card.querySelector('.cancelar-btn').addEventListener('click', () => cerrar(false));
    card.querySelector('.modal-confirm-close').addEventListener('click', () => cerrar(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(false);
    });

    // Cerrar con Escape
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrar(false);
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}