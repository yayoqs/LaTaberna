/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/modulos/cliente/pantalla-eventos.js
   Versión: 1.0.0
   Propósito: Vista inmersiva de eventos en vivo para el cliente.
   Dependencias: js/lib/store.js, js/lib/eventBus.js
   ================================================================ */
   
const PantallaEventos = (() => {
  let _vista = null;

  function render() {
    if (_vista) return _vista;

    _vista = document.createElement('main');
    _vista.id = 'view-eventos-cliente';
    _vista.className = 'view';
    _vista.innerHTML = `
      <div class="eventos-fondo" id="eventosFondo"></div>

      <header class="eventos-header">
        <h1 id="eventosTitulo">🎉 Eventos en Vivo</h1>
        <p class="eventos-sub" id="eventosSub">Conectate a la energía de La Taberna</p>
        <div class="eventos-badge" id="eventosBadge">
          <span class="eventos-punto"></span> En vivo
        </div>
      </header>

      <section class="eventos-contenido" id="eventosContenido">
        <!-- El contenido se renderiza dinámicamente -->
      </section>
    `;

    document.body.appendChild(_vista);
    _initRealtime();
    return _vista;
  }

  function mostrar() {
    // Ocultar vista de eventos estándar si existe
    const viewEventos = document.getElementById('view-eventos');
    if (viewEventos) viewEventos.classList.remove('active');

    if (_vista) {
      _vista.classList.add('active');
      _renderizarEvento();
    }
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
  }

  /* ── Renderizado del evento ───────────────────────────── */
  function _renderizarEvento() {
    const container = document.getElementById('eventosContenido');
    const badge = document.getElementById('eventosBadge');
    const sub = document.getElementById('eventosSub');
    if (!container) return;

    const state = window.Store?.getState?.() || {};
    const eventos = state.eventos_en_vivo || [];
    const activo = eventos.find(e => e.estado === 'activo');

    if (!activo) {
      _mostrarSinEvento(container, badge, sub);
      return;
    }

    _mostrarEventoActivo(container, badge, sub, activo);
  }

  function _mostrarSinEvento(container, badge, sub) {
    if (badge) badge.style.display = 'none';
    if (sub) sub.textContent = 'Próximo evento a las 22:00 hrs';

    container.innerHTML = `
      <div class="eventos-card">
        <div class="card-glass">
          <div class="eventos-vacio">
            <i class="fas fa-calendar-alt"></i>
            <h2>No hay eventos activos ahora</h2>
            <p>Volvé más tarde o consultá el cronograma en la barra.</p>
            <div class="ecualizador inactivo">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function _mostrarEventoActivo(container, badge, sub, evento) {
    if (badge) badge.style.display = 'flex';
    if (sub) sub.textContent = evento.titulo || 'Evento en vivo';

    const tipo = evento.tipo || 'generico';
    const icono = _iconoEvento(tipo);
    const descripcion = evento.descripcion || '';

    let contenidoExtra = '';

    if (tipo === 'bingo') {
      contenidoExtra = _renderBingo(evento);
    } else if (tipo === 'karaoke') {
      contenidoExtra = _renderKaraoke(evento);
    } else if (tipo === 'votacion') {
      contenidoExtra = _renderVotacion(evento);
    }

    container.innerHTML = `
      <div class="eventos-card eventos-card-grande">
        <div class="card-glass">
          <div class="eventos-icono">${icono}</div>
          <h2>${evento.titulo || 'Evento en vivo'}</h2>
          <p class="eventos-descripcion">${descripcion}</p>
          ${contenidoExtra}
        </div>
      </div>
    `;

    // Eventos click para votaciones (placeholder)
    if (tipo === 'votacion') {
      container.querySelectorAll('.votacion-opcion').forEach(btn => {
        btn.addEventListener('click', () => {
          window.ClienteModulo?.PantallaEventos?._mostrarToast?.('info', 'Votación enviada (funcionalidad completa próximamente)');
        });
      });
    }
  }

  /* ── Renderizados específicos ─────────────────────────── */
  function _renderBingo(evento) {
    const numeros = evento.numeros || [];
    const ultimo = numeros.length ? numeros[numeros.length - 1] : '—';
    return `
      <div class="eventos-bingo">
        <div class="bingo-ultimo">
          <span>Último número</span>
          <strong>${ultimo}</strong>
        </div>
        <div class="bingo-historial">
          ${numeros.slice(-10).reverse().map(n => `<span class="bingo-numero">${n}</span>`).join('')}
        </div>
      </div>
    `;
  }

  function _renderKaraoke(evento) {
    const letra = evento.letra || 'Esperando la próxima canción...';
    return `
      <div class="eventos-karaoke">
        <p class="karaoke-letra">${letra}</p>
      </div>
    `;
  }

  function _renderVotacion(evento) {
    const opciones = evento.opciones || [];
    if (!opciones.length) {
      return '<p class="eventos-descripcion">Esperando opciones de votación...</p>';
    }
    return `
      <div class="eventos-votacion">
        ${opciones.map((op, i) => `
          <button class="votacion-opcion" data-indice="${i}">
            ${op.nombre || op}
          </button>
        `).join('')}
      </div>
    `;
  }

  function _iconoEvento(tipo) {
    switch (tipo) {
      case 'bingo': return '🎱';
      case 'karaoke': return '🎤';
      case 'votacion': return '📊';
      default: return '🎉';
    }
  }

  /* ── Realtime ─────────────────────────────────────────── */
  function _initRealtime() {
    if (typeof window.EventBus !== 'undefined') {
      window.EventBus.on('eventos_en_vivo:actualizada', () => {
        if (_vista?.classList.contains('active')) {
          _renderizarEvento();
        }
      });
    }
  }

  return { render, mostrar, ocultar };
})();

export { PantallaEventos };