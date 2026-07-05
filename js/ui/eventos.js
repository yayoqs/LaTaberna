/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/eventos.js
   Versión: 1.0.5
   Propósito: Vista de gestión de eventos administrativos.
              v1.0.5: implementa ciclo de vida activar/limpiar.
   ================================================================ */

import { DB } from '../db.js';
import { Auth } from '../auth.js';
import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { showToast } from '../utils.js';

const Eventos = (() => {

  let _abortController = null;
  let _desuscripciones = [];

  function _asegurarVista() {
    let main = document.getElementById('view-eventos');
    if (main && main.querySelector('.view-toolbar')) return;
    
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-eventos';
      main.className = 'view';
      const referencia = document.getElementById('toastContainer') || document.body.lastChild;
      document.body.insertBefore(main, referencia);
    }

    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-calendar-alt"></i> Gestión de Eventos</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" id="btnNuevoEvento" data-rol="artista,eventos,admin,master">
            <i class="fas fa-plus"></i> Nuevo Evento
          </button>
          <button class="btn-secondary" id="btnActualizarEventos">
            <i class="fas fa-sync-alt"></i> Actualizar
          </button>
        </div>
      </div>
      <div class="reparto-table-wrap" style="padding:20px;">
        <table class="reparto-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Personas</th>
              <th>Lugar</th><th>Artista</th><th>Carpeta</th><th>Presupuesto</th><th>Menú</th>
            </tr>
          </thead>
          <tbody id="eventosBody"></tbody>
        </table>
      </div>
    `;

    const { signal } = _abortController || {};
    document.getElementById('btnNuevoEvento').addEventListener('click', mostrarFormulario, { signal });
    document.getElementById('btnActualizarEventos').addEventListener('click', render, { signal });
  }

  async function render() {
    _asegurarVista();
    const tbody = document.getElementById('eventosBody');
    if (!tbody) return;

    try {
      const respuesta = await DB.llamar('getEventos', {});
      let eventos = respuesta.eventos || [];

      if (Auth.esArtista()) {
        const nombreArtista = Auth.getNombre();
        eventos = eventos.filter(ev => ev.artistaId === nombreArtista);
      }

      if (!eventos.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;">No hay eventos registrados</td></tr>`;
        return;
      }

      eventos.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

      tbody.innerHTML = eventos.map(ev => `
        <tr>
          <td>${ev.fecha}</td>
          <td>${ev.tipo}</td>
          <td><strong>${ev.cliente}</strong></td>
          <td>${ev.personas || '-'}</td>
          <td>${ev.lugar || '-'}</td>
          <td>${ev.artistaId || '-'}</td>
          <td><a href="${ev.carpetaUrl}" target="_blank" title="Abrir carpeta"><i class="fas fa-folder-open"></i> Ver</a></td>
          <td><a href="${ev.presupuestoUrl}" target="_blank" title="Abrir presupuesto"><i class="fas fa-file-invoice"></i> Presupuesto</a></td>
          <td><a href="${ev.menuUrl}" target="_blank" title="Abrir menú"><i class="fas fa-utensils"></i> Menú</a></td>
        </tr>
      `).join('');
    } catch (e) {
      Logger.error('[Eventos] Error cargando:', e);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Error al cargar eventos</td></tr>`;
    }
  }

  function mostrarFormulario() {
    let modal = document.getElementById('modalEvento');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalEvento';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header">
            <h3><i class="fas fa-calendar-plus"></i> Nuevo Evento</h3>
            <button class="modal-close" id="btnCerrarFormularioEvento"><i class="fas fa-times"></i></button>
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
              <button class="btn-secondary" id="btnCancelarFormularioEvento">Cancelar</button>
              <button class="btn-primary" id="btnGuardarEvento"><i class="fas fa-save"></i> Crear Evento</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btnCerrarFormularioEvento').addEventListener('click', cerrarFormulario);
      document.getElementById('btnCancelarFormularioEvento').addEventListener('click', cerrarFormulario);
      document.getElementById('btnGuardarEvento').addEventListener('click', guardarEvento);
    }
    modal.style.display = 'flex';
  }

  function cerrarFormulario() {
    const modal = document.getElementById('modalEvento');
    if (modal) modal.style.display = 'none';
  }

  async function guardarEvento() {
    const fecha = document.getElementById('evtFecha').value.trim();
    const tipo = document.getElementById('evtTipo').value;
    const cliente = document.getElementById('evtCliente').value.trim();
    const personas = parseInt(document.getElementById('evtPersonas')?.value) || 0;
    const lugar = document.getElementById('evtLugar').value.trim();
    const observaciones = document.getElementById('evtObs').value.trim();

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
      observaciones,
      artistaId: Auth.getNombre()
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
      Logger.error('[Eventos] Error guardando:', e);
      showToast('error', 'Error al crear el evento');
    }
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();

    _desuscripciones.push(EventBus.on('db:inicializada', render));
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
  }

  // ── Inicialización ──
  activar();

  return {
    activar,
    limpiar,
    render,
    mostrarFormulario,
    cerrarFormulario,
    guardarEvento
  };
})();

export { Eventos };