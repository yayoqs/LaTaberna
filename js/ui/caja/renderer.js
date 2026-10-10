/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja/renderer.js
   Versión: 1.5.2
   Propósito: Renderizado de la vista de caja: estructura, resúmenes,
              mesas, historial, panel lateral, búsqueda y navegación
              lateral con acciones por sección.
              v1.5.2: Navegación lateral con scroll, apertura de vistas
                      y modales; atajo Ctrl+K/Cmd+K para búsqueda.
   Dependencias:
     · js/lib/store.js
     · js/lib/eventBus.js
     · js/lib/command-bus.js
     · js/utils.js
     · js/ui/cobro.js
     · js/ui/tickets.js
     · js/ui/caja/arqueo.js
     · js/ui/caja/movimientos.js
     · js/ui/caja/historial.js
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { CommandBus } from '../../lib/command-bus.js';
import { formatearDinero, formatearHoraCorta, $id, mostrarToast } from '../../utils.js';
import { Cobro } from '../cobro.js';
import { Tickets } from '../tickets.js';
import { abrirArqueo } from './arqueo.js';
import { abrirMovimiento, abrirListaMovimientos } from './movimientos.js';
import { abrirHistorial } from './historial.js';

export function asegurarVista(signal) {
  const main = document.getElementById('view-caja');

  if (!main) {
    const nuevoMain = document.createElement('main');
    nuevoMain.id = 'view-caja';
    nuevoMain.className = 'view';
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(nuevoMain, referencia);
    _construirContenido(nuevoMain, signal);
    return;
  }

  if (main.querySelector('.caja-shell')) return;

  _construirContenido(main, signal);
}

