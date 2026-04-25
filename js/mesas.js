/* ================================================================
   PubPOS — MÓDULO: mesas.js (v3 – zonas con prefijo A/B)
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
  let _zonaActiva = 'todas';   // 'todas', 'salon', 'terraza'

  /* ── RENDERIZAR GRILLA ────────────────────────────────────── */
  function render() {
    const grid = $id('mesasGrid');
    if (!grid) return;

    if (typeof DB === 'undefined' || !DB.mesas) {
      setTimeout(render, 200);
      return;
    }

    // Asegurar que todas las mesas tengan zona y número con prefijo
    DB.mesas.forEach(m => {
      if (!m.zona) m.zona = 'salon';
      // Normalizar número: si no tiene prefijo, agregar 'A' para salón, 'B' para terraza
      if (typeof m.numero === 'number' || /^\d+$/.test(m.numero)) {
        const prefijo = m.zona === 'terraza' ? 'B' : 'A';
        m.numero = m.numero.toString() + prefijo;
      }
    });

    // Filtrar por zona si no es 'todas'
    let mesasVisibles = DB.mesas.filter(m => m.estado !== 'fusionada');
    if (_zonaActiva !== 'todas') {
      mesasVisibles = mesasVisibles.filter(m => m.zona === _zonaActiva);
    }

    grid.innerHTML = '';

    mesasVisibles.forEach(mesa => {
      const card = document.createElement('article');
      
      if (mesa.esVirtual) {
        card.className = `mesa-card mesa-virtual ${mesa.estado}`;
      } else {
        card.className = `mesa-card ${mesa.estado}`;
      }

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

  /* ── CAMBIO DE ZONA ───────────────────────────────────────── */
  function setZona(zona) {
    _zonaActiva = zona;
    render();
    document.querySelectorAll('.zona-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.zona === zona);
    });
  }

  /* ── MODO SELECCIÓN PARA FUSIÓN ───────────────────────────── */
  function toggleModoFusion() {
    _modoSeleccion = !_modoSeleccion;
    _mesasSeleccionadas.clear();
    render();
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
    const numeros = Array.from(_mesasSeleccionadas).sort((a,b) => a.localeCompare(b));
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

  /* ── AGREGAR NUEVA MESA CON PREFIJO DE ZONA ─────────────── */
  function agregarMesa() {
    if (typeof DB === 'undefined') return;
    const zona = _zonaActiva !== 'todas' ? _zonaActiva : 'salon';
    const prefijo = zona === 'salon' ? 'A' : (zona === 'terraza' ? 'B' : 'X');
    
    // Buscar el número más alto entre las mesas con el mismo prefijo
    const mesasMismaZona = DB.mesas.filter(m => 
      typeof m.numero === 'string' && m.numero.endsWith(prefijo)
    );
    let maxNum = 0;
    mesasMismaZona.forEach(m => {
      const numPart = parseInt(m.numero.slice(0, -1)); // quitar prefijo
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    });
    
    const nuevoNum = (maxNum + 1).toString() + prefijo;
    DB.mesas.push({ ...mesaVacia(nuevoNum), zona });
    DB.config.cantidadMesas = DB.mesas.filter(m => !m.esVirtual).length;
    DB.saveMesas();
    DB.saveConfig();
    render();
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