/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/pantalla-eventos.js
   Versión: 1.0.5
   Propósito: Pantalla de eventos en vivo con votación real y botón de retorno.
              Sin dependencia de App global.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { showToast } from '../../utils.js';

const PantallaEventos = (() => {
  let _vista = null;
  let _votoSeleccionado = null;

  function render() {
    if (_vista) return _vista;

    _vista = document.createElement('main');
    _vista.id = 'view-eventos-cliente';
    _vista.className = 'view';
    _vista.innerHTML = `
      <div class="eventos-fondo" id="eventosFondo"></div>
      <button class="btn-volver" id="btnVolverEventos" style="position:absolute; top:10px; left:10px; z-index:10; background:transparent; border:none; color:var(--color-text-sec); font-size:1.3rem; cursor:pointer; transition: color 0.2s;" title="Volver a la bienvenida">
        <i class="fas fa-arrow-left"></i>
      </button>
      <header class="eventos-header">
        <h1 id="eventosTitulo">🎉 Eventos en Vivo</h1>
        <p class="eventos-sub" id="eventosSub">Conectate a la energía de La Taberna</p>
        <div class="eventos-badge" id="eventosBadge">
          <span class="eventos-punto"></span> En vivo
        </div>
      </header>
      <section class="eventos-contenido" id="eventosContenido"></section>
    `;

    document.body.appendChild(_vista);

    document.getElementById('btnVolverEventos').addEventListener('click', () => {
      EventBus.emit('app:cambiarVista', 'bienvenida');
    });

    _initRealtime();
    return _vista;
  }

  function mostrar() {
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

  function _renderizarEvento() {
    const container = document.getElementById('eventosContenido');
    const badge = document.getElementById('eventosBadge');
    const sub = document.getElementById('eventosSub');
    if (!container) return;

    container.classList.add('fade-out');
    setTimeout(() => {
      const state = Store.getState();
      const eventos = state.eventos_en_vivo || [];
      const activo = eventos.find(e => e.estado === 'activo');

      if (!activo) {
        _mostrarSinEvento(container, badge, sub);
      } else {
        _mostrarEventoActivo(container, badge, sub, activo);
      }
      container.classList.remove('fade-out');
    }, 350);
  }

  function _mostrarSinEvento(container, badge, sub) {
    if (badge) badge.style.display = 'none';
    if (sub) sub.textContent = 'Próximo evento a las 22:00 hrs';
    container.innerHTML = `
      <div class="eventos-card">
        <div class="eventos-vacio">
          <i class="fa-solid fa-calendar-alt"></i>
          <h2>No hay eventos activos ahora</h2>
          <p>Volvé más tarde o consultá el cronograma en la barra.</p>
          <div class="ecualizador inactivo"><span></span><span></span><span></span><span></span><span></span></div>
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

    if (tipo === 'bingo') contenidoExtra = _renderBingo(evento);
    else if (tipo === 'karaoke') contenidoExtra = _renderKaraoke(evento);
    else if (tipo === 'votacion') contenidoExtra = _renderVotacion(evento);

    container.innerHTML = `
      <div class="eventos-card">
        <div class="eventos-icono">${icono}</div>
        <h2>${evento.titulo || 'Evento en vivo'}</h2>
        <p class="eventos-descripcion">${descripcion}</p>
        ${contenidoExtra}
      </div>
    `;

    if (tipo === 'votacion') _configurarVotacion(evento);
  }

  function _renderBingo(evento) {
    const numeros = evento.numeros || [];
    const ultimo = numeros.length ? numeros[numeros.length - 1] : '—';
    return `
      <div class="eventos-bingo">
        <div class="bingo-ultimo"><span>Último número</span><strong>${ultimo}</strong></div>
        <div class="bingo-historial">${numeros.slice(-10).reverse().map(n => `<span class="bingo-numero">${n}</span>`).join('')}</div>
      </div>
    `;
  }

  function _renderKaraoke(evento) {
    const letra = evento.letra || 'Esperando la próxima canción...';
    return `<div class="eventos-karaoke"><p class="karaoke-letra">${letra}</p></div>`;
  }

  function _renderVotacion(evento) {
    const opciones = evento.opciones || [];
    if (!opciones.length) return '<p class="eventos-descripcion">Esperando opciones de votación...</p>';
    return `
      <div class="eventos-votacion" id="votacionOpciones">
        ${opciones.map((op, i) => `<button class="votacion-opcion" data-indice="${i}" data-valor="${op.nombre || op}">${op.nombre || op}</button>`).join('')}
      </div>
    `;
  }

  function _configurarVotacion(evento) {
    const opciones = evento.opciones || [];
    const botones = document.querySelectorAll('.votacion-opcion');
    const idEvento = evento.id;

    botones.forEach(btn => {
      btn.addEventListener('click', async () => {
        const valor = btn.dataset.valor;
        botones.forEach(b => b.classList.remove('seleccionada'));
        btn.classList.add('seleccionada');
        _votoSeleccionado = { indice: btn.dataset.indice, valor };

        const state = Store.getState();
        const eventos = state.eventos_en_vivo || [];
        const eventoActual = eventos.find(e => e.id === idEvento);

        if (!eventoActual) {
          showToast('error', 'No se encontró el evento. Reintentá.');
          btn.classList.remove('seleccionada');
          return;
        }

        const resultados = { ...(eventoActual.resultados || {}) };
        resultados[valor] = (resultados[valor] || 0) + 1;

        try {
          const actualizado = await DBAppwrite.actualizar('eventos_en_vivo', idEvento, { datos: { resultados } });
          if (!actualizado) throw new Error('No se pudo actualizar');
          showToast('success', `Votaste por "${valor}". ¡Gracias por participar!`);
        } catch (e) {
          btn.classList.remove('seleccionada');
          _votoSeleccionado = null;
          showToast('error', 'Error al enviar tu voto. Intentá de nuevo.');
          console.error('[PantallaEventos] Error al votar:', e);
        }
      });
    });
  }

  function _iconoEvento(tipo) {
    switch (tipo) {
      case 'bingo': return '🎱';
      case 'karaoke': return '🎤';
      case 'votacion': return '📊';
      default: return '🎉';
    }
  }

  function _initRealtime() {
    EventBus.on('eventos_en_vivo:actualizada', () => {
      if (_vista?.classList.contains('active')) _renderizarEvento();
    });
  }

  return { render, mostrar, ocultar };
})();

export { PantallaEventos };