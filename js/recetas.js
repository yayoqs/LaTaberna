/* ================================================================
   PubPOS — MÓDULO: recetas.js (v1)
   Propósito: Vista de recetas para cocina y barra.
   - Muestra la tabla de productos con sus recetas.
   - Filtra automáticamente por destino según el rol.
   - Botón "Editar" que abre el modal de Despensa para asignar ingredientes.
   ================================================================ */

const Recetas = (() => {

  // ── RENDERIZAR LA TABLA ──────────────────────────────────
  function render() {
    const tbody = document.getElementById('recetasBody');
    if (!tbody) return;

    const rol = Auth.getRol();
    let productos = DB.productos.filter(p => p.activo !== false);

    // Filtro por rol: cocina solo ve cocina/ambos, barra solo ve barra/ambos
    if (rol === 'cocina') {
      productos = productos.filter(p => p.destino === 'cocina' || p.destino === 'ambos');
    } else if (rol === 'barra') {
      productos = productos.filter(p => p.destino === 'barra' || p.destino === 'ambos');
    }

    if (!productos.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay productos con recetas disponibles para tu rol.</td></tr>`;
      return;
    }

    tbody.innerHTML = productos.map(prod => {
      const receta = DB.recetas.find(r => r.productoId == prod.id);
      const numIngredientes = receta ? receta.ingredientes.length : 0;
      // Mostrar un resumen de los ingredientes (máximo 3 para no saturar)
      let resumen = '—';
      if (receta && receta.ingredientes.length > 0) {
        const nombres = receta.ingredientes.slice(0, 3).map(ing => {
          const ingData = DB.ingredientes.find(i => i.id == ing.ingredienteId);
          return ingData ? `${ingData.nombre} (${ing.cantidad})` : ing.ingredienteId;
        });
        resumen = nombres.join(', ');
        if (receta.ingredientes.length > 3) resumen += ` +${receta.ingredientes.length - 3} más`;
      }

      return `
        <tr>
          <td><strong>${prod.nombre}</strong></td>
          <td><span class="prod-destino-tag ${prod.destino}">${prod.destino}</span></td>
          <td style="font-size:12px;">${resumen}</td>
          <td>
            <button class="btn-secondary" onclick="Recetas.editarReceta('${prod.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  // ── ABRIR MODAL DE RECETA (APUNTANDO AL PRODUCTO) ────────
  function editarReceta(productoId) {
    // Reutiliza el modal de Despensa, que ahora acepta un productoId opcional
    if (typeof Despensa !== 'undefined' && typeof Despensa.mostrarModalReceta === 'function') {
      Despensa.mostrarModalReceta(productoId);
    } else {
      showToast('error', 'Módulo de Despensa no disponible');
    }
  }

  // ── SUSCRIPCIÓN A EVENTOS ────────────────────────────────
  function _initEventListeners() {
    EventBus.on('db:inicializada', render);
    EventBus.on('productos:cargados', render);
    // Cuando se guarda/elimina una receta, emitimos un evento para refrescar
    EventBus.on('recetas:actualizadas', render);
  }
  _initEventListeners();

  // ── API PÚBLICA ──────────────────────────────────────────
  return { render, editarReceta };
})();

window.Recetas = Recetas;