/* ================================================================
   PubPOS — MÓDULO: eventos.js (Fase 2)
   Propósito: Gestión de eventos. Crear evento genera carpeta en
              Drive con presupuesto y menú automáticos.
   ================================================================ */
const Eventos = (() => {

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-eventos')) return;

    const main = document.createElement('main');
    main.id = 'view-eventos';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-calendar-alt"></i> Gestión de Eventos</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" onclick="Eventos.mostrarFormulario()"><i class="fas fa-plus"></i> Nuevo Evento</button>
          <button class="btn-secondary" onclick="Eventos.render()"><i class="fas fa-sync-alt"></i> Actualizar</button>
        </div>
      </div>
      <div class="reparto-table-wrap" style="padding:20px;">
        <table class="reparto-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Personas</th>
              <th>Lugar</th><th>Carpeta</th><th>Presupuesto</th><th>Menú</th>
            </tr>
          </thead>
          <tbody id="eventosBody"></tbody>
        </table>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDERIZAR LISTA ────────────────────────────────────── */
  async function render() {
    _asegurarVista();
    const tbody = $id('eventosBody');
    if (!tbody) return;

    try {
      // Obtener eventos desde el backend (lectura GET)
      const resp = await fetch(`${DB.urlSheets}?action=getEventos`, { mode: 'cors' });
      const data = await resp.json();
      const eventos = data.eventos || [];

      if (!eventos.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;">No hay eventos registrados</td></tr>`;
        return;
      }

      // Ordenar por fecha descendente
      eventos.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

      tbody.innerHTML = eventos.map(ev => `
        <tr>
          <td>${ev.fecha}</td>
          <td>${ev.tipo}</td>
          <td><strong>${ev.cliente}</strong></td>
          <td>${ev.personas || '-'}</td>
          <td>${ev.lugar || '-'}</td>
          <td><a href="${ev.carpetaUrl}" target="_blank" title="Abrir carpeta"><i class="fas fa-folder-open"></i> Ver</a></td>
          <td><a href="${ev.presupuestoUrl}" target="_blank" title="Abrir presupuesto"><i class="fas fa-file-invoice"></i> Presupuesto</a></td>
          <td><a href="${ev.menuUrl}" target="_blank" title="Abrir menú"><i class="fas fa-utensils"></i> Menú</a></td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('[Eventos] Error cargando:', e);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Error al cargar eventos</td></tr>`;
    }
  }

  /* ── FORMULARIO (MODAL) ───────────────────────────────────── */
  function mostrarFormulario() {
    let modal = $id('modalEvento');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEvento';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header">
            <h3><i class="fas fa-calendar-plus"></i> Nuevo Evento</h3>
            <button class="modal-close" onclick="Eventos.cerrarFormulario()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-small-body">
            <label>Fecha *</label><input type="date" id="evtFecha" value="${new Date().toISOString().slice(0,10)}">
            <label>Tipo de evento *</label>
            <select id="evtTipo">
              <option>Cumpleaños</option><option>Aniversario</option><option>Empresarial</option>
              <option>Despedida</option><option>Otro</option>
            </select>
            <label>Cliente *</label><input type="text" id="evtCliente" placeholder="Nombre del cliente o empresa">
            <label>Nº de personas</label><input type="number" id="evtPersonas" min="1" value="10">
            <label>Lugar</label><input type="text" id="evtLugar" placeholder="Salón principal, terraza, etc.">
            <label>Observaciones</label><input type="text" id="evtObs" placeholder="Detalles adicionales">
            <div class="modal-small-footer">
              <button class="btn-secondary" onclick="Eventos.cerrarFormulario()">Cancelar</button>
              <button class="btn-primary" onclick="Eventos.guardarEvento()"><i class="fas fa-save"></i> Crear Evento</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  }

  function cerrarFormulario() {
    const modal = $id('modalEvento');
    if (modal) modal.style.display = 'none';
  }

  /* ── GUARDAR EVENTO (LLAMA AL BACKEND) ──────────────────── */
  async function guardarEvento() {
    const fecha = $val('evtFecha');
    const tipo = $val('evtTipo');
    const cliente = $val('evtCliente');
    const personas = parseInt($id('evtPersonas')?.value) || 0;
    const lugar = $val('evtLugar');
    const observaciones = $val('evtObs');

    if (!fecha || !tipo || !cliente) {
      showToast('error', 'Completa fecha, tipo y cliente');
      return;
    }

    const datos = {
      id: 'evt_' + Date.now(),
      fecha,
      tipo,
      cliente,
      personas,
      lugar,
      observaciones
    };

    try {
      showToast('info', '<i class="fas fa-spinner fa-spin"></i> Creando carpeta y documentos...');
      const respuesta = await DB.llamar('crearCarpetaEvento', datos);
      if (respuesta.error) {
        showToast('error', `Error: ${respuesta.error}`);
      } else {
        showToast('success', `Evento creado. <a href="${respuesta.carpetaUrl}" target="_blank">Abrir carpeta</a>`);
        cerrarFormulario();
        render();
      }
    } catch (e) {
      console.error('[Eventos] Error guardando:', e);
      showToast('error', 'Error al crear el evento');
    }
  }

  /* ── SUSCRIBIR A EVENTOS DEL SISTEMA ───────────────────── */
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
  }
  _initEventListeners();

  return {
    render,
    mostrarFormulario,
    cerrarFormulario,
    guardarEvento
  };
})();

window.Eventos = Eventos;