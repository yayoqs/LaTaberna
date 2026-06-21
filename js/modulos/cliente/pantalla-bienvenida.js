/**
 * Pantalla de Bienvenida post-login (v1.2.0)
 * Módulo ES6 para la vista de bienvenida de clientes.
 *
 * @module PantallaBienvenida
 * @version 1.2.0
 *
 * Layout flexible: las tarjetas se adaptan automáticamente
 * al espacio disponible sin medidas fijas.
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
      <div class="bienvenida-fondo" id="bienvenidaFondo"></div>

      <header class="bienvenida-header" id="bienvenidaHeader">
        <h1 id="bienvenidaMensaje"></h1>
        <p class="bienvenida-sub" id="bienvenidaSub"></p>
      </header>

      <section class="bienvenida-contenido">
        <div class="bienvenida-mesa" id="bienvenidaMesa">
          <label for="inputMesa">Número de mesa</label>
          <input type="number" id="inputMesa" placeholder="Ej: 5" min="1" />
          <button class="btn-primary" id="btnGuardarMesa">Confirmar mesa</button>
          <p class="bienvenida-estado-mesa" id="estadoMesa"></p>
        </div>

        <!-- NUEVO: contenedor flexible para las tarjetas -->
        <div class="bienvenida-cards">
          <div class="bienvenida-card bienvenida-card-grande" id="cardGastronomica">
            <div class="card-glass">
              <div class="card-imagen" id="cardImagenGastro"></div>
              <div class="card-texto">
                <h2>📜 Armar mi Pedido</h2>
                <p id="mensajeGastro">Explorá el menú y dejá tu selección lista para el garzón.</p>
              </div>
            </div>
          </div>

          <div class="bienvenida-card bienvenida-card-chica" id="cardEntretenimiento">
            <div class="card-glass">
              <div class="card-texto">
                <h2>🎉 Eventos en Vivo</h2>
                <p id="mensajeEvento">Próximo evento a las 22:00 hrs</p>
                <div class="ecualizador" id="ecualizador" style="display:none;">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(_vista);
    _configurarEventos();
    _actualizarMensaje();
    _verificarEventos();
    return _vista;
  }

  function _configurarEventos() {
    document.getElementById('btnGuardarMesa').addEventListener('click', _guardarMesa);
    document.getElementById('cardGastronomica').addEventListener('click', _irAlMenu);
    document.getElementById('cardEntretenimiento').addEventListener('click', _irAEventos);
  }

  function _guardarMesa() {
    const input = document.getElementById('inputMesa');
    const valor = parseInt(input?.value, 10);
    if (!valor || valor < 1) {
      document.getElementById('estadoMesa').textContent = 'Ingresá un número válido.';
      return;
    }
    _mesa = valor;
    _verificarPermisoMesa();
    document.getElementById('estadoMesa').textContent = `Mesa ${_mesa} guardada. Esperando activación del garzón...`;
  }

  function _verificarPermisoMesa() {
    if (!_mesa) return;
    const state = window.Store?.getState?.() || {};
    const mesas = state.mesas || [];
    const mesaActual = mesas.find(m => m.numero === _mesa);
    if (mesaActual && mesaActual.permite_prepedidos === true) {
      _permitePrepedidos = true;
      document.getElementById('estadoMesa').textContent = '✅ ¡Mesa activada! Podés armar tu pedido.';
      document.getElementById('mensajeGastro').textContent = '🎉 ¡Pantalla Activada! Comenzá tu selección.';
    } else {
      _permitePrepedidos = false;
      document.getElementById('estadoMesa').textContent = '⏳ Ponete cómodo. El garzón activará tu mesa pronto.';
      document.getElementById('mensajeGastro').textContent = '¡Bienvenidos a La Taberna! En unos instantes tu garzón activará tu pantalla.';
    }
  }

  function obtenerMesa() { return _mesa; }
  function permitePrepedidos() { return _permitePrepedidos; }

  function _actualizarMensaje() {
    const nombre = window.Auth?.getNombre?.() || 'comensal';
    const hora = new Date().getHours();
    const headerEl = document.getElementById('bienvenidaMensaje');
    const subEl = document.getElementById('bienvenidaSub');
    if (hora >= 12 && hora < 19) {
      headerEl.textContent = `La noche está joven, ${nombre}`;
      subEl.textContent = '¿Con qué brindamos hoy?';
    } else if (hora >= 19 || hora < 3) {
      headerEl.textContent = `El escenario está ardiendo, ${nombre}`;
      subEl.textContent = 'Pedí otra ronda.';
    } else {
      headerEl.textContent = `Bienvenido/a, ${nombre}`;
      subEl.textContent = 'La Taberna te espera.';
    }
  }

  function _verificarEventos() {
    const state = window.Store?.getState?.() || {};
    const eventos = state.eventos_en_vivo || [];
    const activo = eventos.find(e => e.estado === 'activo');
    const ecualizador = document.getElementById('ecualizador');
    const mensaje = document.getElementById('mensajeEvento');
    if (activo) {
      mensaje.textContent = `🎤 ${activo.tipo || 'Evento'} en vivo ahora`;
      if (ecualizador) ecualizador.style.display = 'flex';
    } else {
      mensaje.textContent = 'Próximo evento a las 22:00 hrs';
      if (ecualizador) ecualizador.style.display = 'none';
    }
  }

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
      _actualizarMensaje();
      _verificarPermisoMesa();
      _verificarEventos();
    }
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
  }

  function _initRealtime() {
    if (typeof window.EventBus !== 'undefined') {
      window.EventBus.on('mesas:actualizada', (datos) => {
        if (_mesa && datos && datos.numero === _mesa) _verificarPermisoMesa();
      });
      window.EventBus.on('eventos_en_vivo:actualizada', () => _verificarEventos());
    }
  }

  _initRealtime();

  return { render, mostrar, ocultar, obtenerMesa, permitePrepedidos };
})();

export { PantallaBienvenida };