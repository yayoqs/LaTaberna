/* ================================================================
   LaTaberna - PubPOS — UTILIDADES COMPARTIDAS (ES6)
   Archivo: js/utils.js
   Versión: 1.5.0
   Propósito: Utilidades compartidas entre todas las células.
              v1.5.0: locale cambiado de 'es-AR' a 'es-CL'.
   ================================================================ */

export function formatearDinero(n) {
  return '$' + (n || 0).toLocaleString('es-CL', { minimumFractionDigits: 0 });
}

export function formatearDineroTicket(n) {
  return '$' + (n || 0).toLocaleString('es-CL', { minimumFractionDigits: 0 });
}

export function formatearFechaLarga() {
  const now = new Date();
  const s = now.toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatearHoraCompleta() {
  return new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export function formatearHoraCorta(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function formatearFechaCorta() {
  return new Date().toLocaleDateString('es-CL', {
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

export function mostrarToast(tipo, htmlMsg, ms = 3500) {
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

export function obtenerColorDesdeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

export function mostrarConfirmacion(titulo, mensaje, opciones = {}) {
  const {
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    claseConfirmar = 'btn-primary'
  } = opciones;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-confirm-overlay';

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

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrar(false);
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

export function mostrarEntrada(titulo, mensaje, opciones = {}) {
  const {
    valorPredefinido = '',
    placeholder = '',
    tipo = 'text'
  } = opciones;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-confirm-overlay';

    const card = document.createElement('div');
    card.className = 'modal-confirm-card';

    card.innerHTML = `
      <div class="modal-confirm-header">
        <h3>${titulo}</h3>
        <button class="modal-confirm-close">&times;</button>
      </div>
      <div class="modal-confirm-body">
        <p>${mensaje}</p>
        <input type="${tipo}" class="modal-input" 
               placeholder="${placeholder}" 
               value="${valorPredefinido}">
      </div>
      <div class="modal-confirm-footer">
        <button class="btn-secondary cancelar-btn">Cancelar</button>
        <button class="btn-primary aceptar-btn">Aceptar</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const input = card.querySelector('.modal-input');
    input.focus();
    input.select();

    const cerrar = (valor) => {
      overlay.remove();
      resolve(valor);
    };

    card.querySelector('.aceptar-btn').addEventListener('click', () => cerrar(input.value));
    card.querySelector('.cancelar-btn').addEventListener('click', () => cerrar(null));
    card.querySelector('.modal-confirm-close').addEventListener('click', () => cerrar(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(null);
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrar(null);
        document.removeEventListener('keydown', onKeyDown);
      } else if (e.key === 'Enter') {
        cerrar(input.value);
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

// ── Alias temporales (una iteración) ─────────────────────
export const fmtMoney         = formatearDinero;
export const fmtMoneyTicket   = formatearDineroTicket;
export const fmtFechaLarga    = formatearFechaLarga;
export const fmtHoraCompleta  = formatearHoraCompleta;
export const fmtHoraCorta     = formatearHoraCorta;
export const fmtFechaCorta    = formatearFechaCorta;
export const showToast        = mostrarToast;