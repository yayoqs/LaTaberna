/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/perfil.js
   Versión: 2.1.1
   Propósito: Vista de perfil de usuario con diseño de taberna.
              v2.1.1: corrige Auth.getUsuarioActual →
                      Auth.obtenerUsuarioActual.
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

  // ── CONSTRUCCIÓN DEL DOM (CORREGIDA) ──────────────────────
  function _asegurarVista() {
    let main = document.getElementById('view-perfil');
    if (!main) {
      console.error('[Perfil] No se encontró #view-perfil en el DOM.');
      return;
    }
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

  // ── RENDERIZADO PRINCIPAL ─────────────────────────────────
  async function _renderContenido() {
    const usuario = Auth.obtenerUsuarioActual();
    if (!usuario) return;

    const extras = _cargarExtras(usuario.nombre) || {};
    const rol = usuario.rolEfectivo || 'cliente';
    const esStaff = rol !== 'cliente';
    const esAdmin = rol === 'admin' || rol === 'master';
    const esMaster = rol === 'master';

    _renderPanelIzquierdo(usuario, extras);

    const modoSwitch = document.getElementById('perfilModoSwitch');
    if (esStaff) modoSwitch.style.display = 'flex';
    else modoSwitch.style.display = 'none';

    _renderModoVitrina(usuario, extras);
    _renderModoEdicion(usuario, extras, esAdmin, esMaster);
    _renderPanelDerecho(usuario, extras);
    _aplicarVisibilidadRoles(esStaff, esAdmin);
  }

  // ── SUB-RENDERERS ────────────────────────────────────────
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
        <div class="insignias-destacadas">${insigniasDestacadas.slice(0,4).map(i => `<div class="insignia-destacada">${i}</div>`).join('')}</div>
      </div>
      <div class="seccion">
        <h3>🎲 Clubes</h3>
        ${clubes.length ? clubes.map(c => `<div class="club-mini">${c.icono||'🎲'} <span>${c.nombre}</span><span style="margin-left:auto;font-size:10px;color:var(--color-accent);">${c.evento||''}</span></div>`).join('') : '<p class="desc">Únete a eventos para aparecer aquí.</p>'}
      </div>
      <div class="seccion">
        <h3>🕓 Actividad reciente</h3>
        ${actividad.length ? actividad.map(a => `<div class="actividad-vitrina"><span class="punto-v"></span><span>${a.texto}</span></div>`).join('') : '<p class="desc">Sin actividad reciente.</p>'}
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
        <h3>Información pública</h3><p class="desc">Esto lo ven otros usuarios del pub.</p>
        <div class="campo"><div class="campo-label-row"><label>Apodo</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div><input type="text" id="editarApodo" value="${extras.apodo||''}"></div>
        <div class="campo"><div class="campo-label-row"><label>Frase</label><select class="visibilidad-select"><option>🌍 Público</option><option>🔒 Solo staff</option><option>🙈 Privado</option></select></div><input type="text" id="editarFrase" value="${extras.frase||''}"></div>
        <button class="btn-editar-perfil" id="btnGuardarPerfilPublico">Guardar cambios</button>
      </div>`;
    document.getElementById('btnGuardarPerfilPublico')?.addEventListener('click', () => {
      _guardarExtras(usuario.nombre, {...extras, apodo: document.getElementById('editarApodo').value, frase: document.getElementById('editarFrase').value});
      mostrarToast('success','Perfil público actualizado');
      _renderContenido();
    });

    const tabPrefs = document.getElementById('tab-preferencias');
    const prefs = extras.preferencias || {};
    tabPrefs.innerHTML = `
      <div class="nota-privacidad">ℹ️ Solo visible para cocina/barra cuando es necesario.</div>
      <div class="seccion"><h3>🥗 Alimentación</h3>
        <div class="toggle-fila"><div class="txt"><strong>Vegano</strong></div><label class="switch"><input type="checkbox" id="prefVegano" ${prefs.vegano?'checked':''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Vegetariano</strong></div><label class="switch"><input type="checkbox" id="prefVegetariano" ${prefs.vegetariano?'checked':''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Sin gluten</strong></div><label class="switch"><input type="checkbox" id="prefSinGluten" ${prefs.sinGluten?'checked':''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Intolerante a la lactosa</strong></div><label class="switch"><input type="checkbox" id="prefLactosa" ${prefs.lactosa?'checked':''}><span class="slider"></span></label></div>
        <div class="toggle-fila"><div class="txt"><strong>Consumo alcohol</strong></div><label class="switch"><input type="checkbox" id="prefAlcohol" ${prefs.alcohol!==false?'checked':''}><span class="slider"></span></label></div>
      </div>
      <div class="seccion"><h3>⚠️ Alergias</h3>
        <div class="campo"><label>Alergias / intolerancias</label><input type="text" id="editarAlergias" value="${extras.alergias||''}"></div>
        <div class="campo"><label>Notas adicionales</label><textarea id="editarNotasSalud">${extras.notasSalud||''}</textarea></div>
      </div>
      <button class="btn-editar-perfil" id="btnGuardarPreferencias">Guardar preferencias</button>`;
    document.getElementById('btnGuardarPreferencias')?.addEventListener('click', () => {
      _guardarExtras(usuario.nombre, {...extras,
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
      mostrarToast('success','Preferencias actualizadas');
    });

    document.getElementById('tab-participaciones').innerHTML = `
      <div class="seccion"><h3>Mis clubes</h3>${(extras.clubes||[]).length ? extras.clubes.map(c => `<div class="club-mini">${c.icono||'🎲'} <span>${c.nombre}</span></div>`).join('') : '<p class="desc">Únete a eventos.</p>'}</div>`;
    document.getElementById('tab-staff').innerHTML = `<div class="seccion"><h3>🗓️ Turnos</h3><p class="desc">Próximamente.</p></div>`;

    // 🔑 PESTAÑA ADMINISTRACIÓN (FUNCIONAL)
    if (esAdmin) {
      _renderTabAdmin(usuario, esMaster);
    }
  }

  function _renderTabAdmin(usuarioActual, esMaster) {
    const tabAdmin = document.getElementById('tab-admin');
    // Obtener todos los usuarios (desde Auth._usuarios)
    let todosLosUsuarios = [];
    try {
      const raw = localStorage.getItem('pubpos_usuarios');
      if (raw) todosLosUsuarios = JSON.parse(raw);
    } catch (e) { todosLosUsuarios = []; }

    // Filtrar solo usuarios con roles operativos (excluir cliente y artistas sin eventos)
    const rolesOperativos = ['mesero', 'cocina', 'barra', 'caja', 'despensa', 'reparto', 'eventos', 'artista', 'admin'];
    const usuariosFiltrados = todosLosUsuarios.filter(u => rolesOperativos.includes(u.rol) || u.rol === 'master');

    const nombreActual = usuarioActual.nombre;
    const rolActual = usuarioActual.rolEfectivo || usuarioActual.rol;

    const rolesDisponibles = ['mesero', 'cocina', 'barra', 'caja', 'despensa', 'reparto', 'eventos', 'artista', 'admin'];

    tabAdmin.innerHTML = `
      <div class="nota-privacidad">
        🔑 Como <strong>${esMaster ? 'master' : 'admin'}</strong>, puedes asignar roles operativos. El rol <strong>Admin</strong> solo puede asignarlo un <strong>Master</strong>.
      </div>
      <div class="seccion">
        <h3>Asignar roles</h3>
        <div class="search-box" style="margin-bottom:12px;">
          <span>🔍</span>
          <input type="text" id="adminBusqueda" placeholder="Buscar personal...">
        </div>
        <div id="adminListaUsuarios">
          ${usuariosFiltrados.map(u => {
            const esUsuarioActual = u.nombre === nombreActual;
            const esMasterObjetivo = u.rol === 'master';
            const esAdminObjetivo = u.rol === 'admin' && !esMaster;

            let rolesAsignados = [];
            try {
              const extras = _cargarExtras(u.nombre);
              rolesAsignados = extras.cargos || [u.rol]; // Por ahora usamos el rol base
            } catch (e) { rolesAsignados = [u.rol]; }

            const checkboxes = rolesDisponibles.map(rol => {
              const tieneRol = rolesAsignados.includes(rol);
              const bloqueado = esUsuarioActual || esMasterObjetivo || (rol === 'admin' && !esMaster);
              return `<label class="rol-check ${bloqueado ? 'bloqueado' : ''} ${rol === 'admin' ? 'master-rol' : ''}">
                <input type="checkbox" data-usuario="${u.nombre}" data-rol="${rol}" ${tieneRol ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}>
                ${rol.charAt(0).toUpperCase() + rol.slice(1)}
              </label>`;
            }).join('');

            return `<div class="usuario-row">
              <div class="usuario-row-top">
                <div class="av">${u.nombre.charAt(0).toUpperCase()}</div>
                <strong>${u.nombre}${esUsuarioActual ? ' (tú)' : ''}</strong>
                <span class="rol-actual">${rolesAsignados.join(', ') || u.rol}</span>
              </div>
              <div class="roles-checks">${checkboxes}</div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn-editar-perfil" style="width:100%; margin-top:12px;" id="btnInvitarPersonal">+ Invitar como personal</button>
      </div>
    `;

    // Búsqueda en tiempo real
    document.getElementById('adminBusqueda')?.addEventListener('input', function() {
      const termino = this.value.toLowerCase();
      const filas = document.querySelectorAll('#adminListaUsuarios .usuario-row');
      filas.forEach(fila => {
        const nombre = fila.querySelector('strong')?.textContent?.toLowerCase() || '';
        fila.style.display = nombre.includes(termino) ? '' : 'none';
      });
    });

    // Listeners de checkboxes
    tabAdmin.querySelectorAll('.rol-check input[type=checkbox]').forEach(checkbox => {
      checkbox.addEventListener('change', async function() {
        const nombreUsuario = this.dataset.usuario;
        const rol = this.dataset.rol;
        const asignar = this.checked;

        // Si está desmarcando su único rol, prevenir (debe tener al menos uno)
        if (!asignar) {
          const usuarioCheckboxes = tabAdmin.querySelectorAll(`input[data-usuario="${nombreUsuario}"]`);
          const marcados = Array.from(usuarioCheckboxes).filter(cb => cb.checked).length;
          if (marcados === 0) {
            this.checked = true;
            mostrarToast('error', 'Cada usuario debe tener al menos un rol.');
            return;
          }
        }

        // Llamar a Auth.cambiarRol
        // Nota: cambiarRol actualmente asigna un solo rol. Para múltiples roles,
        // necesitamos una lógica diferente (guardar en extras). Por ahora,
        // usamos el rol primario (el más alto) y guardamos el resto en extras.
        const resultado = Auth.cambiarRol(nombreUsuario, rol);
        if (resultado.exito) {
          mostrarToast('success', `Rol "${rol}" ${asignar ? 'asignado' : 'removido'} a ${nombreUsuario}.`);
          _renderContenido(); // Refrescar
        } else {
          this.checked = !asignar; // Revertir
          mostrarToast('error', resultado.error || 'No se pudo cambiar el rol.');
        }
      });
    });
  }

  function _renderPanelDerecho(usuario, extras) {
    const panelDer = document.getElementById('panelDerechoPerfil');
    panelDer.innerHTML = `
      <h3>📊 Resumen</h3>
      <div class="resumen-mini"><div class="titulo">Puntos de fidelización</div><div class="valor">${(extras.puntos||0).toLocaleString()}</div></div>
      <div class="resumen-mini"><div class="titulo">Próxima insignia en</div><div class="valor">3 visitas</div></div>
      <h3 style="margin-top:20px;">🕓 Actividad reciente</h3>
      ${(extras.actividad||[]).length ? extras.actividad.map(a => `<div class="actividad-item"><div class="punto"></div><div>${a.texto}<span class="txt-sec">${a.fecha||''}</span></div></div>`).join('') : '<p class="desc">Sin actividad.</p>'}
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

  // ── DATOS ──────────────────────────────────────────────
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

  // ── CICLO DE VIDA ────────────────────────────────────
  function activar() {
    limpiar();
    _abortController = new AbortController();
    const { signal } = _abortController;

    _asegurarVista();

    document.getElementById('btnToggleIzqPerfil')?.addEventListener('click', _toggleIzq, { signal });
    document.getElementById('btnToggleDerPerfil')?.addEventListener('click', _toggleDer, { signal });
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

    _desuscripciones.push(EventBus.on('db:inicializada', _renderContenido));
    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'perfil') _renderContenido();
    }));

    if (Auth.obtenerUsuarioActual()) _renderContenido();
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

  function _toggleIzq() { const panel = document.getElementById('panelIzquierdoPerfil'); if (panel) { _ajustarPosicionPanel(panel); panel.classList.toggle('abierto'); document.getElementById('perfilOverlay')?.classList.toggle('activo'); } }
  function _toggleDer() { const panel = document.getElementById('panelDerechoPerfil'); if (panel) { _ajustarPosicionPanel(panel); panel.classList.toggle('abierto'); document.getElementById('perfilOverlay')?.classList.toggle('activo'); } }
  function _cerrarPaneles() { document.getElementById('panelIzquierdoPerfil')?.classList.remove('abierto'); document.getElementById('panelDerechoPerfil')?.classList.remove('abierto'); document.getElementById('perfilOverlay')?.classList.remove('activo'); }
  function _mostrarEdicion() { document.getElementById('modoVitrinaPerfil').style.display='none'; document.getElementById('modoEdicionPerfil').style.display='block'; }
  function _mostrarVitrina() { document.getElementById('modoEdicionPerfil').style.display='none'; document.getElementById('modoVitrinaPerfil').style.display='flex'; }

  function _calcularTopPanel() { const appHeader = document.querySelector('.app-header'); if (!appHeader) return '0'; return window.getComputedStyle(appHeader).display === 'none' ? '0' : appHeader.offsetHeight + 'px'; }
  function _ajustarPosicionPanel(panel) { if (!panel || window.innerWidth > 900) return; const top = _calcularTopPanel(); panel.style.top = top; panel.style.height = top === '0' ? '100%' : `calc(100% - ${top})`; }

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
    mainLayout.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { signal });
    mainLayout.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0 && touchStartX < 40) _toggleIzq();
        else if (dx < 0 && touchStartX > window.innerWidth - 40) _toggleDer();
        else if (dx > 0 && document.getElementById('panelDerechoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
        else if (dx < 0 && document.getElementById('panelIzquierdoPerfil')?.classList.contains('abierto')) _cerrarPaneles();
      }
    }, { signal });
  }

  return {
    activar,
    limpiar,
    render() { activar(); }
  };
})();

export { Perfil };