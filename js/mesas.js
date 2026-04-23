/* ================================================================
   PubPOS — MÓDULO: mesas.js
   Propósito: Gestión de la grilla de mesas, fusión y creación.
   Dependencias: DB, EventBus, Auth, utils.js
   ----------------------------------------------------------------
   NOTA SOBRE ROLES:
   • Los botones "Nueva Mesa" y "Fusionar Mesas" tienen atributos
     data-rol en el HTML (admin,master para nueva mesa; mesero,admin,master para fusión).
     Auth.aplicarRestriccionesUI() se encarga de ocultarlos según el rol.
   • La lógica interna no necesita más verificaciones porque el acceso
     a estas funciones ya está restringido por la UI y porque los eventos
     solo se disparan desde botones visibles.
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

  /* ── RENDERIZAR GRILLA ────────────────────────────────────── */
  function render() {
    const grid = $id('mesasGrid');
    if (!grid) return;

    if (typeof DB === 'undefined' || !DB.mesas) {
      setTimeout(render, 200);
      return;
    }

    grid.innerHTML = '';

    const mesasVisibles = DB.mesas.filter(m => m.estado !== 'fusionada');

    mesasVisibles.forEach(mesa => {
      const card = document.createElement('article');
      
      if (mesa.esVirtual) {
        card.className = `mesa-card mesa-virtual ${mesa.estado}`;
      } else {
        card.className = `mesa-card ${mesa.estado}`;
      }

      // Modo selección: checkbox en mesas libres, ocupadas o esperando
      const puedeSeleccionar = _modoSeleccion && 
                               (mesa.estado === 'libre' || mesa.estado === 'ocupada' || mesa.estado === 'esperando') && 
                               !mesa.esVirtual;

      if (puedeSeleccionar) {
        const checked = _mesasSeleccionadas.has(mesa.numero) ? 'checked' : '';
        const extraClass = mesa.estado !== 'libre' ? 'ocupada-check' : '';
        card.innerHTML = `
          <input type="checkbox" class="mesa-checkbox ${extraClass}" data-num="${mesa.numero}" ${checked} 
                 onclick="event.stopPropagation(); Mesas.toggleSeleccionMesa(${mesa.numero}, this.checked)">
          <i class="fas ${ICONOS[mesa.estado] || 'fa-chair'} mesa-icon"></i>
          <strong class="mesa-numero">${mesa.numero}</strong>
          <span class="mesa-estado-label">${LABELS[mesa.estado] || mesa.estado}</span>
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
        // Comportamiento normal: clic abre mesa
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
        `;
      }
      grid.appendChild(card);
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
    const confirmBtn = document.getElementById('btnConfirmarFusion');
    if (confirmBtn) {
      confirmBtn.style.display = _modoSeleccion ? 'inline-flex' : 'none';
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

    const numeros = Array.from(_mesasSeleccionadas).sort((a,b) => a-b);
    const mozo = $id('mozoActivo')?.value || 'Mozo';
    
    const mesaVirtual = DB.fusionarMesas(numeros, mozo);
    if (mesaVirtual) {
      showToast('success', `Mesas ${numeros.join(', ')} fusionadas.`);
      toggleModoFusion();
      // Opcional: abrir la mesa virtual automáticamente
      EventBus.emit('mesa:seleccionada', mesaVirtual.numero);
    } else {
      showToast('error', 'No se pudo fusionar. Verificá que las mesas estén en un estado válido.');
    }
  }

  /* ── AGREGAR NUEVA MESA ───────────────────────────────────── */
  function agregarMesa() {
    if (typeof DB === 'undefined') return;
    const mesasReales = DB.mesas.filter(m => !m.esVirtual);
    const nuevoNum = mesasReales.length + 1;
    DB.mesas.push(mesaVacia(nuevoNum));
    DB.config.cantidadMesas = nuevoNum;
    DB.saveMesas();
    DB.saveConfig();
    render();
    showToast('success', `Mesa ${nuevoNum} agregada`);
  }

  function labelEstado(estado) {
    return LABELS[estado] || estado;
  }

  /* ── SUSCRIPCIÓN A EVENTOS ───────────────────────────────── */
  function _initEventListeners() {
    // Asegurar que el botón de confirmar fusión esté oculto al inicio
    const confirmBtn = document.getElementById('btnConfirmarFusion');
    if (confirmBtn) confirmBtn.style.display = 'none';
    
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
    fusionarMesasSeleccionadas
  };

})();

window.Mesas = Mesas;