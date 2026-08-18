/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/admin-roles.js
   Versión: 2.0.0
   Propósito: Gestión canónica de personal (Staff) con roles múltiples,
              alta segura, token de vinculación y canje.
              v2.0.0: adaptado a laTaberna_Staff (roles, rolPrincipal,
                      tokenVinculacion) y a Auth.registrarUsuario.
   ================================================================ */

import { Auth } from '../../auth.js';
import { Roles } from '../../roles.js';
import { DB } from '../../db.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { mostrarToast, mostrarEntrada, mostrarConfirmacion } from '../../utils.js';

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

export async function renderTabAdmin(usuarioActual, esMaster, contenedorId = 'tab-admin') {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const espacioId = _obtenerEspacioId();
  let staff = [];
  try {
    staff = await DB.obtenerStaffPorEspacio(espacioId);
  } catch (e) {
    Logger.warn('[admin-roles] No se pudo cargar staff:', e);
    staff = [];
  }

  // Normalizar roles en cada staff
  staff = staff.map(s => ({ ...s, roles: _parsearRoles(s) }));

  const rolesOperativos = Roles.lista.filter(r => r !== 'cliente' && r !== 'artista' && r !== 'master');

  contenedor.innerHTML = `
    <div class="nota-privacidad">
      🔑 Como <strong>${esMaster ? 'master' : 'admin'}</strong>, puedes gestionar al personal del local.
      ${!esMaster ? ' El rol <strong>Admin</strong> solo puede asignarlo un <strong>Master</strong>.' : ''}
    </div>
    <div class="seccion">
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
    <div class="seccion" style="margin-top:16px;">
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
      fila.innerHTML = `
        <div class="usuario-row-top">
          <div class="av">${(s.nombre || '?').charAt(0).toUpperCase()}</div>
          <strong>${s.nombre || 'Sin nombre'}</strong>
          <span class="rol-actual">${s.rolPrincipal || 'sin rol'} · ${s.estado || 'activo'}</span>
        </div>
        <div class="roles-checks">
          ${rolesOperativos.map(rol => {
            const tieneRol = s.roles.includes(rol);
            const restringido = !esMaster && rol === 'admin';
            return `
              <label class="rol-check ${restringido ? 'bloqueado' : ''}">
                <input type="checkbox" ${tieneRol ? 'checked' : ''} ${restringido ? 'disabled' : ''}
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

    // Cambiar roles
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

        // Si se removió el rolPrincipal, asignar el primer rol
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

    // Copiar token
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

  // Búsqueda
  contenedor.querySelector('#buscarPersonalInput')?.addEventListener('input', function () {
    const termino = this.value.toLowerCase();
    contenedor.querySelectorAll('.usuario-row').forEach(fila => {
      const nombre = fila.dataset.nombre || '';
      fila.style.display = nombre.includes(termino) ? '' : 'none';
    });
  });

  // Filtros de estado
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

  // Nuevo personal
  contenedor.querySelector('#btnNuevoStaff')?.addEventListener('click', () => {
    _mostrarModalAlta(usuarioActual, esMaster, contenedorId);
  });

  // Canjear token
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

async function _mostrarModalAlta(usuarioActual, esMaster, contenedorId) {
  const nombreUsuario = await mostrarEntrada('Nuevo personal', 'Nombre de usuario (si ya existe, se vinculará):', { placeholder: 'Ej: pedro.soto' });
  if (!nombreUsuario) return;

  const nombreVisible = await mostrarEntrada('Nuevo personal', 'Nombre visible (opcional, por defecto el usuario):', { placeholder: 'Pedro Soto' });
  if (!nombreVisible) return;

  const rolesDisponibles = Roles.lista.filter(r => r !== 'cliente' && r !== 'master');
  const seleccionados = {};

  // Todo los roles disponibles se muestran como checkboxes en un modal simple
  const rolPrincipal = await mostrarEntrada('Rol principal', 'Ingresa el rol principal (ej: mesero):', { valorPredefinido: 'mesero' });
  if (!rolPrincipal || !rolesDisponibles.includes(rolPrincipal.trim())) {
    mostrarToast('error', 'Rol principal inválido.');
    return;
  }

  // Usar roles múltiples: por ahora rolPrincipal + mesero por defecto
  const roles = [rolPrincipal.trim()];
  if (!roles.includes('mesero')) roles.push('mesero');

  const estado = await mostrarEntrada('Estado', 'Ingresa estado (activo, inactivo, vacaciones):', { valorPredefinido: 'activo' });
  const estadoValido = ['activo', 'inactivo', 'vacaciones'].includes(estado?.trim());
  if (!estadoValido) {
    mostrarToast('error', 'Estado inválido.');
    return;
  }

  // Buscar si la cuenta ya existe en global_perfiles
  const perfilExistente = await DBAppwrite.obtenerPerfilPorNombreUsuario(nombreUsuario.trim());
  let usuarioId = perfilExistente?.usuarioId || null;

  if (!usuarioId) {
    // Crear cuenta nueva
    const passwordTemporal = _generarPasswordTemporal();
    const reg = await Auth.registrarUsuario(nombreUsuario.trim(), passwordTemporal);
    if (!reg.exito) {
      mostrarToast('error', reg.error || 'No se pudo crear la cuenta.');
      return;
    }
    usuarioId = reg.usuarioId;

    // Mostrar contraseña temporal una vez
    try {
      await navigator.clipboard.writeText(passwordTemporal);
    } catch {}

    await mostrarConfirmacion(
      'Contraseña temporal',
      `Contraseña temporal para ${nombreUsuario}: ${passwordTemporal}\n\nSe copió al portapapeles. Guárdala bien.`
    );
  }

  const token = _generarToken();
  const registro = {
    nombre: nombreVisible.trim(),
    usuarioId,
    espacioId: _obtenerEspacioId(),
    roles,
    rolPrincipal: rolPrincipal.trim(),
    estado: estado.trim(),
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
}