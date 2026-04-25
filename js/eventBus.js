/* ================================================================
   PubPOS — MÓDULO: eventBus.js
   Propósito: Sistema de publicación/suscripción para desacoplar módulos.
   Uso:
     EventBus.on('mesa:actualizada', (data) => { ... });
     EventBus.emit('mesa:actualizada', { mesa: 3 });
     EventBus.off('mesa:actualizada', callback);
   ================================================================ */

const EventBus = (() => {
  const eventos = {};

  function on(nombre, callback) {
    if (!eventos[nombre]) eventos[nombre] = [];
    eventos[nombre].push(callback);
  }

  function off(nombre, callback) {
    if (!eventos[nombre]) return;
    eventos[nombre] = eventos[nombre].filter(cb => cb !== callback);
  }

  function emit(nombre, datos) {
    if (!eventos[nombre]) return;
    eventos[nombre].forEach(cb => {
      try {
        cb(datos);
      } catch (e) {
        console.error(`[EventBus] Error en handler de "${nombre}":`, e);
      }
    });
  }

  // Opcional: para debug
  function listar() {
    console.log('EventBus registros:', Object.keys(eventos).map(k => `${k}: ${eventos[k].length} handlers`));
  }

  return { on, off, emit, listar };
})();

window.EventBus = EventBus;