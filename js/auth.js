/* ================================================================
   PubPOS — MÓDULO: auth.js (v5 – selector de simulación permanente,
              eliminación de selector de mozo para otros roles)
   ================================================================ */
const Auth = (() => {
  const USUARIOS = [
    { nombre: 'master',   password: 'master123', rol: 'master' },
    { nombre: 'admin',    password: 'admin123',  rol: 'admin' },
    { nombre: 'cocina',   password: 'cocina',    rol: 'cocina' },
    { nombre: 'barra',    password: 'barra',     rol: 'barra' },
    { nombre: 'caja',     password: 'caja',      rol: 'caja' },
    { nombre: 'mesero',   password: 'mesero',    rol: 'mesero' },
    { nombre: 'despensa', password: 'despensa',  rol: 'despensa' },
    { nombre: 'eventos',  password: 'eventos',   rol: 'eventos' },
    { nombre: 'reparto',  password: 'reparto',   rol: 'reparto' },
    { nombre: 'cliente',  password: 'cliente',   rol: 'cliente' }
  ];

  let _usuarioActual = null;
  let _rolSimulado = null;    // solo master puede simular otro rol

  function init() {
    const saved = sessionStorage.getItem('usuarioActual');
    if (saved) {
      try { _usuarioActual = JSON.parse(saved); } catch { _usuarioActual = null; }
    }
    if (!_usuarioActual) {
      mostrarLogin();
    } else {
      aplicarRestriccionesUI();
    }
  }

  function getDefaultView() {
    const rol = getRolEfectivo();
    if (rol === 'cocina' || rol === 'barra') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'despensa') return 'despensa';
    return 'mesas';
  }

  function login(nombre, password) {
    const user = USUARIOS.find(u => u.nombre === nombre && u.password === password);
    if (!user) {
      showToast('error', 'Usuario o contraseña incorrectos');
      return false;
    }
    _usuarioActual = { nombre: user.nombre, rol: user.rol };
    _rolSimulado = null;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    cerrarModalLogin();
    showToast('success', `Bienvenido ${user.nombre} (${user.rol})`);
    const vistaInicial = getDefaultView();
    if (window.App) App.showView(vistaInicial);
    return true;
  }

  function logout() {
    _usuarioActual = null;
    _rolSimulado = null;
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();
  }

  // ── MODAL DE LOGIN ──────────────────────────────────────────
  let loginModal = null;

  function mostrarLogin() {
    if (!loginModal) {
      loginModal = document.createElement('div');
      loginModal.id = 'modalLogin';
      loginModal.className = 'modal-overlay';
      loginModal.style.display = 'flex';
      loginModal.innerHTML = `
        <div class="modal-small" style="max-width:360px;">
          <div class="modal-header">
            <h3><i class="fas fa-beer"></i> La Taberna</h3>
            <button class="modal-close" onclick="Auth.cerrarModalLogin()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Usuario</label>
            <input type="text" id="loginUsuario" placeholder="Ej: admin, master, cocina, barra, caja, mesero, despensa, eventos, reparto">
            <label>Contraseña</label>
            <input type="password" id="loginPassword" placeholder="Contraseña">
            <div class="modal-small-footer">
              <button class="btn-primary" onclick="Auth._loginFromModal()" style="width:100%;">
                <i class="fas fa-sign-in-alt"></i> Ingresar
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(loginModal);
    } else {
      loginModal.style.display = 'flex';
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  }

  function cerrarModalLogin() {
    if (loginModal) loginModal.style.display = 'none';
  }

  function _loginFromModal() {
    const usuario = document.getElementById('loginUsuario')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value.trim() || '';
    login(usuario, password);
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  // ── PERMISOS ──────────────────────────────────────────────
  function getRolEfectivo() {
    if (_usuarioActual?.rol === 'master' && _rolSimulado) {
      return _rolSimulado;
    }
    return _usuarioActual?.rol || null;
  }

  function tienePermiso(permiso) {
    const rol = getRolEfectivo();
    if (!rol) return false;
    return (typeof Roles !== 'undefined' && Roles.getPermisos(rol)[permiso] === true);
  }

  function getRol() { return _usuarioActual?.rol || null; }
  function getNombre() { return _usuarioActual?.nombre || ''; }
  function esMasterReal() { return _usuarioActual?.rol === 'master'; }
  function esMaster() { return _usuarioActual?.rol === 'master' && !_rolSimulado; }
  function esAdmin() { const r = getRolEfectivo(); return r === 'admin' || r === 'master'; }
  function esCocina() { const r = getRolEfectivo(); return r === 'cocina' || r === 'admin' || r === 'master'; }
  function esBarra() { const r = getRolEfectivo(); return r === 'barra' || r === 'admin' || r === 'master'; }
  function esCaja() { const r = getRolEfectivo(); return r === 'caja' || r === 'admin' || r === 'master'; }
  function esMesero() { const r = getRolEfectivo(); return r === 'mesero' || r === 'admin' || r === 'master'; }
  function esDespensa() { const r = getRolEfectivo(); return r === 'despensa' || r === 'admin' || r === 'master'; }

  function puede(permiso) { return tienePermiso(permiso); }
  function puedeEliminarItemEnviado() { return tienePermiso('eliminarItemEnviado'); }
  function puedeCerrarMesa() { return tienePermiso('cerrarMesa'); }
  function puedeAccederCaja() { return tienePermiso('accederCaja'); }
  function puedeAccederCocina() { return tienePermiso('accederCocina'); }
  function puedeCambiarEstadoComanda() { return tienePermiso('cambiarEstadoComanda'); }
  function puedeEditarProductos() { return tienePermiso('editarProductos'); }
  function puedeEditarPrecios() { return tienePermiso('editarPrecios'); }

  // ── UI ────────────────────────────────────────────────────
  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    const rolEfectivo = getRolEfectivo();
    if (userEl) {
      let displayText = _usuarioActual ? `${_usuarioActual.nombre} (${_usuarioActual.rol})` : '';
      if (_rolSimulado) displayText += ` ⇒ ${_rolSimulado}`;
      userEl.textContent = displayText;
    }

    // Mostrar/ocultar elementos según el rol efectivo
    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(rolEfectivo) ||
                     (rolEfectivo === 'admin' && roles.includes('admin')) ||
                     (rolEfectivo === 'master' && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });

    // Contenedor del selector de mozo / simulador de rol
    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;

    if (esMasterReal()) {
      // Siempre mostrar selector de simulación para master
      const rolesDisponibles = (typeof Roles !== 'undefined')
        ? Roles.lista.filter(r => r !== 'master')
        : [];
      const seleccionado = _rolSimulado || '';
      const opciones = rolesDisponibles.map(r =>
        `<option value="${r}" ${r === seleccionado ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
      ).join('');
      mozoContainer.innerHTML = `
        <i class="fas fa-eye"></i>
        <select id="rolSimulado" onchange="Auth._cambiarRolSimulado(this.value)">
          <option value="">— Ver como —</option>
          ${opciones}
        </select>
      `;
      const selectEl = mozoContainer.querySelector('#rolSimulado');
      if (selectEl) selectEl.value = seleccionado;
    } else {
      // Para cualquier otro rol: espacio vacío (sin selector de mozo)
      mozoContainer.innerHTML = '';
    }
  }

  function _cambiarRolSimulado(rol) {
    if (!_usuarioActual || _usuarioActual.rol !== 'master') return;
    if (!rol) {
      _rolSimulado = null;
    } else {
      if (typeof Roles !== 'undefined' && !Roles.lista.includes(rol)) return;
      _rolSimulado = rol;
    }
    aplicarRestriccionesUI();
    const vistaInicial = getDefaultView();
    if (window.App) App.showView(vistaInicial);
  }

  // ── API PÚBLICA ──────────────────────────────────────────
  return {
    init,
    login,
    logout,
    getRol,
    getNombre,
    tienePermiso,
    puede,
    esMaster,
    esAdmin,
    esCocina,
    esBarra,
    esCaja,
    esMesero,
    esDespensa,
    puedeEliminarItemEnviado,
    puedeCerrarMesa,
    puedeAccederCaja,
    puedeAccederCocina,
    puedeCambiarEstadoComanda,
    puedeEditarProductos,
    puedeEditarPrecios,
    getDefaultView,
    mostrarLogin,
    cerrarModalLogin,
    _loginFromModal,
    _cambiarRolSimulado,
    getRolEfectivo,
    esMasterReal,
    aplicarRestriccionesUI   // exponemos para que App lo llame al cambiar de vista
  };
})();

window.Auth = Auth;