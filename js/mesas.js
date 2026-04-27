/* ================================================================
   PubPOS — MÓDULO: mesas.js (v4 – botones de zona dinámicos)
   Propósito: Renderizar la grilla de mesas. Ahora los botones de
              filtro por zona se crean según DB.config.zonas, eliminando
              los botones estáticos del HTML.
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

  let _modoSeleccion = false;
  let _mesasSeleccionadas = new Set();
  let _zonaActiva = 'todas';   // 'todas' o nombre de zona

  /* ── RENDERIZAR GRILLA ────────────────────────────────────── */
  function render() {
    _renderZoneButtons();      // ← genera los botones según DB.config.zonas
    _renderGrid();
  }

  /* ── BOTONES DE ZONA (DINÁMICOS) ─────────────────────────── */
  function _renderZoneButtons() {
    const container = document.getElementById('zonaButtonsContainer');
    if (!container) return;

    const zonas = DB.config.zonas || [];
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

  /* ── CAMBIO DE ZONA ───────────────────────────────────────── */
  function setZona(zona) {
    _zonaActiva = zona;
    _renderGrid();           // solo re-renderiza la grilla
    _renderZoneButtons();    // actualiza las clases 'active'
  }

  /* ── RENDERIZAR LA GRILLA DE MESAS ───────────────────────── */
  function _renderGrid() {
    const grid = $id('mesasGrid');
    if (!grid) return;

    if (typeof DB === 'undefined' || !DB.mesas) {
      setTimeout(_renderGrid, 200);
      return;
    }

    // Filtrar por zona
    let mesasVisibles = DB.mesas.filter(m => m.estado !== 'fusionada');
    if (_zonaActiva !== 'todas') {
      mesasVisibles = mesasVisibles.filter(m => m.zona === _zonaActiva);
    }

    grid.innerHTML = '';

    mesasVisibles.forEach(mesa => {
      const card = document.createElement('article');
      
      let clases = `mesa-card ${mesa.estado}`;
      if (mesa.esVirtual) clases += ' mesa-virtual';
      clases += ` zona-${mesa.zona || 'salon'}`;
      card.className = clases;

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
          <span class="mesa-zona-badge">${mesa.zona}</span>
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
          <span class="mesa-zona-badge">${mesa.zona}</span>
        `;
      }
      grid.appendChild(card);
    });

    const confirmBtn = document.getElementById('btnConfirmarFusion');
    if (confirmBtn) {
      confirmBtn.style.display = _modoSeleccion ? 'inline-flex' : 'none';
    }
  }

  /* ── MODO SELECCIÓN PARA FUSIÓN ───────────────────────────── */
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
      showToast('warning', 'Seleccioná al menos dos mesas para fusionar.');
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
      showToast('error', 'No se pudo fusionar. Verificá que las mesas estén en un estado válido.');
    }
  }

  /* ── AGREGAR NUEVA MESA (número secuencial global) ──────────── */
  function agregarMesa() {
    if (typeof DB === 'undefined') return;
    const zona = _zonaActiva !== 'todas' ? _zonaActiva : (DB.config.zonas[0]?.nombre || 'salon');
    const maxNum = DB.mesas.reduce((max, m) => Math.max(max, m.numero || 0), 0);
    const nuevoNum = maxNum + 1;

    DB.mesas.push({ ...mesaVacia(nuevoNum, zona) });
    DB.saveMesas();
    _renderGrid();
    showToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
  }

  function labelEstado(estado) {
    return LABELS[estado] || estado;
  }

  /* ── SUSCRIPCIÓN A EVENTOS ───────────────────────────────── */
  function _initEventListeners() {
    EventBus.on('mesas:guardadas', render);
    EventBus.on('db:inicializada', render);
    EventBus.on('config:guardada', render);
    EventBus.on('mesa:actualizada', render);
    EventBus.on('comanda:lista', () => render());
  }

  _initEventListeners();

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