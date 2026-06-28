/* ================================================================
   LaTaberna - PubPOS — Módulo
   Archivo: js/modulos/cliente/pantalla-bienvenida.js
   Versión: 1.0.7
   Propósito: Pantalla de bienvenida post-login.
             - Oculta la tarjeta de ingreso al vincular.
             - Muestra una tarjeta de confirmación con detalles
               de la mesa cuando el garzón la activa.
   Dependencias: Auth, Store, EventBus, App
   ================================================================ */

const PantallaBienvenida = (() => {
  let _vista = null;
  let _mesa = null;
  let _permitePrepedidos = false;
  let _interfazActivada = false;   // evita re-renderizar la tarjeta activada

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
        <!-- Tarjeta de ingreso (se oculta al vincular) -->
        <div class="status-card" id="cardIngresoMesa">
          <h2><i class="fa-solid fa-chair" style="color:var(--color-accent)"></i> ¿Dónde te ubicas?</h2>
          <p style="color:var(--color-text-sec);font-size:0.9rem;">Ingresa el número de tu mesa física para activar tu sesión de atención.</p>
          <div class="input-group">
            <input type="number" class="table-input" id="inputMesa" placeholder="00" min="1" max="99">
            <button class="primary-btn" id="btnGuardarMesa">Vincular</button>
          </div>
          <p class="mesa-estado" id="estadoMesa" style="margin-top:10px;font-size:0.85rem;color:var(--color-text-sec);"></p>
          <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--color-border);">
            <button id="btnBarra" style="width:100%; background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.35); color: var(--color-accent); padding: 12px 24px; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;">
              <i class="fa-solid fa-wine-bottle"></i> Estoy en la Barra / Evento
            </button>
          </div>
        </div>

        <!-- Tarjeta de espera / activación -->
        <div class="status-card" id="cardEspera" style="display:none;">
          <!-- Contenido dinámico: se llena en _verificarPermisoMesa() -->
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
    document.getElementById('btnBarra').addEventListener('click', _vincularBarra);
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

    const state = window.Store?.getState?.() || {};
    const mesas = state.mesas || [];
    const mesaExiste = mesas.some(m => m.numero === valor);

    if (!mesaExiste) {
      estadoEl.textContent = `La mesa ${valor} no existe. Verificá el número.`;
      return;
    }

    _vincular(valor, estadoEl);
  }

  function _vincularBarra() {
    const estadoEl = document.getElementById('estadoMesa');
    _vincular('barra', estadoEl);
  }

  function _vincular(mesaId, estadoEl) {
    _mesa = mesaId;
    estadoEl.textContent = `Vinculado a ${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}.`;

    if (typeof window.EventBus !== 'undefined') {
      window.EventBus.emit('cliente:mesa_ingresada', { mesa: _mesa });
    }

    // Ocultar tarjeta de ingreso
    document.getElementById('cardIngresoMesa').style.display = 'none';

    // Mostrar tarjeta de espera con contenido inicial
    const cardEspera = document.getElementById('cardEspera');
    cardEspera.style.display = 'block';
    cardEspera.innerHTML = `
      <h2>Mesa asignada: <span style="color:var(--color-accent)">${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}</span></h2>
      <div class="waiting-status" id="waitingBlock">
        <div class="spinner"></div>
        <p style="font-size:0.9rem;font-weight:600;">Esperando validación del garzón...</p>
        <p style="color:var(--color-text-sec);font-size:0.8rem;">Estamos confirmando tu presencia en el mesón.</p>
      </div>
      <span class="pre-order-badge visible" id="badgePrepedidos" style="display:none;">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Modo Pre-pedido Habilitado
      </span>
    `;

    _verificarPermisoMesa();
  }

  function _verificarPermisoMesa() {
    if (!_mesa) return;
    const state = window.Store?.getState?.() || {};
    const mesas = state.mesas || [];
    const mesaActual = _mesa === 'barra'
      ? mesas.find(m => m.numero === 0 || m.nombre === 'barra')
      : mesas.find(m => m.numero === _mesa);
      
    const permite = mesaActual && mesaActual.permite_prepedidos === true;

    if (permite && !_interfazActivada) {
      _interfazActivada = true;
      _permitePrepedidos = true;

      // Transformar la tarjeta de espera en la vista de activación
      const cardEspera = document.getElementById('cardEspera');
      const esBarra = _mesa === 'barra';
      const icono = esBarra ? 'fa-solid fa-wine-bottle' : 'fa-solid fa-chair';
      const titulo = esBarra ? 'Barra activada' : `Mesa ${_mesa} activada`;
      const detalle = esBarra
        ? 'Estás vinculado a la barra. Solo verás tus propios consumos.'
        : '¡Todo listo! Podés armar tu pedido y disfrutar de La Taberna.';

      cardEspera.innerHTML = `
        <div style="text-align: center;">
          <i class="${icono}" style="font-size: 2.5rem; color: var(--color-accent);"></i>
          <h2 style="margin-top: 10px;">${titulo}</h2>
          <p style="color: var(--color-text-sec); margin-top: 6px;">${detalle}</p>
        </div>
        <span class="pre-order-badge visible" style="display:inline-block; margin-top:15px;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Modo Pre-pedido Habilitado
        </span>
      `;

      document.getElementById('mensajeGastro').textContent = '🎉 ¡Pantalla Activada! Comenzá tu selección.';
    } else if (!permite && _interfazActivada) {
      // Por si el garzón desactiva la mesa (improbable pero posible)
      _interfazActivada = false;
      _permitePrepedidos = false;
      // Volver a mostrar el estado de espera
      const cardEspera = document.getElementById('cardEspera');
      cardEspera.innerHTML = `
        <h2>Mesa asignada: <span style="color:var(--color-accent)">${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}</span></h2>
        <div class="waiting-status">
          <div class="spinner"></div>
          <p style="font-size:0.9rem;font-weight:600;">Esperando validación del garzón...</p>
          <p style="color:var(--color-text-sec);font-size:0.8rem;">Estamos confirmando tu presencia en el mesón.</p>
        </div>
        <span class="pre-order-badge visible" id="badgePrepedidos" style="display:none;"></span>
      `;
      document.getElementById('mensajeGastro').textContent = 'Explora la carta digital y arma tu orden.';
    }
  }

  function obtenerMesa() { return _mesa; }
  function permitePrepedidos() { return _permitePrepedidos; }

  function _irAlMenu() {
    if (!_mesa) {
      return;
    }
    if (!_permitePrepedidos) {
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
      // Si ya estaba vinculado, la tarjeta de ingreso debe estar oculta
      if (_mesa) {
        document.getElementById('cardIngresoMesa').style.display = 'none';
        document.getElementById('cardEspera').style.display = 'block';
        _verificarPermisoMesa();
      }
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
        if (_mesa && datos) {
          const coincide = _mesa === 'barra'
            ? (datos.numero === 0 || datos.nombre === 'barra')
            : (datos.numero === _mesa);
          if (coincide) _verificarPermisoMesa();
        }
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