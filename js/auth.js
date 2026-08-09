/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/auth.js
   Versión: 1.6.2
   Propósito: Autenticación con Appwrite Account nativo + fallback local.
              API pública completamente en español.
              v1.6.2: USUARIOS_POR_DEFECTO se importa desde config-appwrite.js.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { mostrarToast } from './utils.js';
import { Roles } from './roles.js';
import { DBAppwrite } from './db-appwrite.js';
import { USUARIOS_POR_DEFECTO } from './config-appwrite.js';

const URL_FUNCION_ASIGNAR_ROL = 'https://6a6b3c8a003b634646cc.tor.appwrite.run';

export const Auth = (() => {
  let _usuarios = [];
  let _usuarioActual = null;
  let _rolSimulado = null;
  let _appwriteUserId = null;

  async function _sha256(texto) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function _emailDesdeNombre(nombre) {
    const prefijo = 'lataberna';
    return `${nombre.toLowerCase().replace(/\s+/g, '_')}@${prefijo}.com`;
  }

  async function _crearPerfilGlobal(usuarioId, nombre) {
    if (!DBAppwrite || !DBAppwrite.habilitado) return;
    try {
      await DBAppwrite.crear('global_perfiles', usuarioId, {
        usuarioId,
        nombre,
        avatar: '',
        nivel: 1,
        xp: 0,
        insignias: '[]',
        racha: 0,
        titulos: '[]'
      });
      Logger.info(`[Auth] Perfil global creado para: ${nombre}`);
    } catch (e) {
      if (e.code !== 409) {
        Logger.warn('[Auth] No se pudo crear perfil global:', e.message);
      }
    }
  }

  async function _cargarPerfilGlobal(usuarioId) {
    if (!DBAppwrite || !DBAppwrite.habilitado) return null;
    try {
      const perfiles = await DBAppwrite.listar('global_perfiles');
      const perfil = perfiles.find(p => p.usuarioId === usuarioId);
      return perfil || null;
    } catch (e) {
      Logger.warn('[Auth] No se pudo cargar perfil global:', e.message);
      return null;
    }
  }

  async function _obtenerAppwriteUserIdPorNombre(nombre) {
    const usuario = _usuarios.find(u => u.nombre === nombre);
    if (usuario && usuario._appwriteUserId) return usuario._appwriteUserId;
    try {
      const perfiles = await DBAppwrite.listar('global_perfiles');
      const perfil = perfiles.find(p => p.nombre === nombre);
      return perfil ? perfil.usuarioId : null;
    } catch (e) {
      Logger.warn('[Auth] No se pudo buscar userId en global_perfiles:', e.message);
      return null;
    }
  }

  async function _cargarUsuarios() {
    const guardados = localStorage.getItem('pubpos_usuarios');
    if (guardados) {
      try {
        _usuarios = JSON.parse(guardados);
        if (!Array.isArray(_usuarios) || _usuarios.length === 0) throw new Error('Array vacío');

        for (const defUser of USUARIOS_POR_DEFECTO) {
          const idx = _usuarios.findIndex(u => u.nombre === defUser.nombre);
          if (idx === -1) {
            const hash = await _sha256(defUser.password);
            _usuarios.push({ nombre: defUser.nombre, hash, rol: defUser.rol, _migradoAAuth: false });
          } else if (defUser.nombre === 'master') {
            _usuarios[idx].rol = 'master';
          }
        }
        _guardarUsuarios();
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
      _usuarios.push({ nombre: u.nombre, hash, rol: u.rol, _migradoAAuth: false });
    }
    localStorage.setItem('pubpos_usuarios', JSON.stringify(_usuarios));
  }

  function _guardarUsuarios() { localStorage.setItem('pubpos_usuarios', JSON.stringify(_usuarios)); }

  function iniciar() {
    const saved = sessionStorage.getItem('usuarioActual');
    if (saved) { try { _usuarioActual = JSON.parse(saved); } catch { _usuarioActual = null; } }
    if (_usuarioActual) aplicarRestriccionesUI();
  }

  function obtenerVistaPorDefecto() {
    const rol = obtenerRolEfectivo();
    if (rol === 'cocina' || rol === 'barra') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'despensa') return 'despensa';
    if (rol === 'reparto') return 'reparto';
    if (rol === 'eventos' || rol === 'artista') return 'eventos';
    if (rol === 'cliente' || rol === 'master') return 'bienvenida';
    return 'mesas';
  }

  async function iniciarSesion(nombre, password) {
    try {
      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.cuenta) {
        try {
          try { await DBAppwrite.cuenta.deleteSession('current'); } catch(e) {}
          _appwriteUserId = null;

          const email = _emailDesdeNombre(nombre);
          await DBAppwrite.cuenta.createEmailPasswordSession(email, password);
          Logger.info(`[Auth] Sesión Appwrite creada para: ${email}`);

          let usuario = _usuarios.find(u => u.nombre === nombre);
          const rolDefecto = (nombre === 'master') ? 'master' : (USUARIOS_POR_DEFECTO.find(u => u.nombre === nombre)?.rol || 'cliente');
          const nuevoHash = await _sha256(password);

          if (!usuario) {
            usuario = { nombre, hash: nuevoHash, rol: rolDefecto, _migradoAAuth: true };
            _usuarios.push(usuario);
            _guardarUsuarios();
            Logger.info(`[Auth] Usuario ${nombre} creado localmente desde Appwrite.`);
          } else {
            usuario.hash = nuevoHash;
            if (nombre === 'master') usuario.rol = 'master';
            usuario._migradoAAuth = true;
            _guardarUsuarios();
          }

          const localTaberna = { id: 'lataberna', nombre: 'La Taberna', tipo: 'bar', rol: usuario.rol, databaseId: '6a0275cb0022ebf7d30d' };
          _usuarioActual = { nombre: usuario.nombre, rol: usuario.rol, local: [localTaberna], localActivoId: localTaberna.id, perfil: null };
          _rolSimulado = null;

          const appwriteUserId = await obtenerIdUsuarioAppwrite();
          if (appwriteUserId) {
            let perfil = await _cargarPerfilGlobal(appwriteUserId);
            if (!perfil) {
              await _crearPerfilGlobal(appwriteUserId, nombre);
              perfil = await _cargarPerfilGlobal(appwriteUserId);
            }
            _usuarioActual.perfil = perfil;
          }

          sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
          aplicarRestriccionesUI();
          cerrarModalLogin();
          mostrarToast('success', 'Bienvenido/a ' + usuario.nombre + ' (' + usuario.rol + ')');
          const vistaInicial = obtenerVistaPorDefecto();
          EventBus.emit('app:cambiarVista', vistaInicial);
          return true;
        } catch (e) {
          const esErrorCredenciales = e.code === 401 ||
                                     (e.type && e.type.includes('user_invalid_credentials')) ||
                                     (e.message && e.message.toLowerCase().includes('invalid credentials'));

          if (esErrorCredenciales) {
            Logger.warn('[Auth] Credenciales rechazadas por Appwrite:', e.message);
            mostrarToast('error', 'Usuario o contraseña incorrectos');
            return false;
          }
          Logger.warn('[Auth] No se pudo iniciar sesión con Appwrite, usando fallback local:', e.message);
        }
      }

      // Fallback local
      const hashIngresado = await _sha256(password);
      const usuario = _usuarios.find(u => u.nombre === nombre && u.hash === hashIngresado);
      if (!usuario) { mostrarToast('error', 'Usuario o contraseña incorrectos'); return false; }
      const localTaberna = { id: 'lataberna', nombre: 'La Taberna', tipo: 'bar', rol: usuario.rol, databaseId: '6a0275cb0022ebf7d30d' };
      _usuarioActual = { nombre: usuario.nombre, rol: usuario.rol, local: [localTaberna], localActivoId: localTaberna.id, perfil: null };
      _rolSimulado = null;
      sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
      aplicarRestriccionesUI();
      cerrarModalLogin();
      mostrarToast('success', 'Bienvenido/a ' + usuario.nombre + ' (' + usuario.rol + ')');
      const vistaInicial = obtenerVistaPorDefecto();
      EventBus.emit('app:cambiarVista', vistaInicial);
      return true;
    } catch (e) {
      Logger.error('[Auth] Error en iniciarSesion:', e);
      return false;
    }
  }

  async function cerrarSesion() {
    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.cuenta) {
      try {
        await DBAppwrite.cuenta.deleteSession('current');
        Logger.info('[Auth] Sesión Appwrite eliminada en servidor.');
      } catch (e) {
        Logger.warn('[Auth] No se pudo eliminar la sesión de Appwrite:', e.message);
      }
    }
    _usuarioActual = null;
    _rolSimulado = null;
    _appwriteUserId = null;
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();
  }

  async function obtenerIdUsuarioAppwrite() {
    if (_appwriteUserId) return _appwriteUserId;
    try {
      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.cuenta) {
        const account = await DBAppwrite.cuenta.get();
        _appwriteUserId = account.$id;
        Logger.info('[Auth] ID de Appwrite obtenido:', _appwriteUserId);
        return _appwriteUserId;
      }
    } catch (e) { Logger.warn('[Auth] No se pudo obtener el ID de Appwrite:', e); }
    return null;
  }

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
            <button class="modal-close" id="btnCerrarModalLogin"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body" id="loginPanel">
            <label>Usuario</label>
            <input type="text" id="loginUsuario" placeholder="Ej: admin, mesero, cocina...">
            <label>Contraseña</label>
            <input type="password" id="loginPassword" placeholder="Contraseña">
            <div class="modal-small-footer" style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn-primary" id="btnModalIngresar" style="width:100%;">
                <i class="fas fa-sign-in-alt"></i> Ingresar
              </button>
              <button class="btn-secondary" id="btnModalRegistrarse" style="width:100%;">
                <i class="fas fa-user-plus"></i> ¿Aun sin cuenta? Registrate
              </button>
            </div>
          </div>
          <div class="modal-small-body" id="registroPanel" style="display:none;">
            <label>Usuario</label>
            <input type="text" id="regUsuario" placeholder="Elegir un nombre de usuario">
            <label>Contraseña</label>
            <input type="password" id="regPassword" placeholder="Mínimo 4 caracteres">
            <label>Repetir contraseña</label>
            <input type="password" id="regPasswordConfirm" placeholder="Repetir la contraseña">
            <div class="modal-small-footer" style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn-primary" id="btnModalCrearCuenta" style="width:100%;">
                <i class="fas fa-check"></i> Crear cuenta
              </button>
              <button class="btn-secondary" id="btnVolverLogin" style="width:100%;">
                <i class="fas fa-arrow-left"></i> Volver al inicio de sesión
              </button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(loginModal);

      document.getElementById('btnCerrarModalLogin').addEventListener('click', cerrarModalLogin);
      document.getElementById('btnModalIngresar').addEventListener('click', _iniciarSesionDesdeModal);
      document.getElementById('btnModalRegistrarse').addEventListener('click', _mostrarRegistro);
      document.getElementById('btnVolverLogin').addEventListener('click', _mostrarLoginPanel);
      document.getElementById('btnModalCrearCuenta').addEventListener('click', _registrarDesdeModal);
    } else {
      loginModal.style.display = 'flex';
      _mostrarLoginPanel();
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  }

  function _mostrarLoginPanel() {
    document.getElementById('loginPanel').style.display = '';
    document.getElementById('registroPanel').style.display = 'none';
  }

  function _mostrarRegistro() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('registroPanel').style.display = '';
  }

  function cerrarModalLogin() { if (loginModal) loginModal.style.display = 'none'; }

  async function _iniciarSesionDesdeModal() {
    const usuario = document.getElementById('loginUsuario')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value.trim() || '';
    await iniciarSesion(usuario, password);
    const userInput = document.getElementById('loginUsuario');
    const passInput = document.getElementById('loginPassword');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  }

  async function _registrarDesdeModal() {
    const nombre = document.getElementById('regUsuario')?.value?.trim() || '';
    const password = document.getElementById('regPassword')?.value || '';
    const passwordConfirm = document.getElementById('regPasswordConfirm')?.value || '';

    if (!nombre || !password) {
      mostrarToast('error', 'Completar todos los campos.');
      return;
    }
    if (password !== passwordConfirm) {
      mostrarToast('error', 'Las contraseñas no coinciden.');
      return;
    }

    const resultado = await registrarCliente(nombre, password);
    if (resultado.exito) {
      mostrarToast('success', 'Cuenta creada. Ya puedes iniciar sesión.');
      _mostrarLoginPanel();
      document.getElementById('regUsuario').value = '';
      document.getElementById('regPassword').value = '';
      document.getElementById('regPasswordConfirm').value = '';
    } else {
      mostrarToast('error', resultado.error || 'Error al crear la cuenta.');
    }
  }

  async function cambiarPassword(nombreUsuario, nuevaPassword) {
    if (!esAdmin() && !esMasterReal()) { mostrarToast('error', 'No tienes permiso para cambiar contraseñas'); return false; }
    const idx = _usuarios.findIndex(u => u.nombre === nombreUsuario);
    if (idx === -1) { mostrarToast('error', 'Usuario no encontrado'); return false; }
    const nuevoHash = await _sha256(nuevaPassword);
    _usuarios[idx].hash = nuevoHash;
    _guardarUsuarios();
    mostrarToast('success', 'Contraseña actualizada');
    return true;
  }

  async function cambiarRol(nombreUsuario, nuevoRol) {
    if (!_usuarioActual) {
      return { exito: false, error: 'No hay sesión activa.' };
    }
    if (!esMasterReal() && !esAdmin()) {
      return { exito: false, error: 'No tienes permiso para cambiar roles.' };
    }
    if (typeof Roles === 'undefined' || !Roles.lista.includes(nuevoRol)) {
      return { exito: false, error: `El rol "${nuevoRol}" no es válido.` };
    }
    if (nombreUsuario === _usuarioActual.nombre) {
      return { exito: false, error: 'No puedes cambiar tu propio rol.' };
    }
    const idx = _usuarios.findIndex(u => u.nombre === nombreUsuario);
    if (idx === -1) {
      return { exito: false, error: 'Usuario no encontrado.' };
    }
    const usuarioObjetivo = _usuarios[idx];
    if (usuarioObjetivo.rol === 'master') {
      return { exito: false, error: 'No se puede cambiar el rol de un master.' };
    }
    if (usuarioObjetivo.rol === 'admin' && !esMasterReal()) {
      return { exito: false, error: 'Solo un master puede cambiar el rol de un admin.' };
    }

    const rolAnterior = usuarioObjetivo.rol;
    _usuarios[idx].rol = nuevoRol;
    _guardarUsuarios();
    Logger.info(`[Auth] Rol cambiado: ${nombreUsuario} de "${rolAnterior}" a "${nuevoRol}" por ${_usuarioActual.nombre}.`);

    if (usuarioObjetivo._migradoAAuth) {
      try {
        let appwriteUserId = usuarioObjetivo._appwriteUserId;
        if (!appwriteUserId) {
          appwriteUserId = await _obtenerAppwriteUserIdPorNombre(nombreUsuario);
        }
        if (appwriteUserId) {
          const response = await fetch(URL_FUNCION_ASIGNAR_ROL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: appwriteUserId, rol: nuevoRol })
          });
          const data = await response.json();
          if (!data.success) {
            Logger.warn(`[Auth] No se pudo sincronizar el label en Appwrite: ${data.error}`);
          }
        }
      } catch (e) {
        Logger.warn('[Auth] Error al llamar a asignar-rol:', e.message);
      }
    }

    return { exito: true };
  }

  async function registrarCliente(nombre, password) {
    if (!nombre || !password) { Logger.warn('[Auth] Intento de registro sin nombre o password'); return { exito: false, error: 'Nombre y contraseña requeridos' }; }
    const existe = _usuarios.find(u => u.nombre === nombre);
    if (existe) { Logger.warn('[Auth] Registro fallido: el usuario ya existe:', nombre); return { exito: false, error: 'El usuario ya existe' }; }

    let creadoEnAppwrite = false;
    let appwriteUserId = null;
    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.cuenta) {
      try {
        const email = _emailDesdeNombre(nombre);
        appwriteUserId = Appwrite.ID.unique();
        const respuesta = await DBAppwrite.cuenta.create(appwriteUserId, email, password);
        appwriteUserId = respuesta.$id || appwriteUserId;
        Logger.info(`[Auth] Usuario creado en Appwrite: ${email} (ID: ${appwriteUserId})`);
        creadoEnAppwrite = true;
        await _crearPerfilGlobal(appwriteUserId, nombre);
      } catch (e) {
        Logger.warn('[Auth] No se pudo crear usuario en Appwrite, usando solo local:', e.message);
      }
    }

    const hash = await _sha256(password);
    const nuevoUsuario = { nombre, hash, rol: 'cliente', _migradoAAuth: creadoEnAppwrite, _appwriteUserId: appwriteUserId };
    _usuarios.push(nuevoUsuario);
    _guardarUsuarios();
    Logger.info('[Auth] Cliente registrado:', nombre);
    EventBus.emit('cliente:cuenta_creada', { nombre, timestamp: Date.now() });
    return { exito: true, nombre };
  }

  function obtenerRolEfectivo() {
    if (_usuarioActual?.rol === 'master' && _rolSimulado) return _rolSimulado;
    if (_usuarioActual?.localActivoId) {
      const local = _usuarioActual.local?.find(l => l.id === _usuarioActual.localActivoId);
      if (local) return local.rol;
    }
    return _usuarioActual?.rol || null;
  }

  function tienePermiso(permiso) { const rol = obtenerRolEfectivo(); if (!rol) return false; return (typeof Roles !== 'undefined' && Roles.getPermisos(rol)[permiso] === true); }
  function obtenerRol() { return _usuarioActual?.rol || null; }
  function obtenerNombre() { return _usuarioActual?.nombre || ''; }
  function obtenerUsuarioActual() {
    if (!_usuarioActual) return null;
    return {
      nombre: _usuarioActual.nombre,
      rol: _usuarioActual.rol,
      rolEfectivo: obtenerRolEfectivo(),
      simulando: _rolSimulado || null,
      local: _usuarioActual.local || [],
      localActivoId: _usuarioActual.localActivoId,
      perfil: _usuarioActual.perfil || null
    };
  }
  function obtenerLocales() { return _usuarioActual?.local || []; }
  function obtenerLocalActivo() {
    if (!_usuarioActual || !_usuarioActual.localActivoId) return null;
    return _usuarioActual.local?.find(l => l.id === _usuarioActual.localActivoId) || null;
  }

  function cambiarLocal(localId) {
    const local = _usuarioActual?.local?.find(l => l.id === localId);
    if (!local) return;
    _usuarioActual.localActivoId = localId;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    EventBus.emit('app:cambiarVista', obtenerVistaPorDefecto());
    mostrarToast('info', 'Cambiaste a "' + local.nombre + '" (' + local.rol + ')');
    Logger.info('[Auth] Local cambiado a "' + local.nombre + '"');
  }

  function actualizarNombre(nuevoNombre) {
    if (!_usuarioActual) return;
    if (!nuevoNombre || typeof nuevoNombre !== 'string') { Logger.warn('[Auth] Intento de actualizar nombre con valor inválido:', nuevoNombre); return; }
    _usuarioActual.nombre = nuevoNombre;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    Logger.info('[Auth] Nombre actualizado a "' + nuevoNombre + '"');
  }

  function esMasterReal() { return _usuarioActual?.rol === 'master'; }
  function esMaster() { return _usuarioActual?.rol === 'master' && !_rolSimulado; }
  function esAdmin() { const r = obtenerRolEfectivo(); return r === 'admin' || r === 'master'; }
  function esCocina() { const r = obtenerRolEfectivo(); return r === 'cocina' || r === 'admin' || r === 'master'; }
  function esBarra() { const r = obtenerRolEfectivo(); return r === 'barra' || r === 'admin' || r === 'master'; }
  function esCaja() { const r = obtenerRolEfectivo(); return r === 'caja' || r === 'admin' || r === 'master'; }
  function esMesero() { const r = obtenerRolEfectivo(); return r === 'mesero' || r === 'admin' || r === 'master'; }
  function esDespensa() { const r = obtenerRolEfectivo(); return r === 'despensa' || r === 'admin' || r === 'master'; }
  function esReparto() { const r = obtenerRolEfectivo(); return r === 'reparto' || r === 'admin' || r === 'master'; }
  function esCliente() { const r = obtenerRolEfectivo(); return r === 'cliente' || r === 'admin' || r === 'master'; }
  function esEventos() { const r = obtenerRolEfectivo(); return r === 'eventos' || r === 'admin' || r === 'master'; }
  function esArtista() { const r = obtenerRolEfectivo(); return r === 'artista' || r === 'admin' || r === 'master'; }

  function puede(permiso) { return tienePermiso(permiso); }
  function puedeEliminarItemEnviado() { return tienePermiso('eliminarItemEnviado'); }
  function puedeCerrarMesa() { return tienePermiso('cerrarMesa'); }
  function puedeAccederCaja() { return tienePermiso('accederCaja'); }
  function puedeAccederCocina() { return tienePermiso('accederCocina'); }
  function puedeCambiarEstadoComanda() { return tienePermiso('cambiarEstadoComanda'); }
  function puedeEditarProductos() { return tienePermiso('editarProductos'); }
  function puedeEditarPrecios() { return tienePermiso('editarPrecios'); }
  function puedeAccederRecetas() { const rol = obtenerRolEfectivo(); return ['cocina', 'barra', 'admin', 'master'].includes(rol); }
  function puedeAccederReparto() { const rol = obtenerRolEfectivo(); return ['reparto', 'admin', 'master'].includes(rol); }
  function puedeAccederMenu() { return obtenerRolEfectivo() !== null; }
  function puedeAccederEventos() { const rol = obtenerRolEfectivo(); return ['eventos', 'artista', 'admin', 'master'].includes(rol); }
  function puedeAccederPerfil() { return obtenerRolEfectivo() !== null; }

  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    const rolEfectivo = obtenerRolEfectivo();
    if (userEl) {
      let displayText = _usuarioActual ? _usuarioActual.nombre + ' (' + rolEfectivo + ')' : '';
      if (_rolSimulado) displayText += ' ⇒ ' + _rolSimulado;
      userEl.textContent = displayText;
    }
    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.includes(rolEfectivo) || (rolEfectivo === 'admin' && roles.includes('admin')) || (rolEfectivo === 'master' && roles.includes('master'));
      el.style.display = mostrar ? '' : 'none';
    });
    _renderSelectorLocal();
    const mozoContainer = document.querySelector('.mozo-selector');
    if (!mozoContainer || !_usuarioActual) return;
    if (esMasterReal()) {
      const rolesDisponibles = (typeof Roles !== 'undefined') ? Roles.lista.filter(r => r !== 'master') : [];
      const seleccionado = _rolSimulado || '';
      const opciones = rolesDisponibles.map(r => `<option value="${r}" ${r === seleccionado ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
      mozoContainer.innerHTML = `<i class="fas fa-eye"></i><select id="rolSimulado"><option value="">— Ver como —</option>${opciones}</select>`;
      const selectEl = mozoContainer.querySelector('#rolSimulado');
      if (selectEl) {
        selectEl.addEventListener('change', function() {
          _cambiarRolSimulado(this.value);
        });
      }
    } else { mozoContainer.innerHTML = ''; }
  }

  function _renderSelectorLocal() {
    const container = document.getElementById('espacioSelectorContainer');
    if (!container || !_usuarioActual) return;
    const locales = _usuarioActual.local || [];
    if (locales.length <= 1) { container.innerHTML = ''; return; }
    const activo = _usuarioActual.localActivoId;
    container.innerHTML = `<i class="fas fa-home"></i><select id="localSelect">${locales.map(l => `<option value="${l.id}" ${l.id === activo ? 'selected' : ''}>${l.nombre} (${l.rol})</option>`).join('')}</select>`;
    const selectEl = container.querySelector('#localSelect');
    if (selectEl) {
      selectEl.addEventListener('change', function() {
        Auth.cambiarLocal(this.value);
      });
    }
  }

  function _cambiarRolSimulado(rol) {
    if (!_usuarioActual || _usuarioActual.rol !== 'master') return;
    if (!rol) { _rolSimulado = null; } else { if (typeof Roles !== 'undefined' && !Roles.lista.includes(rol)) return; _rolSimulado = rol; }
    aplicarRestriccionesUI();
    const vistaInicial = obtenerVistaPorDefecto();
    EventBus.emit('app:cambiarVista', vistaInicial);
  }

  return {
    iniciar, iniciarSesion, cerrarSesion,
    obtenerRol, obtenerNombre, obtenerUsuarioActual, obtenerLocales, obtenerLocalActivo, cambiarLocal,
    actualizarNombre, tienePermiso, puede, esMaster, esAdmin, esCocina, esBarra, esCaja, esMesero,
    esDespensa, esReparto, esCliente, esEventos, esArtista, puedeEliminarItemEnviado, puedeCerrarMesa,
    puedeAccederCaja, puedeAccederCocina, puedeCambiarEstadoComanda, puedeEditarProductos, puedeEditarPrecios,
    obtenerVistaPorDefecto, mostrarLogin, cerrarModalLogin, _iniciarSesionDesdeModal, _cambiarRolSimulado, obtenerRolEfectivo,
    esMasterReal, aplicarRestriccionesUI, puedeAccederRecetas, puedeAccederReparto, puedeAccederMenu,
    puedeAccederEventos, puedeAccederPerfil, cambiarPassword, cambiarRol, _cargarUsuarios, registrarCliente,
    obtenerIdUsuarioAppwrite, _mostrarRegistro
  };
})();

export function inicializarAuth() {
  Auth._cargarUsuarios().catch(function(e) {
    Logger.error('[Auth] Error al cargar usuarios:', e);
  });
}