function _construirContenido(contenedor, signal) {
  contenedor.innerHTML = `
    <div class="caja-shell" style="display:flex; flex:1; min-height:0;">
      <aside class="sidebar-left" id="cajaSidebarLeft">
        <div class="brand-row">
          <div class="brand-mark"><i class="fas fa-mug-hot"></i></div>
          <div class="brand-text">
            <div class="name">La Taberna</div>
            <div class="sub">Módulo Caja</div>
          </div>
        </div>
        <nav class="side-nav">
          <div class="side-nav-label">Operación</div>
          <div class="nav-item active" data-seccion="resumen"><i class="fas fa-grip"></i> Resumen del turno</div>
          <div class="nav-item" data-seccion="mesas"><i class="fas fa-chair"></i> Mesas</div>
          <div class="nav-item" data-seccion="pendientes"><i class="fas fa-clock"></i> Cobros pendientes <span class="nav-badge" id="badgePendientes">0</span></div>
          <div class="nav-item" data-seccion="historial"><i class="fas fa-receipt"></i> Historial de hoy</div>
          <div class="side-nav-label">Caja</div>
          <div class="nav-item" data-seccion="arqueo" id="navArqueo"><i class="fas fa-vault"></i> Arqueo / Cierre</div>
          <div class="nav-item" data-seccion="movimientos"><i class="fas fa-file-invoice"></i> Movimientos</div>
          <div class="nav-item" data-seccion="retiros"><i class="fas fa-hand-holding-dollar"></i> Retiros / Ingresos</div>
          <div class="side-nav-label">Sistema</div>
          <div class="nav-item" data-seccion="ajustes"><i class="fas fa-gear"></i> Ajustes de caja</div>
        </nav>
        <div class="shift-card">
          <div class="shift-top">
            <div class="avatar-circ" id="avatarCajero">CA</div>
            <div>
              <div class="shift-name" id="nombreCajero">Cajero</div>
              <div class="shift-role">Turno actual</div>
            </div>
          </div>
          <div class="shift-timer"><i class="fas fa-circle"></i> <span id="estadoTurno">Turno abierto</span></div>
          <button class="btn-close-shift" id="btnCerrarTurno"><i class="fas fa-lock"></i> Cerrar turno</button>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <button class="btn-icon hamburger" id="btnMenuCaja"><i class="fas fa-bars"></i></button>
          <div class="page-title-block">
            <h1 id="tituloSeccion">Resumen del turno</h1>
            <div class="crumb" id="subtituloSeccion">Caja · Turno actual</div>
          </div>
          <div class="search-wrap">
            <i class="fas fa-search"></i>
            <input type="text" id="busquedaCaja" placeholder="Buscar mesa, mozo o ticket... (Ctrl+K)">
            <div id="feedbackBusqueda" style="font-size:12px;color:var(--color-text-muted);margin-left:8px;white-space:nowrap;"></div>
          </div>
          <div class="topbar-right">
            <div class="date-chip"><i class="fas fa-calendar-day"></i> <span id="fechaActual"></span></div>
            <div class="bell-wrap">
              <button class="btn-icon" id="btnNotificaciones"><i class="fas fa-bell"></i></button>
              <span class="bell-dot" id="dotNotificaciones" style="display:none;"></span>
            </div>
            <div class="avatar-circ" id="avatarTopbar">CA</div>
          </div>
        </header>

        <div class="content-scroll" id="cajaContentScroll">
          <div class="stats-row" id="cajaStats"></div>

          <div class="section-head" id="seccionPendientes">
            <h2><i class="fas fa-clock"></i> Cobros pendientes <span class="count-tag" id="contadorPendientes">0</span></h2>
          </div>
          <div class="pend-scroll" id="cajaPendientes"></div>

          <div class="section-head" id="seccionMesas">
            <h2><i class="fas fa-chair"></i> Mesas</h2>
            <div class="view-toggle">
              <button class="active" data-vista="tarjetas" id="btnVistaTarjetas"><i class="fas fa-grip"></i> Tarjetas</button>
              <button data-vista="tabla" id="btnVistaTabla"><i class="fas fa-list"></i> Tabla</button>
            </div>
          </div>
          <div class="mesas-grid" id="cajaMesasGrid"></div>

          <div class="section-head" id="seccionHistorial">
            <h2><i class="fas fa-receipt"></i> Historial de hoy</h2>
          </div>
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="caja-table">
                <thead>
                  <tr>
                    <th>Mesa</th><th>Apertura</th><th>Cierre</th><th>Mozo</th>
                    <th>Pax</th><th>Ítems</th><th>Total</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody id="cajaBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <aside class="sidebar-right" id="cajaSidebarRight">
        <div class="rs-title">Resumen del turno</div>
        <div class="rs-block">
          <div class="rs-total-label">Total cobrado</div>
          <div class="rs-total-value" id="totalCobrado">$0</div>
          <div id="resumenMetodosPago"></div>
        </div>
        <div class="rs-block">
          <div class="rs-title" style="margin-bottom:10px;">Propinas acumuladas</div>
          <div class="rs-total-value" id="propinasAcumuladas" style="font-size:20px;color:var(--color-accent);">$0</div>
        </div>
        <div class="rs-block">
          <div class="rs-title" style="margin-bottom:6px;">Pendientes</div>
          <div id="miniPendientes"></div>
        </div>
        <div class="rs-title">Acciones rápidas</div>
        <div class="rs-quick-actions">
          <button class="qa-btn" id="btnNuevoCobro"><i class="fas fa-credit-card"></i> Nuevo cobro</button>
          <button class="qa-btn" id="btnRegistrarRetiro"><i class="fas fa-hand-holding-dollar"></i> Registrar retiro</button>
          <button class="qa-btn" id="btnArqueoParcial"><i class="fas fa-vault"></i> Arqueo parcial</button>
          <button class="qa-btn" id="btnReimprimirUltimo"><i class="fas fa-print"></i> Reimprimir último ticket</button>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="cajaSidebarBackdrop"></div>
    </div>
  `;

  document.getElementById('btnMenuCaja').addEventListener('click', () => {
    document.getElementById('cajaSidebarLeft').classList.toggle('open');
    document.getElementById('cajaSidebarBackdrop').classList.toggle('open');
  }, { signal });

  document.getElementById('cajaSidebarBackdrop').addEventListener('click', () => {
    document.getElementById('cajaSidebarLeft').classList.remove('open');
    document.getElementById('cajaSidebarBackdrop').classList.remove('open');
  }, { signal });

  document.getElementById('btnCerrarTurno').addEventListener('click', () => abrirArqueo(), { signal });

  document.getElementById('btnNuevoCobro').addEventListener('click', () => Cobro.abrirModalCierre(), { signal });

  document.getElementById('btnArqueoParcial').addEventListener('click', () => abrirArqueo(), { signal });

  document.getElementById('navArqueo').addEventListener('click', () => abrirArqueo(), { signal });

  document.getElementById('btnVistaTarjetas').addEventListener('click', () => {
    document.getElementById('btnVistaTarjetas').classList.add('active');
    document.getElementById('btnVistaTabla').classList.remove('active');
    document.getElementById('cajaMesasGrid').style.display = 'grid';
    document.querySelector('.table-wrap').style.display = 'block';
  }, { signal });

  document.getElementById('btnVistaTabla').addEventListener('click', () => {
    document.getElementById('btnVistaTabla').classList.add('active');
    document.getElementById('btnVistaTarjetas').classList.remove('active');
    document.getElementById('cajaMesasGrid').style.display = 'none';
    document.querySelector('.table-wrap').style.display = 'block';
  }, { signal });

  document.getElementById('btnReimprimirUltimo').addEventListener('click', () => Tickets.mostrarUltimo(), { signal });

  document.getElementById('busquedaCaja').addEventListener('input', (e) => _filtrarBusqueda(e.target.value), { signal });

  document.getElementById('btnRegistrarRetiro').addEventListener('click', () => abrirMovimiento(), { signal });

  document.getElementById('btnNotificaciones').addEventListener('click', () => {
    mostrarToast('info', 'Notificaciones de caja próximamente.');
  }, { signal });

  // Navegación lateral con acciones
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const seccion = item.dataset.seccion;

      // Historial abre vista dedicada, no activa el nav
      if (seccion === 'historial') {
        abrirHistorial();
        return;
      }

      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const titulo = document.getElementById('tituloSeccion');
      if (titulo) titulo.textContent = item.textContent.trim();

      _ejecutarAccionSeccion(seccion);
    }, { signal });
  });

  // Atajo de teclado Ctrl+K / Cmd+K para foco de búsqueda
  const onKeyDown = (e) => {
    const esAtajo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    if (esAtajo) {
      e.preventDefault();
      const input = document.getElementById('busquedaCaja');
      if (input) {
        input.focus();
        input.select();
      }
    }
  };
  document.addEventListener('keydown', onKeyDown, { signal });

  const ahora = new Date();
  const fechaFormateada = ahora.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('fechaActual').textContent = fechaFormateada;
}

