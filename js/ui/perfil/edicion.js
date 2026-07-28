/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/edicion.js
   Versión: 1.0.2
   Propósito: Renderizado del modo edición (pestañas de configuración).
              v1.0.2: integra la pestaña de administración de roles.
   ================================================================ */

import { cargarExtras, guardarExtras } from './estado.js';
import { mostrarToast } from '../../utils.js';
import { renderTabAdmin } from './admin-roles.js';

export function renderModoEdicion(usuario, extras, esAdmin, esMaster) {
  const tabPublico = document.getElementById('tab-publico');
  if (tabPublico) {
    tabPublico.innerHTML = `
      <div class="seccion">
        <h3>Información pública</h3><p class="desc">Esto lo ven otros usuarios del pub.</p>
        <div class="campo"><div class="campo-label-row"><label>Apodo</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div><input type="text" id="editarApodo" value="${extras.apodo || ''}"></div>
        <div class="campo"><div class="campo-label-row"><label>Frase</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div><input type="text" id="editarFrase" value="${extras.frase || ''}"></div>
        <button class="btn-editar-perfil" id="btnGuardarPerfilPublico">Guardar cambios</button>
      </div>`;
    document.getElementById('btnGuardarPerfilPublico')?.addEventListener('click', () => {
      guardarExtras(usuario.nombre, { ...cargarExtras(usuario.nombre), apodo: document.getElementById('editarApodo').value, frase: document.getElementById('editarFrase').value });
      mostrarToast('success', 'Perfil público actualizado');
    });
  }

  const tabPrefs = document.getElementById('tab-preferencias');
  if (tabPrefs) {
    const prefs = extras.preferencias || {};
    tabPrefs.innerHTML = `
      <div class="nota-privacidad">ℹ️ Solo visible para cocina/barra cuando es necesario.</div>
      <div class="seccion"><h3>🥗 Alimentación</h3>
        <div class="toggle-fila"><div class="txt"><strong>Vegano</strong></div><label class="switch"><input type="checkbox" id="prefVegano" ${prefs.vegano ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Vegetariano</strong></div><label class="switch"><input type="checkbox" id="prefVegetariano" ${prefs.vegetariano ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Sin gluten</strong></div><label class="switch"><input type="checkbox" id="prefSinGluten" ${prefs.sinGluten ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Intolerante a la lactosa</strong></div><label class="switch"><input type="checkbox" id="prefLactosa" ${prefs.lactosa ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Consumo alcohol</strong></div><label class="switch"><input type="checkbox" id="prefAlcohol" ${prefs.alcohol !== false ? 'checked' : ''}><span class="slider"></span></label></div>
      </div>
      <div class="seccion"><h3>⚠️ Alergias</h3>
        <div class="campo"><label>Alergias / intolerancias</label><input type="text" id="editarAlergias" value="${extras.alergias || ''}"></div>
        <div class="campo"><label>Notas adicionales</label><textarea id="editarNotasSalud">${extras.notasSalud || ''}</textarea></div>
      </div>
      <button class="btn-editar-perfil" id="btnGuardarPreferencias">Guardar preferencias</button>`;
    document.getElementById('btnGuardarPreferencias')?.addEventListener('click', () => {
      guardarExtras(usuario.nombre, {
        ...cargarExtras(usuario.nombre),
        preferencias: {
          vegano: document.getElementById('prefVegano').checked,
          vegetariano: document.getElementById('prefVegetariano').checked,
          sinGluten: document.getElementById('prefSinGluten').checked,
          lactosa: document.getElementById('prefLactosa').checked,
          alcohol: document.getElementById('prefAlcohol').checked
        },
        alergias: document.getElementById('editarAlergias').value,
        notasSalud: document.getElementById('editarNotasSalud').value
      });
      mostrarToast('success', 'Preferencias actualizadas');
    });
  }

  const tabParticipaciones = document.getElementById('tab-participaciones');
  if (tabParticipaciones) {
    tabParticipaciones.innerHTML = `
      <div class="seccion"><h3>Mis clubes</h3>${(extras.clubes || []).length ? extras.clubes.map(c => `<div class="club-mini">${c.icono || '🎲'} <span>${c.nombre}</span></div>`).join('') : '<p class="desc">Únete a eventos.</p>'}</div>`;
  }

  const tabStaff = document.getElementById('tab-staff');
  if (tabStaff) {
    tabStaff.innerHTML = `<div class="seccion"><h3>🗓️ Turnos</h3><p class="desc">Próximamente.</p></div>`;
  }

  // Pestaña de administración de roles
  if (esAdmin) {
    renderTabAdmin(usuario, esMaster);
  }
}