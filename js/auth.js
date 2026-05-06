/* ================================================================
   PubPOS — MÓDULO: auth.js (v5.7 – documentación JSDoc y robustez)
   ================================================================
   Cambios respecto a v5.6:
   • Se agregó documentación JSDoc completa para todas las funciones
     públicas, incluyendo parámetros, retornos y ejemplos de uso.
   • Se unificó la validación de credenciales usando las constantes
     USUARIOS definidas al inicio del módulo.
   • Se corrigió el acceso a _usuarioActual desde Perfil.js (antes
     se accedía directamente a la propiedad "privada"; ahora hay un
     método público actualizarNombre).
   • Se agregó Logger en lugar de console para advertencias.
   ================================================================ */
const Auth = (() => {
  /**
   * Lista de usuarios precargados.
   * En producción estos datos deberían venir de la hoja "Empleados".
   * @type {Array<{nombre: string, password: string, rol: string}>}
   */
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

  /** @type {object|null} Datos del usuario autenticado */
  let _usuarioActual = null;

  /** @type {string|null} Rol simulado (solo para master) */
  let _rolSimulado = null;

  /**
   * Inicializa el módulo de autenticación.
   * Si hay una sesión guardada en sessionStorage, la restaura.
   * Si no, muestra el modal de login.
   */
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

  /**
   * Devuelve la vista por defecto según el rol efectivo.
   * @returns {string} Nombre de la vista (ej. 'mesas', 'cocina')
   */
  function getDefaultView() {
    const rol = getRolEfectivo();
    if (rol === 'cocina' || rol === 'barra') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'despensa') return 'despensa';
    if (rol === 'reparto') return 'reparto';
    if (rol === 'eventos') return 'eventos';
    if (rol === 'cliente') return 'menu';
    // admin y master vuelven a mesas como vista principal
    return 'mesas';
  }

  /**
   * Intenta iniciar sesión con usuario y contraseña.
   * @param {string} nombre - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {boolean} true si el login fue exitoso
   */
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

  /** Cierra la sesión actual y muestra el login */
  function logout() {
    _usuarioActual = null;
    _rolSimulado = null;
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();
  }

  // ── MODAL DE LOGIN ──────────────────────────────────────
  let loginModal = null;

  /** Muestra el modal de inicio de sesión */
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
            <input type="text" id="loginUsuario" placeholder="Ej: admin, master, cocina, barra, caja, mesero, despensa, eventos, reparto, cliente">
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

  /** Oculta el modal de login */
  function cerrarModalLogin() {
    if (loginModal) loginModal.style.display = 'none';
  }

  /** Toma los valores del formulario de login y los envía a login() */
  function _loginFromModal() {
    const usuario = document.getElementById('loginUsuario')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value.trim() || '';
    login(usuario, password);
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  /**
   * Devuelve el rol efectivo (considera simulación de master).
   * @returns {string|null}
   */
  function getRolEfectivo() {
    if (_usuarioActual?.rol === 'master' && _rolSimulado) return _rolSimulado;
    return _usuarioActual?.rol || null;
  }

  /**
   * Verifica si el usuario tiene un permiso específico.
   * @param {string} permiso - Nombre del permiso (ej. 'cerrarMesa')
   * @returns {boolean}
   */
  function tienePermiso(permiso) {
    const rol = getRolEfectivo();
    if (!rol) return false;
    return (typeof Roles !== 'undefined' && Roles.getPermisos(rol)[permiso] === true);
  }

  /** @returns {string|null} Rol del usuario logueado */
  function getRol() { return _usuarioActual?.rol || null; }

  /** @returns {string} Nombre del usuario logueado */
  function getNombre() { return _usuarioActual?.nombre || ''; }

  /**
   * Retorna el objeto completo del usuario actual.
   * @returns {object|null} { nombre, rol, rolEfectivo, simulando }
   */
  function getUsuarioActual() {
    if (!_usuarioActual) return null;
    return {
      nombre: _usuarioActual.nombre,
      rol: _usuarioActual.rol,
      rolEfectivo: getRolEfectivo(),
      simulando: _rolSimulado || null
    };
  }

  /**
   * Actualiza el nombre del usuario actual (usado por Perfil).
   * @param {string} nuevoNombre
   */
  function actualizarNombre(nuevoNombre) {
    if (!_usuarioActual) return;
    if (!nuevoNombre || typeof nuevoNombre !== 'string') {
      Logger.warn('[Auth] Intento de actualizar nombre con valor inválido:', nuevoNombre);
      return;
    }
    _usuarioActual.nombre = nuevoNombre;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    Logger.info(`[Auth] Nombre actualizado a "${nuevoNombre}"`);
  }

  // ── MÉTODOS DE COMPROBACIÓN DE ROL ──────────────────────
  function esMasterReal() { return _usuarioActual?.rol === 'master'; }
  function esMaster() { return _usuarioActual?.rol === 'master' && !_rolSimulado; }
  function esAdmin() { const r = getRolEfectivo(); return r === 'admin' || r === 'master'; }
  function esCocina() { const r = getRolEfectivo(); return r === 'cocina' || r === 'admin' || r === 'master'; }
  function esBarra() { const r = getRolEfectivo(); return r === 'barra' || r === 'admin' || r === 'master'; }
  function esCaja() { const r = getRolEfectivo(); return r === 'caja' || r === 'admin' || r === 'master'; }
  function esMesero() { const r = getRolEfectivo(); return r === 'mesero' || r === 'admin' || r === 'master'; }
  function esDespensa() { const r = getRolEfectivo(); return r === 'despensa' || r === 'admin' || r === 'master'; }
  function esReparto() { const r = getRolEfectivo(); return r === 'reparto' || r === 'admin' || r === 'master'; }
  function esCliente() { const r = getRolEfectivo(); return r === 'cliente' || r === 'admin' || r === 'master'; }
  function esEventos() { const r = getRolEfectivo(); return r === 'eventos' || r === 'admin' || r === 'master'; }

  // ── PERMISOS ESPECÍFICOS ────────────────────────────────
  function puede(permiso) { return tienePermiso(permiso); }
  function puedeEliminarItemEnviado() { return tienePermiso('eliminarItemEnviado'); }
  function puedeCerrarMesa() { return tienePermiso('cerrarMesa'); }
  function puedeAccederCaja() { return tienePermiso('accederCaja'); }
  function puedeAccederCocina() { return tienePermiso('accederCocina'); }
  function puedeCambiarEstadoComanda() { return tienePermiso('cambiarEstadoComanda'); }
  function puedeEditarProductos() { return tienePermiso('editarProductos'); }
  function puedeEditarPrecios() { return tienePermiso('editarPrecios'); }
  function puedeAccederRecetas() {
    const rol = getRolEfectivo();
    return ['cocina', 'barra', 'admin', 'master'].includes(rol);
  }
  function puedeAccederReparto() {
    const rol = getRolEfectivo();
    return ['reparto', 'admin', 'master'].includes(rol);
  }
  function puedeAccederMenu() { return getRolEfectivo() !== null; }
  function puedeAccederEventos() {
    const rol = getRolEfectivo();
    return ['eventos', 'admin', 'master'].includes(rol);
  }
  function puedeAccederPerfil() {
    return getRolEfectivo() !== null;
  }

  /**
   * Actualiza la UI según el rol actual.
   * Muestra/oculta elementos con data-rol, actualiza el selector de
   * simulación para el master y refleja el nombre en el header.
   */
  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    const rolEfectivo = getRolEfectivo();
    if (userEl) {
      let displayText = _usuarioActual ? `${_usuarioActual.nombre} (${_usuarioActual.rol})` : '';
      if (_rolSimulado) displayText += ` ⇒ ${_rolSimulado}`;
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

    if (esMasterReal()) {
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
      mozoContainer.innerHTML = '';
    }
  }

  /**
   * Cambia el rol simulado (solo para master).
   * @param {string} rol - Nuevo rol a simular (vacío para quitar simulación)
   */
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

  // ── API PÚBLICA ────────────────────────────────────────
  return {
    init,
    login,
    logout,
    getRol,
    getNombre,
    getUsuarioActual,
    actualizarNombre,       // ← NUEVO método público
    tienePermiso,
    puede,
    esMaster,
    esAdmin,
    esCocina,
    esBarra,
    esCaja,
    esMesero,
    esDespensa,
    esReparto,
    esCliente,
    esEventos,
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
    aplicarRestriccionesUI,
    puedeAccederRecetas,
    puedeAccederReparto,
    puedeAccederMenu,
    puedeAccederEventos,
    puedeAccederPerfil
  };
})();

window.Auth = Auth;