/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/auth.js
   Versión: 1.0.2
   Propósito: Autenticación, hashing SHA-256, roles, login/logout,
              registro de clientes, modal de login con botón Registrarse.
   Dependencias: js/lib/logger.js, js/lib/eventBus.js, js/utils.js
   ================================================================ */
const Auth = (() => {
  // ── CONFIGURACIÓN INICIAL SOLO PARA PRIMER ARRANQUE ────────
  const USUARIOS_POR_DEFECTO = [
    { nombre: 'master',   password: 'master123', rol: 'master' },
    { nombre: 'admin',    password: 'admin123',  rol: 'admin' },
    { nombre: 'cocina',   password: 'cocina',    rol: 'cocina' },
    { nombre: 'barra',    password: 'barra',     rol: 'barra' },
    { nombre: 'caja',     password: 'caja',      rol: 'caja' },
    { nombre: 'mesero',   password: 'mesero',    rol: 'mesero' },
    { nombre: 'despensa', password: 'despensa',  rol: 'despensa' },
    { nombre: 'eventos',  password: 'eventos',   rol: 'eventos' },
    { nombre: 'reparto',  password: 'reparto',   rol: 'reparto' },
    { nombre: 'cliente',  password: 'cliente',   rol: 'cliente' },
    { nombre: 'artista',  password: 'artista',   rol: 'artista' }
  ];

  /** @type {Array<{nombre:string, hash:string, rol:string}>} */
  let _usuarios = [];

  /** @type {object|null} */
  let _usuarioActual = null;
  let _rolSimulado = null;

  // ── HASHING ────────────────────────────────────────────────
  async function _sha256(texto) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── INICIALIZACIÓN DE USUARIOS ────────────────────────────
  async function _cargarUsuarios() {
    const guardados = localStorage.getItem('pubpos_usuarios');
    if (guardados) {
      try {
        _usuarios = JSON.parse(guardados);
        if (!Array.isArray(_usuarios) || _usuarios.length === 0) throw new Error('Array vacío');
        Logger.info('[Auth] Usuarios cargados desde localStorage.');
        return;
      } catch (e) {
        Logger.warn('[Auth] Datos de usuarios corruptos, regenerando...');
      }
    }

    Logger.info('[Auth] Creando usuarios iniciales con hash...');
    _usuarios = [];
    for (const u of USUARIOS_POR_DEFECTO) {
      const hash = await _sha256(u.password);
      _usuarios.push({ nombre: u.nombre, hash, rol: u.rol });
    }
    localStorage.setItem('pubpos_usuarios', JSON.stringify(_usuarios));
  }

  function _guardarUsuarios() {
    localStorage.setItem('pubpos_usuarios', JSON.stringify(_usuarios));
  }

  // ── AUTENTICACIÓN ─────────────────────────────────────────
  function init() {
    const saved = sessionStorage.getItem('usuarioActual');
    if (saved) {
      try { _usuarioActual = JSON.parse(saved); } catch { _usuarioActual = null; }
    }
    if (_usuarioActual) {
      aplicarRestriccionesUI();
    }
  }

  function getDefaultView() {
    const rol = getRolEfectivo();
    if (rol === 'cocina' || rol === 'barra') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'despensa') return 'despensa';
    if (rol === 'reparto') return 'reparto';
    if (rol === 'eventos' || rol === 'artista') return 'eventos';
    if (rol === 'cliente' || rol === 'master') return 'bienvenida';
    return 'mesas';
  }

  async function login(nombre, password) {
    const hashIngresado = await _sha256(password);
    const usuario = _usuarios.find(u => u.nombre === nombre && u.hash === hashIngresado);
    if (!usuario) {
      showToast('error', 'Usuario o contraseña incorrectos');
      return false;
    }

    const espacioTaberna = {
      id: 'esp_taberna',
      nombre: 'La Taberna',
      tipo: 'bar',
      rol: usuario.rol
    };

    _usuarioActual = {
      nombre: usuario.nombre,
      rol: usuario.rol,
      espacios: [espacioTaberna],
      espacioActivoId: espacioTaberna.id
    };
    _rolSimulado = null;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    cerrarModalLogin();
    showToast('success', 'Bienvenido/a ' + usuario.nombre + ' (' + usuario.rol + ')');
    const vistaInicial = getDefaultView();
    if (window.App) App.showView(vistaInicial);
    return true;
  }

  function logout() {
    _usuarioActual = null;
    _rolSimulado = null;
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(function(el) { el.style.display = 'none'; });
    mostrarLogin();
  }

  // ── ID DE USUARIO DE APPWRITE ──────────────────────────
  let _appwriteUserId = null;

  async function getAppwriteUserId() {
    if (_appwriteUserId) return _appwriteUserId;
    try {
      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.account) {
        const account = await DBAppwrite.account.get();
        _appwriteUserId = account.$id;
        Logger.info('[Auth] ID de Appwrite obtenido:', _appwriteUserId);
        return _appwriteUserId;
      }
    } catch (e) {
      Logger.warn('[Auth] No se pudo obtener el ID de Appwrite:', e);
    }
    return null;
  }

  // ── MODAL DE LOGIN ──────────────────────────────────────
  let loginModal = null;

  function mostrarLogin() {
    if (!loginModal) {
      loginModal = document.createElement('div');
      loginModal.id = 'modalLogin';
      loginModal.className = 'modal-overlay';
      loginModal.style.display = 'flex';
      loginModal.innerHTML =
        '<div class="modal-small" style="max-width:360px;">' +
          '<div class="modal-header">' +
            '<h3><i class="fas fa-beer"></i> La Taberna</h3>' +
            '<button class="modal-close" onclick="Auth.cerrarModalLogin()"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div class="modal-small-body">' +
            '<label>Usuario</label>' +
            '<input type="text" id="loginUsuario" placeholder="Ej: admin, mesero, cocina...">' +
            '<label>Contraseña</label>' +
            '<input type="password" id="loginPassword" placeholder="Contraseña">' +
            '<div class="modal-small-footer" style="display:flex; flex-direction:column; gap:8px;">' +
              '<button class="btn-primary" onclick="Auth._loginFromModal()" style="width:100%;">' +
                '<i class="fas fa-sign-in-alt"></i> Ingresar' +
              '</button>' +
              '<button class="btn-secondary" onclick="Auth._mostrarRegistro()" style="width:100%;">' +
                '<i class="fas fa-user-plus"></i> ¿Aun sin cuenta? Registrate' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(loginModal);
    } else {
      loginModal.style.display = 'flex';
    }
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  }

  function cerrarModalLogin() {
    if (loginModal) loginModal.style.display = 'none';
  }

  async function _loginFromModal() {
    const usuario = document.getElementById('loginUsuario')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value.trim() || '';
    await login(usuario, password);
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  /**
   * Emite el evento 'auth:mostrarRegistro' para que la Célula C
   * abra su modal de registro.
   */
  function _mostrarRegistro() {
    EventBus.emit('auth:mostrarRegistro');
  }

  // ── GESTIÓN DE CONTRASEÑAS ────────────────────────────
  async function cambiarPassword(nombreUsuario, nuevaPassword) {
    if (!esAdmin() && !esMasterReal()) {
      showToast('error', 'No tienes permiso para cambiar contraseñas');
      return false;
    }
    const idx = _usuarios.findIndex(u => u.nombre === nombreUsuario);
    if (idx === -1) {
      showToast('error', 'Usuario no encontrado');
      return false;
    }
    const nuevoHash = await _sha256(nuevaPassword);
    _usuarios[idx].hash = nuevoHash;
    _guardarUsuarios();
    showToast('success', 'Contraseña actualizada');
    return true;
  }

  // ── REGISTRO DE CLIENTE ──────────────────────────────────
  async function registrarCliente(nombre, password) {
    if (!nombre || !password) {
      Logger.warn('[Auth] Intento de registro sin nombre o password');
      return { exito: false, error: 'Nombre y contraseña requeridos' };
    }
    const existe = _usuarios.find(u => u.nombre === nombre);
    if (existe) {
      Logger.warn('[Auth] Registro fallido: el usuario ya existe:', nombre);
      return { exito: false, error: 'El usuario ya existe' };
    }
    const hash = await _sha256(password);
    const nuevoUsuario = { nombre, hash, rol: 'cliente' };
    _usuarios.push(nuevoUsuario);
    _guardarUsuarios();
    Logger.info('[Auth] Cliente registrado:', nombre);
    EventBus.emit('cliente:cuenta_creada', { nombre, timestamp: Date.now() });
    return { exito: true, nombre };
  }

  // ── PERMISOS ──────────────────────────────────────────
  function getRolEfectivo() {
    if (_usuarioActual?.rol === 'master' && _rolSimulado) return _rolSimulado;
    if (_usuarioActual?.espacioActivoId) {
      const espacio = _usuarioActual.espacios?.find(e => e.id === _usuarioActual.espacioActivoId);
      if (espacio) return espacio.rol;
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

  function getUsuarioActual() {
    if (!_usuarioActual) return null;
    return {
      nombre: _usuarioActual.nombre,
      rol: _usuarioActual.rol,
      rolEfectivo: getRolEfectivo(),
      simulando: _rolSimulado || null,
      espacios: _usuarioActual.espacios || [],
      espacioActivoId: _usuarioActual.espacioActivoId
    };
  }

  function getEspacios() {
    return _usuarioActual?.espacios || [];
  }

  function getEspacioActivo() {
    if (!_usuarioActual?.espacioActivoId) return null;
    return _usuarioActual.espacios?.find(e => e.id === _usuarioActual.espacioActivoId) || null;
  }

  function cambiarEspacio(espacioId) {
    const espacio = _usuarioActual?.espacios?.find(e => e.id === espacioId);
    if (!espacio) return;

    _usuarioActual.espacioActivoId = espacioId;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();

    if (window.App) {
      App.showView(getDefaultView());
    }
    showToast('info', 'Cambiaste a "' + espacio.nombre + '" (' + espacio.rol + ')');
    Logger.info('[Auth] Espacio cambiado a "' + espacio.nombre + '"');
  }

  function actualizarNombre(nuevoNombre) {
    if (!_usuarioActual) return;
    if (!nuevoNombre || typeof nuevoNombre !== 'string') {
      Logger.warn('[Auth] Intento de actualizar nombre con valor inválido:', nuevoNombre);
      return;
    }
    _usuarioActual.nombre = nuevoNombre;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    Logger.info('[Auth] Nombre actualizado a "' + nuevoNombre + '"');
  }

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
  function esArtista() { const r = getRolEfectivo(); return r === 'artista' || r === 'admin' || r === 'master'; }

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
    return ['eventos', 'artista', 'admin', 'master'].includes(rol);
  }
  function puedeAccederPerfil() { return getRolEfectivo() !== null; }

  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    const rolEfectivo = getRolEfectivo();
    if (userEl) {
      let displayText = _usuarioActual ? _usuarioActual.nombre + ' (' + rolEfectivo + ')' : '';
      if (_rolSimulado) displayText += ' ⇒ ' + _rolSimulado;
      userEl.textContent = displayText;
    }

    document.querySelectorAll('[data-rol]').forEach(function(el) {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(rolEfectivo) ||
                     (rolEfectivo === 'admin' && roles.includes('admin')) ||
                     (rolEfectivo === 'master' && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });

    _renderSelectorEspacio();

    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;

    if (esMasterReal()) {
      const rolesDisponibles = (typeof Roles !== 'undefined')
        ? Roles.lista.filter(function(r) { return r !== 'master'; })
        : [];
      const seleccionado = _rolSimulado || '';
      const opciones = rolesDisponibles.map(function(r) {
        return '<option value="' + r + '" ' + (r === seleccionado ? 'selected' : '') + '>' +
               r.charAt(0).toUpperCase() + r.slice(1) + '</option>';
      }).join('');
      mozoContainer.innerHTML =
        '<i class="fas fa-eye"></i>' +
        '<select id="rolSimulado" onchange="Auth._cambiarRolSimulado(this.value)">' +
          '<option value="">— Ver como —</option>' +
          opciones +
        '</select>';
      const selectEl = mozoContainer.querySelector('#rolSimulado');
      if (selectEl) selectEl.value = seleccionado;
    } else {
      mozoContainer.innerHTML = '';
    }
  }

  function _renderSelectorEspacio() {
    const container = document.getElementById('espacioSelectorContainer');
    if (!container || !_usuarioActual) return;

    const espacios = _usuarioActual.espacios || [];
    if (espacios.length <= 1) {
      container.innerHTML = '';
      return;
    }

    const activo = _usuarioActual.espacioActivoId;
    container.innerHTML =
      '<i class="fas fa-home"></i>' +
      '<select id="espacioSelect" onchange="Auth.cambiarEspacio(this.value)">' +
        espacios.map(function(e) {
          return '<option value="' + e.id + '" ' + (e.id === activo ? 'selected' : '') + '>' + e.nombre + ' (' + e.rol + ')</option>';
        }).join('') +
      '</select>';
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

  return {
    init, login, logout,
    getRol, getNombre, getUsuarioActual,
    getEspacios, getEspacioActivo, cambiarEspacio,
    actualizarNombre,
    tienePermiso, puede,
    esMaster, esAdmin, esCocina, esBarra, esCaja, esMesero,
    esDespensa, esReparto, esCliente, esEventos, esArtista,
    puedeEliminarItemEnviado, puedeCerrarMesa,
    puedeAccederCaja, puedeAccederCocina, puedeCambiarEstadoComanda,
    puedeEditarProductos, puedeEditarPrecios,
    getDefaultView, mostrarLogin, cerrarModalLogin, _loginFromModal,
    _cambiarRolSimulado, getRolEfectivo, esMasterReal, aplicarRestriccionesUI,
    puedeAccederRecetas, puedeAccederReparto, puedeAccederMenu,
    puedeAccederEventos, puedeAccederPerfil,
    cambiarPassword, _cargarUsuarios,
    registrarCliente,
    getAppwriteUserId,
    _mostrarRegistro
  };
})();

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', function() {
  Auth._cargarUsuarios().catch(function(e) {
    Logger.error('[Auth] Error al cargar usuarios:', e);
  });
});