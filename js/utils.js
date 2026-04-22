/* ================================================================
   PubPOS — MÓDULO: utils.js
   Propósito: Funciones de utilidad compartidas por todos los módulos.
              Sin dependencias externas.
   ----------------------------------------------------------------
   ETAPA DE EDICIÓN:
   • Cambiar formato de moneda → función fmtMoney()
   • Cambiar formato de fecha  → función fmtFecha() / fmtHora()
   • Agregar helpers nuevos aquí antes de usarlos en otros módulos
   ================================================================ */

/* ── FORMATO MONETARIO ───────────────────────────────────────── */

/**
 * Devuelve un número formateado como moneda argentina.
 * Ejemplos: fmtMoney(1500) → "$1.500"
 *           fmtMoney(0)    → "$0"
 */
function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

/**
 * Versión compacta para tickets de impresión (sin separador de miles).
 */
function fmtMoneyTicket(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}


/* ── FORMATO FECHA / HORA ────────────────────────────────────── */

/** Devuelve la fecha actual en formato "Lunes 18 de abril de 2026" */
function fmtFechaLarga() {
  const now = new Date();
  const s = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Devuelve la hora actual "HH:MM:SS" */
function fmtHoraCompleta() {
  return new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/** Devuelve hora corta "HH:MM" de un timestamp o Date */
function fmtHoraCorta(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/** Devuelve fecha corta "DD/MM/AAAA" */
function fmtFechaCorta() {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}


/* ── TIEMPO TRANSCURRIDO ─────────────────────────────────────── */

/**
 * Devuelve "X min" o "Xh Ym" desde un timestamp pasado.
 * @param {number|string} ts  timestamp de apertura
 */
function tiempoDesde(ts) {
  const ms  = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}


/* ── CÁLCULO DE TOTALES ──────────────────────────────────────── */

/**
 * Suma precio×qty de todos los ítems de una comanda.
 * @param {Array} items  array de ítems { precio, qty }
 */
function calcularTotal(items) {
  return (items || []).reduce((sum, it) => sum + it.precio * it.qty, 0);
}


/* ── TOAST NOTIFICATIONS ─────────────────────────────────────── */

/**
 * Muestra una notificación flotante.
 * @param {'success'|'error'|'info'|'warning'} tipo
 * @param {string} htmlMsg  HTML del mensaje (puede contener <i> de FontAwesome)
 * @param {number} ms       duración en milisegundos (default 3500)
 */
function showToast(tipo, htmlMsg, ms = 3500) {
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


/* ── DOM HELPERS ─────────────────────────────────────────────── */

/** Shortcut para document.getElementById */
function $id(id) { return document.getElementById(id); }

/** Valor limpio de un input por id */
function $val(id) { return ($id(id)?.value || '').trim(); }
