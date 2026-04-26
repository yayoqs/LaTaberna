/* ================================================================
   PubPOS — MÓDULO: auth.js (v3 – roles genéricos + nuevos perfiles)
   ================================================================ */
const Auth = (() => {
  const USUARIOS = [
    { nombre: 'master',   password: 'master123',  rol: 'master' },
    { nombre: 'admin',    password: 'admin123',   rol: 'admin' },
    { nombre: 'cocina',   password: 'cocina',     rol: 'cocina' },
    { nombre: 'barra',    password: 'barra',      rol: 'barra' },
    { nombre: 'caja',     password: 'caja',       rol: 'caja' },
    { nombre: 'mesero',   password: 'mesero',     rol: 'mesero' },
    { nombre: 'despensa', password: 'despensa',   rol: 'despensa' },
    { nombre: 'eventos',  password: 'eventos',    rol: 'eventos' },
    { nombre: 'reparto',  password: 'reparto',    rol: 'reparto' },
    { nombre: 'cliente',  password: 'cliente',    rol: 'cliente' }
  ];

  let _usuarioActual = null;
  let _rolSimulado = null;

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
    if (rol === 'despensa') return 'despensa';   // despensa ve directamente su inventario
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

  // --- MODAL DE LOGIN ---
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
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
    }
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
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  // --- Permisos y restricciones UI ---
  function getRolEfectivo() {
    if (_usuarioActual?.rol === 'master' && _rolSimulado) {
      return _rolSimulado;
    }
    return _usuarioActual?.rol || null;
  }

  function tienePermiso(permiso) {
    const rol = getRolEfectivo();
    if (!rol) return false;
    return Roles.getPermisos(rol)[permiso] === true;
  }

  function getRol() { return _usuarioActual?.rol || null; }
  function getNombre() { return _usuarioActual?.nombre || ''; }
  function esMaster() { return _usuarioActual?.rol === 'master' && !_rolSimulado; }
  function esAdmin() { return getRolEfectivo() === 'admin' || esMaster(); }
  function esCocina() { return getRolEfectivo() === 'cocina' || esAdmin(); }
  function esBarra() { return getRolEfectivo() === 'barra' || esAdmin(); }
  function esCaja() { return getRolEfectivo() === 'caja' || esAdmin(); }
  function esMesero() { return getRolEfectivo() === 'mesero' || esAdmin(); }
  function esDespensa() { return getRolEfectivo() === 'despensa' || esAdmin(); }  // nuevo ayudante

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
    const rolEfectivo = getRolEfectivo();
    if (userEl) {
      let displayText = _usuarioActual ? `${_usuarioActual.nombre} (${_usuarioActual.rol})` : '';
      if (_rolSimulado) {
        displayText += ` ⇒ ${_rolSimulado}`;
      }
      userEl.textContent = displayText;
    }

    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(rolEfectivo) ||
                     (rolEfectivo === 'admin' && roles.includes('admin')) ||
                     (rolEfectivo === 'master' && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });

    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;

    if (esMaster()) {
      const rolesDisponibles = Roles.lista.filter(r => r !== 'master');
      const opciones = rolesDisponibles.map(r => `<option value="${r}" ${r === (_rolSimulado || 'admin') ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
      mozoContainer.innerHTML = `
        <i class="fas fa-eye"></i>
        <select id="rolSimulado" onchange="Auth._cambiarRolSimulado(this.value)">
          <option value="">— Ver como —</option>
          ${opciones}
        </select>
      `;
      if (!_rolSimulado) {
        document.getElementById('rolSimulado').value = '';
      }
    } else {
      // Para otros roles: mostrar nombre fijo o selector de mozo si es mesero/admin
      if (getRolEfectivo() === 'mesero' || esAdmin()) {
        let mozosNombres = [];
        if (typeof DB !== 'undefined' && Array.isArray(DB.mozos) && DB.mozos.length) {
          mozosNombres = DB.mozos.filter(m => m.activo !== false).map(m => m.nombre);
        } else {
          mozosNombres = ['mesero'];
        }
        const options = mozosNombres.map(nombre => `<option value="${nombre}" selected>${nombre}</option>`).join('');
        mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><select id="mozoActivo" onchange="Comanda?.setMozo?.(this.value)">${options}</select>`;
      } else {
        mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><span style="padding:6px 0;color:var(--color-text);font-weight:500;">${_usuarioActual.nombre}</span>`;
      }
    }
  }

  // Método para cambiar el rol simulado (solo master) – ahora es parte de la API pública
  function _cambiarRolSimulado(rol) {
    if (!_usuarioActual || _usuarioActual.rol !== 'master') return;
    if (!rol) {
      _rolSimulado = null;
    } else {
      if (!Roles.lista.includes(rol)) return;
      _rolSimulado = rol;
    }
    aplicarRestriccionesUI();
    const vistaInicial = getDefaultView();
    if (window.App) App.showView(vistaInicial);
  }

  // API pública
  return {
    init, login, logout, getRol, getNombre, tienePermiso, puede,
    esMaster, esAdmin, esCocina, esBarra, esCaja, esMesero, esDespensa,
    puedeEliminarItemEnviado, puedeCerrarMesa, puedeAccederCaja, puedeAccederCocina,
    puedeCambiarEstadoComanda, puedeEditarProductos, puedeEditarPrecios,
    getDefaultView,
    mostrarLogin, cerrarModalLogin, _loginFromModal,
    _cambiarRolSimulado,   // expuesto para el selector
    getRolEfectivo
  };
})();

window.Auth = Auth;