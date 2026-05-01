/* ================================================================
   PubPOS — MÓDULO: personal.js (Fase 3)
   Propósito: Gestión de personal. Alta de empleado genera carpeta
              en Drive con subcarpetas de documentos.
   ================================================================ */
const Personal = (() => {

  function _asegurarVista() {
    if ($id('view-personal')) return;

    const main = document.createElement('main');
    main.id = 'view-personal';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-id-card"></i> Gestión de Personal</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" onclick="Personal.mostrarFormulario()"><i class="fas fa-user-plus"></i> Nuevo Empleado</button>
          <button class="btn-secondary" onclick="Personal.render()"><i class="fas fa-sync-alt"></i> Actualizar</button>
        </div>
      </div>
      <div class="reparto-table-wrap" style="padding:20px;">
        <table class="reparto-table">
          <thead>
            <tr>
              <th>Nombre</th><th>Email</th><th>Puesto</th><th>Fecha Ingreso</th>
              <th>Carpeta</th><th>Contrato</th>
            </tr>
          </thead>
          <tbody id="personalBody"></tbody>
        </table>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  async function render() {
    _asegurarVista();
    const tbody = $id('personalBody');
    if (!tbody) return;

    try {
      const resp = await fetch(`${DB.urlSheets}?action=getEmpleados`, { mode: 'cors' });
      const data = await resp.json();
      const empleados = data.empleados || [];

      if (!empleados.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">No hay empleados registrados</td></tr>`;
        return;
      }

      empleados.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));

      tbody.innerHTML = empleados.map(emp => `
        <tr>
          <td><strong>${emp.nombre}</strong></td>
          <td>${emp.email || '-'}</td>
          <td>${emp.puesto || '-'}</td>
          <td>${emp.fechaIngreso || '-'}</td>
          <td><a href="${emp.carpetaUrl}" target="_blank" title="Abrir carpeta"><i class="fas fa-folder-open"></i> Ver</a></td>
          <td>${emp.docContratoUrl ? `<a href="${emp.docContratoUrl}" target="_blank"><i class="fas fa-file-contract"></i> Contrato</a>` : '-'}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('[Personal] Error cargando:', e);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar empleados</td></tr>`;
    }
  }

  function mostrarFormulario() {
    let modal = $id('modalPersonal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalPersonal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header">
            <h3><i class="fas fa-user-plus"></i> Nuevo Empleado</h3>
            <button class="modal-close" onclick="Personal.cerrarFormulario()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Nombre completo *</label><input type="text" id="empNombre" placeholder="Nombre y apellido">
            <label>Email</label><input type="email" id="empEmail" placeholder="correo@ejemplo.com">
            <label>Puesto</label><input type="text" id="empPuesto" placeholder="Camarero, Cocinero, etc.">
            <label>Fecha de ingreso</label><input type="date" id="empFechaIngreso" value="${new Date().toISOString().slice(0,10)}">
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Personal.cerrarFormulario()">Cancelar</button>
              <button class="btn-primary" onclick="Personal.guardarEmpleado()"><i class="fas fa-save"></i> Guardar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  }

  function cerrarFormulario() {
    const modal = $id('modalPersonal');
    if (modal) modal.style.display = 'none';
  }

  async function guardarEmpleado() {
    const nombre = $val('empNombre');
    const email = $val('empEmail');
    const puesto = $val('empPuesto');
    const fechaIngreso = $val('empFechaIngreso');

    if (!nombre) {
      showToast('error', 'El nombre es obligatorio');
      return;
    }

    const datos = {
      id: 'emp_' + Date.now(),
      nombre,
      email,
      puesto,
      fechaIngreso
    };

    try {
      showToast('info', '<i class="fas fa-spinner fa-spin"></i> Creando carpeta del empleado...');
      const respuesta = await DB.llamar('crearCarpetaEmpleado', datos);
      if (respuesta.error) {
        showToast('error', `Error: ${respuesta.error}`);
      } else {
        showToast('success', `Empleado creado. <a href="${respuesta.carpetaUrl}" target="_blank">Abrir carpeta</a>`);
        cerrarFormulario();
        render();
      }
    } catch (e) {
      console.error('[Personal] Error guardando:', e);
      showToast('error', 'Error al crear el empleado');
    }
  }

  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
  }
  _initEventListeners();

  return {
    render,
    mostrarFormulario,
    cerrarFormulario,
    guardarEmpleado
  };
})();

window.Personal = Personal;