/* ================================================================
   PubPOS — MÓDULO: caja.js (v3 – exportar conectado a Drive)
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
          <button class="btn-primary" onclick="Caja.exportar()">
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

  // ================================================================
  // FASE 1: Exportar el cierre de caja a Google Drive (PDF)
  // Antes: solo mostraba un toast diciendo "próximamente".
  // Ahora: recoge los datos del turno, los envía al backend
  //        y muestra el enlace al PDF generado.
  // ================================================================
  async function exportar() {
    try {
      // ── 1. Recopilar los mismos datos que ya se muestran en pantalla ──
      const todos = await DB.fetchTodosPedidos();
      const cerrados = todos.filter(p => p.estado === 'cerrada');
      const abiertos = todos.filter(p => p.estado !== 'cerrada' && p.estado !== 'cancelada');

      const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
      const ticketPromedio = cerrados.length ? totalVentas / cerrados.length : 0;

      // ── 2. Construir el objeto que espera el backend ──
      const datosCierre = {
        resumen: {
          totalVentas,
          mesasCerradas: cerrados.length,
          ticketPromedio,
          mesasAbiertas: abiertos.length
        },
        pedidos: todos  // El backend filtrará solo los cerrados para el detalle
      };

      // ── 3. Mostrar feedback al usuario ──
      showToast('info', '<i class="fas fa-spinner fa-spin"></i> Generando informe de cierre...');

      // ── 4. Llamar al backend usando el nuevo método genérico ──
      const respuesta = await DB.llamar('generarCierre', datosCierre);

      // ── 5. Interpretar la respuesta ──
      if (respuesta.error) {
        showToast('error', `Error: ${respuesta.error}`);
      } else {
        // Mostrar enlace al PDF (se abre en pestaña nueva)
        showToast('success', `<i class="fas fa-check-circle"></i> PDF generado: <a href="${respuesta.pdfUrl}" target="_blank" style="color:var(--color-accent);">Abrir PDF</a>`);
        console.log('[Caja] PDF generado:', respuesta.pdfUrl);
      }
    } catch (e) {
      console.error('[Caja] Error exportando:', e);
      showToast('error', '<i class="fas fa-exclamation-circle"></i> Error al generar el cierre. ¿Está bien configurada la hoja AppConfig?');
    }
  }

  // Suscripción a eventos
  EventBus.on('pedidos:guardados', render);
  EventBus.on('pedido:cerrado', render);
  EventBus.on('db:inicializada', render);

  return { render, exportar };
})();

window.Caja = Caja;