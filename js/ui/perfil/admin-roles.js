/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/admin-roles.js
   Versión: 2.1.3
   Propósito: Gestión canónica de personal (Staff) con roles múltiples,
              alta segura, token de vinculación y canje.
              v2.1.3: elimina uso de clase .seccion en HTML generado
                      para evitar que se oculte dentro de #view-config.
   ================================================================ */

import { Auth } from '../../auth.js';
import { Roles } from '../../roles.js';
import { DB } from '../../db.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast, mostrarEntrada } from '../../utils.js';

function _obtenerEspacioId() {
  const local = Auth.obtenerLocalActivo?.();
  return local?.id || 'lataberna';
}

function _generarToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'tk_' + crypto.randomUUID();
  }
  return 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function _generarPasswordTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += letras.charAt(Math.floor(Math.random() * letras.length));
  return pass;
}

function _parsearRoles(staff) {
  if (!staff) return [];
  if (Array.isArray(staff.roles)) return staff.roles;
  try { return JSON.parse(staff.roles || '[]'); } catch { return []; }
}

/**
 * Calcula los roles que el usuario actual PUEDE ASIGNAR según su jerarquía.
 * Temporalmente excluye 'artista' hasta que B4 defina su flujo.
 * @param {string[]} rolesEfectivos
 * @returns {string[]}
 */
function _obtenerRolesAsignables(rolesEfectivos) {
  try {
    const permitidos = [];

    rolesEfectivos.forEach(rol => {
      if (rol === 'master') {
        if (!permitidos.includes('admin')) permitidos.push('admin');
      } else {
        const jerarquiaRol = Roles.jerarquia[rol] || [];
        jerarquiaRol.forEach(r => {
          if (!permitidos.includes(r)) permitidos.push(r);
        });
      }
    });

    return permitidos.filter(r => r !== 'cliente' && r !== 'master' && r !== 'artista');
  } catch (e) {
    Logger.warn('[admin-roles] No se pudieron calcular roles asignables:', e);
    return [];
  }
}

/**
 * Abre un modal para alta de staff.
 * Devuelve una promesa que resuelve con los datos o null si cancela.
 */