function _ejecutarAccionSeccion(seccion) {
  const scrollEl = document.getElementById('cajaContentScroll');

  switch (seccion) {
    case 'resumen':
      if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      const busqueda = document.getElementById('busquedaCaja');
      if (busqueda) {
        busqueda.value = '';
        _filtrarBusqueda('');
      }
      break;

    case 'mesas':
      document.getElementById('seccionMesas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;

    case 'pendientes':
      document.getElementById('seccionPendientes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;

    case 'arqueo':
      abrirArqueo();
      break;

    case 'movimientos':
      abrirListaMovimientos();
      break;

    case 'retiros':
      abrirMovimiento();
      break;

    case 'ajustes':
      mostrarToast('info', 'Ajustes de caja próximamente. Contacta al administrador.');
      break;
  }
}

function _filtrarBusqueda(texto) {
  const query = texto.toLowerCase().trim();
  const mesasGrid = document.getElementById('cajaMesasGrid');
  const bodyEl = document.getElementById('cajaBody');
  let visibles = 0;

  if (mesasGrid) {
    const tarjetas = mesasGrid.querySelectorAll('.mesa-card');
    tarjetas.forEach(card => {
      const textoCard = card.textContent.toLowerCase();
      const mostrar = textoCard.includes(query);
      card.style.display = mostrar ? '' : 'none';
      if (mostrar) visibles++;
    });
  }

  if (bodyEl) {
    const filas = bodyEl.querySelectorAll('tr');
    filas.forEach(fila => {
      const textoFila = fila.textContent.toLowerCase();
      const mostrar = textoFila.includes(query);
      fila.style.display = mostrar ? '' : 'none';
      if (mostrar) visibles++;
    });
  }

  const feedbackEl = document.getElementById('feedbackBusqueda');
  if (!feedbackEl) return;
  if (!query) {
    feedbackEl.textContent = '';
  } else {
    feedbackEl.textContent = visibles > 0 ? `${visibles} resultado(s)` : 'Sin resultados';
  }
}

export function render() {
  asegurarVista();

  const estado = Store.obtenerEstado();
  const pedidos = estado.pedidos || [];
  const mesas = estado.mesas || [];

  const cerrados = pedidos.filter(p => p.estado === 'cerrada');
  const abiertos = pedidos.filter(p => p.estado !== 'cerrada' && p.estado !== 'cancelada');

  const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
  const promedio = cerrados.length ? totalVentas / cerrados.length : 0;

  const statsEl = document.getElementById('cajaStats');
  if (statsEl) {
    statsEl.innerHTML = _htmlStats(totalVentas, cerrados.length, promedio, abiertos.length);
  }

  const pedidosPendientes = pedidos.filter(p => {
    if (p.estado === 'cerrada') return false;
    const total = p.total || 0;
    const transacciones = Array.isArray(p.transacciones) ? p.transacciones : [];
    const cubierto = transacciones.reduce((s, t) => s + (t.monto || 0), 0);
    return cubierto > 0 && cubierto < total;
  });

  const contadorPendientes = document.getElementById('contadorPendientes');
  const badgePendientes = document.getElementById('badgePendientes');
  if (contadorPendientes) contadorPendientes.textContent = pedidosPendientes.length;
  if (badgePendientes) badgePendientes.textContent = pedidosPendientes.length;

  const pendientesEl = document.getElementById('cajaPendientes');
  if (pendientesEl) {
    pendientesEl.innerHTML = pedidosPendientes.length
      ? pedidosPendientes.map(p => {
          const total = p.total || 0;
          const cubierto = (p.transacciones || []).reduce((s, t) => s + (t.monto || 0), 0);
          const porcentaje = total > 0 ? Math.round((cubierto / total) * 100) : 0;
          return `
            <div class="pend-card">
              <div class="pend-mesa">Mesa ${p.mesa}</div>
              <div class="pend-names">${p.mozo || 'Mozo'} · ${p.comensales || 1} comensales</div>
              <div class="pend-bar-track"><div class="pend-bar-fill" style="width:${porcentaje}%"></div></div>
              <div class="pend-amounts"><span>Cubierto <b>${formatearDinero(cubierto)}</b></span><span>Total <b>${formatearDinero(total)}</b></span></div>
              <button class="pend-btn" data-mesa="${p.mesa}">Continuar cobro</button>
            </div>
          `;
        }).join('')
      : '<div style="color:var(--color-text-muted);font-size:13px;">No hay cobros pendientes.</div>';

    pendientesEl.querySelectorAll('.pend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mesa = mesas.find(m => m.numero == btn.dataset.mesa);
        if (mesa) Cobro.abrirModalCierre(mesa);
      });
    });
  }

  const mesasGrid = document.getElementById('cajaMesasGrid');
  if (mesasGrid) {
    mesasGrid.innerHTML = mesas.map(m => {
      const pedido = pedidos.find(p => p.id === m.pedidoId);
      const total = pedido ? pedido.total : 0;
      const comensales = pedido ? pedido.comensales : (m.comensales || 1);
      const items = pedido && Array.isArray(pedido.items) ? pedido.items.length : 0;
      return `
        <div class="mesa-card" data-mesa="${m.numero}">
          <div class="mesa-top">
            <div><div class="mesa-num-label">Mesa</div><div class="mesa-num">${m.numero}</div></div>
            <span class="status-pill ${m.estado}"><i class="fas ${_iconoEstado(m.estado)}"></i> ${_textoEstado(m.estado)}</span>
          </div>
          <div class="mesa-meta">
            <span><i class="fas fa-users"></i> ${comensales} pax</span>
            <span><i class="fas fa-utensils"></i> ${items} ítems</span>
          </div>
          <div class="mesa-total"><span>${formatearDinero(total)}</span><span class="mesa-mozo"><span class="mini-avatar">${(pedido?.mozo || '—').charAt(0)}</span> ${pedido?.mozo || '—'}</span></div>
        </div>
      `;
    }).join('');

    mesasGrid.querySelectorAll('.mesa-card').forEach(card => {
      card.addEventListener('click', () => {
        const mesa = mesas.find(m => m.numero == card.dataset.mesa);
        if (mesa) Cobro.abrirModalCierre(mesa);
      });
    });
  }

  const bodyEl = document.getElementById('cajaBody');
  if (bodyEl) {
    bodyEl.innerHTML = pedidos.length
      ? pedidos.map(p => _htmlFila(p)).join('')
      : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--color-text-muted)">No hay ventas registradas hoy. Las mesas cerradas aparecerán aquí.</td></tr>`;
  }

  const totalCobradoEl = document.getElementById('totalCobrado');
  if (totalCobradoEl) totalCobradoEl.textContent = formatearDinero(totalVentas);

  const metodosEl = document.getElementById('resumenMetodosPago');
  if (metodosEl) metodosEl.innerHTML = _htmlResumenMetodos(cerrados);

  const propinasEl = document.getElementById('propinasAcumuladas');
  if (propinasEl) propinasEl.textContent = formatearDinero(_calcularPropinas(cerrados));

  const miniPendientesEl = document.getElementById('miniPendientes');
  if (miniPendientesEl) {
    miniPendientesEl.innerHTML = pedidosPendientes.length
      ? pedidosPendientes.map(p => `<div class="mini-pend-row"><span class="who">Mesa ${p.mesa}</span><span class="amt">${formatearDinero(p.total - ((p.transacciones || []).reduce((s,t) => s + (t.monto||0),0)))}</span></div>`).join('')
      : '<div style="color:var(--color-text-muted);font-size:12px;">Sin pendientes</div>';
  }
}

