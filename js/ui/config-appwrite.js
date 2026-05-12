/* ================================================================
   Raíz — MÓDULO: config-appwrite.js (v1.0)
   Propósito: Modal para ingresar credenciales de Appwrite.
              Solo accesible para admin y master.
   ================================================================ */
var ConfigAppwrite = (function() {

  function abrirModal() {
    if (!Auth.esAdmin() && !Auth.esMasterReal()) {
      showToast('error', 'Solo el administrador puede configurar Appwrite');
      return;
    }

    var existente = document.getElementById('modalAppwriteConfig');
    if (existente) existente.remove();

    var overlay = document.createElement('div');
    overlay.id = 'modalAppwriteConfig';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    var endpoint = localStorage.getItem('appwrite_endpoint') || 'https://cloud.appwrite.io/v1';
    var projectId = localStorage.getItem('appwrite_project_id') || '';
    var apiKey = localStorage.getItem('appwrite_api_key') || '';
    var habilitado = (localStorage.getItem('appwrite_habilitado') === 'true') ? 'checked' : '';

    overlay.innerHTML =
      '<div class="modal-small" style="max-width:500px;">' +
        '<div class="modal-header">' +
          '<h3><i class="fas fa-cloud"></i> Conexión a Appwrite</h3>' +
          '<button class="modal-close" onclick="ConfigAppwrite.cerrarModal()"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="modal-small-body">' +
          '<label for="appwriteEndpoint">Endpoint</label>' +
          '<input type="text" id="appwriteEndpoint" value="' + endpoint + '" placeholder="https://cloud.appwrite.io/v1">' +
          '<label for="appwriteProjectId">Project ID</label>' +
          '<input type="text" id="appwriteProjectId" value="' + projectId + '" placeholder="ID del proyecto en Appwrite">' +
          '<label for="appwriteApiKey">API Key (secreta)</label>' +
          '<input type="password" id="appwriteApiKey" value="' + apiKey + '" placeholder="Clave de API con permisos databases.read/write">' +
          '<div style="margin-top:12px;">' +
            '<label style="display:flex; align-items:center; gap:8px; cursor:pointer;">' +
              '<input type="checkbox" id="appwriteHabilitado" ' + habilitado + '>' +
              '<span>Activar Appwrite como backend principal</span>' +
            '</label>' +
            '<p style="font-size:11px; color:var(--color-text-muted); margin-top:4px;">' +
              'Si no se activa, la app usará Google Sheets como hasta ahora. Al guardar, la aplicación se reiniciará.' +
            '</p>' +
          '</div>' +
          '<div class="modal-small-footer">' +
            '<button class="btn-secondary" onclick="ConfigAppwrite.cerrarModal()">Cancelar</button>' +
            '<button class="btn-primary" onclick="ConfigAppwrite.guardar()"><i class="fas fa-save"></i> Guardar y reiniciar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
  }

  function cerrarModal() {
    var modal = document.getElementById('modalAppwriteConfig');
    if (modal) modal.remove();
  }

  function guardar() {
    var endpoint = document.getElementById('appwriteEndpoint')?.value.trim() || 'https://cloud.appwrite.io/v1';
    var projectId = document.getElementById('appwriteProjectId')?.value.trim() || '';
    var apiKey = document.getElementById('appwriteApiKey')?.value.trim() || '';
    var habilitado = document.getElementById('appwriteHabilitado')?.checked || false;

    if (habilitado && (!projectId || !apiKey)) {
      showToast('error', 'Project ID y API Key son obligatorios para activar Appwrite');
      return;
    }

    localStorage.setItem('appwrite_endpoint', endpoint);
    localStorage.setItem('appwrite_project_id', projectId);
    localStorage.setItem('appwrite_api_key', apiKey);
    localStorage.setItem('appwrite_habilitado', habilitado ? 'true' : 'false');

    showToast('success', 'Configuración guardada. La aplicación se reiniciará...');
    setTimeout(function() {
      location.reload();
    }, 1000);
  }

  return {
    abrirModal: abrirModal,
    cerrarModal: cerrarModal,
    guardar: guardar
  };
})();

window.ConfigAppwrite = ConfigAppwrite;