function _abrirModalAlta(rolesAsignables) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal-small" style="max-width:480px;">
        <div class="modal-header">
          <h3><i class="fas fa-user-plus"></i> Nuevo personal</h3>
          <button class="modal-close" id="btnCerrarAltaStaff"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body" id="altaStaffBody">
          <label>Nombre de usuario</label>
          <input type="text" id="altaUsuario" placeholder="Ej: pedro.soto">

          <label>Nombre visible</label>
          <input type="text" id="altaNombreVisible" placeholder="Pedro Soto">

          <label>Roles</label>
          <div class="modal-alta-roles" id="altaRolesChecks">
            ${rolesAsignables.length === 0
              ? '<p style="font-size:12px;color:var(--color-text-muted);">No tienes roles para asignar.</p>'
              : rolesAsignables.map(rol => `
                  <label class="modal-alta-rol-check">
                    <input type="checkbox" value="${rol}">
                    ${rol.charAt(0).toUpperCase() + rol.slice(1)}
                  </label>
                `).join('')}
          </div>

          <label>Rol principal</label>
          <select id="altaRolPrincipal" disabled>
            <option value="">— Selecciona roles —</option>
          </select>

          <label>Estado</label>
          <select id="altaEstado">
            <option value="activo" selected>Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="vacaciones">Vacaciones</option>
          </select>
        </div>
        <div class="modal-small-footer">
          <button class="btn-secondary" id="btnCancelarAltaStaff">Cancelar</button>
          <button class="btn-primary" id="btnConfirmarAltaStaff">Crear personal</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cerrar = (valor) => {
      overlay.remove();
      resolve(valor);
    };

    overlay.querySelector('#btnCerrarAltaStaff').addEventListener('click', () => cerrar(null));
    overlay.querySelector('#btnCancelarAltaStaff').addEventListener('click', () => cerrar(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(null);
    });

    const checksContainer = overlay.querySelector('#altaRolesChecks');
    const selectPrincipal = overlay.querySelector('#altaRolPrincipal');

    function actualizarSelectPrincipal() {
      const marcados = [...checksContainer.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
      selectPrincipal.innerHTML = marcados.length === 0
        ? '<option value="">— Selecciona roles —</option>'
        : marcados.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
      selectPrincipal.disabled = marcados.length === 0;
      if (marcados.length > 0) {
        const seleccionAnterior = selectPrincipal.dataset.anterior;
        if (seleccionAnterior && marcados.includes(seleccionAnterior)) {
          selectPrincipal.value = seleccionAnterior;
        } else {
          selectPrincipal.value = marcados[0];
        }
      }
    }

    checksContainer.addEventListener('change', (e) => {
      if (e.target.matches('input[type="checkbox"]')) {
        selectPrincipal.dataset.anterior = selectPrincipal.value || '';
        actualizarSelectPrincipal();
      }
    });

    overlay.querySelector('#btnConfirmarAltaStaff').addEventListener('click', () => {
      const nombreUsuario = overlay.querySelector('#altaUsuario').value.trim();
      const nombreVisible = overlay.querySelector('#altaNombreVisible').value.trim() || nombreUsuario;
      const rolesSeleccionados = [...overlay.querySelectorAll('#altaRolesChecks input:checked')].map(c => c.value);
      const rolPrincipal = overlay.querySelector('#altaRolPrincipal').value;
      const estado = overlay.querySelector('#altaEstado').value;

      if (!nombreUsuario) {
        mostrarToast('error', 'Debes ingresar un nombre de usuario.');
        return;
      }
      if (rolesSeleccionados.length === 0) {
        mostrarToast('error', 'Selecciona al menos un rol.');
        return;
      }
      if (!rolPrincipal || !rolesSeleccionados.includes(rolPrincipal)) {
        mostrarToast('error', 'El rol principal debe estar entre los roles seleccionados.');
        return;
      }

      cerrar({ nombreUsuario, nombreVisible, roles: rolesSeleccionados, rolPrincipal, estado });
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrar(null);
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

/**
 * Muestra la contraseña temporal en un modal visible después de crear cuenta.
 */
async function _mostrarModalPasswordTemporal(usuario, password) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal-small" style="max-width:400px;">
        <div class="modal-header">
          <h3><i class="fas fa-key"></i> Contraseña temporal</h3>
          <button class="modal-close" id="btnCerrarPasswordTemporal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body">
          <p style="font-size:13px;color:var(--color-text-sec);">
            La cuenta <strong>${usuario}</strong> fue creada correctamente.<br>
            Esta contraseña <strong>no se volverá a mostrar</strong>.
          </p>
          <div class="modal-password-box">
            <input type="text" id="inputPasswordTemporal" value="${password}" readonly>
            <button class="btn-secondary" id="btnCopiarPasswordTemporal"><i class="fas fa-copy"></i> Copiar</button>
          </div>
        </div>
        <div class="modal-small-footer">
          <button class="btn-primary" id="btnContinuarPasswordTemporal">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cerrar = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector('#btnCerrarPasswordTemporal').addEventListener('click', cerrar);
    overlay.querySelector('#btnContinuarPasswordTemporal').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar();
    });

    overlay.querySelector('#btnCopiarPasswordTemporal').addEventListener('click', async () => {
      const input = overlay.querySelector('#inputPasswordTemporal');
      try {
        await navigator.clipboard.writeText(input.value);
        mostrarToast('success', 'Contraseña copiada');
      } catch {
        input.select();
        document.execCommand('copy');
        mostrarToast('success', 'Contraseña copiada');
      }
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrar();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

export async function renderTabAdmin(usuarioActual, esMaster, contenedorId = 'tab-admin') {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  // Obtener roles reales desde el usuarioActual o desde Auth
  const rolesEfectivos = usuarioActual?.rolesEfectivos || Auth.obtenerRolesEfectivos();
  const espacioId = _obtenerEspacioId();
  let staff = [];

  try {
    staff = await DB.obtenerStaffPorEspacio(espacioId);
  } catch (e) {
    Logger.warn('[admin-roles] No se pudo cargar staff:', e);
    staff = [];
  }

  staff = staff.map(s => ({ ...s, roles: _parsearRoles(s) }));

  const rolesAsignables = _obtenerRolesAsignables(rolesEfectivos);

  // Mostrar el rol real del usuario en la nota de jerarquía
  const rolPrincipalReal = usuarioActual?.rolPrincipal || rolesEfectivos[0] || 'staff';

  contenedor.innerHTML = `
    <div class="nota-privacidad">
      🔑 Como <strong>${rolPrincipalReal}</strong>, puedes gestionar al personal del local.
      ${rolPrincipalReal !== 'master' ? ' El rol <strong>Admin</strong> solo puede asignarlo un <strong>Master</strong>.' : ''}
    </div>
    <div class="panel-admin">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0;"><i class="fas fa-users"></i> Personal</h3>
        <button class="btn-primary" id="btnNuevoStaff"><i class="fas fa-user-plus"></i> Nuevo personal</button>
      </div>
      <div class="search-box" style="margin-bottom:12px;">
        <span>🔍</span>
        <input type="text" id="buscarPersonalInput" placeholder="Buscar por nombre o usuario...">
      </div>
      <div class="filtros-roles">
        <button class="filtro-rol activo" data-filtro="todos">Todos</button>
        <button class="filtro-rol" data-filtro="activo">Activos</button>
        <button class="filtro-rol" data-filtro="inactivo">Inactivos</button>
        <button class="filtro-rol" data-filtro="vacaciones">Vacaciones</button>
      </div>
      <div id="listaPersonalContainer">
        ${staff.length === 0 ? '<p style="color:var(--color-text-muted); font-size:12px;">No hay personal registrado.</p>' : ''}
      </div>
    </div>
    <div class="panel-admin" style="margin-top:16px;">
      <h3><i class="fas fa-link"></i> Vincular cuenta con token</h3>
      <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">
        Si ya creaste una ficha de personal y la persona tiene cuenta, entrégale el token para que se vincule desde su perfil.
      </p>
      <button class="btn-secondary" id="btnCanjearTokenStaff"><i class="fas fa-ticket-alt"></i> Canjear token de staff</button>
    </div>
  `;

  const listaContainer = contenedor.querySelector('#listaPersonalContainer');
  if (staff.length > 0) {
    staff.forEach(s => {
      const fila = document.createElement('div');
      fila.className = 'usuario-row';
      fila.dataset.estado = s.estado || 'activo';
      fila.dataset.nombre = (s.nombre || '').toLowerCase();

      // Solo mostramos roles asignables por el usuario actual
      const rolesMostrados = rolesAsignables;

      fila.innerHTML = `
        <div class="usuario-row-top">
          <div class="av">${(s.nombre || '?').charAt(0).toUpperCase()}</div>
          <strong>${s.nombre || 'Sin nombre'}</strong>
          <span class="rol-actual">${s.rolPrincipal || 'sin rol'} · ${s.estado || 'activo'}</span>
        </div>
        <div class="roles-checks">
          ${rolesMostrados.map(rol => {
            const tieneRol = s.roles.includes(rol);
            return `
              <label class="rol-check">
                <input type="checkbox" ${tieneRol ? 'checked' : ''}
                  data-staff-id="${s.id}" data-rol="${rol}">
                ${rol.charAt(0).toUpperCase() + rol.slice(1)}
              </label>
            `;
          }).join('')}
        </div>
        <div style="display:flex; gap:8px; margin-top:8px; font-size:11px; color:var(--color-text-muted);">
          <span>🧷 ${s.tokenVinculacion || 'Sin token'}</span>
          <button class="btn-copiar-token" data-token="${s.tokenVinculacion || ''}" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-sec);border-radius:4px;padding:2px 8px;cursor:pointer;">Copiar token</button>
        </div>
      `;
      listaContainer.appendChild(fila);
    });

    listaContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', async function () {
        const staffId = this.dataset.staffId;
        const rol = this.dataset.rol;
        const staffActual = staff.find(s => s.id === staffId);
        if (!staffActual) return;

        const nuevosRoles = [...staffActual.roles];
        if (this.checked) {
          if (!nuevosRoles.includes(rol)) nuevosRoles.push(rol);
        } else {
          const idx = nuevosRoles.indexOf(rol);
          if (idx >= 0) nuevosRoles.splice(idx, 1);
        }

        if (nuevosRoles.length === 0) {
          this.checked = true;
          mostrarToast('error', 'El personal debe tener al menos un rol.');
          return;
        }

        if (!nuevosRoles.includes(staffActual.rolPrincipal)) {
          staffActual.rolPrincipal = nuevosRoles[0];
        }

        try {
          await DB.crearOActualizarStaff({
            ...staffActual,
            roles: nuevosRoles,
            rolPrincipal: staffActual.rolPrincipal
          });
          mostrarToast('success', `Roles de ${staffActual.nombre} actualizados`);
          await renderTabAdmin(usuarioActual, esMaster, contenedorId);
        } catch (e) {
          mostrarToast('error', 'Error al actualizar roles');
        }
      });
    });

    listaContainer.querySelectorAll('.btn-copiar-token').forEach(btn => {
      btn.addEventListener('click', async () => {
        const token = btn.dataset.token;
        if (!token) return;
        try {
          await navigator.clipboard.writeText(token);
          mostrarToast('success', 'Token copiado');
        } catch {
          mostrarToast('error', 'No se pudo copiar');
        }
      });
    });
  }

  contenedor.querySelector('#buscarPersonalInput')?.addEventListener('input', function () {
    const termino = this.value.toLowerCase();
    contenedor.querySelectorAll('.usuario-row').forEach(fila => {
      const nombre = fila.dataset.nombre || '';
      fila.style.display = nombre.includes(termino) ? '' : 'none';
    });
  });

  contenedor.querySelectorAll('.filtro-rol').forEach(btn => {
    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.filtro-rol').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      const filtro = btn.dataset.filtro;
      contenedor.querySelectorAll('.usuario-row').forEach(fila => {
        const estado = fila.dataset.estado || 'activo';
        fila.style.display = (filtro === 'todos' || filtro === estado) ? '' : 'none';
      });
    });
  });

  contenedor.querySelector('#btnNuevoStaff')?.addEventListener('click', async () => {
    const datos = await _abrirModalAlta(rolesAsignables);
    if (!datos) return;

    let usuarioId = null;
    try {
      const perfilExistente = await DBAppwrite.obtenerPerfilPorNombreUsuario(datos.nombreUsuario);
      usuarioId = perfilExistente?.usuarioId || null;
    } catch (e) {
      Logger.warn('[admin-roles] Error al buscar perfil existente:', e);
    }

    if (!usuarioId) {
      const passwordTemporal = _generarPasswordTemporal();
      const reg = await Auth.registrarUsuario(datos.nombreUsuario, passwordTemporal);
      if (!reg.exito) {
        mostrarToast('error', reg.error || 'No se pudo crear la cuenta.');
        return;
      }
      usuarioId = reg.usuarioId;

      await _mostrarModalPasswordTemporal(datos.nombreUsuario, passwordTemporal);
    }

    const token = _generarToken();
    const registro = {
      nombre: datos.nombreVisible,
      usuarioId,
      espacioId: _obtenerEspacioId(),
      roles: datos.roles,
      rolPrincipal: datos.rolPrincipal,
      estado: datos.estado,
      telefono: '',
      email: '',
      notas: '',
      tokenVinculacion: token
    };

    try {
      await DB.crearOActualizarStaff(registro);
      mostrarToast('success', 'Personal agregado correctamente');
      await renderTabAdmin(usuarioActual, esMaster, contenedorId);
    } catch (e) {
      mostrarToast('error', 'Error al crear staff: ' + e.message);
    }
  });

  contenedor.querySelector('#btnCanjearTokenStaff')?.addEventListener('click', async () => {
    const token = await mostrarEntrada('Vincular staff', 'Ingresa el token de vinculación entregado por tu administrador:');
    if (!token) return;
    const resultado = await Auth.vincularCuentaStaff(token.trim());
    if (resultado.exito) {
      mostrarToast('success', 'Cuenta vinculada correctamente');
    } else {
      mostrarToast('error', resultado.error || 'No se pudo vincular');
    }
  });
}