/* ================================================================
   Raíz — MÓDULO: mesas.js (v6.5 – micro-insignias KDS y long-press)
   Propósito: Mapa de mesas con zonas dinámicas y colores. Obtiene
              los datos del Store y los ordena siempre por número.
   Novedades v6.5:
   - Micro-insignias de cocina (tenedor) y barra (copa) con colores
     según el estado de las comandas.
   - Long-press (400ms) para desplegar popover con desglose.
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
  let _badges = new Map();

  // Para long-press
  let _longPressTimer = null;
  let _longPressMesa = null;

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
      <div id="popoverContainer" style="position:fixed;z-index:9999;pointer-events:none;"></div>
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

  /**
   * Obtiene el estado mas avanzado de las comandas de una mesa
   * para cada destino (cocina/barra).
   * Retorna { cocina: 'pendiente'|'en-proceso'|'lista', barra: 'pendiente'|'en-proceso'|'lista' }
   */
  function _getEstadoComandas(mesaNumero) {
    const comandas = Store.getState().comandas || [];
    const estados = { cocina: 'pendiente', barra: 'pendiente' };

    comandas.forEach(c => {
      if (c.mesa != mesaNumero) return;

      let destino = c.destino;
      // Si es una comanda virtual, respetar su destino
      if (c.id && c.id.endsWith('_cocina')) destino = 'cocina';
      if (c.id && c.id.endsWith('_barra')) destino = 'barra';

      if (destino === 'cocina' || destino === 'ambos') {
        if (c.estado === 'lista') estados.cocina = 'lista';
        else if (c.estado === 'en-proceso' && estados.cocina !== 'lista') estados.cocina = 'en-proceso';
        else if (c.estado === 'nueva' && estados.cocina === 'pendiente') estados.cocina = 'pendiente';
      }
      if (destino === 'barra' || destino === 'ambos') {
        if (c.estado === 'lista') estados.barra = 'lista';
        else if (c.estado === 'en-proceso' && estados.barra !== 'lista') estados.barra = 'en-proceso';
        else if (c.estado === 'nueva' && estados.barra === 'pendiente') estados.barra = 'pendiente';
      }
    });

    return estados;
  }

  function _colorEstado(estado) {
    const colores = {
      'pendiente': '#9ca3af',
      'en-proceso': '#f59e0b',
      'lista': '#22c55e'
    };
    return colores[estado] || '#9ca3af';
  }

  function _renderGrid() {
    const grid = $id('mesasGrid');
    if (!grid) return;

    let mesas = Store.getState().mesas || [];
    mesas = mesas.filter(m => m.estado !== 'fusionada');
    if (_zonaActiva !== 'todas') {
      mesas = mesas.filter(m => m.zona === _zonaActiva);
    }
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

      const badgeInfo = _badges.get(mesa.numero);
      const badgeHTML = badgeInfo 
        ? `<span class="precarga-badge" onclick="event.stopPropagation(); Mesas.onPrecargaClick(${mesa.numero})" title="Precarga pendiente">
             <i class="fas fa-bell"></i> ${badgeInfo.cantidad}
           </span>` 
        : '';

      // Micro-insignias de cocina y barra
      const estados = _getEstadoComandas(mesa.numero);
      const microCocina = `<span class="micro-badge micro-cocina" style="background:${_colorEstado(estados.cocina)};" title="Cocina: ${estados.cocina}">
        <i class="fas fa-utensils"></i>
      </span>`;
      const microBarra = `<span class="micro-badge micro-barra" style="background:${_colorEstado(estados.barra)};" title="Barra: ${estados.barra}">
        <i class="fas fa-glass-martini-alt"></i>
      </span>`;

      // Contenido base
      let innerHTML = '';

      if (puedeSeleccionar) {
        const checked = _mesasSeleccionadas.has(mesa.numero) ? 'checked' : '';
        innerHTML = `
          <input type="checkbox" class="mesa-checkbox" data-num="${mesa.numero}" ${checked} 
                 onclick="event.stopPropagation(); Mesas.toggleSeleccionMesa('${mesa.numero}', this.checked)">
          <i class="fas ${ICONOS[mesa.estado] || 'fa-chair'} mesa-icon"></i>
          <strong class="mesa-numero">${mesa.numero}</strong>
          <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
          <div class="micro-insignias">${microCocina}${microBarra}</div>
          ${badgeHTML}
          <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>
        `;
      } else {
        let numeroMostrado = mesa.numero;
        let icono = ICONOS[mesa.estado] || 'fa-chair';
        
        if (mesa.esVirtual) {
          numeroMostrado = mesa.mesasFusionadas.join(' + ');
          icono = 'fa-object-group';
        }
        
        innerHTML = `
          <i class="fas ${icono} mesa-icon"></i>
          <strong class="mesa-numero">${numeroMostrado}</strong>
          <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
          ${mesa.esVirtual ? '<span class="mesa-virtual-badge"><i class="fas fa-link"></i> Unión</span>' : ''}
          <div class="micro-insignias">${microCocina}${microBarra}</div>
          ${badgeHTML}
          <span class="mesa-zona-badge" style="background:${colorZona}; color:white;">${mesa.zona}</span>
        `;
      }

      card.innerHTML = innerHTML;

      // Eventos de long-press y clic normal
      if (!puedeSeleccionar && !mesa.esVirtual) {
        card.addEventListener('mousedown', (e) => {
          if (e.target.closest('.precarga-badge') || e.target.closest('.micro-badge')) return;
          _longPressMesa = mesa.numero;
          _longPressTimer = setTimeout(() => {
            _mostrarPopover(mesa, card);
            _longPressTimer = null;
          }, 400);
        });

        card.addEventListener('mouseup', (e) => {
          if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
            if (_longPressMesa === mesa.numero && !e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge')) {
              EventBus.emit('mesa:seleccionada', mesa.numero);
            }
          }
          _longPressMesa = null;
        });

        card.addEventListener('mouseleave', () => {
          if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
            _longPressMesa = null;
          }
        });

        // Touch events
        card.addEventListener('touchstart', (e) => {
          if (e.target.closest('.precarga-badge') || e.target.closest('.micro-badge')) return;
          _longPressMesa = mesa.numero;
          _longPressTimer = setTimeout(() => {
            _mostrarPopover(mesa, card);
            _longPressTimer = null;
          }, 400);
        });

        card.addEventListener('touchend', (e) => {
          if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
            if (_longPressMesa === mesa.numero && !e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge')) {
              EventBus.emit('mesa:seleccionada', mesa.numero);
            }
          }
          _longPressMesa = null;
        });

        card.addEventListener('touchmove', () => {
          if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
            _longPressMesa = null;
          }
        });
      }

      // Clic normal para modo fusion
      if (puedeSeleccionar) {
        card.onclick = (e) => {
          if (e.target.type !== 'checkbox' && !e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge')) {
            const cb = card.querySelector('.mesa-checkbox');
            if (cb) {
              cb.checked = !cb.checked;
              Mesas.toggleSeleccionMesa(mesa.numero, cb.checked);
            }
          }
        };
      } else if (mesa.esVirtual) {
        card.onclick = (e) => {
          if (!e.target.closest('.precarga-badge') && !e.target.closest('.micro-badge')) {
            EventBus.emit('mesa:seleccionada', mesa.numero);
          }
        };
      }

      grid.appendChild(card);
    });
  }

  function _mostrarPopover(mesa, card) {
    const cont = $id('popoverContainer');
    if (!cont) return;

    const rect = card.getBoundingClientRect();
    const estados = _getEstadoComandas(mesa.numero);
    const comandas = Store.getState().comandas || [];
    const mesaComandas = comandas.filter(c => c.mesa == mesa.numero);

    let itemsHTML = '';
    mesaComandas.forEach(c => {
      const destino = (c.id && c.id.endsWith('_barra')) ? 'barra' :
                      (c.id && c.id.endsWith('_cocina')) ? 'cocina' :
                      c.destino;
      const icono = destino === 'barra' ? '🍹' : '🍳';
      (c.items || []).forEach(it => {
        itemsHTML += `<div style="font-size:11px;padding:2px 0;">${icono} ${it.nombre} x${it.qty} — <strong>${c.estado}</strong></div>`;
      });
    });

    cont.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid #2e2e42;border-radius:8px;padding:12px;color:#f1f5f9;font-size:12px;min-width:180px;pointer-events:auto;position:absolute;top:${rect.top}px;left:${rect.right + 8}px;z-index:9999;">
        <strong>Mesa ${mesa.numero}</strong>
        <div style="margin-top:4px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${_colorEstado(estados.cocina)};margin-right:4px;"></span> Cocina: ${estados.cocina}
        </div>
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${_colorEstado(estados.barra)};margin-right:4px;"></span> Barra: ${estados.barra}
        </div>
        <div style="margin-top:6px;border-top:1px solid #2e2e42;padding-top:4px;">${itemsHTML || '<span style="color:#9ca3af;">Sin comandas</span>'}</div>
        <button style="margin-top:8px;background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;float:right;" onclick="document.getElementById('popoverContainer').innerHTML='';">Cerrar</button>
      </div>
    `;
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

  function labelEstado(estado) {
    return LABELS[estado] || estado;
  }

  // ── Métodos para precargas ──
  function setBadge(numMesa, cantidad, precargaId) {
    _badges.set(numMesa, { cantidad, precargaId });
    _renderGrid();
  }

  function clearBadge(numMesa) {
    _badges.delete(numMesa);
    _renderGrid();
  }

  function onPrecargaClick(numMesa) {
    const badge = _badges.get(numMesa);
    if (badge) {
      EventBus.emit('mesa:badge_click', { mesa: numMesa, precargaId: badge.precargaId });
    }
  }

  // ── Listeners ──
  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('MESA') || action.type.startsWith('MESAS') || action.type.startsWith('COMANDA')) {
        _renderGrid();
      }
      if (action.type === 'CONFIG_INICIALIZAR') {
        _renderZoneButtons();
      }
    });

    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });

    EventBus.on('comanda:enviada', () => _renderGrid());
    EventBus.on('comanda:lista', () => _renderGrid());
    EventBus.on('mesa:actualizada', () => _renderGrid());
  }

  _initListeners();

  return {
    render,
    agregarMesa,
    labelEstado,
    toggleModoFusion,
    toggleSeleccionMesa,
    fusionarMesasSeleccionadas,
    setZona,
    setBadge,
    clearBadge,
    onPrecargaClick
  };
})();

window.Mesas = Mesas;