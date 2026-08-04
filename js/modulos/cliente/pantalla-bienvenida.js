/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/pantalla-bienvenida.js
   Versión: 2.2.7
   Propósito: Panel de control post-validación.
              Auth.logout → Auth.cerrarSesion.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Store } from '../../lib/store.js';
import { Auth } from '../../auth.js';
import { mostrarEntrada } from '../../utils.js';

const PantallaBienvenida = (() => {
  let _vista = null;
  let _mesa = null;
  let _permitePrepedidos = false;
  let _interfazActivada = false;
  let _activada = false;

  let _abortController = null;
  let _abortControllerPanel = null;

  let _cbMesasActualizada, _cbMesaActualizada, _cbEventosActualizada, _cbPrecargasActualizada;
  let _cbBtnGuardar, _cbBtnBarra, _cbLogout, _cbGastroInicial, _cbEventosInicial;

  function _asegurarVista() {
    if (_vista) return;

    let main = document.getElementById('view-bienvenida');
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-bienvenida';
      main.className = 'view';
      document.body.appendChild(main);
    }

    _vista = main;

    if (_vista.querySelector('.top-bar')) return;

    _vista.innerHTML = `
      <div class="top-bar" id="bienvenidaTopBar">
        <div class="user-profile">
          <div class="user-avatar" id="bienvenidaAvatar"></div>
          <div class="user-info">
            <h3 id="bienvenidaNombre"></h3>
            <p><i class="fa-solid fa-circle-check"></i> Cliente Registrado</p>
          </div>
        </div>
        <button class="logout-btn" id="btnLogout"><i class="fa-solid fa-right-from-bracket"></i> Salir</button>
      </div>
      <div class="welcome-container" id="welcomeContainer">
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
        <div class="status-card" id="cardEspera" style="display:none;"></div>
        <div class="menu-grid" id="menuGridInicial">
          <div class="action-card order-mode" id="cardGastronomicaInicial">
            <div class="action-icon"><i class="fa-solid fa-scroll"></i></div>
            <div class="action-details"><h4>Armar mi Pedido</h4><p id="mensajeGastroInicial">Vincula tu mesa para comenzar.</p></div>
          </div>
          <div class="action-card events-mode" id="cardEntretenimientoInicial">
            <div class="action-icon"><i class="fa-solid fa-cake-candles"></i></div>
            <div class="action-details"><h4>Eventos en Vivo & Karaoke</h4><p id="mensajeEventoInicial">Próximo evento a las 22:00 hrs</p></div>
          </div>
        </div>
      </div>
    `;
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _abortController = new AbortController();
    const { signal } = _abortController;

    _cbBtnGuardar = _guardarMesa;
    _cbBtnBarra = _vincularBarra;
    _cbLogout = () => { if (typeof Auth.cerrarSesion === 'function') Auth.cerrarSesion(); };
    _cbGastroInicial = () => {
      if (!_permitePrepedidos) { document.getElementById('mensajeGastroInicial').textContent = 'Espera la activación del garzón.'; return; }
      _irAlMenu();
    };
    _cbEventosInicial = _irAEventos;

    document.getElementById('btnGuardarMesa').addEventListener('click', _cbBtnGuardar, { signal });
    document.getElementById('btnBarra').addEventListener('click', _cbBtnBarra, { signal });
    document.getElementById('btnLogout').addEventListener('click', _cbLogout, { signal });
    document.getElementById('cardEntretenimientoInicial').addEventListener('click', _cbEventosInicial, { signal });
    document.getElementById('cardGastronomicaInicial').addEventListener('click', _cbGastroInicial, { signal });

    _initRealtime();
    _actualizarPerfil();
  }

  function limpiar() {
    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (_abortControllerPanel) { _abortControllerPanel.abort(); _abortControllerPanel = null; }
    if (!_activada) return;
    _activada = false;

    if (typeof EventBus.off === 'function') {
      if (_cbMesasActualizada) EventBus.off('mesas:actualizada', _cbMesasActualizada);
      if (_cbMesaActualizada) EventBus.off('mesa:actualizada', _cbMesaActualizada);
      if (_cbEventosActualizada) EventBus.off('eventos_en_vivo:actualizada', _cbEventosActualizada);
      if (_cbPrecargasActualizada) EventBus.off('precargas_cliente:actualizada', _cbPrecargasActualizada);
    }
  }

  function _actualizarPerfil() {
    const nombre = Auth.obtenerNombre() || 'Comensal';
    const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
    const nombreEl = document.getElementById('bienvenidaNombre');
    const avatarEl = document.getElementById('bienvenidaAvatar');
    if (nombreEl) nombreEl.textContent = nombre;
    if (avatarEl) avatarEl.textContent = iniciales;
  }

  function _guardarMesa() {
    const input = document.getElementById('inputMesa');
    const valor = parseInt(input?.value, 10);
    const estadoEl = document.getElementById('estadoMesa');
    if (!valor || valor < 1) { estadoEl.textContent = 'Ingresá un número válido.'; return; }
    const state = Store.obtenerEstado();
    const mesas = state.mesas || [];
    const mesaExiste = mesas.some(m => m.numero === valor);
    if (!mesaExiste) { estadoEl.textContent = `La mesa ${valor} no existe. Verificá el número.`; return; }
    _vincular(valor, estadoEl);
  }

  function _vincularBarra() { _vincular('barra', document.getElementById('estadoMesa')); }

  function _vincular(mesaId, estadoEl) {
    _mesa = mesaId;
    if (estadoEl) estadoEl.textContent = `Vinculado a ${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}.`;
    EventBus.emit('cliente:mesa_ingresada', { mesa: _mesa });
    const cardIngreso = document.getElementById('cardIngresoMesa');
    if (cardIngreso) cardIngreso.style.display = 'none';

    Store.despachar({ type: 'CLIENTE_MESA_ASIGNADA', payload: _mesa });

    const cardEspera = document.getElementById('cardEspera');
    if (cardEspera) {
      cardEspera.style.display = 'block';
      cardEspera.innerHTML = `
        <h2>Mesa asignada: <span style="color:var(--color-accent)">${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}</span></h2>
        <div class="waiting-status" id="waitingBlock">
          <div class="spinner"></div>
          <p style="font-size:0.9rem;font-weight:600;">Esperando validación del garzón...</p>
          <p style="color:var(--color-text-sec);font-size:0.8rem;">Estamos confirmando tu presencia en el mesón.</p>
        </div>
      `;
    }
    const mensaje = document.getElementById('mensajeGastroInicial');
    if (mensaje) mensaje.textContent = 'Espera la activación del garzón.';
  }

  function _verificarPermisoMesa() {
    if (!_mesa) return;
    const state = Store.obtenerEstado();
    const mesas = state.mesas || [];
    const mesaActual = _mesa === 'barra' ? mesas.find(m => m.numero === 0 || m.nombre === 'barra') : mesas.find(m => m.numero === _mesa);
    const permite = mesaActual && mesaActual.permite_prepedidos === true;

    if (permite && !_interfazActivada) {
      _interfazActivada = true;
      _permitePrepedidos = true;
      Store.despachar({ type: 'CLIENTE_PERMISO_PREPEDIDOS', payload: true });
      _construirPanelControl();
    } else if (!permite && _interfazActivada) {
      _interfazActivada = false;
      _permitePrepedidos = false;
      Store.despachar({ type: 'CLIENTE_PERMISO_PREPEDIDOS', payload: false });
      const cardEspera = document.getElementById('cardEspera');
      if (cardEspera) {
        cardEspera.style.display = 'block';
        cardEspera.innerHTML = `
          <h2>Mesa asignada: <span style="color:var(--color-accent)">${_mesa === 'barra' ? 'Barra' : 'Mesa ' + _mesa}</span></h2>
          <div class="waiting-status"><div class="spinner"></div><p style="font-size:0.9rem;font-weight:600;">Esperando validación del garzón...</p><p style="color:var(--color-text-sec);font-size:0.8rem;">Estamos confirmando tu presencia en el mesón.</p></div>
        `;
      }
      const mensaje = document.getElementById('mensajeGastroInicial');
      if (mensaje) mensaje.textContent = 'Espera la activación del garzón.';
    }
  }

  function _construirPanelControl() {
    if (_abortControllerPanel) { _abortControllerPanel.abort(); }
    _abortControllerPanel = new AbortController();
    const { signal } = _abortControllerPanel;

    const container = document.getElementById('welcomeContainer');
    if (!container) return;
    const esBarra = _mesa === 'barra';
    const nombreMesa = esBarra ? 'Barra' : `Mesa ${_mesa}`;
    container.innerHTML = `
      <div class="hero-row">
        <div class="hero-estado">
          <div class="icono-mesa">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <rect x="30" y="30" width="40" height="40" rx="4" fill="none" stroke="var(--color-accent)" stroke-width="3" />
              <rect x="42" y="14" width="16" height="10" rx="3" fill="none" stroke="var(--color-accent)" stroke-width="2" />
              <rect x="76" y="42" width="10" height="16" rx="3" fill="none" stroke="var(--color-accent)" stroke-width="2" />
              <rect x="42" y="76" width="16" height="10" rx="3" fill="none" stroke="var(--color-accent)" stroke-width="2" />
              <rect x="14" y="42" width="10" height="16" rx="3" fill="none" stroke="var(--color-accent)" stroke-width="2" />
              <text x="50" y="55" text-anchor="middle" fill="var(--color-accent)" font-size="16" font-weight="800">${esBarra ? 'B' : _mesa}</text>
            </svg>
          </div>
          <h1>${nombreMesa}</h1>
          <p>${esBarra ? 'Estás en la barra. Solo verás tus propios consumos.' : `Te encuentras en la mesa ${_mesa}. ¡Todo listo para disfrutar!`}</p>
        </div>
        <div class="sidebar-comensales" id="sidebarComensales">
          <h4><i class="fa-solid fa-users"></i> Comensales</h4>
          <div class="avatar-list-vertical" id="listaComensales"><div class="avatar-mini activo" id="avatarPrincipal"></div></div>
          <button class="btn-agregar-comensal" id="btnAgregarComensal">+</button>
        </div>
      </div>
      <div class="acciones-grid">
        <button class="btn-accion btn-pedido" id="btnHacerPedido"><i class="fa-solid fa-scroll"></i> Hacer un Pedido</button>
        <button class="btn-accion btn-llamar" id="btnLlamarGarzon"><i class="fa-solid fa-bell"></i> Llamar al Garzón</button>
      </div>
      <div class="pedido-vistazo" id="pedidoVistazo">
        <div class="pedido-icono">📋</div>
        <div class="pedido-detalle"><h4>Mi Pedido</h4><p id="textoEstadoPedido">Aún no has hecho ningún pedido.</p></div>
        <div class="pedido-badge" id="badgeCantidadPedidos" style="display:none;">0 activo</div>
      </div>
      <div class="menu-grid">
        <div class="action-card order-mode" id="cardGastronomica"><div class="action-icon"><i class="fa-solid fa-scroll"></i></div><div class="action-details"><h4>Armar mi Pedido</h4><p>Explora la carta digital y arma tu orden.</p></div></div>
        <div class="action-card events-mode" id="cardEntretenimiento"><div class="action-icon"><i class="fa-solid fa-cake-candles"></i></div><div class="action-details"><h4>Eventos en Vivo & Karaoke</h4><p id="mensajeEvento">Próximo evento a las 22:00 hrs</p></div></div>
      </div>
    `;

    const iniciales = Auth.obtenerNombre()?.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('') || '??';
    const avatarPrincipal = document.getElementById('avatarPrincipal');
    if (avatarPrincipal) avatarPrincipal.textContent = iniciales;

    document.getElementById('btnHacerPedido').addEventListener('click', _irAlMenu, { signal });
    document.getElementById('btnLlamarGarzon').addEventListener('click', _llamarGarzon, { signal });
    document.getElementById('cardGastronomica').addEventListener('click', _irAlMenu, { signal });
    document.getElementById('cardEntretenimiento').addEventListener('click', _irAEventos, { signal });
    document.getElementById('btnAgregarComensal').addEventListener('click', _agregarComensal, { signal });

    _cbPrecargasActualizada = _actualizarVistazoPedido;
    EventBus.on('precargas_cliente:actualizada', _cbPrecargasActualizada);
    _actualizarVistazoPedido();
  }

  function _llamarGarzon() {
    EventBus.emit('cliente:llamar_garzon', { mesa: _mesa });
    const btn = document.getElementById('btnLlamarGarzon');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Garzón notificado';
      btn.style.pointerEvents = 'none';
      setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-bell"></i> Llamar al Garzón'; btn.style.pointerEvents = ''; }, 3000);
    }
  }

  async function _agregarComensal() {
    const nombre = await mostrarEntrada('Agregar comensal', 'Nombre del nuevo comensal:');
    if (!nombre) return;
    const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
    const lista = document.getElementById('listaComensales');
    if (lista) {
      const avatar = document.createElement('div'); avatar.className = 'avatar-mini'; avatar.textContent = iniciales; avatar.title = nombre;
      lista.appendChild(avatar);
    }
    EventBus.emit('cliente:comensal_agregado', { mesa: _mesa, nombre, iniciales });
  }

  function _actualizarVistazoPedido() {
    const state = Store.obtenerEstado();
    const precargas = state.precargas_cliente || [];
    const misPrecargas = precargas.filter(p => p.id_usuario === (Auth.getAppwriteUserId?.() || ''));
    const texto = document.getElementById('textoEstadoPedido');
    const badge = document.getElementById('badgeCantidadPedidos');
    if (misPrecargas.length === 0) { if (texto) texto.textContent = 'Aún no has hecho ningún pedido.'; if (badge) badge.style.display = 'none'; return; }
    const ultima = misPrecargas[misPrecargas.length - 1];
    const items = typeof ultima.productos === 'string' ? JSON.parse(ultima.productos) : ultima.productos;
    const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
    if (texto) texto.innerHTML = `${items[0]?.nombre || 'Producto'} x${totalItems} — <span style="color:#f59e0b;">${ultima.estado || 'pendiente'}</span>`;
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = `${misPrecargas.length} activo${misPrecargas.length > 1 ? 's' : ''}`; }
  }

  function obtenerMesa() { return _mesa; }
  function permitePrepedidos() { return _permitePrepedidos; }
  function _irAlMenu() { if (!_mesa || !_permitePrepedidos) return; EventBus.emit('app:cambiarVista', 'menu'); }
  function _irAEventos() { EventBus.emit('app:cambiarVista', 'eventos'); }

  function mostrar() {
    _asegurarVista();
    activar();
    _verificarPermisoMesa();
    const viewMenu = document.getElementById('view-menu');
    if (viewMenu) viewMenu.classList.remove('active');
    _vista.classList.add('active');
    _actualizarPerfil();
    if (_mesa) {
      const cardIngreso = document.getElementById('cardIngresoMesa');
      const cardEspera = document.getElementById('cardEspera');
      if (_interfazActivada) { if (cardIngreso) cardIngreso.style.display = 'none'; if (cardEspera) cardEspera.style.display = 'none'; }
      else { if (cardIngreso) cardIngreso.style.display = 'none'; if (cardEspera) cardEspera.style.display = 'block'; }
    }
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    limpiar();
  }

  function _initRealtime() {
    _cbMesasActualizada = (datos) => {
      if (_mesa && datos) {
        const coincide = _mesa === 'barra' ? (datos.numero === 0 || datos.nombre === 'barra') : (datos.numero === _mesa);
        if (coincide) _verificarPermisoMesa();
      }
    };
    _cbMesaActualizada = (datos) => {
      if (_mesa && datos) {
        const coincide = _mesa === 'barra' ? (datos.numero === 0 || datos.nombre === 'barra') : (datos.numero === _mesa);
        if (coincide) _verificarPermisoMesa();
      }
    };
    _cbEventosActualizada = () => {
      const state = Store.obtenerEstado();
      const eventos = state.eventos_en_vivo || [];
      const activo = eventos.find(e => e.estado === 'activo');
      const mensaje = document.getElementById('mensajeEvento') || document.getElementById('mensajeEventoInicial');
      if (activo && mensaje) mensaje.textContent = `🎤 ${activo.tipo || 'Evento'} en vivo ahora`;
      else if (mensaje) mensaje.textContent = 'Próximo evento a las 22:00 hrs';
    };

    EventBus.on('mesas:actualizada', _cbMesasActualizada);
    EventBus.on('mesa:actualizada', _cbMesaActualizada);
    EventBus.on('eventos_en_vivo:actualizada', _cbEventosActualizada);
  }

  return { mostrar, ocultar, obtenerMesa, permitePrepedidos };
})();

export { PantallaBienvenida };