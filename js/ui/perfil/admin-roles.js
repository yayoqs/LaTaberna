/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/admin-roles.js
   Versión: 1.0.0
   Propósito: Pestaña de administración de roles (solo admin y master).
   ================================================================ */

import { Auth } from '../../auth.js';
import { Roles } from '../../roles.js';
import { mostrarToast } from '../../utils.js';

export function renderTabAdmin(usuarioActual, esMaster) {
  const tabAdmin = document.getElementById('tab-admin');
  if (!tabAdmin) return;

  let todosUsuarios = [];
  try {
    const raw = localStorage.getItem('pubpos_usuarios');
    if (raw) todosUsuarios = JSON.parse(raw);
  } catch (e) { todosUsuarios = []; }

  const rolesOperativos = Roles.lista.filter(r => r !== 'cliente' && r !== 'artista');
  const usuariosFiltrados = todosUsuarios.filter(u => {
    if (u.nombre === usuarioActual.nombre) return false;
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
      <h3>Asignar roles al personal</h3>
      <div class="search-box" style="margin-bottom:12px;">
        <span>🔍</span>
        <input type="text" id="buscarPersonalInput" placeholder="Buscar por nombre...">
      </div>
      <div id="listaPersonalContainer">
        ${usuariosFiltrados.length === 0 ? '<p class="desc">No hay personal para administrar.</p>' : ''}
      </div>
      <button class="btn-editar-perfil" id="btnInvitarPersonal" style="width:100%; margin-top:12px;">+ Invitar como personal</button>
    </div>
  `;

  const container = document.getElementById('listaPersonalContainer');
  if (usuariosFiltrados.length > 0 && container) {
    usuariosFiltrados.forEach(u => {
      const fila = document.createElement('div');
      fila.className = 'usuario-row';
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
              <label class="rol-check ${restringido ? 'bloqueado' : ''} ${rol === 'admin' ? 'admin-rol' : ''}">
                <input type="checkbox" 
                       ${tieneRol ? 'checked' : ''} 
                       ${restringido ? 'disabled' : ''}
                       data-usuario="${u.nombre}" 
                       data-rol="${rol}">
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

        const resultado = Auth.cambiarRol(nombreUsuario, nuevoRol);
        if (!resultado.exito) {
          mostrarToast('error', resultado.error);
          this.checked = !this.checked;
          return;
        }
        mostrarToast('success', `Rol de ${nombreUsuario} actualizado a ${nuevoRol}`);
      });
    });
  }

  document.getElementById('buscarPersonalInput')?.addEventListener('input', function () {
    const termino = this.value.toLowerCase();
    container.querySelectorAll('.usuario-row').forEach(fila => {
      const nombre = fila.querySelector('strong').textContent.toLowerCase();
      fila.style.display = nombre.includes(termino) ? '' : 'none';
    });
  });

  document.getElementById('btnInvitarPersonal')?.addEventListener('click', async () => {
    const nombreCliente = prompt('Ingresa el nombre exacto del cliente a invitar como personal:');
    if (!nombreCliente) return;
    const rolInicial = prompt('Asignar rol inicial (mesero, cocina, barra, etc.):', 'mesero');
    if (!rolInicial || !Roles.lista.includes(rolInicial)) {
      mostrarToast('error', 'Rol no válido.');
      return;
    }
    const resultado = Auth.cambiarRol(nombreCliente, rolInicial);
    if (resultado.exito) {
      mostrarToast('success', `${nombreCliente} ahora es ${rolInicial}`);
    } else {
      mostrarToast('error', resultado.error);
    }
  });
}