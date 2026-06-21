/**
 * Módulo: Recetario (v1.0.2)
 * Propósito: Vista aislada de recetas para consulta del personal.
 * Sin conexión al WebSocket del KDS.
 * Corrección: usa window.DBAppwrite.listar directamente para permitir mocks en tests.
 */
const Recetario = (() => {
  const Logger = window.Logger;

  async function cargarRecetas() {
    try {
      return await window.DBAppwrite.listar('recetas');
    } catch (e) {
      Logger.error('[Recetario] Error al cargar recetas:', e);
      return [];
    }
  }

  function _asegurarVista() {
    if (document.getElementById('view-recetario')) return;
    const main = document.createElement('main');
    main.id = 'view-recetario';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-book"></i> Recetario</h2>
        <button class="btn-secondary" onclick="Recetario.render()">
          <i class="fas fa-sync-alt"></i> Actualizar
        </button>
      </div>
      <div id="recetarioGrid" class="recetario-grid"></div>
    `;
    document.body.appendChild(main);
  }

  async function render() {
    _asegurarVista();
    const grid = document.getElementById('recetarioGrid');
    if (!grid) return;

    const recetas = await cargarRecetas();
    if (!recetas.length) {
      grid.innerHTML = '<p style="color:var(--color-text-muted);">No hay recetas disponibles.</p>';
      return;
    }

    let html = '';
    for (const receta of recetas) {
      const producto = (window.DB?.productos || []).find(p => p.id === receta.productoId);
      const nombreProducto = producto ? producto.nombre : receta.productoId;
      const ingredientes = Array.isArray(receta.ingredientes) ? receta.ingredientes : 
                          (typeof receta.ingredientes === 'string' ? JSON.parse(receta.ingredientes) : []);

      let ingHTML = '';
      for (const ing of ingredientes) {
        const ingData = (window.DB?.ingredientes || []).find(i => i.id === ing.ingredienteId);
        const nombreIng = ingData ? ingData.nombre : ing.ingredienteId;
        const unidad = ingData ? ingData.unidad : '';
        ingHTML += `<li>${nombreIng}: ${ing.cantidad} ${unidad}</li>`;
      }

      html += `
        <div class="receta-card">
          <h3>${nombreProducto}</h3>
          ${receta.instrucciones ? `<p class="receta-instr">${receta.instrucciones}</p>` : ''}
          <ul>${ingHTML || '<li>Sin ingredientes</li>'}</ul>
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  Logger.info('[Recetario] Módulo inicializado.');
  return { render };
})();

window.Recetario = Recetario;