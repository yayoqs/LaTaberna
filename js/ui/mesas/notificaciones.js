/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/notificaciones.js
   Versión: 1.0.1
   Propósito: Mapa unificado de notificaciones. Claves normalizadas a string.
   ================================================================ */

const _notificaciones = new Map();

function _clave(numMesa) {
  return String(numMesa);
}

function getNotificaciones(numMesa) {
  return _notificaciones.get(_clave(numMesa)) || [];
}

function addNotificacion(numMesa, tipo, datos = {}) {
  const clave = _clave(numMesa);
  const lista = _notificaciones.get(clave) || [];
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
  _notificaciones.set(clave, lista);
}

function removeNotificacion(numMesa, tipo) {
  const clave = _clave(numMesa);
  const lista = _notificaciones.get(clave);
  if (!lista) return;
  const filtrada = lista.filter(n => n.tipo !== tipo);
  if (filtrada.length === 0) {
    _notificaciones.delete(clave);
  } else {
    _notificaciones.set(clave, filtrada);
  }
}

function clearNotificaciones(numMesa) {
  _notificaciones.delete(_clave(numMesa));
}

export {
  getNotificaciones,
  addNotificacion,
  removeNotificacion,
  clearNotificaciones
};