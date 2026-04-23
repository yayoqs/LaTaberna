/* ================================================================
   PubPOS — MÓDULO: auth.js
   Propósito: Gestión de usuarios, roles y permisos.
   Cambios (2026-04-23):
     • Añadida función getDefaultView() para redirigir según rol.
     • Modificado login() para usar vista por defecto en lugar de fijar 'mesas'.
     • Modificado logout() para limpiar elementos UI basados en rol.
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

  /**
   * Determina la vista inicial según el rol del usuario.
   * - Cocina y Barra → ven el monitor KDS.
   * - Caja → ven el módulo de caja.
   * - Resto (master, admin, mesero) → mesas.
   */
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
    // CAMBIO: usar la vista por defecto según rol
    const vistaInicial = getDefaultView();
    if (window.App) App.showView(vistaInicial);
    return true;
  }

  function logout() {
    _usuarioActual = null;
    sessionStorage.removeItem('usuarioActual');
    // Limpiar elementos que dependen de rol para que no queden visibles
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();
  }

  // ... (el resto de funciones de permisos se mantienen igual)
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
    const userEl = $id('usuarioActualDisplay');
    if (userEl) userEl.textContent = _usuarioActual ? `${_usuarioActual.nombre} (${_usuarioActual.rol})` : '';

    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(_usuarioActual?.rol) || (esAdmin() && roles.includes('admin')) || (esMaster() && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });

    // ... (resto del código del mozo selector sin cambios)
    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;
    if (!esMaster()) {
      mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><span style="padding: 6px 0; color: var(--color-text); font-weight: 500;">${_usuarioActual.nombre}</span>`;
    } else {
      let mozosNombres = [];
      if (typeof DB !== 'undefined' && Array.isArray(DB.mozos) && DB.mozos.length) {
        mozosNombres = DB.mozos.filter(m => m.activo !== false).map(m => m.nombre);
      } else {
        mozosNombres = USUARIOS.filter(u => ['mesero', 'admin', 'master'].includes(u.rol)).map(u => u.nombre);
      }
      const options = mozosNombres.map(nombre => `<option value="${nombre}" ${nombre === _usuarioActual.nombre ? 'selected' : ''}>${nombre}</option>`).join('');
      mozoContainer.innerHTML = `<i class="fas fa-user-tie"></i><select id="mozoActivo" onchange="Comanda?.setMozo?.(this.value)">${options}</select>`;
    }
  }

  function mostrarLogin() {
    // ... (sin cambios, igual que antes)
    let modal = $id('modalLogin');
    if (!modal) { /* crear modal */ }
    else { modal.style.display = 'flex'; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  }

  function cerrarModalLogin() { $id('modalLogin').style.display = 'none'; }
  function _loginFromModal() { /* ... */ }

  return {
    init, login, logout, getRol, getNombre, tienePermiso, puede,
    esMaster, esAdmin, esCocina, esBarra, esCaja, esMesero,
    puedeEliminarItemEnviado, puedeCerrarMesa, puedeAccederCaja, puedeAccederCocina,
    puedeCambiarEstadoComanda, puedeEditarProductos, puedeEditarPrecios,
    getDefaultView,   // EXPUESTO para que App lo use
    mostrarLogin, cerrarModalLogin, _loginFromModal
  };
})();

window.Auth = Auth;