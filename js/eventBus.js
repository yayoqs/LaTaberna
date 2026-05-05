/* ================================================================
   PubPOS — MÓDULO: eventBus.js (v2 – EventBus con eventos tipados)
   Propósito: Sistema de publicación/suscripción para desacoplar módulos.
              Ahora soporta eventos basados en clases (tipados) y
              mantiene total compatibilidad con los suscriptores
              que usan strings.
   ================================================================ */

const EventBus = (() => {
  const eventos = {};

  /**
   * Registra un callback para un tipo de evento.
   * @param {string|Function} eventType - String del evento o clase del evento.
   * @param {function} callback - Función que recibirá los datos del evento.
   */
  function on(eventType, callback) {
    // Obtener el nombre del evento a partir del string o de la clase
    const nombre = _nombreEvento(eventType);
    if (!nombre) {
      console.error('[EventBus] Tipo de evento inválido:', eventType);
      return;
    }
    if (!eventos[nombre]) eventos[nombre] = [];
    eventos[nombre].push(callback);
  }

  /**
   * Emite un evento, notificando a todos los suscriptores.
   * @param {string|object} event - String del evento o instancia de una clase.
   * @param {any} [datos] - Datos adicionales (solo si el primer parámetro es string).
   */
  function emit(event, datos) {
    let nombre;
    let payload;

    if (typeof event === 'string') {
      // Compatibilidad anterior: emit('mesa:actualizada', { ... })
      nombre = event;
      payload = datos;
    } else if (typeof event === 'object' && event !== null) {
      // Nuevo: emit(new PedidoCerradoEvent(...))
      // El evento debe tener una propiedad 'tipo' o usamos el nombre del constructor
      nombre = _nombreEvento(event);
      payload = event;
    } else {
      console.error('[EventBus] Formato de evento no soportado:', event);
      return;
    }

    if (!eventos[nombre]) return;

    eventos[nombre].forEach(cb => {
      try {
        cb(payload);
      } catch (e) {
        console.error(`[EventBus] Error en handler de "${nombre}":`, e);
      }
    });
  }

  /**
   * Elimina un callback registrado.
   * @param {string|Function} eventType - String o clase del evento.
   * @param {function} callback - El callback exacto a eliminar.
   */
  function off(eventType, callback) {
    const nombre = _nombreEvento(eventType);
    if (!nombre || !eventos[nombre]) return;
    eventos[nombre] = eventos[nombre].filter(cb => cb !== callback);
  }

  // ── UTILIDAD PRIVADA ──────────────────────────────────────
  function _nombreEvento(eventType) {
    if (typeof eventType === 'string') return eventType;
    if (typeof eventType === 'function') return eventType.name;       // Clase
    if (typeof eventType === 'object' && eventType !== null) {
      return eventType.tipo || eventType.constructor?.name;            // Instancia
    }
    return null;
  }

  /**
   * Opcional: para debug.
   */
  function listar() {
    console.log('EventBus registros:', Object.keys(eventos).map(k => `${k}: ${eventos[k].length} handlers`));
  }

  return { on, off, emit, listar };
})();

window.EventBus = EventBus;

/*
   ── EJEMPLOS DE USO ──────────────────────────────────────────

   // Crear una clase de evento (puede ir en su propio archivo)
   class PedidoCerradoEvent {
     constructor(pedidoId, total) {
       this.tipo = 'PedidoCerradoEvent';  // opcional, si no se define se usará el nombre de la clase
       this.pedidoId = pedidoId;
       this.total = total;
     }
   }

   // Suscribirse usando la clase o un string
   EventBus.on(PedidoCerradoEvent, (e) => {
     console.log(`Pedido ${e.pedidoId} cerrado, total: ${e.total}`);
   });

   // Emitir una instancia
   EventBus.emit(new PedidoCerradoEvent('ped_123', 4500));

   // Emitir con string (compatibilidad)
   EventBus.emit('mesa:seleccionada', { mesa: 3 });
*/