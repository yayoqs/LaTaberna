/* ================================================================
   PubPOS — MÓDULO: caja.js (v4.0 – reactivo al Store)
   ================================================================
   Cambios:
   • Eliminadas las llamadas a DB.fetchTodosPedidos() y las
     suscripciones individuales a EventBus.
   • Ahora se suscribe a Store y vuelve a renderizar cada vez que
     cambian los pedidos.
   • El botón de cierre de turno sigue usando App.cerrarTurnoApp().
   ================================================================ */
const Caja = (() => {

  /* ── CREACIÓN DINÁMICA DE LA VISTA ───────────────────────── */
  function _asegurarVista() {
    if ($id('view-caja')) return;

    const main = document.createElement('main');
    main.id = 'view-caja';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-cash-register"></i> Caja — Resumen del Turno</h2>
        <div class="toolbar-actions">
          <button class="btn-primary" onclick="App.cerrarTurnoApp()">
            <i class="fas fa-file-alt"></i> Cierre de Caja
          </button>
        </div>
      </div>
      <div class="caja-stats" id="cajaStats"></div>
      <div class="caja-table-wrap">
        <table class="caja-table">
          <thead>
            <tr><th>Mesa</th><th>Apertura</th><th>Cierre</th><th>Mozo</th><th>Pax</th><th>Ítems</th><th>Total</th><th>Estado</th></tr>
          </thead>
          <tbody id="cajaBody"></tbody>
        </table>
      </div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  /* ── RENDER ────────────────────────────────────────────── */
  function render() {
    _asegurarVista();
    const statsEl = $id('cajaStats');
    const bodyEl = $id('cajaBody');
    if (!statsEl || !bodyEl) return;

    const pedidos = Store.getState().pedidos;
    const cerrados = pedidos.filter(p => p.estado === 'cerrada');
    const abiertos = pedidos.filter(p => p.estado !== 'cerrada' && p.estado !== 'cancelada');

    const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
    const promedio = cerrados.length ? totalVentas / cerrados.length : 0;

    statsEl.innerHTML = _htmlStats(totalVentas, cerrados.length, promedio, abiertos.length);
    bodyEl.innerHTML = pedidos.length
      ? pedidos.map(_htmlFila).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted)">No hay registros en este turno</td></tr>`;
  }

  function _htmlStats(totalVentas, cerradas, promedio, abiertas) {
    const tarjetas = [
      { icon: 'fa-dollar-sign', label: 'Total Ventas', value: fmtMoney(totalVentas), color: 'var(--color-success)' },
      { icon: 'fa-chair', label: 'Mesas Cerradas', value: cerradas, color: 'var(--color-accent)' },
      { icon: 'fa-chart-line', label: 'Ticket Promedio', value: fmtMoney(promedio), color: 'var(--color-primary)' },
      { icon: 'fa-door-open', label: 'Mesas Abiertas', value: abiertas, color: 'var(--color-danger)' }
    ];
    return tarjetas.map(t => `
      <div class="caja-stat-card">
        <div class="caja-stat-icon ${t.cls || ''}"><i class="fas ${t.icon}"></i></div>
        <div><div class="caja-stat-label">${t.label}</div><div class="caja-stat-value" style="color:${t.color}">${t.value}</div></div>
      </div>`).join('');
  }

  function _htmlFila(p) {
    let items = [];
    try { items = JSON.parse(p.items || '[]'); } catch {}
    const cant = items.reduce((s, it) => s + it.qty, 0);
    const apertura = fmtHoraCorta(p.created_at);
    const cierre = p.estado === 'cerrada' ? fmtHoraCorta(p.updated_at) : '—';
    return `
      <tr>
        <td><strong>Mesa ${p.mesa}</strong></td>
        <td>${apertura}</td>
        <td>${cierre}</td>
        <td>${p.mozo || '—'}</td>
        <td>${p.comensales || 1}</td>
        <td>${cant}</td>
        <td><strong style="color:var(--color-success)">${fmtMoney(p.total)}</strong></td>
        <td><span class="status-pill ${p.estado}">${p.estado}</span></td>
      </tr>`;
  }

  /* ── SUSCRIPCIÓN AL STORE ──────────────────────────────── */
  function _initListeners() {
    // Solo reaccionar si cambian los pedidos en el Store
    Store.subscribe((state, action) => {
      // Solo re-renderizar si la acción afecta a los pedidos
      if (action.type.startsWith('PEDIDOS') || action.type.startsWith('PEDIDO')) {
        render();
      }
    });

    // La primera vez que la vista se activa, forzamos render
    EventBus.on('db:inicializada', render);
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'caja') render();
    });
  }
  _initListeners();

  return { render };
})();

window.Caja = Caja;