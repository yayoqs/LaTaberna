/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/notificaciones.js
   Versión: 1.0.0
   Propósito: Mapa unificado de notificaciones (precargas,
              clientes esperando, etc.).
   ================================================================ */

const _notificaciones = new Map();

function getNotificaciones(numMesa) {
  return _notificaciones.get(numMesa) || [];
}

function addNotificacion(numMesa, tipo, datos = {}) {
  const lista = _notificaciones.get(numMesa) || [];
  const idx = lista.findIndex(n => n.tipo === tipo);
  if (idx >= 0 && tipo !== 'precarga') {
    lista[idx] = { tipo, ...datos };
  } else if (tipo === 'precarga') {
    if (idx >= 0) {
      lista[idx] = { tipo, ...datos };
    } else {
      lista.push({ tipo, ...datos });
    }
  } else {
    lista.push({ tipo, ...datos });
  }
  _notificaciones.set(numMesa, lista);
}

function removeNotificacion(numMesa, tipo) {
  const lista = _notificaciones.get(numMesa);
  if (!lista) return;
  const filtrada = lista.filter(n => n.tipo !== tipo);
  if (filtrada.length === 0) {
    _notificaciones.delete(numMesa);
  } else {
    _notificaciones.set(numMesa, filtrada);
  }
}

function clearNotificaciones(numMesa) {
  _notificaciones.delete(numMesa);
}

export {
  getNotificaciones,
  addNotificacion,
  removeNotificacion,
  clearNotificaciones
};