/* ================================================================
   LaTaberna - Ecosistema Elisekai — MÓDULO JS (ES6)
   Archivo: js/auth.js
   Versión: 2.6.1
   Propósito: Autenticación con Appwrite Account nativo.
              v2.6.1: A.74: cambiarLocal despacha MOVIMIENTOS_LIMPIAR
                      al Store antes de la recarga. Tras el cambio,
                      dispara DB.recargarMovimientos() para repoblar
                      el slice con los movimientos del nuevo espacio.
              v2.6.0: Se agrega obtenerJWT() con cache a 80% del TTL.
                      Se limpia el cache al cerrar sesión.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Store } from './lib/store.js';
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

  // Cache de JWT
  let _jwtCache = null;
  let _jwtExpira = 0;

  const PRIORIDAD_ROLES = [
    'master',
    'owner',
    'admin',
    'mesero',
    'caja',
    'chef',
    'barman',
    'repartidor',
    'artista',
    'cocinaAyudante',
    'barraAyudante',
    'jugador'
  ];

  function _emailDesdeNombre(nombreUsuario) {
    return `${nombreUsuario.toLowerCase().replace(/\s+/g, '_')}@elisekai.com`;
  }

  function _obtenerDB() {
    try { return Deps.obtener('db'); } catch { return null; }
  }

  function _obtenerAppActual() {
    if (_usuarioActual?.espacioActivoId) {
      const espacio = (_usuarioActual.espacios || []).find(e => e.id === _usuarioActual.espacioActivoId);
      if (espacio?.app) return espacio.app;
    }
    const host = window.location.hostname || '';
    const partes = host.split('.');
    if (partes.length >= 3) return partes[0];
    return 'lataberna';
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

    if (rol === 'master') return 'mesas';
    if (rol === 'owner' || rol === 'admin') return 'mesas';
    if (rol === 'chef' || rol === 'cocinaAyudante') return 'cocina';
    if (rol === 'barman' || rol === 'barraAyudante') return 'cocina';
    if (rol === 'caja') return 'caja';
    if (rol === 'repartidor') return 'reparto';
    if (rol === 'artista') return 'eventos';
    if (rol === 'jugador') return 'bienvenida';
    return 'mesas';
  }

  /**
   * Obtiene un JWT del usuario actual, cacheado al 80% del TTL.
   * Appwrite emite JWT con 15 minutos por defecto. Cacheamos 12 min.
   * @returns {Promise<string|null>}
   */
  async function obtenerJWT() {
    if (_jwtCache && Date.now() < _jwtExpira) {
      return _jwtCache;
    }
    try {
      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.cuenta) {
        const respuesta = await DBAppwrite.cuenta.createJWT();
        _jwtCache = respuesta.jwt;
        _jwtExpira = Date.now() + (12 * 60 * 1000);
        Logger.debug('[Auth] JWT generado y cacheado.');
        return _jwtCache;
      }
    } catch (e) {
      Logger.warn('[Auth] No se pudo obtener JWT:', e.message);
    }
    return null;
  }

  function limpiarJWTCache() {
    _jwtCache = null;
    _jwtExpira = 0;
  }

  async function iniciarSesion(nombreUsuario, password) {
    try {
      if (typeof DBAppwrite === 'undefined' || !DBAppwrite.cuenta) {
        mostrarToast('error', 'Servicio de autenticación no disponible');
        return false;
      }

      try { await DBAppwrite.cuenta.deleteSession('current'); } catch(e) {}
      _appwriteUserId = null;
      limpiarJWTCache();

      const email = _emailDesdeNombre(nombreUsuario);
      await DBAppwrite.cuenta.createEmailPasswordSession(email, password);
      Logger.info(`[Auth] Sesión Appwrite creada para: ${email}`);

      const appwriteUserId = await obtenerIdUsuarioAppwrite();
      let espaciosUsuario = [];
      let roles = ['jugador'];
      let rolPrincipal = 'jugador';
      let espacioActivoId = null;

      if (appwriteUserId) {
        const esMaster = await _esMasterPorLabel(appwriteUserId);

        if (esMaster) {
          const todos = await DBAppwrite.listarTodosLosEspacios();
          espaciosUsuario = todos.map(espacio => ({
            id: espacio.id,
            nombre: espacio.nombre || espacio.id,
            app: espacio.app || 'lataberna',
            tipo: espacio.tipo || 'espacio',
            roles: ['master'],
            rolPrincipal: 'master'
          }));
        } else {
          const equipos = await DBAppwrite.obtenerEquiposDelUsuario();

          for (const equipo of equipos) {
            const teamId = equipo.$id;
            const membresia = await DBAppwrite.obtenerMembresiaDeEquipo(teamId, appwriteUserId);
            const rolesEquipo = membresia && Array.isArray(membresia.roles) ? membresia.roles : [];
            const espacio = await DBAppwrite.obtenerEspacioPorId(teamId);

            if (espacio) {
              espaciosUsuario.push({
                id: teamId,
                nombre: espacio.nombre || teamId,
                app: espacio.app || 'lataberna',
                tipo: espacio.tipo || 'espacio',
                roles: rolesEquipo,
                rolPrincipal: PRIORIDAD_ROLES.find(rol => rolesEquipo.includes(rol)) || rolesEquipo[0] || 'jugador'
              });
            }
          }

          const espaciosPersonales = await DBAppwrite.listarEspaciosPorAdmin(appwriteUserId);
          for (const espacio of espaciosPersonales) {
            const yaExiste = espaciosUsuario.some(e => e.id === espacio.id);
            if (!yaExiste) {
              espaciosUsuario.push({
                id: espacio.id,
                nombre: espacio.nombre || espacio.id,
                app: espacio.app || 'mirefugio',
                tipo: espacio.tipo || 'hogar',
                roles: ['jugador'],
                rolPrincipal: 'jugador'
              });
            }
          }
        }
      }

      if (espaciosUsuario.length === 0) {
        roles = ['jugador'];
        rolPrincipal = 'jugador';
      } else {
        const appActual = _obtenerAppActual();
        const espaciosDeApp = espaciosUsuario.filter(e => e.app === appActual);
        const espacioElegido = espaciosDeApp.length > 0
          ? espaciosDeApp[0]
          : espaciosUsuario[0];

        espacioActivoId = espacioElegido.id;
        roles = espacioElegido.roles || ['jugador'];
        rolPrincipal = espacioElegido.rolPrincipal || 'jugador';
      }

      _usuarioActual = {
        nombre: nombreUsuario,
        espacios: espaciosUsuario,
        espacioActivoId,
        perfil: null
      };
      _rolSimulado = null;

      const perfil = await _cargarPerfilGlobal(appwriteUserId);
      _usuarioActual.perfil = perfil;

      sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
      aplicarRestriccionesUI();
      cerrarModalLogin();
      mostrarToast('success', 'Bienvenido/a ' + nombreUsuario);
      const vistaInicial = obtenerVistaPorDefecto();
      EventBus.emit('app:cambiarVista', vistaInicial);

      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.reconfigurarRealtime) {
        await DBAppwrite.reconfigurarRealtime();
      }

      return true;
    } catch (e) {
      const tipo = e.type || '';
      if (tipo === 'user_invalid_credentials' || e.code === 401) {
        Logger.warn('[Auth] Credenciales rechazadas por Appwrite:', e.message);
        mostrarToast('error', 'Usuario o contraseña incorrectos');
      } else if (tipo === 'user_blocked') {
        Logger.warn('[Auth] Usuario bloqueado:', e.message);
        mostrarToast('error', 'Tu cuenta ha sido suspendida temporalmente. Contacta a soporte.');
      } else if (tipo === 'general_rate_limit_exceeded' || e.code === 429) {
        Logger.warn('[Auth] Rate limit alcanzado:', e.message);
        mostrarToast('error', 'Demasiados intentos. Espera un momento y vuelve a intentarlo.');
      } else {
        Logger.error('[Auth] Error en iniciarSesion:', e);
        mostrarToast('error', 'Error al iniciar sesión');
      }
      return false;
    }
  }

  async function _esMasterPorLabel(usuarioId) {
    try {
      const account = await DBAppwrite.cuenta.get();
      const labels = account.labels || [];
      return labels.includes('master');
    } catch (e) {
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
      EventBus.emit('jugador:cuenta_creada', { nombre: nombreUsuario, timestamp: Date.now() });
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
    limpiarJWTCache();
    sessionStorage.removeItem('usuarioActual');
    document.querySelectorAll('[data-rol]').forEach(el => el.style.display = 'none');
    mostrarLogin();

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.desconectarRealtime) {
      await DBAppwrite.desconectarRealtime();
    }
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
            <h3><i class="fas fa-beer"></i> Elisekai</h3>
            <button class="modal-close" id="btnCerrarModalLogin"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body" id="loginPanel">
            <label>Usuario</label>
            <input type="text" id="loginUsuario" placeholder="Nombre de usuario">
            <label>Contraseña</label>
            <input type="password" id="loginPassword" placeholder="Contraseña">
            <div class="modal-small-footer" style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn-primary" id="btnModalIngresar" style="width:100%;">
                <i class="fas fa-sign-in-alt"></i> Ingresar
              </button>
              <button class="btn-secondary" id="btnModalRegistrarse" style="width:100%;">
                <i class="fas fa-user-plus"></i> ¿Sin cuenta? Regístrate
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
        if (e.target === loginModal) cerrarModalLogin();
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
    if (!_usuarioActual || !_usuarioActual.espacioActivoId) return null;
    return _usuarioActual.espacios?.find(e => e.id === _usuarioActual.espacioActivoId) || null;
  }

  function obtenerRolesEfectivos() {
    const local = _obtenerLocalActivo();
    if (local && Array.isArray(local.roles)) return [...local.roles];
    if (local && local.rol) return [local.rol];
    if (_usuarioActual?.rol) return [_usuarioActual.rol];
    return ['jugador'];
  }

  function obtenerRolPrincipal() {
    const local = _obtenerLocalActivo();
    if (local && local.rolPrincipal) return local.rolPrincipal;
    if (local && local.rol) return local.rol;
    if (_usuarioActual?.rol) return _usuarioActual.rol;
    return 'jugador';
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
      espacios: _usuarioActual.espacios || [],
      espacioActivoId: _usuarioActual.espacioActivoId,
      appActual: _obtenerAppActual(),
      perfil: _usuarioActual.perfil || null
    };
  }

  function obtenerLocales() { return _usuarioActual?.espacios || []; }
  function obtenerLocalActivo() { return _obtenerLocalActivo(); }

  async function vincularCuentaStaff(token) {
    const db = _obtenerDB();
    if (!db || !db.vincularCuentaStaff) return { exito: false, error: 'DB no disponible' };
    const resultado = await db.vincularCuentaStaff(token);
    if (resultado.exito) {
      const appwriteUserId = await obtenerIdUsuarioAppwrite();
      if (appwriteUserId) {
        const equipos = await DBAppwrite.obtenerEquiposDelUsuario();
        if (equipos.length > 0) {
          const teamId = equipos[0].$id;
          const membresia = await DBAppwrite.obtenerMembresiaDeEquipo(teamId, appwriteUserId);
          if (membresia && Array.isArray(membresia.roles)) {
            const local = _obtenerLocalActivo();
            if (local) {
              local.roles = membresia.roles;
              local.rolPrincipal = PRIORIDAD_ROLES.find(rol => membresia.roles.includes(rol)) || membresia.roles[0] || 'jugador';
            }
            sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
            aplicarRestriccionesUI();
            EventBus.emit('auth:staff_vinculado', membresia);
          }
        }
      }
    }
    return resultado;
  }

  function cambiarLocal(localId) {
    const local = _usuarioActual?.espacios?.find(e => e.id === localId);
    if (!local) return;
    _usuarioActual.espacioActivoId = localId;
    sessionStorage.setItem('usuarioActual', JSON.stringify(_usuarioActual));
    aplicarRestriccionesUI();
    EventBus.emit('app:cambiarVista', obtenerVistaPorDefecto());
    mostrarToast('info', 'Cambiaste a "' + local.nombre + '"');

    // A.74: limpiar el slice de movimientos y recargarlos del nuevo
    // espacio. Los movimientos del espacio anterior no deben quedar
    // visibles tras el cambio.
    try {
      Store.despachar({ type: 'MOVIMIENTOS_LIMPIAR' });
    } catch (e) {
      Logger.warn('[Auth] No se pudo limpiar movimientos al cambiar de espacio:', e);
    }

    try {
      const db = _obtenerDB();
      if (db && typeof db.recargarMovimientos === 'function') {
        db.recargarMovimientos();
      }
    } catch (e) {
      Logger.warn('[Auth] No se pudo recargar movimientos:', e);
    }

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.reconfigurarRealtime) {
      DBAppwrite.reconfigurarRealtime();
    }
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
  function esOwner() { return obtenerRolesEfectivos().some(r => r === 'owner' || r === 'master'); }
  function esAdmin() { return obtenerRolesEfectivos().some(r => r === 'admin' || r === 'owner' || r === 'master'); }
  function esJugador() { return obtenerRolesEfectivos().some(r => r === 'jugador' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esChef() { return obtenerRolesEfectivos().some(r => r === 'chef' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esCocinaAyudante() { return obtenerRolesEfectivos().some(r => r === 'cocinaAyudante' || r === 'chef' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esBarman() { return obtenerRolesEfectivos().some(r => r === 'barman' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esBarraAyudante() { return obtenerRolesEfectivos().some(r => r === 'barraAyudante' || r === 'barman' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esMesero() { return obtenerRolesEfectivos().some(r => r === 'mesero' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esCaja() { return obtenerRolesEfectivos().some(r => r === 'caja' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esRepartidor() { return obtenerRolesEfectivos().some(r => r === 'repartidor' || r === 'admin' || r === 'owner' || r === 'master'); }
  function esArtista() { return obtenerRolesEfectivos().some(r => r === 'artista' || r === 'admin' || r === 'owner' || r === 'master'); }

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
  }

  function _renderSelectorLocal() {
    const container = document.getElementById('espacioSelectorContainer');
    if (!container || !_usuarioActual) return;
    const espacios = _usuarioActual.espacios || [];
    if (espacios.length === 0) {
      container.innerHTML = '';
      return;
    }

    if (espacios.length === 1) {
      const espacioActivo = _obtenerLocalActivo();
      if (espacioActivo) {
        container.innerHTML = `<i class="fas fa-home"></i> ${espacioActivo.nombre}`;
      }
      return;
    }

    const activo = _usuarioActual.espacioActivoId;
    container.innerHTML = `<i class="fas fa-home"></i><select id="localSelect">${espacios.map(e => `<option value="${e.id}" ${e.id === activo ? 'selected' : ''}>${e.nombre}</option>`).join('')}</select>`;
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
    actualizarNombre, tienePermiso, puede, esMaster, esOwner, esAdmin, esJugador, esChef, esCocinaAyudante, esBarman,
    esBarraAyudante, esMesero, esCaja, esRepartidor, esArtista,
    puedeEliminarItemEnviado, puedeCerrarMesa,
    puedeAccederCaja, puedeAccederCocina, puedeCambiarEstadoComanda,
    puedeEditarProductos, puedeEditarPrecios,
    obtenerVistaPorDefecto, mostrarLogin, cerrarModalLogin, _iniciarSesionDesdeModal, _cambiarRolSimulado,
    esMasterReal, aplicarRestriccionesUI, puedeAccederRecetas, puedeAccederReparto, puedeAccederMenu,
    puedeAccederEventos, puedeAccederPerfil, puedeGestionarPersonal, puedeAsignarAdmin,
    puedeAsignarGerente, puedeAsignarStaff, obtenerIdUsuarioAppwrite, _mostrarRegistro, vincularCuentaStaff,
    obtenerJWT, limpiarJWTCache
  };
})();

export function inicializarAuth() {
  Auth.iniciar();
}