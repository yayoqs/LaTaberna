/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/renderer.js
   Versión: 1.0.1
   Propósito: Construcción del DOM base del perfil y renderizado de
              paneles. Delega vitrina y edición a submódulos reales.
   ================================================================ */

import { renderModoVitrina } from './vitrina.js';
import { renderModoEdicion } from './edicion.js';

export function asegurarVista() {
  let main = document.getElementById('view-perfil');
  if (!main) return;
  if (main.querySelector('.perfil-header')) return;

  main.innerHTML = `
    <div class="perfil-header">
      <button class="icon-btn" id="btnToggleIzqPerfil" title="Identidad">👤</button>
      <h2>Mi Perfil</h2>
      <button class="icon-btn" id="btnToggleDerPerfil" title="Resumen">📊</button>
    </div>
    <div class="main-layout" id="perfilMainLayout">
      <div class="panel-izquierdo" id="panelIzquierdoPerfil">
        <div class="id-card" id="perfilIdCard"></div>
        <div class="modo-switch" id="perfilModoSwitch" style="display:none;">
          <button class="activo" data-modo="cliente">🎟️ Cliente</button>
          <button data-modo="staff">🛠️ Staff</button>
        </div>
        <div class="cargos-lista" id="perfilCargosLista"></div>
        <div class="mini-stats" id="perfilMiniStats"></div>
        <div class="insignias" id="perfilInsignias"></div>
        <div class="panel-izq-footer">
          <button class="btn-editar-perfil" id="btnEditarPerfil">⚙️ Editar perfil</button>
        </div>
      </div>
      <div class="panel-central" id="panelCentralPerfil">
        <div class="modo-vitrina" id="modoVitrinaPerfil"></div>
        <div class="modo-edicion" id="modoEdicionPerfil" style="display:none;">
          <div class="edicion-header">
            <button class="btn-volver" id="btnVolverVitrina">← Volver a mi taberna</button>
            <h3>Editar perfil</h3>
          </div>
          <div class="central-tabs">
            <button class="central-tab visible activo" data-tab="publico">🪪 Perfil</button>
            <button class="central-tab visible" data-tab="preferencias">🍽️ Preferencias</button>
            <button class="central-tab visible" data-tab="participaciones">🎲 Participaciones</button>
            <button class="central-tab" data-tab="staff" data-req="staff">🛠️ Staff</button>
            <button class="central-tab" data-tab="admin" data-req="admin">🔑 Administración</button>
          </div>
          <div class="central-tab-content activo" id="tab-publico"></div>
          <div class="central-tab-content" id="tab-preferencias"></div>
          <div class="central-tab-content" id="tab-participaciones"></div>
          <div class="central-tab-content" id="tab-staff"></div>
          <div class="central-tab-content" id="tab-admin"></div>
        </div>
      </div>
      <div class="panel-derecho" id="panelDerechoPerfil"></div>
    </div>
    <div class="overlay" id="perfilOverlay"></div>
  `;
}

export function renderPanelIzquierdo(usuario, extras) {
  const idCard = document.getElementById('perfilIdCard');
  const apodo = extras.apodo || usuario.nombre;
  const nivel = extras.nivel || 1;
  const cargos = extras.cargos || [];
  const insignias = extras.insignias || [];
  const stats = extras.stats || { visitas: 0, clubes: 0, insignias: insignias.length };

  if (idCard) {
    idCard.innerHTML = `
      <div class="avatar-octagon-marco">
        <div class="glow-ring"></div>
        <div class="marco-octagono"><span class="sprite">🧙‍♀️</span></div>
        <div class="marco-borde"></div>
        <span class="nivel-badge">NIVEL ${nivel}</span>
        <span class="badge-modo">${cargos.length > 0 ? '🛠️' : '🎟️'}</span>
      </div>
      <div class="nombre">${usuario.nombre}</div>
      <div class="apodo">"${apodo}"</div>
      <div class="desde">${extras.desde || 'Miembro reciente'}</div>
    `;
  }

  const cargosLista = document.getElementById('perfilCargosLista');
  if (cargosLista) cargosLista.innerHTML = cargos.map(c => `<span class="cargo-chip">${c}</span>`).join('') || '';

  const miniStats = document.getElementById('perfilMiniStats');
  if (miniStats) {
    miniStats.innerHTML = `
      <div class="stat"><div class="n">${stats.visitas}</div><div class="l">Visitas</div></div>
      <div class="stat"><div class="n">${stats.clubes}</div><div class="l">Clubes</div></div>
      <div class="stat"><div class="n">${stats.insignias}</div><div class="l">Insignias</div></div>
    `;
  }

  const insigniasContainer = document.getElementById('perfilInsignias');
  if (insigniasContainer) {
    const todasInsignias = ['🏅', '🃏', '🧠', '⭐', '🎯', '🎲', '🎪', '🏆'];
    insigniasContainer.innerHTML = `
      <h4>Insignias</h4>
      <div class="insignia-grid">
        ${todasInsignias.map((icono, i) => {
          const desbloqueada = insignias[i] || (i < insignias.length);
          return `<div class="insignia ${desbloqueada ? '' : 'bloqueada'}">${desbloqueada ? icono : '🔒'}</div>`;
        }).join('')}
      </div>
    `;
  }
}

export function renderPanelDerecho(usuario, extras) {
  const panelDer = document.getElementById('panelDerechoPerfil');
  if (!panelDer) return;
  panelDer.innerHTML = `
    <h3>📊 Resumen</h3>
    <div class="resumen-mini"><div class="titulo">Puntos de fidelización</div><div class="valor">${(extras.puntos || 0).toLocaleString()}</div></div>
    <div class="resumen-mini"><div class="titulo">Próxima insignia en</div><div class="valor">3 visitas</div></div>
    <h3 style="margin-top:20px;">🕓 Actividad reciente</h3>
    ${(extras.actividad || []).length ? extras.actividad.map(a => `<div class="actividad-item"><div class="punto"></div><div>${a.texto}<span class="txt-sec">${a.fecha || ''}</span></div></div>`).join('') : '<p class="desc">Sin actividad.</p>'}
  `;
}

export function aplicarVisibilidadRoles(esStaff, esAdmin) {
  document.querySelectorAll('.central-tab[data-req="staff"]').forEach(tab => tab.classList.toggle('visible', esStaff));
  document.querySelectorAll('.central-tab[data-req="admin"]').forEach(tab => tab.classList.toggle('visible', esAdmin));
  const tabActiva = document.querySelector('.central-tab.activo');
  if (tabActiva && !tabActiva.classList.contains('visible')) {
    document.querySelectorAll('.central-tab').forEach(t => t.classList.remove('activo'));
    document.querySelectorAll('.central-tab-content').forEach(c => c.classList.remove('activo'));
    document.querySelector('.central-tab[data-tab="publico"]')?.classList.add('activo');
    document.getElementById('tab-publico')?.classList.add('activo');
  }
}

// Reexportamos las funciones reales para que ciclo-vida las encuentre
export { renderModoVitrina, renderModoEdicion };