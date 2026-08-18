/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/auth.js
   Versión: 2.1.3
   Propósito: Autenticación con Appwrite Account nativo.
              v2.1.3: corregido C2, C3 y permisos de barra.
                      Sin backdoor de master por nombre de usuario.
                      Vista por defecto de barra pasa a cocina.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { mostrarToast } from './utils.js';
import { Roles } from './roles.js';
import { DBAppwrite } from './db-appwrite.js';
import { Deps } from './lib/deps.js';
import { URL_FUNCION_REGISTRAR_USUARIO } from './config-appwrite.js';

export const Auth = (() => {
  let _usuarioActual = null;
  let _rolSimulado = null;
  let _appwriteUserId = null;
  let _listenersAsignados = false;

  function _emailDesdeNombre(nombreUsuario) {
    return `${nombreUsuario.toLowerCase().replace(/\s+/g, '_')}@elisekai.com`;
  }

  function _obtenerDB() {
    try { return Deps.obtener('db'); } catch { return null; }
  }

  async function _cargarPerfilGlobal(usuarioId) {
    if (!DBAppwrite || !DBAppwrite.habilitado) return null;
    try {
      return await DBAppwrite.obtenerPerfilPorUsuarioId(usuarioId);
    } catch (e) {
      Logger.warn('[Auth] No se pudo cargar perfil global:', e.message);
      return null;
    }
  }

  function iniciar() {
    const saved = sessionStorage.getItem('usuarioActual');
    if (saved) { try { _usuarioActual = JSON.parse(saved); } catch { _usuarioActual = null; } }
    if (_usuarioActual) aplicarRestriccionesUI();
  }

  function obtenerVistaPorDefecto() {
    const rol = obtenerRolPrincipal();

    if (rol === 'chef' || rol === 'cocinaAyudante') return 'cocina';
    if (rol === 'barman' || rol === 'barraAyudante') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'gerente' || rol === 'admin' || rol === 'master') return 'mesas';
    if (rol === 'repartidor') return 'reparto';
    if (rol === 'artista') return 'eventos';
    if (rol === 'cliente') return 'bienvenida';
    return 'mesas';
  }

  async function iniciarSesion(nombreUsuario, password) {
    try {
      if (typeof DBAppwrite === 'undefined' || !DBAppwrite.cuenta) {
        mostrarToast('error', 'Servicio de autenticación no disponible');
        return false;
      }

      try { await DBAppwrite.cuenta.deleteSession('current'); } catch(e) {}
      _appwriteUserId = null;

      const email = _emailDesdeNombre(nombreUsuario);
      await DBAppwrite.cuenta.createEmailPasswordSession(email, password);
      Logger.info(`[Auth] Sesión Appwrite creada para: ${email}`);

      const appwriteUserId = await obtenerIdUsuarioAppwrite();
      const espacioId = 'lataberna';

      let roles = ['cliente'];
      let rolPrincipal = 'cliente';

      const db = _obtenerDB();
      if (db && db.obtenerStaffPorUsuario) {
        const staff = await db.obtenerStaffPorUsuario(appwriteUserId, espacioId);
        if (staff) {
          roles = Array.isArray(staff.roles) ? staff.roles : (() => {
            try { return JSON.parse(staff.roles || '[]'); } catch { return []; }
          })();
          rolPrincipal = staff.rolPrincipal || roles[0] || 'cliente';
        }
      }

      const localTaberna = {
        id: espacioId,
        nombre: 'La Taberna',
        tipo: 'bar',
        roles,
        rolPrincipal,
        databaseId: '6a0275cb0022ebf7d30d'
      };
      _usuarioActual = { nombre: nombreUsuario, local: [localTaberna], localActivoId: espacioId, perfil: null };
      _rolSimulado = null;

      const perfil = await _cargarPerfilGlobal(appwriteUserId);
      _usuarioActual.perfil = perfil;

      sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
      aplicarRestriccionesUI();
      cerrarModalLogin();
      mostrarToast('success', 'Bienvenido/a ' + nombreUsuario);
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
      } else {
        Logger.error('[Auth] Error en iniciarSesion:', e);
        mostrarToast('error', 'Error al iniciar sesión');
      }
      return false;
    }
  }

  async function registrarUsuario(nombreUsuario, password) {
    if (!nombreUsuario || !password) {
      return { exito: false, error: 'Usuario y contraseña requeridos' };
    }

    try {
      const response = await fetch(URL_FUNCION_REGISTRAR_USUARIO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreUsuario, password })
      });
      const data = await response.json();
      if (!data.exito) {
        return { exito: false, error: data.error || 'Error al registrar usuario' };
      }

      Logger.info('[Auth] Usuario registrado:', nombreUsuario);
      EventBus.emit('cliente:cuenta_creada', { nombre: nombreUsuario, timestamp: Date.now() });
      return { exito: true, nombre: nombreUsuario, usuarioId: data.usuarioId };
    } catch (e) {
      Logger.error('[Auth] Error al llamar a registrar-usuario:', e);
      return { exito: false, error: 'No se pudo conectar con el servicio de registro' };
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
    } catch (e) {
      Logger.warn('[Auth] No se pudo obtener el ID de Appwrite:', e);
    }
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
            <input type="text" id="loginUsuario" placeholder="Ej: admin, gerente, chef...">
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
            <input type="password" id="regPassword" placeholder="Mínimo 8 caracteres">
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
    } else {
      loginModal.style.display = 'flex';
      _mostrarLoginPanel();
    }

    if (!_listenersAsignados) {
      document.getElementById('btnCerrarModalLogin').addEventListener('click', cerrarModalLogin);
      document.getElementById('btnModalIngresar').addEventListener('click', _iniciarSesionDesdeModal);
      document.getElementById('btnModalRegistrarse').addEventListener('click', _mostrarRegistro);
      document.getElementById('btnVolverLogin').addEventListener('click', _mostrarLoginPanel);
      document.getElementById('btnModalCrearCuenta').addEventListener('click', _registrarDesdeModal);

      loginModal.addEventListener('click', function(e) {
        if (e.target === loginModal) {
          cerrarModalLogin();
        }
      });

      _listenersAsignados = true;
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

  function cerrarModalLogin() {
    if (loginModal) loginModal.style.display = 'none';
  }

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
    const nombreUsuario = document.getElementById('regUsuario')?.value?.trim() || '';
    const password = document.getElementById('regPassword')?.value || '';
    const passwordConfirm = document.getElementById('regPasswordConfirm')?.value || '';

    if (!nombreUsuario || !password) {
      mostrarToast('error', 'Completar todos los campos.');
      return;
    }
    if (password !== passwordConfirm) {
      mostrarToast('error', 'Las contraseñas no coinciden.');
      return;
    }

    const resultado = await registrarUsuario(nombreUsuario, password);
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

  function _obtenerLocalActivo() {
    if (!_usuarioActual || !_usuarioActual.localActivoId) return null;
    return _usuarioActual.local?.find(l => l.id === _usuarioActual.localActivoId) || null;
  }

  function obtenerRolesEfectivos() {
    const local = _obtenerLocalActivo();
    if (local && Array.isArray(local.roles)) return [...local.roles];
    if (local && local.rol) return [local.rol];
    if (_usuarioActual?.rol) return [_usuarioActual.rol];
    return ['cliente'];
  }

  function obtenerRolPrincipal() {
    const local = _obtenerLocalActivo();
    if (local && local.rolPrincipal) return local.rolPrincipal;
    if (local && local.rol) return local.rol;
    if (_usuarioActual?.rol) return _usuarioActual.rol;
    return 'cliente';
  }

  function obtenerRolEfectivo() {
    return obtenerRolPrincipal();
  }

  function tienePermiso(permiso) {
    const roles = obtenerRolesEfectivos();
    if (!roles.length || typeof Roles === 'undefined') return false;
    return roles.some(rol => Roles.getPermisos(rol)[permiso] === true);
  }

  function obtenerNombre() { return _usuarioActual?.nombre || ''; }
  function obtenerRol() { return obtenerRolPrincipal(); }

  function obtenerUsuarioActual() {
    if (!_usuarioActual) return null;
    return {
      nombre: _usuarioActual.nombre,
      rolesEfectivos: obtenerRolesEfectivos(),
      rolPrincipal: obtenerRolPrincipal(),
      simulando: _rolSimulado || null,
      local: _usuarioActual.local || [],
      localActivoId: _usuarioActual.localActivoId,
      perfil: _usuarioActual.perfil || null
    };
  }

  function obtenerLocales() { return _usuarioActual?.local || []; }
  function obtenerLocalActivo() { return _obtenerLocalActivo(); }

  async function vincularCuentaStaff(token) {
    const db = _obtenerDB();
    if (!db || !db.vincularCuentaStaff) return { exito: false, error: 'DB no disponible' };
    const resultado = await db.vincularCuentaStaff(token);
    if (resultado.exito) {
      const appwriteUserId = await obtenerIdUsuarioAppwrite();
      const espacioId = resultado.staff?.espacioId || 'lataberna';
      if (appwriteUserId && db.obtenerStaffPorUsuario) {
        const staff = await db.obtenerStaffPorUsuario(appwriteUserId, espacioId);
        if (staff) {
          const local = _obtenerLocalActivo();
          if (local) {
            local.roles = staff.roles;
            local.rolPrincipal = staff.rolPrincipal;
          }
          sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
          aplicarRestriccionesUI();
          EventBus.emit('auth:staff_vinculado', staff);
        }
      }
    }
    return resultado;
  }

  function cambiarLocal(localId) {
    const local = _usuarioActual?.local?.find(l => l.id === localId);
    if (!local) return;
    _usuarioActual.localActivoId = localId;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    EventBus.emit('app:cambiarVista', obtenerVistaPorDefecto());
    mostrarToast('info', 'Cambiaste a "' + local.nombre + '"');
  }

  function actualizarNombre(nuevoNombre) {
    if (!_usuarioActual) return;
    if (!nuevoNombre || typeof nuevoNombre !== 'string') return;
    _usuarioActual.nombre = nuevoNombre;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
  }

  function esMasterReal() { return obtenerRolesEfectivos().includes('master'); }
  function esMaster() { return esMasterReal() && !_rolSimulado; }
  function esAdmin() { return obtenerRolesEfectivos().some(r => r === 'admin' || r === 'master'); }
  function esGerente() { return obtenerRolesEfectivos().some(r => r === 'gerente' || r === 'admin' || r === 'master'); }
  function esChef() { return obtenerRolesEfectivos().some(r => r === 'chef' || r === 'admin' || r === 'master'); }
  function esCocinaAyudante() { return obtenerRolesEfectivos().some(r => r === 'cocinaAyudante' || r === 'chef' || r === 'admin' || r === 'master'); }
  function esBarman() { return obtenerRolesEfectivos().some(r => r === 'barman' || r === 'admin' || r === 'master'); }
  function esBarraAyudante() { return obtenerRolesEfectivos().some(r => r === 'barraAyudante' || r === 'barman' || r === 'admin' || r === 'master'); }
  function esMesero() { return obtenerRolesEfectivos().some(r => r === 'mesero' || r === 'admin' || r === 'master'); }
  function esCaja() { return obtenerRolesEfectivos().some(r => r === 'caja' || r === 'admin' || r === 'master'); }
  function esRepartidor() { return obtenerRolesEfectivos().some(r => r === 'repartidor' || r === 'admin' || r === 'master'); }
  function esArtista() { return obtenerRolesEfectivos().some(r => r === 'artista' || r === 'admin' || r === 'master'); }
  function esCliente() { return obtenerRolesEfectivos().some(r => r === 'cliente' || r === 'admin' || r === 'master'); }

  function puede(permiso) { return tienePermiso(permiso); }
  function puedeEliminarItemEnviado() { return tienePermiso('gestionarPedido') || tienePermiso('cambiarEstadoComanda'); }
  function puedeCerrarMesa() { return tienePermiso('cerrarMesa'); }
  function puedeAccederCaja() { return tienePermiso('verCaja'); }
  function puedeAccederCocina() { return tienePermiso('verCocina'); }
  function puedeCambiarEstadoComanda() { return tienePermiso('cambiarEstadoComanda'); }
  function puedeEditarProductos() { return tienePermiso('editarProductos'); }
  function puedeEditarPrecios() { return tienePermiso('editarPrecios'); }
  function puedeAccederRecetas() { return tienePermiso('editarRecetas') || tienePermiso('verCostos'); }
  function puedeAccederReparto() { return tienePermiso('gestionarDelivery') || tienePermiso('verDelivery'); }
  function puedeAccederMenu() { return tienePermiso('verMenu') || obtenerRolesEfectivos().length > 0; }
  function puedeAccederEventos() { return tienePermiso('gestionarEventos') || tienePermiso('verEventos'); }
  function puedeAccederPerfil() { return obtenerRolesEfectivos().length > 0; }
  function puedeGestionarPersonal() { return tienePermiso('gestionarPersonal'); }
  function puedeAsignarAdmin() { return tienePermiso('asignarAdmin'); }
  function puedeAsignarGerente() { return tienePermiso('asignarGerente'); }
  function puedeAsignarStaff() { return tienePermiso('asignarStaff'); }

  function aplicarRestriccionesUI() {
    const userEl = document.getElementById('usuarioActualDisplay');
    const roles = obtenerRolesEfectivos();
    if (userEl) {
      let displayText = _usuarioActual ? _usuarioActual.nombre + ' (' + roles.join(', ') + ')' : '';
      if (_rolSimulado) displayText += ' ⇒ ' + _rolSimulado;
      userEl.textContent = displayText;
    }
    document.querySelectorAll('[data-rol]').forEach(el => {
      const rolesElemento = el.dataset.rol.split(',').map(r => r.trim());
      const mostrar = roles.some(r => rolesElemento.includes(r));
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
    container.innerHTML = `<i class="fas fa-home"></i><select id="localSelect">${locales.map(l => `<option value="${l.id}" ${l.id === activo ? 'selected' : ''}>${l.nombre}</option>`).join('')}</select>`;
    const selectEl = container.querySelector('#localSelect');
    if (selectEl) {
      selectEl.addEventListener('change', function() {
        Auth.cambiarLocal(this.value);
      });
    }
  }

  function _cambiarRolSimulado(rol) {
    if (!_usuarioActual || !esMasterReal()) return;
    if (!rol) { _rolSimulado = null; } else { if (typeof Roles !== 'undefined' && !Roles.lista.includes(rol)) return; _rolSimulado = rol; }
    aplicarRestriccionesUI();
    EventBus.emit('app:cambiarVista', obtenerVistaPorDefecto());
  }

  return {
    iniciar, iniciarSesion, cerrarSesion,
    registrarUsuario,
    obtenerRol, obtenerNombre, obtenerUsuarioActual, obtenerLocales, obtenerLocalActivo, cambiarLocal,
    obtenerRolesEfectivos, obtenerRolPrincipal, obtenerRolEfectivo,
    actualizarNombre, tienePermiso, puede, esMaster, esAdmin, esGerente, esChef, esCocinaAyudante, esBarman,
    esBarraAyudante, esMesero, esCaja, esRepartidor, esArtista, esCliente,
    puedeEliminarItemEnviado, puedeCerrarMesa,
    puedeAccederCaja, puedeAccederCocina, puedeCambiarEstadoComanda,
    puedeEditarProductos, puedeEditarPrecios,
    obtenerVistaPorDefecto, mostrarLogin, cerrarModalLogin, _iniciarSesionDesdeModal, _cambiarRolSimulado,
    esMasterReal, aplicarRestriccionesUI, puedeAccederRecetas, puedeAccederReparto, puedeAccederMenu,
    puedeAccederEventos, puedeAccederPerfil, puedeGestionarPersonal, puedeAsignarAdmin,
    puedeAsignarGerente, puedeAsignarStaff, obtenerIdUsuarioAppwrite, _mostrarRegistro, vincularCuentaStaff
  };
})();

export function inicializarAuth() {
  Auth.iniciar();
}