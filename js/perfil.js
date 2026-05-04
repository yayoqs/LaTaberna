/* ================================================================
   PubPOS — MÓDULO: perfil.js (v1 – Perfil del Usuario)
   Propósito: Cada usuario autenticado ve su propio perfil, puede
              editar su nombre y consultar sus documentos desde Drive.
   ================================================================ */
const Perfil = (() => {

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-perfil')) return;

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
        <!-- Tarjeta de información personal -->
        <section class="perfil-tarjeta">
          <div class="perfil-avatar" id="perfilAvatar"></div>
          <div class="perfil-info">
            <h3 id="perfilNombre"></h3>
            <span class="perfil-rol" id="perfilRol"></span>
            <span class="perfil-simulacion" id="perfilSimulacion" style="display:none;"></span>
          </div>
        </section>

        <!-- Sección de documentos -->
        <section class="perfil-documentos">
          <h4><i class="fas fa-folder-open"></i> Mis Documentos</h4>
          <div id="perfilDocsLista" class="perfil-docs-lista">
            <p style="color:var(--color-text-muted);">Cargando...</p>
          </div>
        </section>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDERIZAR PERFIL ──────────────────────────────────── */
  async function render() {
    _asegurarVista();

    const usuario = Auth.getUsuarioActual();
    if (!usuario) {
      showToast('error', 'No hay sesión activa');
      return;
    }

    // Mostrar datos del usuario
    $id('perfilNombre').textContent = usuario.nombre;
    $id('perfilRol').textContent = `Rol: ${usuario.rolEfectivo}`;
    if (usuario.simulando) {
      $id('perfilSimulacion').style.display = 'block';
      $id('perfilSimulacion').textContent = `(Simulando: ${usuario.simulando})`;
    } else {
      $id('perfilSimulacion').style.display = 'none';
    }

    // Avatar con inicial
    const inicial = usuario.nombre.charAt(0).toUpperCase();
    $id('perfilAvatar').innerHTML = `<span>${inicial}</span>`;

    // Cargar documentos desde el backend
    await _cargarDocumentos();
  }

  /* ── MODAL PARA EDITAR NOMBRE ───────────────────────────── */
  function mostrarModalEditar() {
    let modal = $id('modalEditarPerfil');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEditarPerfil';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header">
            <h3><i class="fas fa-pen"></i> Editar Perfil</h3>
            <button class="modal-close" onclick="Perfil.cerrarModalEditar()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Nombre</label>
            <input type="text" id="editarPerfilNombre" placeholder="Tu nombre">
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Perfil.cerrarModalEditar()">Cancelar</button>
              <button class="btn-primary" onclick="Perfil.guardarPerfil()"><i class="fas fa-save"></i> Guardar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    // Precargar nombre actual
    const usuario = Auth.getUsuarioActual();
    $id('editarPerfilNombre').value = usuario ? usuario.nombre : '';
    modal.style.display = 'flex';
  }

  function cerrarModalEditar() {
    const modal = $id('modalEditarPerfil');
    if (modal) modal.style.display = 'none';
  }

  async function guardarPerfil() {
    const nuevoNombre = $val('editarPerfilNombre');
    if (!nuevoNombre) {
      showToast('error', 'El nombre no puede estar vacío');
      return;
    }

    // Actualizar el nombre en el objeto del usuario (solo en memoria)
    const usuario = Auth.getUsuarioActual();
    if (usuario) {
      // Actualizamos sessionStorage y el display
      Auth._usuarioActual.nombre = nuevoNombre;
      sessionStorage.setItem('usuarioActual', JSON.stringify(Auth._usuarioActual));
      Auth.aplicarRestriccionesUI();
    }

    cerrarModalEditar();
    render();
    showToast('success', 'Perfil actualizado');
  }

  /* ── CARGAR DOCUMENTOS ──────────────────────────────────── */
  async function _cargarDocumentos() {
    const docsContainer = $id('perfilDocsLista');
    if (!docsContainer) return;

    try {
      // Intentar obtener documentos del usuario desde el backend
      const respuesta = await DB.llamar('getDocumentosUsuario', {
        usuario: Auth.getNombre()
      });
      const documentos = respuesta.documentos || [];

      if (!documentos.length) {
        docsContainer.innerHTML = `<p style="color:var(--color-text-muted);">No tienes documentos cargados.</p>`;
        return;
      }

      docsContainer.innerHTML = documentos.map(doc => `
        <div class="perfil-doc-item">
          <i class="fas fa-file-pdf"></i>
          <span>${doc.nombre || 'Documento'}</span>
          <a href="${doc.url}" target="_blank" class="btn-ajuste"><i class="fas fa-download"></i> Ver</a>
        </div>
      `).join('');
    } catch (e) {
      console.warn('[Perfil] No se pudieron cargar documentos:', e);
      docsContainer.innerHTML = `<p style="color:var(--color-text-muted);">Error al cargar documentos.</p>`;
    }
  }

  /* ── SUSCRIPCIÓN A EVENTOS ──────────────────────────────── */
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
  }
  _initEventListeners();

  return {
    render,
    mostrarModalEditar,
    cerrarModalEditar,
    guardarPerfil
  };
})();

window.Perfil = Perfil;