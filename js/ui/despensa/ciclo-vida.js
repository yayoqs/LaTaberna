/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/ciclo-vida.js
   Versión: 3.3.1
   Propósito: Ciclo de vida de la despensa con panel izquierdo acordeón,
              proveedores reales y conexión Ingrediente ↔ Proveedor.
              v3.3.1: corrige eventos de botones con delegación.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { DB } from '../../db.js';
import {
  asegurarVista,
  renderResumen,
  renderEspacios,
  renderMovimientos,
  renderListaCompras,
  renderProveedores,
  renderProductosDisponibles,
  abrirPanelIzquierdo,
  abrirPanelDerecho,
  cerrarPaneles
} from './renderer.js';
import { exportarCSV, exportarPDF } from './exportacion.js';
import {
  getListaCompras,
  agregarAListaCompras,
  quitarDeListaCompras,
  getTerminoBusqueda,
  setTerminoBusqueda
} from './estado.js';
import { mostrar as mostrarModalProveedor } from './modal-proveedor.js';
import { crearProveedorRepo } from '../../repositorios/proveedor-repository.js';

let _abortController = null;
let _desuscripciones = [];
let _filtroMovimientos = 'todos';

async function _refresh() {
  const state = Store.obtenerEstado();
  const ingredientes = (state.ingredientes || DB.ingredientes || []).filter(i => {
    const t = getTerminoBusqueda();
    return !t || i.nombre.toLowerCase().includes(t.toLowerCase());
  });

  renderResumen(ingredientes);
  renderEspacios(ingredientes);
  renderListaCompras(getListaCompras());
  renderMovimientos(_filtroMovimientos);

  const proveedorRepo = crearProveedorRepo();
  const proveedoresGuardados = await proveedorRepo.obtenerProveedores();

  const proveedoresMap = new Map();
  proveedoresGuardados.forEach(prov => {
    proveedoresMap.set(prov.nombre, { ...prov, productos: 0, ingredientes: [] });
  });

  const productosMap = new Map();

  ingredientes.forEach(ing => {
    const provNombre = ing.proveedor || 'Sin proveedor';
    const precioProv = ing.precio_proveedor || ing.valor_unitario || 0;

    if (!proveedoresMap.has(provNombre)) {
      proveedoresMap.set(provNombre, { nombre: provNombre, notas: '', productos: 0, ingredientes: [] });
    }
    const prov = proveedoresMap.get(provNombre);
    prov.productos++;
    prov.ingredientes.push({ nombre: ing.nombre, precio_proveedor: precioProv });

    if (!productosMap.has(ing.nombre)) {
      productosMap.set(ing.nombre, { nombre: ing.nombre, proveedores: 0, proveedoresLista: [] });
    }
    const prod = productosMap.get(ing.nombre);
    prod.proveedores++;
    prod.proveedoresLista.push({ nombre: provNombre, precio: precioProv });
  });

  renderProveedores(Array.from(proveedoresMap.values()));
  renderProductosDisponibles(Array.from(productosMap.values()));
}

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();

  // Tabs panel izquierdo
  document.querySelectorAll('#view-despensa .panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#view-despensa .panel-tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('#view-despensa .panel-tab-content').forEach(c => c.classList.remove('activo'));
      tab.classList.add('activo');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('activo');
    }, { signal });
  });

  // Tabs centrales
  document.querySelectorAll('#view-despensa .central-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#view-despensa .central-tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('#view-despensa .central-tab-content').forEach(c => c.classList.remove('activo'));
      tab.classList.add('activo');
      document.getElementById('central-' + tab.dataset.tab).classList.add('activo');
      if (tab.dataset.tab === 'movimientos') {
        _filtroMovimientos = 'todos';
        renderMovimientos(_filtroMovimientos);
      }
    }, { signal });
  });

  // Filtros de movimientos
  document.querySelectorAll('#view-despensa .mov-filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-despensa .mov-filtro-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      _filtroMovimientos = btn.dataset.filtro;
      renderMovimientos(_filtroMovimientos);
    }, { signal });
  });

  // Búsqueda
  document.getElementById('inventarioSearch')?.addEventListener('input', function() {
    setTerminoBusqueda(this.value);
    _refresh();
  }, { signal });

  // ── Delegación de eventos en el panel izquierdo (soluciona pérdida de listeners) ──
  const panelIzq = document.getElementById('panelIzquierdo');
  if (panelIzq) {
    panelIzq.addEventListener('click', (e) => {
      // Botón Nuevo Producto
      if (e.target.closest('#btnNuevoProducto')) {
        import('./modal-ingrediente.js').then(mod => mod.mostrar(null, _refresh));
      }
      // Botón Nuevo Proveedor
      if (e.target.closest('#btnNuevoProveedor')) {
        mostrarModalProveedor(null, _refresh);
      }
    }, { signal });
  }

  // Editar insumo desde los espacios (delegación en el contenedor de espacios)
  document.getElementById('espaciosContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-editar-insumo');
    if (btn) {
      import('./modal-ingrediente.js').then(mod => mod.editarIngrediente(btn.dataset.id));
    }
  }, { signal });

  // Exportación
  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV, { signal });
  document.getElementById('btnExportarPDF')?.addEventListener('click', exportarPDF, { signal });

  // Paneles laterales
  document.getElementById('despensaOverlay')?.addEventListener('click', cerrarPaneles, { signal });
  document.getElementById('btnCerrarDer')?.addEventListener('click', cerrarPaneles, { signal });
  document.getElementById('btnToggleIzq')?.addEventListener('click', () => {
    const panel = document.getElementById('panelIzquierdo');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }, { signal });
  document.getElementById('btnToggleDer')?.addEventListener('click', () => {
    const panel = document.getElementById('panelDerecho');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }, { signal });

  // Gestos swipe (móvil)
  const mainLayout = document.getElementById('despensaMainLayout');
  if (mainLayout) {
    let touchStartX = 0, touchStartY = 0;
    mainLayout.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { signal });
    mainLayout.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0 && touchStartX < 40) abrirPanelIzquierdo();
        else if (dx < 0 && touchStartX > window.innerWidth - 40) abrirPanelDerecho();
        else if (dx > 0 && document.getElementById('panelDerecho')?.classList.contains('abierto')) cerrarPaneles();
        else if (dx < 0 && document.getElementById('panelIzquierdo')?.classList.contains('abierto')) cerrarPaneles();
      }
    }, { signal });
  }

  // Lista de compras
  document.getElementById('btnAddCompra')?.addEventListener('click', () => {
    const input = document.getElementById('inputCompra');
    if (input?.value.trim()) {
      agregarAListaCompras({ nombre: input.value.trim(), stock: '' });
      renderListaCompras(getListaCompras());
      input.value = '';
    }
  }, { signal });
  document.getElementById('btnSugerirCompras')?.addEventListener('click', () => {
    const ingredientes = Store.obtenerEstado().ingredientes || DB.ingredientes || [];
    const actuales = getListaCompras().map(i => i.nombre);
    ingredientes.forEach(ing => {
      if (ing.stock <= ing.stock_minimo && !actuales.includes(ing.nombre)) {
        agregarAListaCompras({ nombre: ing.nombre, stock: `${ing.stock} ${ing.unidad}` });
      }
    });
    renderListaCompras(getListaCompras());
  }, { signal });
  document.getElementById('listaCompras')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-quitar');
    if (btn) {
      const itemNombre = btn.dataset.item || btn.closest('.compra-item')?.querySelector('.nombre')?.textContent.trim();
      if (itemNombre) {
        quitarDeListaCompras(itemNombre);
        renderListaCompras(getListaCompras());
      }
    }
  }, { signal });

  // Header dinámico (ocultar/mostrar)
  const appHeader = document.querySelector('.app-header');
  if (appHeader) {
    const observer = new MutationObserver(() => {
      const oculto = appHeader.style.display === 'none';
      const top = oculto ? '0' : 'var(--header-h)';
      const h = oculto ? '100%' : 'calc(100% - var(--header-h))';
      ['panelIzquierdo', 'panelDerecho'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.top = top; el.style.height = h; }
      });
    });
    observer.observe(appHeader, { attributes: true, attributeFilter: ['style'] });
    _desuscripciones.push(() => observer.disconnect());
  }

  // Suscripciones Store/EventBus
  _desuscripciones.push(Store.suscribir((state, action) => {
    if (action.type.startsWith('INGREDIENTE') || action.type.startsWith('MOVIMIENTO') || action.type.startsWith('PROVEEDOR')) {
      _refresh();
    }
  }));
  _desuscripciones.push(EventBus.on('db:inicializada', _refresh));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'despensa') _refresh();
  }));

  if ((Store.obtenerEstado().ingredientes || []).length > 0) _refresh();
}

export function limpiar() {
  if (_abortController) { _abortController.abort(); _abortController = null; }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];
  const main = document.getElementById('view-despensa');
  if (main) { main.innerHTML = ''; main.classList.remove('active'); }
}