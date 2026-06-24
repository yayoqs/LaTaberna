/* ================================================================
   LaTaberna - PubPOS — Módulo
   Archivo: js/modulos/cliente/pantalla-bienvenida.js
   Versión: 1.0.3
   Propósito: Pantalla de bienvenida post-login con validación de
             existencia de mesa en el Store antes de activar espera.
   Dependencias: Auth, Store, EventBus, App
   ================================================================ */

/**
 * Pantalla de Bienvenida post-login (v1.0.3)
 * Módulo ES6 para la vista de bienvenida de clientes.
 *
 * @module PantallaBienvenida
 * @version 1.0.3
 *
 * Ahora valida que la mesa ingresada exista en Store.getState().mesas.
 * Si no existe, muestra error y no pasa al estado de espera.
 */
const PantallaBienvenida = (() => {
  let _vista = null;
  let _mesa = null;
  let _permitePrepedidos = false;

  function render() {
    if (_vista) return _vista;

    _vista = document.createElement('main');
    _vista.id = 'view-bienvenida';
    _vista.className = 'view';
    _vista.innerHTML = `
      <div class="top-bar" id="bienvenidaTopBar">
        <div class="user-profile">
          <div class="user-avatar" id="bienvenidaAvatar"></div>
          <div class="user-info">
            <h3 id="bienvenidaNombre"></h3>
            <p><i class="fa-solid fa-circle-check"></i> Cliente Registrado</p>
          </div>
        </div>
        <button class="logout-btn" id="btnLogout">
          <i class="fa-solid fa-right-from-bracket"></i> Salir
        </button>
      </div>

      <div class="welcome-container">
        <div class="status-card" id="cardIngresoMesa">
          <h2><i class="fa-solid fa-chair" style="color:var(--color-accent)"></i> ¿Dónde te ubicas?</h2>
          <p style="color:var(--color-text-sec);font-size:0.9rem;">Ingresa el número de tu mesa física para activar tu sesión de atención.</p>
          <div class="input-group">
            <input type="number" class="table-input" id="inputMesa" placeholder="00" min="1" max="99">
            <button class="primary-btn" id="btnGuardarMesa">Vincular</button>
          </div>
          <p class="mesa-estado" id="estadoMesa" style="margin-top:10px;font-size:0.85rem;color:var(--color-text-sec);"></p>
        </div>

        <div class="status-card" id="cardEspera" style="display:none;">
          <h2>Mesa asignada: <span style="color:var(--color-accent)" id="mesaAsignada"></span></h2>
          <div class="waiting-status" id="waitingBlock">
            <div class="spinner"></div>
            <p style="font-size:0.9rem;font-weight:600;">Esperando validación del garzón...</p>
            <p style="color:var(--color-text-sec);font-size:0.8rem;">Estamos confirmando tu presencia en el mesón.</p>
          </div>
          <span class="pre-order-badge visible" id="badgePrepedidos" style="display:none;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Modo Pre-pedido Habilitado
          </span>
        </div>

        <div class="menu-grid">
          <div class="action-card order-mode" id="cardGastronomica">
            <div class="action-icon"><i class="fa-solid fa-scroll"></i></div>
            <div class="action-details">
              <h4>Armar mi Pedido</h4>
              <p id="mensajeGastro">Explora la carta digital y arma tu orden.</p>
            </div>
          </div>
          <div class="action-card events-mode" id="cardEntretenimiento">
            <div class="action-icon"><i class="fa-solid fa-cake-candles"></i></div>
            <div class="action-details">
              <h4>Eventos en Vivo & Karaoke</h4>
              <p id="mensajeEvento">Próximo evento a las 22:00 hrs</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(_vista);
    _configurarEventos();
    _actualizarPerfil();
    _initRealtime();
    return _vista;
  }

  function _configurarEventos() {
    document.getElementById('btnGuardarMesa').addEventListener('click', _guardarMesa);
    document.getElementById('cardGastronomica').addEventListener('click', _irAlMenu);
    document.getElementById('cardEntretenimiento').addEventListener('click', _irAEventos);
    document.getElementById('btnLogout').addEventListener('click', () => {
      if (typeof window.Auth !== 'undefined' && typeof window.Auth.logout === 'function') {
        window.Auth.logout();
      }
    });
  }

  function _actualizarPerfil() {
    const nombre = window.Auth?.getNombre?.() || 'Comensal';
    const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
    document.getElementById('bienvenidaNombre').textContent = nombre;
    document.getElementById('bienvenidaAvatar').textContent = iniciales;
  }

  function _guardarMesa() {
    const input = document.getElementById('inputMesa');
    const valor = parseInt(input?.value, 10);
    const estadoEl = document.getElementById('estadoMesa');
    
    if (!valor || valor < 1) {
      estadoEl.textContent = 'Ingresá un número válido.';
      return;
    }

    // Validar que la mesa existe en el Store
    const state = window.Store?.getState?.() || {};
    const mesas = state.mesas || [];
    const mesaExiste = mesas.some(m => m.numero === valor);

    if (!mesaExiste) {
      estadoEl.textContent = `La mesa ${valor} no existe. Verificá el número.`;
      return;
    }

    _mesa = valor;
    estadoEl.textContent = `Mesa ${_mesa} guardada.`;
    _verificarPermisoMesa();
    document.getElementById('cardEspera').style.display = 'block';
    document.getElementById('mesaAsignada').textContent = `Mesa ${_mesa}`;
  }

  function _verificarPermisoMesa() {
    if (!_mesa) return;
    const state = window.Store?.getState?.() || {};
    const mesas = state.mesas || [];
    const mesaActual = mesas.find(m => m.numero === _mesa);
    if (mesaActual && mesaActual.permite_prepedidos === true) {
      _permitePrepedidos = true;
      document.getElementById('estadoMesa').textContent = '✅ Mesa activada.';
      document.getElementById('badgePrepedidos').style.display = 'inline-block';
      setTimeout(() => document.getElementById('badgePrepedidos').classList.add('visible'), 10);
      document.getElementById('mensajeGastro').textContent = '🎉 ¡Pantalla Activada! Comenzá tu selección.';
    } else {
      _permitePrepedidos = false;
      document.getElementById('badgePrepedidos').style.display = 'none';
      document.getElementById('badgePrepedidos').classList.remove('visible');
      document.getElementById('mensajeGastro').textContent = 'Explora la carta digital y arma tu orden.';
    }
  }

  function obtenerMesa() { return _mesa; }
  function permitePrepedidos() { return _permitePrepedidos; }

  function _irAlMenu() {
    if (!_mesa) {
      document.getElementById('estadoMesa').textContent = 'Primero ingresá el número de mesa.';
      return;
    }
    if (!_permitePrepedidos) {
      document.getElementById('estadoMesa').textContent = 'Esperá a que el garzón active tu mesa.';
      return;
    }
    if (typeof window.App !== 'undefined' && typeof window.App.showView === 'function') {
      window.App.showView('menu');
    }
  }

  function _irAEventos() {
    if (typeof window.App !== 'undefined' && typeof window.App.showView === 'function') {
      window.App.showView('eventos');
    }
  }

  function mostrar() {
    if (_vista) {
      const viewMenu = document.getElementById('view-menu');
      if (viewMenu) viewMenu.classList.remove('active');

      _vista.classList.add('active');
      _actualizarPerfil();
      _verificarPermisoMesa();
    }
  }

  function ocultar() {
    if (_vista) {
      _vista.classList.remove('active');
    }
  }

  function _initRealtime() {
    if (typeof window.EventBus !== 'undefined') {
      window.EventBus.on('mesas:actualizada', (datos) => {
        if (_mesa && datos && datos.numero === _mesa) _verificarPermisoMesa();
      });
      window.EventBus.on('eventos_en_vivo:actualizada', () => {
        const state = window.Store?.getState?.() || {};
        const eventos = state.eventos_en_vivo || [];
        const activo = eventos.find(e => e.estado === 'activo');
        const mensaje = document.getElementById('mensajeEvento');
        if (activo && mensaje) {
          mensaje.textContent = `🎤 ${activo.tipo || 'Evento'} en vivo ahora`;
        } else if (mensaje) {
          mensaje.textContent = 'Próximo evento a las 22:00 hrs';
        }
      });
    }
  }

  return { render, mostrar, ocultar, obtenerMesa, permitePrepedidos };
})();

export { PantallaBienvenida };