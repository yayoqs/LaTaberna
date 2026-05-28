/* ================================================================
   Raíz — MÓDULO: mesas.js (v6.3 – ordenamiento forzado)
   Propósito: Mapa de mesas con zonas dinámicas y colores. Obtiene
              los datos del Store y los ordena siempre por número.
   ================================================================ */
const Mesas = (() => {

  const ICONOS = {
    libre:     'fa-chair',
    ocupada:   'fa-utensils',
    esperando: 'fa-hourglass-half',
    cuenta:    'fa-file-invoice-dollar',
    fusionada: 'fa-link'
  };

  const LABELS = {
    libre:     'LIBRE',
    ocupada:   'OCUPADA',
    esperando: 'LISTA',
    cuenta:    'CUENTA',
    fusionada: 'FUSIONADA'
  };

  const ZONA_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

  let _modoSeleccion = false;
  let _mesasSeleccionadas = new Set();
  let _zonaActiva = 'todas';

  function _asegurarVista() {
    if ($id('view-mesas')) return;

    const main = document.createElement('main');
    main.id = 'view-mesas';
    main.className = 'view active';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-grip"></i> Salón — Mapa de Mesas</h2>
        <div class="toolbar-actions">
          <span class="legend">
            <span class="badge libre">Libre</span>
            <span class="badge ocupada">Ocupada</span>
            <span class="badge esperando">Lista</span>
            <span class="badge cuenta">Cuenta</span>
          </span>
          <div id="zonaButtonsContainer" style="display: flex; gap: 4px;"></div>
          <button class="btn-secondary" onclick="Mesas.agregarMesa()" data-rol="admin,master">
            <i class="fas fa-plus"></i> Nueva Mesa
          </button>
          <button id="btnFusionar" class="btn-secondary" onclick="Mesas.toggleModoFusion()" data-rol="mesero,admin,master">
            <i class="fas fa-object-group"></i> Fusionar Mesas
          </button>
          <button id="btnConfirmarFusion" class="btn-primary" onclick="Mesas.fusionarMesasSeleccionadas()" style="display:none;">
            <i class="fas fa-check"></i> Confirmar Fusión
          </button>
        </div>
      </div>
      <div id="mesasGrid" class="mesas-grid"></div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /** Renderiza los botones de zona y la grilla */
  function render() {
    _asegurarVista();
    _renderZoneButtons();
    _renderGrid();
  }

  function _renderZoneButtons() {
    const container = document.getElementById('zonaButtonsContainer');
    if (!container) return;

    const zonas = (Store.getState().config && Store.getState().config.zonas) || DB.config.zonas || [];
    let html = `
      <button class="nav-btn zona-btn ${_zonaActiva === 'todas' ? 'active' : ''}" 
              data-zona="todas" onclick="Mesas.setZona('todas')">
        <i class="fas fa-globe"></i> Todas
      </button>`;
    
    zonas.forEach(z => {
      html += `
        <button class="nav-btn zona-btn ${_zonaActiva === z.nombre ? 'active' : ''}" 
                data-zona="${z.nombre}" onclick="Mesas.setZona('${z.nombre}')">
          <i class="fas fa-map-marker-alt"></i> ${z.nombre.charAt(0).toUpperCase() + z.nombre.slice(1)}
        </button>`;
    });

    container.innerHTML = html;
  }

  function _getZonaColor(zonaNombre) {
    const zonas = (Store.getState().config && Store.getState().config.zonas) || DB.config.zonas || [];
    const idx = zonas.findIndex(z => z.nombre === zonaNombre);
    return ZONA_COLORS[idx >= 0 ? idx % ZONA_COLORS.length : 0];
  }

  /** Cambia la zona activa y re-renderiza la grilla */
  function setZona(zona) {
    _zonaActiva = zona;
    _renderGrid();
    _renderZoneButtons();
  }

  function _renderGrid() {
    const grid = $id('mesasGrid');
    if (!grid) return;

    let mesas = Store.getState().mesas || [];
    mesas = mesas.filter(m => m.estado !== 'fusionada');
    if (_zonaActiva !== 'todas') {
      mesas = mesas.filter(m => m.zona === _zonaActiva);
    }
    // Ordenar siempre por número
    mesas.sort((a, b) => a.numero - b.numero);

    grid.innerHTML = '';

    mesas.forEach(mesa => {
      const card = document.createElement('article');
      
      let clases = `mesa-card ${mesa.estado}`;
      if (mesa.esVirtual) clases += ' mesa-virtual';
      card.className = clases;

      const colorZona = _getZonaColor(mesa.zona || 'salon');
      card.style.borderLeft = `5px solid ${colorZona}`;
      card.style.background = `linear-gradient(135deg, ${colorZona}10 0%, var(--color-card) 100%)`;

      const puedeSeleccionar = _modoSeleccion && 
                               (mesa.estado === 'libre' || mesa.estado === 'ocupada' || mesa.estado === 'esperando') && 
                               !mesa.esVirtual;

      if (puedeSeleccionar) {
        const checked = _mesasSeleccionadas.has(mesa.numero) ? 'checked' : '';
        card.innerHTML = `
          <input type="checkbox" class="mesa-checkbox" data-num="${mesa.numero}" ${checked} 
                 onclick="event.stopPropagation(); Mesas.toggleSeleccionMesa('${mesa.numero}', this.checked)">
          <i class="fas ${ICONOS[mesa.estado] || 'fa-chair'} mesa-icon"></i>
          <strong class="mesa-numero">${mesa.numero}</strong>
          <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
          <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>
        `;
        card.onclick = (e) => {
          if (e.target.type !== 'checkbox') {
            const cb = card.querySelector('.mesa-checkbox');
            if (cb) {
              cb.checked = !cb.checked;
              Mesas.toggleSeleccionMesa(mesa.numero, cb.checked);
            }
          }
        };
      } else {
        card.onclick = () => EventBus.emit('mesa:seleccionada', mesa.numero);
        
        let numeroMostrado = mesa.numero;
        let icono = ICONOS[mesa.estado] || 'fa-chair';
        
        if (mesa.esVirtual) {
          numeroMostrado = mesa.mesasFusionadas.join(' + ');
          icono = 'fa-object-group';
        }
        
        card.innerHTML = `
          <i class="fas ${icono} mesa-icon"></i>
          <strong class="mesa-numero">${numeroMostrado}</strong>
          <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
          ${mesa.esVirtual ? '<span class="mesa-virtual-badge"><i class="fas fa-link"></i> Unión</span>' : ''}
          <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>
        `;
      }
      grid.appendChild(card);
    });
  }

  function toggleModoFusion() {
    _modoSeleccion = !_modoSeleccion;
    _mesasSeleccionadas.clear();
    _renderGrid();
    const btn = document.getElementById('btnFusionar');
    if (btn) {
      btn.innerHTML = _modoSeleccion ? '<i class="fas fa-times"></i> Cancelar' : '<i class="fas fa-object-group"></i> Fusionar Mesas';
    }
  }

  function toggleSeleccionMesa(num, isChecked) {
    if (isChecked) {
      _mesasSeleccionadas.add(num);
    } else {
      _mesasSeleccionadas.delete(num);
    }
  }

  function fusionarMesasSeleccionadas() {
    if (_mesasSeleccionadas.size < 2) {
      showToast('warning', 'Selecciona al menos dos mesas para fusionar.');
      return;
    }
    const numeros = Array.from(_mesasSeleccionadas).sort((a,b) => a - b);
    const mozo = $id('mozoActivo')?.value || 'Mozo';
    const mesaVirtual = DB.fusionarMesas(numeros, mozo);
    if (mesaVirtual) {
      showToast('success', `Mesas ${numeros.join(', ')} fusionadas.`);
      toggleModoFusion();
      EventBus.emit('mesa:seleccionada', mesaVirtual.numero);
    } else {
      showToast('error', 'No se pudo fusionar. Verifica que las mesas estén en un estado válido.');
    }
  }

  /** Agrega una nueva mesa usando el comando correspondiente */
  function agregarMesa() {
    if (typeof DB === 'undefined') return;
    const zona = _zonaActiva !== 'todas' ? _zonaActiva : (DB.config.zonas[0]?.nombre || 'salon');
    const mesas = Store.getState().mesas;
    const maxNum = mesas.reduce((max, m) => Math.max(max, m.numero || 0), 0);
    const nuevoNum = maxNum + 1;

    if (typeof CommandBus !== 'undefined') {
      CommandBus.ejecutar({
        type: 'agregarMesa',
        datos: { numero: nuevoNum, zona }
      }).then(resultado => {
        if (resultado.exito) {
          showToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
        } else {
          showToast('error', resultado.error || 'Error al agregar mesa');
        }
      }).catch(err => {
        Logger.error('[Mesas] Error al ejecutar comando agregarMesa:', err);
        showToast('error', 'Error inesperado al agregar mesa');
      });
    } else {
      const nuevaMesa = { ...mesaVacia(nuevoNum, zona) };
      Store.dispatch({ type: 'MESA_AGREGAR', payload: nuevaMesa });
      DB.mesas.push(nuevaMesa);
      DB.saveMesas();
      showToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
    }
  }

  /**
   * Devuelve la etiqueta legible para un estado de mesa.
   * @param {string} estado
   * @returns {string}
   */
  function labelEstado(estado) {
    return LABELS[estado] || estado;
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('MESA') || action.type.startsWith('MESAS')) {
        _renderGrid();
      }
      if (action.type === 'CONFIG_INICIALIZAR') {
        _renderZoneButtons();
      }
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
  }

  _initListeners();

  return {
    render,
    agregarMesa,
    labelEstado,
    toggleModoFusion,
    toggleSeleccionMesa,
    fusionarMesasSeleccionadas,
    setZona
  };
})();

window.Mesas = Mesas;