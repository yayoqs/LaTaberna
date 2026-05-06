/* ================================================================
   PubPOS — MÓDULO: perfil.js (v2.1 – encapsulación mejorada)
   ================================================================
   Cambios respecto a v2:
   • Se elimina el acceso directo a Auth._usuarioActual.nombre.
     Ahora se actualiza sessionStorage y se reconstruye el objeto
     interno de Auth para reflejar el cambio sin recargar.
   • Se añade un comentario TODO para implementar en Auth un método
     público que reciba los nuevos datos del perfil.
   • Se corrige _renderAvatar para que, al quitar la foto, se
     elimine correctamente el estilo de fondo y se muestre la inicial.
   • Comentarios pedagógicos añadidos.
   ================================================================ */
const Perfil = (() => {

  // Clave para guardar datos extendidos en localStorage
  function _storageKey(usuario) {
    return `pubpos_perfil_${usuario}`;
  }

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
          <div class="perfil-detalles" id="perfilDetalles" style="width:100%; margin-top:12px;">
            <!-- Se llena dinámicamente -->
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

    // Cargar datos extendidos desde localStorage
    const extras = _cargarExtras(usuario.nombre);

    // Mostrar nombre y rol
    $id('perfilNombre').textContent = usuario.nombre;
    $id('perfilRol').textContent = `Rol: ${usuario.rolEfectivo}`;
    if (usuario.simulando) {
      $id('perfilSimulacion').style.display = 'block';
      $id('perfilSimulacion').textContent = `(Simulando: ${usuario.simulando})`;
    } else {
      $id('perfilSimulacion').style.display = 'none';
    }

    // Avatar: si hay foto, usarla; si no, inicial
    _renderAvatar(usuario.nombre, extras.foto);

    // Detalles extra (teléfono, email)
    _renderDetalles(extras);

    // Cargar documentos desde el backend
    await _cargarDocumentos();
  }

  function _renderAvatar(nombre, fotoUrl) {
    const avatarEl = $id('perfilAvatar');
    if (!avatarEl) return;

    if (fotoUrl && fotoUrl.trim() !== '') {
      avatarEl.innerHTML = '';
      avatarEl.style.backgroundImage = `url('${fotoUrl}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.color = 'transparent'; // esconde la inicial
    } else {
      // ⚠️ Limpiar estilos de fondo para mostrar la inicial correctamente
      avatarEl.style.backgroundImage = '';
      avatarEl.style.backgroundSize = '';
      avatarEl.style.color = '#000';
      avatarEl.innerHTML = `<span>${nombre.charAt(0).toUpperCase()}</span>`;
    }
  }

  function _renderDetalles(extras) {
    const cont = $id('perfilDetalles');
    if (!cont) return;

    let html = '';
    if (extras.telefono) {
      html += `<div class="perfil-detalle-item"><i class="fas fa-phone"></i> ${extras.telefono}</div>`;
    }
    if (extras.email) {
      html += `<div class="perfil-detalle-item"><i class="fas fa-envelope"></i> ${extras.email}</div>`;
    }
    if (!html) {
      html = '<p style="color:var(--color-text-muted); font-size:12px;">Sin información adicional.</p>';
    }
    cont.innerHTML = html;
  }

  /* ── MODAL PARA EDITAR PERFIL ────────────────────────────── */
  function mostrarModalEditar() {
    let modal = $id('modalEditarPerfil');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEditarPerfil';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small" style="max-width:460px;">
          <div class="modal-header">
            <h3><i class="fas fa-pen"></i> Editar Perfil</h3>
            <button class="modal-close" onclick="Perfil.cerrarModalEditar()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Nombre</label>
            <input type="text" id="editarPerfilNombre" placeholder="Tu nombre">

            <label>Teléfono</label>
            <input type="text" id="editarPerfilTelefono" placeholder="+56 9 ...">

            <label>Email</label>
            <input type="email" id="editarPerfilEmail" placeholder="correo@ejemplo.com">

            <label>Foto de perfil (URL)</label>
            <input type="text" id="editarPerfilFoto" placeholder="https://... (opcional)">

            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Perfil.cerrarModalEditar()">Cancelar</button>
              <button class="btn-primary" onclick="Perfil.guardarPerfil()"><i class="fas fa-save"></i> Guardar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Precargar datos actuales
    const usuario = Auth.getUsuarioActual();
    $id('editarPerfilNombre').value = usuario ? usuario.nombre : '';

    const extras = _cargarExtras(usuario ? usuario.nombre : '');
    $id('editarPerfilTelefono').value = extras.telefono || '';
    $id('editarPerfilEmail').value = extras.email || '';
    $id('editarPerfilFoto').value = extras.foto || '';

    modal.style.display = 'flex';
  }

  function cerrarModalEditar() {
    const modal = $id('modalEditarPerfil');
    if (modal) modal.style.display = 'none';
  }

  async function guardarPerfil() {
    const usuario = Auth.getUsuarioActual();
    if (!usuario) {
      showToast('error', 'No hay sesión activa');
      return;
    }

    const nuevoNombre = $val('editarPerfilNombre');
    const telefono = $val('editarPerfilTelefono');
    const email = $val('editarPerfilEmail');
    const foto = $val('editarPerfilFoto');

    if (!nuevoNombre) {
      showToast('error', 'El nombre no puede estar vacío');
      return;
    }

    // ── Actualizar nombre en sessionStorage ─────────────────
    // TODO: Reemplazar por Auth.actualizarNombre(nuevoNombre) cuando
    // se implemente el método público en auth.js.
    const nuevoUsuario = { nombre: nuevoNombre, rol: usuario.rol };
    sessionStorage.setItem('usuarioActual', JSON.stringify(nuevoUsuario));

    // Actualizar el objeto en memoria para que Auth lo refleje sin recargar
    Auth._usuarioActual = nuevoUsuario;
    Auth.aplicarRestriccionesUI();

    // ── Guardar datos extendidos en localStorage ────────────
    _guardarExtras(nuevoNombre, { telefono, email, foto });

    cerrarModalEditar();
    render();
    showToast('success', 'Perfil actualizado');
  }

  /* ── CARGA / GUARDADO DE DATOS EXTRAS ──────────────────── */
  function _cargarExtras(usuario) {
    const raw = localStorage.getItem(_storageKey(usuario));
    if (raw) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  }

  function _guardarExtras(usuario, datos) {
    localStorage.setItem(_storageKey(usuario), JSON.stringify(datos));
  }

  /* ── CARGAR DOCUMENTOS ──────────────────────────────────── */
  async function _cargarDocumentos() {
    const docsContainer = $id('perfilDocsLista');
    if (!docsContainer) return;

    try {
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