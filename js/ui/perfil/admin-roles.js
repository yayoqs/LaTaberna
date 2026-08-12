/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/admin-roles.js
   Versión: 1.2.0
   Propósito: Pestaña de administración de roles (solo admin y master).
              v1.2.0: acepta contenedorId para reutilizar en Configuración.
   ================================================================ */

import { Auth } from '../../auth.js';
import { Roles } from '../../roles.js';
import { mostrarToast, mostrarEntrada } from '../../utils.js';

export function renderTabAdmin(usuarioActual, esMaster, contenedorId = 'tab-admin') {
  const tabAdmin = document.getElementById(contenedorId);
  if (!tabAdmin) return;

  let todosUsuarios = [];
  try {
    const raw = localStorage.getItem('pubpos_usuarios');
    if (raw) todosUsuarios = JSON.parse(raw);
  } catch (e) { todosUsuarios = []; }

  const rolesOperativos = Roles.lista.filter(r => r !== 'cliente' && r !== 'artista');
  const usuariosFiltrados = todosUsuarios.filter(u => {
    if (u.nombre === usuarioActual?.nombre) return false;
    if (u.rol === 'master') return false;
    if (!esMaster && u.rol === 'admin') return false;
    return rolesOperativos.includes(u.rol) || (esMaster && u.rol === 'cliente');
  });

  const rolesAsignables = Roles.lista.filter(r => r !== 'master');
  const rolesRestringidos = !esMaster ? ['admin'] : [];

  tabAdmin.innerHTML = `
    <div class="nota-privacidad">
      🔑 Como <strong>${esMaster ? 'master' : 'admin'}</strong>, puedes asignar roles operativos.
      ${!esMaster ? ' El rol <strong>Admin</strong> solo puede asignarlo un <strong>Master</strong>.' : ''}
    </div>
    <div class="seccion">
      <h3><i class="fas fa-users"></i> Asignar roles al personal</h3>
      <div class="search-box" style="margin-bottom:12px;">
        <span>🔍</span>
        <input type="text" id="buscarPersonalInput" placeholder="Buscar por nombre...">
      </div>
      <div class="filtros-roles">
        <button class="filtro-rol activo" data-filtro="todos">Todos</button>
        ${rolesOperativos.map(r => `<button class="filtro-rol" data-filtro="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</button>`).join('')}
      </div>
      <div id="listaPersonalContainer">
        ${usuariosFiltrados.length === 0 ? '<p style="color:var(--color-text-muted); font-size:12px;">No hay personal para administrar.</p>' : ''}
      </div>
      <button class="btn-primary" id="btnInvitarPersonal" style="margin-top:12px;"><i class="fas fa-user-plus"></i> Invitar como personal</button>
    </div>
  `;

  const container = document.getElementById('listaPersonalContainer');
  if (usuariosFiltrados.length > 0 && container) {
    usuariosFiltrados.forEach(u => {
      const fila = document.createElement('div');
      fila.className = 'usuario-row';
      fila.dataset.rol = u.rol;
      fila.innerHTML = `
        <div class="usuario-row-top">
          <div class="av">${u.nombre.charAt(0).toUpperCase()}</div>
          <strong>${u.nombre}</strong>
          <span class="rol-actual">${u.rol}</span>
        </div>
        <div class="roles-checks">
          ${rolesAsignables.map(rol => {
            const tieneRol = u.rol === rol;
            const restringido = rolesRestringidos.includes(rol);
            return `
              <label class="rol-check ${restringido ? 'bloqueado' : ''}">
                <input type="checkbox" ${tieneRol ? 'checked' : ''} ${restringido ? 'disabled' : ''} data-usuario="${u.nombre}" data-rol="${rol}">
                ${rol.charAt(0).toUpperCase() + rol.slice(1)}
              </label>
            `;
          }).join('')}
        </div>
      `;
      container.appendChild(fila);
    });

    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', async function () {
        const nombreUsuario = this.dataset.usuario;
        const nuevoRol = this.checked ? this.dataset.rol : 'cliente';
        const resultado = await Auth.cambiarRol(nombreUsuario, nuevoRol);
        if (!resultado.exito) {
          mostrarToast('error', resultado.error);
          this.checked = !this.checked;
          return;
        }
        mostrarToast('success', `Rol de ${nombreUsuario} actualizado a ${nuevoRol}`);
        renderTabAdmin(usuarioActual, esMaster, contenedorId);
      });
    });
  }

  // Filtros
  tabAdmin.querySelectorAll('.filtro-rol').forEach(btn => {
    btn.addEventListener('click', () => {
      tabAdmin.querySelectorAll('.filtro-rol').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      const filtro = btn.dataset.filtro;
      tabAdmin.querySelectorAll('.usuario-row').forEach(fila => {
        fila.style.display = (filtro === 'todos' || fila.dataset.rol === filtro) ? '' : 'none';
      });
    });
  });

  // Búsqueda
  document.getElementById('buscarPersonalInput')?.addEventListener('input', function () {
    const termino = this.value.toLowerCase();
    tabAdmin.querySelectorAll('.usuario-row').forEach(fila => {
      const nombre = fila.querySelector('strong').textContent.toLowerCase();
      fila.style.display = nombre.includes(termino) ? '' : 'none';
    });
  });

  // Invitar
  document.getElementById('btnInvitarPersonal')?.addEventListener('click', async () => {
    const nombreCliente = await mostrarEntrada('Invitar como personal', 'Ingresa el nombre exacto del cliente a invitar:', { placeholder: 'Ej: juanperez' });
    if (!nombreCliente) return;
    const rolInicial = await mostrarEntrada('Asignar rol inicial', 'Elige el primer rol:', { valorPredefinido: 'mesero', placeholder: 'mesero, cocina, barra...' });
    if (!rolInicial || !Roles.lista.includes(rolInicial.trim())) {
      mostrarToast('error', 'Rol no válido.');
      return;
    }
    const resultado = await Auth.cambiarRol(nombreCliente.trim(), rolInicial.trim());
    if (resultado.exito) {
      mostrarToast('success', `${nombreCliente} ahora es ${rolInicial}`);
      renderTabAdmin(usuarioActual, esMaster, contenedorId);
    } else {
      mostrarToast('error', resultado.error);
    }
  });
}