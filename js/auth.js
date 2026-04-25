/* ================================================================
   PubPOS — MÓDULO: auth.js (Corregido y completo)
   ================================================================ */

const Auth = (() => {
  const USUARIOS = [
    { nombre: 'master',  password: 'master123', rol: 'master' },
    { nombre: 'admin',   password: 'admin123',  rol: 'admin' },
    { nombre: 'cocina',  password: 'cocina',    rol: 'cocina' },
    { nombre: 'barra',   password: 'barra',     rol: 'barra' },
    { nombre: 'caja',    password: 'caja',      rol: 'caja' },
    { nombre: 'Carlos',  password: 'carlos',    rol: 'mesero' },
    { nombre: 'Ana',     password: 'ana',       rol: 'mesero' },
    { nombre: 'Luis',    password: 'luis',      rol: 'mesero' },
    { nombre: 'María',   password: 'maria',     rol: 'mesero' },
    { nombre: 'cliente', password: 'cliente',   rol: 'cliente' }
  ];

  let _usuarioActual = null;

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
    if (!_usuarioActual) return 'mesas';
    const rol = _usuarioActual.rol;
    if (rol === 'cocina' || rol === 'barra') return 'cocina';
    if (rol === 'caja') return 'caja';
    return 'mesas';
  }

  function login(nombre, password) {
    const user = USUARIOS.find(u => u.nombre === nombre && u.password === password);
    if (!user) {
      showToast('error', 'Usuario o contraseña incorrectos');
      return false;
    }
    _usuarioActual = { nombre: user.nombre, rol: user.rol };
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
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();
  }

  // --- MODAL DE LOGIN (se crea dinámicamente si no existe) ---
  function mostrarLogin() {
    let modal = document.getElementById('modalLogin');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalLogin';
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-small" style="max-width:360px;">
          <div class="modal-header">
            <h3><i class="fas fa-beer"></i> La Taberna</h3>
            <button class="modal-close" onclick="Auth.cerrarModalLogin()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Usuario</label>
            <input type="text" id="loginUsuario" placeholder="Ej: admin, master, cocina, barra, caja, Carlos, Ana, Luis, María">
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
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
    }
    // Ocultar todas las vistas mientras se muestra el login
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  }

  function cerrarModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) modal.style.display = 'none';
  }

  function _loginFromModal() {
    const usuario = document.getElementById('loginUsuario')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value.trim() || '';
    login(usuario, password);
    // Limpiar campos
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  // --- Permisos y restricciones UI ---
  function tienePermiso(permiso) {
    if (!_usuarioActual) return false;
    return Roles.getPermisos(_usuarioActual.rol)[permiso] === true;
  }

  function getRol() { return _usuarioActual?.rol || null; }
  function getNombre() { return _usuarioActual?.nombre || ''; }
  function esMaster() { return _usuarioActual?.rol === 'master'; }
  function esAdmin() { return _usuarioActual?.rol === 'admin' || esMaster(); }
  function esCocina() { return _usuarioActual?.rol === 'cocina' || esAdmin(); }
  function esBarra() { return _usuarioActual?.rol === 'barra' || esAdmin(); }
  function esCaja() { return _usuarioActual?.rol === 'caja' || esAdmin(); }
  function esMesero() { return _usuarioActual?.rol === 'mesero' || esAdmin(); }

  function puede(permiso) { return tienePermiso(permiso); }
  function puedeEliminarItemEnviado() { return tienePermiso('eliminarItemEnviado'); }
  function puedeCerrarMesa() { return tienePermiso('cerrarMesa'); }
  function puedeAccederCaja() { return tienePermiso('accederCaja'); }
  function puedeAccederCocina() { return tienePermiso('accederCocina'); }
  function puedeCambiarEstadoComanda() { return tienePermiso('cambiarEstadoComanda'); }
  function puedeEditarProductos() { return tienePermiso('editarProductos'); }
  function puedeEditarPrecios() { return tienePermiso('editarPrecios'); }

  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    if (userEl) userEl.textContent = _usuarioActual ? `${_usuarioActual.nombre} (${_usuarioActual.rol})` : '';

    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(_usuarioActual?.rol) ||
                     (esAdmin() && roles.includes('admin')) ||
                     (esMaster() && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });

    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;
    if (!esMaster()) {
      mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><span style="padding:6px 0;color:var(--color-text);font-weight:500;">${_usuarioActual.nombre}</span>`;
    } else {
      let mozosNombres = [];
      if (typeof DB !== 'undefined' && Array.isArray(DB.mozos) && DB.mozos.length) {
        mozosNombres = DB.mozos.filter(m => m.activo !== false).map(m => m.nombre);
      } else {
        mozosNombres = USUARIOS.filter(u => ['mesero','admin','master'].includes(u.rol)).map(u => u.nombre);
      }
      const options = mozosNombres.map(nombre => `<option value="${nombre}" ${nombre === _usuarioActual.nombre ? 'selected' : ''}>${nombre}</option>`).join('');
      mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><select id="mozoActivo" onchange="Comanda?.setMozo?.(this.value)">${options}</select>`;
    }
  }

  return {
    init, login, logout, getRol, getNombre, tienePermiso, puede,
    esMaster, esAdmin, esCocina, esBarra, esCaja, esMesero,
    puedeEliminarItemEnviado, puedeCerrarMesa, puedeAccederCaja, puedeAccederCocina,
    puedeCambiarEstadoComanda, puedeEditarProductos, puedeEditarPrecios,
    getDefaultView,
    mostrarLogin, cerrarModalLogin, _loginFromModal
  };
})();

window.Auth = Auth;