function _htmlStats(totalVentas, cerradas, promedio, abiertas) {
  const tarjetas = [
    { icon: 'fa-sack-dollar', cls: 'ventas', label: 'Total ventas', value: formatearDinero(totalVentas) },
    { icon: 'fa-chair', cls: 'mesas', label: 'Mesas cerradas', value: cerradas },
    { icon: 'fa-chart-line', cls: 'prom', label: 'Ticket promedio', value: formatearDinero(promedio) },
    { icon: 'fa-door-open', cls: 'open', label: 'Mesas abiertas', value: abiertas }
  ];
  return tarjetas.map(t => `
    <div class="stat-card">
      <div class="stat-icon ${t.cls}"><i class="fas ${t.icon}"></i></div>
      <div>
        <div class="stat-label">${t.label}</div>
        <div class="stat-value">${t.value}</div>
      </div>
    </div>
  `).join('');
}

function _htmlResumenMetodos(cerrados) {
  const metodos = {
    'Efectivo': 0,
    'Débito': 0,
    'Crédito': 0,
    'Transferencia': 0
  };
  cerrados.forEach(p => {
    const transacciones = Array.isArray(p.transacciones) ? p.transacciones : [];
    transacciones.forEach(t => {
      if (metodos.hasOwnProperty(t.formaPago)) {
        metodos[t.formaPago] += (t.monto || 0);
      }
    });
    if (transacciones.length === 0) {
      metodos['Efectivo'] += (p.total || 0);
    }
  });
  const total = Object.values(metodos).reduce((s, v) => s + v, 0);
  return Object.entries(metodos).map(([nombre, monto]) => {
    const porcentaje = total > 0 ? Math.round((monto / total) * 100) : 0;
    const iconCls = nombre === 'Efectivo' ? 'efectivo' : nombre === 'Débito' ? 'debito' : nombre === 'Crédito' ? 'credito' : 'transferencia';
    const icono = nombre === 'Efectivo' ? 'fa-money-bill' : nombre === 'Débito' ? 'fa-credit-card' : nombre === 'Crédito' ? 'fa-credit-card' : 'fa-mobile-alt';
    return `
      <div class="pm-row">
        <div class="pm-icon ${iconCls}"><i class="fas ${icono}"></i></div>
        <div class="pm-info">
          <div class="pm-label"><span>${nombre}</span><span>${formatearDinero(monto)}</span></div>
          <div class="pm-track"><div class="pm-fill" style="width:${porcentaje}%;background:${nombre === 'Efectivo' ? 'var(--color-success)' : nombre === 'Débito' ? 'var(--color-info)' : nombre === 'Crédito' ? 'var(--color-primary)' : 'var(--color-info)'}"></div></div>
        </div>
      </div>
    `;
  }).join('');
}

