/* ================================================================
   PubPOS — MÓDULO: perfil.js (v3.0 – ES6 nativo)
   Propósito: Vista de perfil de usuario con foto, datos y documentos.
              Compatible con carga normal y como módulo ES6.
   ================================================================ */
const Perfil = (() => {

  /** Clave en localStorage para datos extendidos del usuario */
  function _storageKey(usuario) {
    return `pubpos_perfil_${usuario}`;
  }

  function _asegurarVista() {
    if (document.getElementById('view-perfil')) return;

    const main = document.createElement('main');
    main.id = 'view-perfil';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-id-card"></i> Mi Perfil</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" onclick="Perfil.mostrarModalEditar()"><i class="fas fa-pen"></i> Editar</button>
          <button class="btn-secondary" onclick="Perfil.render()"><i class="fas fa-sync-alt"></i> Actualizar</button>
        </div>
      </div>
      <div class="perfil-contenido">
        <section class="perfil-tarjeta">
          <div class="perfil-avatar" id="perfilAvatar"></div>
          <div class="perfil-info">
            <h3 id="perfilNombre"></h3>
            <span class="perfil-rol" id="perfilRol"></span>
            <span class="perfil-simulacion" id="perfilSimulacion" style="display:none;"></span>
          </div>
          <div class="perfil-detalles" id="perfilDetalles" style="width:100%; margin-top:12px;"></div>
        </section>
        <section class="perfil-documentos">
          <h4><i class="fas fa-folder-open"></i> Mis Documentos</h4>
          <div id="perfilDocsLista" class="perfil-docs-lista">
            <p style="color:var(--color-text-muted);">Cargando...</p>
          </div>
        </section>
      </div>
    `;
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /** Carga y muestra los datos del perfil y los documentos. */
  async function render() {
    _asegurarVista();

    const usuario = Auth.getUsuarioActual();
    if (!usuario) {
      showToast('error', 'No hay sesión activa');
      return;
    }

    const extras = _cargarExtras(usuario.nombre);
    document.getElementById('perfilNombre').textContent = usuario.nombre;
    document.getElementById('perfilRol').textContent = `Rol: ${usuario.rolEfectivo}`;
    if (usuario.simulando) {
      document.getElementById('perfilSimulacion').style.display = 'block';
      document.getElementById('perfilSimulacion').textContent = `(Simulando: ${usuario.simulando})`;
    } else {
      document.getElementById('perfilSimulacion').style.display = 'none';
    }

    _renderAvatar(usuario.nombre, extras.foto);
    _renderDetalles(extras);
    await _cargarDocumentos();
  }

  function _renderAvatar(nombre, fotoUrl) {
    const avatarEl = document.getElementById('perfilAvatar');
    if (!avatarEl) return;

    if (fotoUrl && fotoUrl.trim() !== '') {
      avatarEl.innerHTML = '';
      avatarEl.style.backgroundImage = `url('${fotoUrl}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.color = 'transparent';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.style.backgroundSize = '';
      avatarEl.style.color = '#000';
      avatarEl.innerHTML = `<span>${nombre.charAt(0).toUpperCase()}</span>`;
    }
  }

  function _renderDetalles(extras) {
    const cont = document.getElementById('perfilDetalles');
    if (!cont) return;
    let html = '';
    if (extras.telefono) html += `<div class="perfil-detalle-item"><i class="fas fa-phone"></i> ${extras.telefono}</div>`;
    if (extras.email) html += `<div class="perfil-detalle-item"><i class="fas fa-envelope"></i> ${extras.email}</div>`;
    cont.innerHTML = html || '<p style="color:var(--color-text-muted); font-size:12px;">Sin información adicional.</p>';
  }

  function mostrarModalEditar() {
    let modal = document.getElementById('modalEditarPerfil');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEditarPerfil';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width:460px;">
          <div class="modal-header"><h3><i class="fas fa-pen"></i> Editar Perfil</h3><button class="modal-close" onclick="Perfil.cerrarModalEditar()"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <label>Nombre</label><input type="text" id="editarPerfilNombre">
            <label>Teléfono</label><input type="text" id="editarPerfilTelefono">
            <label>Email</label><input type="email" id="editarPerfilEmail">
            <label>Foto de perfil (URL)</label><input type="text" id="editarPerfilFoto">
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Perfil.cerrarModalEditar()">Cancelar</button>
              <button class="btn-primary" onclick="Perfil.guardarPerfil()">Guardar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const usuario = Auth.getUsuarioActual();
    document.getElementById('editarPerfilNombre').value = usuario ? usuario.nombre : '';
    const extras = _cargarExtras(usuario ? usuario.nombre : '');
    document.getElementById('editarPerfilTelefono').value = extras.telefono || '';
    document.getElementById('editarPerfilEmail').value = extras.email || '';
    document.getElementById('editarPerfilFoto').value = extras.foto || '';
    modal.style.display = 'flex';
  }

  function cerrarModalEditar() {
    const modal = document.getElementById('modalEditarPerfil');
    if (modal) modal.style.display = 'none';
  }

  /** Guarda los datos editados del perfil. */
  async function guardarPerfil() {
    const usuario = Auth.getUsuarioActual();
    if (!usuario) { showToast('error', 'No hay sesión activa'); return; }

    const nuevoNombre = document.getElementById('editarPerfilNombre').value.trim();
    const telefono = document.getElementById('editarPerfilTelefono').value.trim();
    const email = document.getElementById('editarPerfilEmail').value.trim();
    const foto = document.getElementById('editarPerfilFoto').value.trim();

    if (!nuevoNombre) { showToast('error', 'El nombre no puede estar vacío'); return; }

    Auth.actualizarNombre(nuevoNombre);

    _guardarExtras(nuevoNombre, { telefono, email, foto });
    cerrarModalEditar();
    render();
    showToast('success', 'Perfil actualizado');
  }

  function _cargarExtras(usuario) {
    const raw = localStorage.getItem(_storageKey(usuario));
    return raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
  }

  function _guardarExtras(usuario, datos) {
    localStorage.setItem(_storageKey(usuario), JSON.stringify(datos));
  }

  async function _cargarDocumentos() {
    const docsContainer = document.getElementById('perfilDocsLista');
    if (!docsContainer) return;
    try {
      const respuesta = await DB.llamar('getDocumentosUsuario', { usuario: Auth.getNombre() });
      const documentos = respuesta.documentos || [];
      if (!documentos.length) {
        docsContainer.innerHTML = '<p style="color:var(--color-text-muted);">No tienes documentos cargados.</p>';
        return;
      }
      docsContainer.innerHTML = documentos.map(doc => `
        <div class="perfil-doc-item">
          <i class="fas fa-file-pdf"></i>
          <span>${doc.nombre || 'Documento'}</span>
          <a href="${doc.url}" target="_blank" class="btn-ajuste"><i class="fas fa-download"></i> Ver</a>
        </div>`).join('');
    } catch (e) {
      Logger.warn('[Perfil] No se pudieron cargar documentos:', e);
      docsContainer.innerHTML = '<p style="color:var(--color-text-muted);">Error al cargar documentos.</p>';
    }
  }

  EventBus.on('db:inicializada', render);

  return { render, mostrarModalEditar, cerrarModalEditar, guardarPerfil };
})();

// Compatibilidad global
window.Perfil = Perfil;

// Exportar como módulo ES6
export default Perfil;