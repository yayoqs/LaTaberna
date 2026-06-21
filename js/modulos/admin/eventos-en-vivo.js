/* ================================================================
   La Taberna — MÓDULO: eventos-en-vivo.js (v1.2 – ES6 nativo)
   Propósito: Panel del animador para eventos en vivo (bingo, karaoke, votaciones).
              Usa DBAppwrite para persistir y EventBus para tiempo real.
              Compatible con carga como <script> normal y como módulo ES6.
   ================================================================ */

const EventosEnVivo = (() => {
  let _estadoActual = null;   // documento actual de eventos_en_vivo
  let _vistaActiva = false;

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if (document.getElementById('view-eventos-en-vivo')) return;

    const main = document.createElement('main');
    main.id = 'view-eventos-en-vivo';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-broadcast-tower"></i> Eventos en Vivo</h2>
        <div class="toolbar-actions">
          <select id="selTipoEvento">
            <option value="">— Seleccionar tipo —</option>
            <option value="bingo">Bingo</option>
            <option value="karaoke">Karaoke</option>
            <option value="votacion">Votación</option>
          </select>
          <button class="btn-primary" id="btnCrearEvento" onclick="EventosEnVivo.crearEvento()">
            <i class="fas fa-plus"></i> Nuevo Evento
          </button>
          <button class="btn-secondary" id="btnIniciar" style="display:none;" onclick="EventosEnVivo.cambiarEstado('activo')">
            <i class="fas fa-play"></i> Iniciar
          </button>
          <button class="btn-secondary" id="btnPausar" style="display:none;" onclick="EventosEnVivo.cambiarEstado('pausado')">
            <i class="fas fa-pause"></i> Pausar
          </button>
          <button class="btn-secondary" id="btnFinalizar" style="display:none;" onclick="EventosEnVivo.cambiarEstado('finalizado')">
            <i class="fas fa-stop"></i> Finalizar
          </button>
          <button class="btn-secondary" id="btnReiniciar" style="display:none;" onclick="EventosEnVivo.reiniciarEvento()">
            <i class="fas fa-undo"></i> Reiniciar
          </button>
        </div>
      </div>
      <div class="eventos-vivo-panel" id="panelEventoVivo">
        <div id="estadoEvento" class="estado-badge">Sin evento activo</div>
        <div id="zonaInteraccion" class="zona-interaccion"></div>
      </div>
    `;
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── AUTORIZACIÓN ────────────────────────────────────────── */
  function _usuarioAutorizado() {
    const rol = Auth.getRol();
    return ['artista', 'eventos', 'admin', 'master'].includes(rol);
  }

  /* ── RENDERIZADO PRINCIPAL ──────────────────────────────── */
  function render() {
    _asegurarVista();
    if (!_usuarioAutorizado()) {
      document.getElementById('panelEventoVivo').innerHTML =
        '<p style="color:var(--color-danger); padding:40px; text-align:center;">Acceso denegado. No tienes permisos para esta sección.</p>';
      return;
    }
    _actualizarUI();
  }

  function _actualizarUI() {
    const badge = document.getElementById('estadoEvento');
    const zona = document.getElementById('zonaInteraccion');
    const btnIniciar = document.getElementById('btnIniciar');
    const btnPausar = document.getElementById('btnPausar');
    const btnFinalizar = document.getElementById('btnFinalizar');
    const btnReiniciar = document.getElementById('btnReiniciar');
    const btnCrear = document.getElementById('btnCrearEvento');

    if (!badge || !zona) return;

    if (!_estadoActual) {
      badge.textContent = 'Sin evento activo';
      badge.className = 'estado-badge';
      zona.innerHTML = '<p style="color:var(--color-text-muted);">Crea un nuevo evento para comenzar.</p>';
      btnIniciar.style.display = 'none';
      btnPausar.style.display = 'none';
      btnFinalizar.style.display = 'none';
      btnReiniciar.style.display = 'none';
      btnCrear.style.display = '';
      return;
    }

    const { estado, tipo, datos } = _estadoActual;
    badge.textContent = `${tipo} — ${estado}`;
    badge.className = `estado-badge estado-${estado}`;

    btnCrear.style.display = 'none';
    btnIniciar.style.display = (estado === 'configuracion' || estado === 'pausado') ? '' : 'none';
    btnPausar.style.display = (estado === 'activo') ? '' : 'none';
    btnFinalizar.style.display = (estado !== 'finalizado') ? '' : 'none';
    btnReiniciar.style.display = (estado === 'finalizado') ? '' : 'none';

    switch (tipo) {
      case 'bingo':
        _renderInterfazBingo(datos, estado);
        break;
      case 'karaoke':
        _renderInterfazKaraoke(datos, estado);
        break;
      case 'votacion':
        _renderInterfazVotacion(datos, estado);
        break;
      default:
        zona.innerHTML = '';
    }
  }

  /* ── INTERFAZ BINGO ─────────────────────────────────────── */
  function _renderInterfazBingo(datos, estado) {
    const zona = document.getElementById('zonaInteraccion');
    const bolas = (datos && datos.bolas) || [];
    const ultima = bolas.length ? bolas[bolas.length - 1] : null;
    zona.innerHTML = `
      <div class="bingo-panel">
        ${ultima ? `<div class="ultima-bola">Última: <span>${ultima}</span></div>` : ''}
        <h3>Bolas cantadas</h3>
        <div class="bolas-grid">
          ${bolas.map(b => `<span class="bola">${b}</span>`).join('')}
        </div>
        <button class="btn-primary" onclick="EventosEnVivo.cantarBola()" ${estado !== 'activo' ? 'disabled' : ''}>
          <i class="fas fa-dice"></i> Cantar bola
        </button>
      </div>
    `;
  }

  /* ── INTERFAZ KARAOKE ───────────────────────────────────── */
  function _renderInterfazKaraoke(datos, estado) {
    const zona = document.getElementById('zonaInteraccion');
    const letra = (datos && datos.letra) || '';
    zona.innerHTML = `
      <div class="karaoke-panel">
        <label>Letra de la canción</label>
        <textarea id="letraKaraoke" rows="6" placeholder="Escribe la letra aquí...">${letra}</textarea>
        <div class="karaoke-botones">
          <button class="btn-primary" onclick="EventosEnVivo.actualizarLetra()" ${estado !== 'activo' ? 'disabled' : ''}>
            <i class="fas fa-sync-alt"></i> Actualizar letra
          </button>
          <button class="btn-secondary" onclick="EventosEnVivo.limpiarLetra()" ${estado !== 'activo' ? 'disabled' : ''}>
            <i class="fas fa-eraser"></i> Limpiar letra
          </button>
        </div>
      </div>
    `;
  }

  /* ── INTERFAZ VOTACIÓN ──────────────────────────────────── */
  function _renderInterfazVotacion(datos, estado) {
    const zona = document.getElementById('zonaInteraccion');
    const opciones = (datos && datos.opciones) || [];
    const resultados = (datos && datos.resultados) || {};
    const estadoActivo = estado === 'activo';

    let htmlOpciones = '';
    if (opciones.length === 0) {
      htmlOpciones = '<p style="color:var(--color-text-muted);">No hay opciones definidas.</p>';
    } else {
      htmlOpciones = '<ul class="votacion-lista">';
      opciones.forEach(op => {
        const votos = resultados[op] || 0;
        htmlOpciones += `<li>${op} — <strong>${votos}</strong> votos</li>`;
      });
      htmlOpciones += '</ul>';
    }

    zona.innerHTML = `
      <div class="votacion-panel">
        <h3>Opciones</h3>
        ${htmlOpciones}
        ${estadoActivo ? `
          <div class="votacion-agregar">
            <input type="text" id="nuevaOpcion" placeholder="Nueva opción">
            <button class="btn-secondary" onclick="EventosEnVivo.agregarOpcion()">
              <i class="fas fa-plus"></i> Agregar
            </button>
          </div>
        ` : ''}
        ${opciones.length > 0 && estadoActivo ? `
          <button class="btn-secondary" onclick="EventosEnVivo.eliminarUltimaOpcion()" style="margin-top:8px;">
            <i class="fas fa-trash"></i> Eliminar última
          </button>
        ` : ''}
        <p style="font-size:12px; color:var(--color-text-muted); margin-top:12px;">
          Los votos se reciben automáticamente desde los clientes.
        </p>
      </div>
    `;
  }

  /* ── ACCIONES ───────────────────────────────────────────── */
  async function crearEvento() {
    const tipo = document.getElementById('selTipoEvento').value;
    if (!tipo) {
      showToast('error', 'Selecciona un tipo de evento');
      return;
    }

    const datosIniciales = {
      tipo,
      estado: 'configuracion',
      datos: {},
      creadoPor: Auth.getNombre(),
      updatedAt: Date.now()
    };

    try {
      const doc = await DBAppwrite.crear('eventos_en_vivo', 'unique()', datosIniciales);
      showToast('success', `Evento de ${tipo} creado`);
      _estadoActual = doc;
      _actualizarUI();
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al crear evento:', error);
      showToast('error', 'No se pudo crear el evento');
    }
  }

  async function cambiarEstado(nuevoEstado) {
    if (!_estadoActual || !_estadoActual.id) return;
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        estado: nuevoEstado,
        updatedAt: Date.now()
      });
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al cambiar estado:', error);
      showToast('error', 'No se pudo cambiar el estado');
    }
  }

  async function reiniciarEvento() {
    if (!_estadoActual || !_estadoActual.id) return;
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        estado: 'configuracion',
        datos: {},
        updatedAt: Date.now()
      });
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al reiniciar evento:', error);
      showToast('error', 'No se pudo reiniciar el evento');
    }
  }

  /* ── BINGO ──────────────────────────────────────────────── */
  async function cantarBola() {
    if (!_estadoActual || _estadoActual.tipo !== 'bingo' || _estadoActual.estado !== 'activo') return;
    const bolas = (_estadoActual.datos && _estadoActual.datos.bolas) || [];
    if (bolas.length >= 90) {
      showToast('warning', 'Ya se cantaron todas las bolas');
      return;
    }
    let nuevaBola;
    do {
      nuevaBola = Math.floor(Math.random() * 90) + 1;
    } while (bolas.includes(nuevaBola));
    const nuevosDatos = { ..._estadoActual.datos, bolas: [...bolas, nuevaBola] };
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        datos: nuevosDatos,
        updatedAt: Date.now()
      });
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al cantar bola:', error);
      showToast('error', 'No se pudo cantar la bola');
    }
  }

  /* ── KARAOKE ───────────────────────────────────────────── */
  async function actualizarLetra() {
    if (!_estadoActual || _estadoActual.tipo !== 'karaoke' || _estadoActual.estado !== 'activo') return;
    const letra = document.getElementById('letraKaraoke')?.value || '';
    const nuevosDatos = { ..._estadoActual.datos, letra };
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        datos: nuevosDatos,
        updatedAt: Date.now()
      });
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al actualizar letra:', error);
      showToast('error', 'No se pudo actualizar la letra');
    }
  }

  async function limpiarLetra() {
    if (!_estadoActual || _estadoActual.tipo !== 'karaoke' || _estadoActual.estado !== 'activo') return;
    const nuevosDatos = { ..._estadoActual.datos, letra: '' };
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        datos: nuevosDatos,
        updatedAt: Date.now()
      });
      const ta = document.getElementById('letraKaraoke');
      if (ta) ta.value = '';
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al limpiar letra:', error);
      showToast('error', 'No se pudo limpiar la letra');
    }
  }

  /* ── VOTACIÓN ──────────────────────────────────────────── */
  async function agregarOpcion() {
    if (!_estadoActual || _estadoActual.tipo !== 'votacion' || _estadoActual.estado !== 'activo') return;
    const input = document.getElementById('nuevaOpcion');
    const opcion = input?.value.trim();
    if (!opcion) { showToast('warning', 'Escribe una opción'); return; }
    const opciones = (_estadoActual.datos && _estadoActual.datos.opciones) || [];
    if (opciones.includes(opcion)) { showToast('warning', 'Esa opción ya existe'); return; }
    const nuevosDatos = {
      ..._estadoActual.datos,
      opciones: [...opciones, opcion]
    };
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        datos: nuevosDatos,
        updatedAt: Date.now()
      });
      if (input) input.value = '';
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al agregar opción:', error);
      showToast('error', 'No se pudo agregar la opción');
    }
  }

  async function eliminarUltimaOpcion() {
    if (!_estadoActual || _estadoActual.tipo !== 'votacion' || _estadoActual.estado !== 'activo') return;
    const opciones = (_estadoActual.datos && _estadoActual.datos.opciones) || [];
    if (opciones.length === 0) { showToast('warning', 'No hay opciones para eliminar'); return; }
    const nuevasOpciones = opciones.slice(0, -1);
    const nuevosDatos = { ..._estadoActual.datos, opciones: nuevasOpciones };
    try {
      await DBAppwrite.actualizar('eventos_en_vivo', _estadoActual.id, {
        datos: nuevosDatos,
        updatedAt: Date.now()
      });
    } catch (error) {
      Logger.error('[EventosEnVivo] Error al eliminar opción:', error);
      showToast('error', 'No se pudo eliminar la opción');
    }
  }

  /* ── SUSCRIPCIÓN A TIEMPO REAL ──────────────────────────── */
  function _suscribirTiempoReal() {
    EventBus.on('eventos_en_vivo:actualizada', (doc) => {
      if (_vistaActiva && doc && doc.tipo) {
        _estadoActual = doc;
        _actualizarUI();
      }
    });
  }

  /* ── INICIALIZACIÓN ──────────────────────────────────────── */
  function _init() {
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'eventos-en-vivo') {
        _vistaActiva = true;
        render();
      } else {
        _vistaActiva = false;
      }
    });
    _suscribirTiempoReal();
  }

  _init();

  return {
    render,
    crearEvento,
    cambiarEstado,
    reiniciarEvento,
    cantarBola,
    actualizarLetra,
    limpiarLetra,
    agregarOpcion,
    eliminarUltimaOpcion
  };
})();

// Exponer al ámbito global para compatibilidad con el resto del sistema
window.EventosEnVivo = EventosEnVivo;

// Exportar como módulo ES6 para cargas con type="module"
export default EventosEnVivo;