function _calcularPropinas(cerrados) {
  return cerrados.reduce((s, p) => s + (p.propina || 0), 0);
}

function _htmlFila(p) {
  const items = Array.isArray(p.items) ? p.items : [];
  const cant = items.reduce((s, it) => s + (it.qty || 1), 0);
  const apertura = formatearHoraCorta(p.creadoEn || p.created_at);
  const cierre = p.estado === 'cerrada' ? formatearHoraCorta(p.actualizadoEn || p.updated_at) : '—';
  const estadoCls = p.estado === 'cerrada' ? 'cerrada' : p.estado === 'abierta' ? 'abierta' : p.estado;
  const estadoTexto = p.estado === 'cerrada' ? 'Cerrada' : p.estado === 'abierta' ? 'Abierta' : p.estado;
  return `
    <tr>
      <td><strong>Mesa ${p.mesa}</strong></td>
      <td>${apertura}</td>
      <td>${cierre}</td>
      <td>${p.mozo || '—'}</td>
      <td>${p.comensales || 1}</td>
      <td>${cant}</td>
      <td><strong style="color:var(--color-success)">${formatearDinero(p.total)}</strong></td>
      <td><span class="status-pill ${estadoCls}"><i class="fas ${_iconoEstado(p.estado)}"></i> ${estadoTexto}</span></td>
      <td><button class="row-icon-btn"><i class="fas fa-receipt"></i></button></td>
    </tr>
  `;
}

function _iconoEstado(estado) {
  switch (estado) {
    case 'libre': return 'fa-chair';
    case 'ocupada': return 'fa-utensils';
    case 'esperando': return 'fa-hourglass-half';
    case 'cuenta': return 'fa-file-invoice-dollar';
    case 'pagada': return 'fa-check-double';
    case 'cerrada': return 'fa-check-double';
    case 'abierta': return 'fa-door-open';
    case 'en_proceso': return 'fa-clock';
    default: return 'fa-chair';
  }
}

function _textoEstado(estado) {
  switch (estado) {
    case 'libre': return 'Libre';
    case 'ocupada': return 'Ocupada';
    case 'esperando': return 'Lista';
    case 'cuenta': return 'Cuenta';
    case 'pagada': return 'Pagada';
    case 'cerrada': return 'Cerrada';
    case 'abierta': return 'Abierta';
    case 'en_proceso': return 'En proceso';
    default: return estado;
  }
}