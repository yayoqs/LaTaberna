/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/estado.js
   Versión: 1.0.0
   Propósito: Carga y guardado de datos de perfil (extras de localStorage).
   ================================================================ */

function _storageKey(usuario) {
  return `pubpos_perfil_${usuario}`;
}

export function cargarExtras(usuario) {
  const raw = localStorage.getItem(_storageKey(usuario));
  const base = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
  return {
    apodo: '',
    frase: '',
    desde: 'Miembro reciente',
    nivel: 1,
    racha: 0,
    xp: 0,
    xpSiguiente: 1000,
    cargos: [],
    insignias: [],
    insigniasDestacadas: [],
    stats: { visitas: 0, clubes: 0, insignias: 0 },
    accesorios: { mano: '🍺', aura: '' },
    clubes: [],
    actividad: [],
    preferencias: {},
    alergias: '',
    notasSalud: '',
    puntos: 0,
    ...base
  };
}

export function guardarExtras(usuario, datos) {
  localStorage.setItem(_storageKey(usuario), JSON.stringify(datos));
}