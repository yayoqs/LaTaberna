/* ================================================================
   PubPOS — MÓDULO: caja.js (v3.3 – delegación de cierre unificada)
   ================================================================
   Cambios respecto a v3.2:
   • Eliminada la función local cerrarTurno() que duplicaba la
     lógica de cierre de turno.
   • El botón "Cierre de Caja" ahora invoca directamente a
     App.cerrarTurnoApp(), que contiene la verificación de permisos,
     la confirmación, la llamada a TurnoManager y los toasts
     correspondientes.
   • Esto garantiza que el cierre de turno se comporte igual desde
     cualquier vista (Caja, Config o la función global).
   • Se mantiene la suscripción a eventos para refrescar la tabla
     cuando el turno cambia.
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
          <!-- ⚡ El botón ahora usa la función unificada de App -->
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

  async function render() {
    _asegurarVista();
    const statsEl = $id('cajaStats');
    const bodyEl = $id('cajaBody');
    if (!statsEl || !bodyEl) return;

    try {
      const todos = await DB.fetchTodosPedidos();
      const cerrados = todos.filter(p => p.estado === 'cerrada');
      const abiertos = todos.filter(p => p.estado !== 'cerrada' && p.estado !== 'cancelada');

      const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
      const promedio = cerrados.length ? totalVentas / cerrados.length : 0;

      statsEl.innerHTML = _htmlStats(totalVentas, cerrados.length, promedio, abiertos.length);
      bodyEl.innerHTML = todos.length
        ? todos.map(_htmlFila).join('')
        : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted)">No hay registros en este turno</td></tr>`;

    } catch (e) {
      statsEl.innerHTML = `<div style="grid-column:1/-1;color:var(--color-text-muted);padding:20px"><i class="fas fa-exclamation-circle"></i> Error cargando datos de caja</div>`;
      console.warn('[Caja] Error:', e);
    }
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

  // ── EVENTOS ──────────────────────────────────────────────
  // Refrescar cuando cambien los pedidos o el turno
  EventBus.on('pedidos:guardados', render);
  EventBus.on('pedido:cerrado', render);
  EventBus.on('db:inicializada', render);
  EventBus.on('turno:iniciado', render);
  EventBus.on('turno:cerrado', render);

  // API pública: solo render, la acción de cierre se delegó a App.cerrarTurnoApp()
  return { render };
})();

window.Caja = Caja;