/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/perfil.js
   Versión: 2.0.2
   Propósito: Vista de perfil de usuario con diseño de taberna.
              v2.0.2: corrige observer que afectaba otras vistas.
   ================================================================ */

import { Auth } from '../auth.js';
import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';
import { mostrarToast } from '../utils.js';

const Perfil = (() => {

  let _abortController = null;
  let _desuscripciones = [];
  let _observerHeader = null;

  function _storageKey(usuario) {
    return `pubpos_perfil_${usuario}`;
  }

  function _asegurarVista() {
    let main = document.getElementById('view-perfil');
    if (main && main.querySelector('.main-layout')) return;
    
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-perfil';
      main.className = 'view';
      const referencia = document.getElementById('toastContainer') || document.body.lastChild;
      document.body.insertBefore(main, referencia);
    }

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

    main.classList.add('active');
  }

  async function render() {
    _asegurarVista();

    const usuario = Auth.getUsuarioActual();
    if (!usuario) return;

    const extras = _cargarExtras(usuario.nombre) || {};
    const rol = usuario.rolEfectivo || 'cliente';
    const esStaff = rol !== 'cliente';
    const esAdmin = rol === 'admin' || rol === 'master';
    const esMaster = rol === 'master';

    _renderPanelIzquierdo(usuario, extras);

    const modoSwitch = document.getElementById('perfilModoSwitch');
    if (esStaff) {
      modoSwitch.style.display = 'flex';
    } else {
      modoSwitch.style.display = 'none';
    }

    _renderModoVitrina(usuario, extras);
    _renderModoEdicion(usuario, extras, esAdmin, esMaster);
    _renderPanelDerecho(usuario, extras);
    _aplicarVisibilidadRoles(esStaff, esAdmin);
  }

  function _renderPanelIzquierdo(usuario, extras) {
    const idCard = document.getElementById('perfilIdCard');
    const apodo = extras.apodo || usuario.nombre;
    const nivel = extras.nivel || 1;
    const cargos = extras.cargos || [];
    const insignias = extras.insignias || [];
    const stats = extras.stats || { visitas: 0, clubes: 0, insignias: insignias.length };

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

    document.getElementById('perfilCargosLista').innerHTML = cargos.map(c => `<span class="cargo-chip">${c}</span>`).join('') || '';
    document.getElementById('perfilMiniStats').innerHTML = `
      <div class="stat"><div class="n">${stats.visitas}</div><div class="l">Visitas</div></div>
      <div class="stat"><div class="n">${stats.clubes}</div><div class="l">Clubes</div></div>
      <div class="stat"><div class="n">${stats.insignias}</div><div class="l">Insignias</div></div>
    `;

    const todasInsignias = ['🏅', '🃏', '🧠', '⭐', '🎯', '🎲', '🎪', '🏆'];
    document.getElementById('perfilInsignias').innerHTML = `
      <h4>Insignias</h4>
      <div class="insignia-grid">
        ${todasInsignias.map((icono, i) => {
          const desbloqueada = insignias[i] || (i < insignias.length);
          return `<div class="insignia ${desbloqueada ? '' : 'bloqueada'}">${desbloqueada ? icono : '🔒'}</div>`;
        }).join('')}
      </div>
    `;
  }

  function _renderModoVitrina(usuario, extras) {
    const vitrina = document.getElementById('modoVitrinaPerfil');
    const apodo = extras.apodo || usuario.nombre;
    const nivel = extras.nivel || 1;
    const racha = extras.racha || 0;
    const xp = extras.xp || 0;
    const xpSiguiente = extras.xpSiguiente || 1000;
    const accesorios = extras.accesorios || { mano: '🍺', aura: '' };
    const clubes = extras.clubes || [];
    const actividad = extras.actividad || [];
    const insigniasDestacadas = extras.insigniasDestacadas || extras.insignias || [];

    vitrina.innerHTML = `
      <div class="taberna-hero">
        <div class="avatar-rpg-marco">
          <div class="glow-ring"></div>
          <div class="marco-circulo"><span class="sprite">🧙‍♀️</span></div>
        </div>
        <div class="titulo-rango">"${apodo}"</div>
        <div class="racha-badge">🔥 ${racha} días de racha</div>
        <div class="xp-bar-wrap">
          <div class="xp-bar-labels"><span>Experiencia</span><strong>${xp} / ${xpSiguiente} XP</strong></div>
          <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${Math.min(100, (xp / xpSiguiente) * 100)}%"></div></div>
          <div class="xp-restante">Te faltan ${xpSiguiente - xp} XP para nivel ${nivel + 1}</div>
        </div>
      </div>
      <div class="seccion">
        <h3>🎒 Accesorios equipables</h3>
        <p class="desc">Ganados en eventos y clubes. Toca para equipar.</p>
        <div class="accesorio-fila-titulo">Objeto en mano</div>
        <div class="skin-fila fila-mano-perfil">
          <div class="skin-slot ${accesorios.mano === '🍺' ? 'equipado' : ''}" data-emoji="🍺">🍺${accesorios.mano === '🍺' ? '<span class="check">✓</span>' : ''}</div>
          <div class="skin-slot ${accesorios.mano === '🃏' ? 'equipado' : ''}" data-emoji="🃏">🃏${accesorios.mano === '🃏' ? '<span class="check">✓</span>' : ''}</div>
          <div class="skin-slot ${accesorios.mano === '♟️' ? 'equipado' : ''}" data-emoji="♟️">♟️${accesorios.mano === '♟️' ? '<span class="check">✓</span>' : ''}</div>
        </div>
      </div>
      <div class="seccion">
        <h3>🏅 Insignias destacadas</h3>
        <div class="insignias-destacadas">
          ${insigniasDestacadas.slice(0, 4).map(i => `<div class="insignia-destacada">${i}</div>`).join('')}
        </div>
      </div>
      <div class="seccion">
        <h3>🎲 Clubes</h3>
        ${clubes.length > 0 ? clubes.map(c => `<div class="club-mini">${c.icono || '🎲'} <span>${c.nombre}</span><span style="margin-left:auto;font-size:10px;color:var(--color-accent);">${c.evento || ''}</span></div>`).join('') : '<p class="desc">Únete a eventos para aparecer aquí.</p>'}
      </div>
      <div class="seccion">
        <h3>🕓 Actividad reciente</h3>
        ${actividad.length > 0 ? actividad.map(a => `<div class="actividad-vitrina"><span class="punto-v"></span><span>${a.texto}</span></div>`).join('') : '<p class="desc">Sin actividad reciente.</p>'}
      </div>
    `;

    vitrina.querySelectorAll('.fila-mano-perfil .skin-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        vitrina.querySelectorAll('.fila-mano-perfil .skin-slot').forEach(s => {
          s.classList.remove('equipado');
          s.querySelector('.check')?.remove();
        });
        slot.classList.add('equipado');
        const check = document.createElement('span');
        check.className = 'check';
        check.textContent = '✓';
        slot.appendChild(check);
      });
    });
  }

  function _renderModoEdicion(usuario, extras, esAdmin, esMaster) {
    const tabPublico = document.getElementById('tab-publico');
    tabPublico.innerHTML = `
      <div class="seccion">
        <h3>Información pública</h3>
        <p class="desc">Esto lo ven otros usuarios del pub. Tú controlas cada dato.</p>
        <div class="campo">
          <div class="campo-label-row"><label>Apodo</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div>
          <input type="text" id="editarApodo" value="${extras.apodo || ''}">
        </div>
        <div class="campo">
          <div class="campo-label-row"><label>Frase / vibe</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div>
          <input type="text" id="editarFrase" value="${extras.frase || ''}">
        </div>
        <button class="btn-editar-perfil" id="btnGuardarPerfilPublico">Guardar cambios</button>
      </div>
    `;
    document.getElementById('btnGuardarPerfilPublico')?.addEventListener('click', () => {
      _guardarExtras(usuario.nombre, { ..._cargarExtras(usuario.nombre), apodo: document.getElementById('editarApodo').value, frase: document.getElementById('editarFrase').value });
      mostrarToast('success', 'Perfil público actualizado');
      render();
    });

    const tabPreferencias = document.getElementById('tab-preferencias');
    const prefs = extras.preferencias || {};
    tabPreferencias.innerHTML = `
      <div class="nota-privacidad">ℹ️ Estos datos ajustan la carta y las recomendaciones. Solo visibles para cocina/barra cuando es necesario.</div>
      <div class="seccion">
        <h3>🥗 Alimentación</h3>
        <div class="toggle-fila"><div class="txt"><strong>Vegano</strong></div><label class="switch"><input type="checkbox" id="prefVegano" ${prefs.vegano ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Vegetariano</strong></div><label class="switch"><input type="checkbox" id="prefVegetariano" ${prefs.vegetariano ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Sin gluten</strong></div><label class="switch"><input type="checkbox" id="prefSinGluten" ${prefs.sinGluten ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Intolerante a la lactosa</strong></div><label class="switch"><input type="checkbox" id="prefLactosa" ${prefs.lactosa ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Consumo alcohol</strong></div><label class="switch"><input type="checkbox" id="prefAlcohol" ${prefs.alcohol !== false ? 'checked' : ''}><span class="slider"></span></label></div>
      </div>
      <div class="seccion">
        <h3>⚠️ Alergias <span style="font-size:10px;color:var(--color-danger);">SENSIBLE</span></h3>
        <div class="campo"><label>Alergias / intolerancias</label><input type="text" id="editarAlergias" value="${extras.alergias || ''}"></div>
        <div class="campo"><label>Notas adicionales</label><textarea id="editarNotasSalud" placeholder="Cualquier otra cosa...">${extras.notasSalud || ''}</textarea></div>
      </div>
      <button class="btn-editar-perfil" id="btnGuardarPreferencias">Guardar preferencias</button>
    `;
    document.getElementById('btnGuardarPreferencias')?.addEventListener('click', () => {
      const nuevosExtras = {
        ..._cargarExtras(usuario.nombre),
        preferencias: {
          vegano: document.getElementById('prefVegano').checked,
          vegetariano: document.getElementById('prefVegetariano').checked,
          sinGluten: document.getElementById('prefSinGluten').checked,
          lactosa: document.getElementById('prefLactosa').checked,
          alcohol: document.getElementById('prefAlcohol').checked
        },
        alergias: document.getElementById('editarAlergias').value,
        notasSalud: document.getElementById('editarNotasSalud').value
      };
      _guardarExtras(usuario.nombre, nuevosExtras);
      mostrarToast('success', 'Preferencias actualizadas');
    });

    document.getElementById('tab-participaciones').innerHTML = `
      <div class="seccion">
        <h3>Mis clubes</h3>
        ${(extras.clubes || []).length > 0 ? extras.clubes.map(c => `<div class="club-mini">${c.icono || '🎲'} <span>${c.nombre}</span><span style="margin-left:auto;font-size:10px;color:var(--color-accent);">${c.evento || ''}</span></div>`).join('') : '<p class="desc">Únete a eventos para aparecer aquí.</p>'}
        <button class="btn-editar-perfil" style="margin-top:12px; width:100%;">Ver próximos eventos →</button>
      </div>
    `;

    document.getElementById('tab-staff').innerHTML = `
      <div class="seccion"><h3>🗓️ Mis turnos</h3><p class="desc">Próximamente: integración con gestión de turnos.</p></div>
      <div class="seccion"><h3>✅ Tareas de hoy</h3><p class="desc">Próximamente: integración con gestión de tareas.</p></div>
    `;

    if (esAdmin) {
      document.getElementById('tab-admin').innerHTML = `
        <div class="nota-privacidad">🔑 Como <strong>${esMaster ? 'master' : 'admin'}</strong>, puedes asignar roles operativos. El rol <strong>Admin</strong> solo puede asignarlo un <strong>Master</strong>.</div>
        <div class="seccion">
          <h3>Asignar roles</h3>
          <p class="desc">Próximamente: listado de personal y asignación de roles.</p>
          <button class="btn-editar-perfil" style="width:100%; margin-top:12px;">+ Invitar como personal</button>
        </div>
      `;
    }
  }

  function _renderPanelDerecho(usuario, extras) {
    const panelDer = document.getElementById('panelDerechoPerfil');
    const puntos = extras.puntos || 0;
    const actividad = extras.actividad || [];
    panelDer.innerHTML = `
      <h3>📊 Resumen</h3>
      <div class="resumen-mini"><div class="titulo">Puntos de fidelización</div><div class="valor">${puntos.toLocaleString()}</div></div>
      <div class="resumen-mini"><div class="titulo">Próxima insignia en</div><div class="valor">3 visitas</div></div>
      <h3 style="margin-top:20px;">🕓 Actividad reciente</h3>
      ${actividad.length > 0 ? actividad.map(a => `<div class="actividad-item"><div class="punto"></div><div>${a.texto}<span class="txt-sec">${a.fecha || ''}</span></div></div>`).join('') : '<p class="desc">Sin actividad reciente.</p>'}
    `;
  }

  function _aplicarVisibilidadRoles(esStaff, esAdmin) {
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

  function _cargarExtras(usuario) {
    const raw = localStorage.getItem(_storageKey(usuario));
    const base = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
    return {
      apodo: '', frase: '', desde: 'Miembro reciente', nivel: 1, racha: 0, xp: 0, xpSiguiente: 1000,
      cargos: [], insignias: [], insigniasDestacadas: [], stats: { visitas: 0, clubes: 0, insignias: 0 },
      accesorios: { mano: '🍺', aura: '' }, clubes: [], actividad: [], preferencias: {},
      alergias: '', notasSalud: '', puntos: 0, ...base
    };
  }

  function _guardarExtras(usuario, datos) {
    localStorage.setItem(_storageKey(usuario), JSON.stringify(datos));
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();
    const { signal } = _abortController;

    _asegurarVista();

    document.getElementById('btnToggleIzqPerfil')?.addEventListener('click', _togglePanelIzquierdo, { signal });
    document.getElementById('btnToggleDerPerfil')?.addEventListener('click', _togglePanelDerecho, { signal });
    document.getElementById('perfilOverlay')?.addEventListener('click', _cerrarPaneles, { signal });
    document.getElementById('btnEditarPerfil')?.addEventListener('click', _mostrarEdicion, { signal });
    document.getElementById('btnVolverVitrina')?.addEventListener('click', _mostrarVitrina, { signal });

    document.querySelectorAll('.central-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (!tab.classList.contains('visible')) return;
        document.querySelectorAll('.central-tab').forEach(t => t.classList.remove('activo'));
        document.querySelectorAll('.central-tab-content').forEach(c => c.classList.remove('activo'));
        tab.classList.add('activo');
        document.getElementById('tab-' + tab.dataset.tab)?.classList.add('activo');
      }, { signal });
    });

    document.querySelectorAll('#perfilModoSwitch button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('#perfilModoSwitch button').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
      }, { signal });
    });

    _configurarSwipe(signal);
    _configurarAjusteHeader(signal);

    _desuscripciones.push(EventBus.on('db:inicializada', () => { if (Auth.getUsuarioActual()) render(); }));
    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => { if (vista === 'perfil' && Auth.getUsuarioActual()) render(); }));

    if (Auth.getUsuarioActual()) render();
  }

  function limpiar() {
    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (_observerHeader) { _observerHeader.disconnect(); _observerHeader = null; }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];

    const main = document.getElementById('view-perfil');
    if (main) {
      main.innerHTML = '';
      main.classList.remove('active');
    }
  }

  function _togglePanelIzquierdo() {
    const panel = document.getElementById('panelIzquierdoPerfil');
    if (panel) {
      _ajustarPosicionPanel(panel);
      panel.classList.toggle('abierto');
      document.getElementById('perfilOverlay')?.classList.toggle('activo');
    }
  }
  function _togglePanelDerecho() {
    const panel = document.getElementById('panelDerechoPerfil');
    if (panel) {
      _ajustarPosicionPanel(panel);
      panel.classList.toggle('abierto');
      document.getElementById('perfilOverlay')?.classList.toggle('activo');
    }
  }
  function _cerrarPaneles() {
    document.getElementById('panelIzquierdoPerfil')?.classList.remove('abierto');
    document.getElementById('panelDerechoPerfil')?.classList.remove('abierto');
    document.getElementById('perfilOverlay')?.classList.remove('activo');
  }
  function _mostrarEdicion() {
    document.getElementById('modoVitrinaPerfil').style.display = 'none';
    document.getElementById('modoEdicionPerfil').style.display = 'block';
  }
  function _mostrarVitrina() {
    document.getElementById('modoEdicionPerfil').style.display = 'none';
    document.getElementById('modoVitrinaPerfil').style.display = 'flex';
  }

  function _calcularTopPanel() {
    const appHeader = document.querySelector('.app-header');
    if (!appHeader) return '0';
    return window.getComputedStyle(appHeader).display === 'none' ? '0' : appHeader.offsetHeight + 'px';
  }

  function _ajustarPosicionPanel(panel) {
    if (!panel || window.innerWidth > 900) return;
    const top = _calcularTopPanel();
    panel.style.top = top;
    panel.style.height = top === '0' ? '100%' : `calc(100% - ${top})`;
  }

  function _configurarAjusteHeader(signal) {
    const appHeader = document.querySelector('.app-header');
    if (!appHeader) return;

    _observerHeader = new MutationObserver(() => {
      const oculto = appHeader.style.display === 'none';
      const top = oculto ? '0' : 'var(--header-h)';
      const h = oculto ? '100%' : 'calc(100% - var(--header-h))';
      const panelIzq = document.getElementById('panelIzquierdoPerfil');
      const panelDer = document.getElementById('panelDerechoPerfil');
      if (panelIzq) { panelIzq.style.top = top; panelIzq.style.height = h; }
      if (panelDer) { panelDer.style.top = top; panelDer.style.height = h; }
    });
    _observerHeader.observe(appHeader, { attributes: true, attributeFilter: ['style'] });
  }

  function _configurarSwipe(signal) {
    const mainLayout = document.getElementById('perfilMainLayout');
    if (!mainLayout) return;
    let touchStartX = 0, touchStartY = 0;
    mainLayout.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { signal });
    mainLayout.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0 && touchStartX < 40) _togglePanelIzquierdo();
        else if (dx < 0 && touchStartX > window.innerWidth - 40) _togglePanelDerecho();
        else if (dx > 0 && document.getElementById('panelDerechoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
        else if (dx < 0 && document.getElementById('panelIzquierdoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
      }
    }, { signal });
  }

  return {
    activar,
    limpiar,
    render
  };
})();

export { Perfil };