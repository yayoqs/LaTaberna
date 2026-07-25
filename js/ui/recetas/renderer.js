/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/renderer.js
   Versión: 2.1.1
   Propósito: Renderizado principal del recetario con layout libro,
              sidebar gestual de capítulos dinámicos y pestañas de
              subcategorías (niveles) que se adaptan al capítulo
              seleccionado. Corrección: pestañas de nivel estables.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { Auth } from '../../auth.js';
import { obtenerColorDesdeNombre } from '../../utils.js';
import {
  getModo, setModo, getActivada, getPestanaActiva, setPestanaActiva,
  getBusqueda, setBusqueda, getFiltroNivel, setFiltroNivel,
  isSidebarAbierto, setSidebarAbierto, getCategoriaActiva, setCategoriaActiva,
  getCategorias, setCategorias
} from './estado.js';
import { activar } from './ciclo-vida.js';
import { mostrarDetalle } from './detalle.js';
import { mostrarVistaCompleta } from './edicion.js';
import { mostrarModalReceta } from './crear.js';
import { ejecutarPreparacion } from './ejecutar.js';

const PALETA_CATEGORIAS = [
  '#ef6a5f', '#eab308', '#4ade80', '#38bdf8', '#f97316', '#8b5cf6',
  '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171', '#818cf8'
];

export function pintar(modo) {
  if (!getActivada()) activar();

  if (modo) setModo(modo);
  else {
    const rol = Auth.getRol();
    setModo((rol === 'admin' || rol === 'master' || rol === 'cocina' || rol === 'barra') ? 'produccion' : 'consulta');
  }

  _asegurarVista();
  const contenedor = document.getElementById('recetas-contenedor');
  if (!contenedor) return;

  switch (getPestanaActiva()) {
    case 'recetario': pintarRecetario(contenedor); break;
    case 'stock': pintarStock(contenedor); break;
    case 'planificacion': pintarPlanificacion(contenedor); break;
    default: pintarRecetario(contenedor);
  }
}

/* ─── Vista base ────────────────────────────── */
function _asegurarVista() {
  let main = document.getElementById('view-recetas');
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-recetas';
    main.className = 'view';
    document.body.appendChild(main);
  }
  if (!main.querySelector('#recetas-contenedor')) {
    _construirVista(main);
  }
}

function _construirVista(main) {
  main.innerHTML = `
    <div class="recetas-sidebar-backdrop" id="recetasSidebarBackdrop"></div>
    <div class="recetas-sidebar" id="recetasSidebar">
      <div class="recetas-sidebar-marca">
        <div class="recetas-sidebar-marca-icono"><i class="fas fa-fire-burner"></i></div>
        <div>
          <h4 class="recetas-font-libro">La Taberna</h4>
          <small>Producción</small>
        </div>
        <button class="recetas-sidebar-cerrar" id="btnCerrarSidebar"><i class="fas fa-times"></i></button>
      </div>
      <nav class="recetas-sidebar-nav">
        <div class="recetas-sidebar-grupo-titulo">Capítulos</div>
        <div id="recetasSidebarCapitulos"></div>
        <div class="recetas-sidebar-grupo-titulo" style="margin-top:12px;">Acciones</div>
        <button class="recetas-sidebar-item" id="btnNuevaRecetaSidebar"><i class="fas fa-plus"></i> Nueva receta</button>
      </nav>
      <div class="recetas-sidebar-footer">La Taberna · Recetario v6</div>
    </div>
    <div class="recetas-borde-agarre" id="recetasBordeAgarre"></div>
    <div class="recetas-pestanas" id="recetas-pestanas">
      <div class="recetas-pestana activo" data-pestana="recetario"><i class="fas fa-book-open"></i><span>Recetario</span></div>
      <div class="recetas-pestana" data-pestana="stock"><i class="fas fa-boxes"></i><span>Mi Stock</span></div>
      <div class="recetas-pestana" data-pestana="planificacion"><i class="fas fa-tasks"></i><span>Planificación</span></div>
    </div>
    <div id="recetas-subpestanas-container"></div>
    <div id="recetas-contenedor" class="recetas-contenedor"></div>
  `;

  // Eventos de pestañas principales
  document.querySelectorAll('#recetas-pestanas .recetas-pestana').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.pestana;
      setPestanaActiva(id);
      document.querySelectorAll('#recetas-pestanas .recetas-pestana').forEach(t => t.classList.toggle('activo', t.dataset.pestana === id));
      pintar();
    });
  });

  // Sidebar: botones
  document.getElementById('btnCerrarSidebar').addEventListener('click', cerrarSidebar);
  document.getElementById('recetasSidebarBackdrop').addEventListener('click', cerrarSidebar);
  document.getElementById('recetasBordeAgarre').addEventListener('click', () => abrirSidebar());
  document.getElementById('btnNuevaRecetaSidebar').addEventListener('click', () => { cerrarSidebar(); mostrarModalReceta(); });

  // Gestos swipe para sidebar
  let sbInicioX = null, sbArrastrando = false;
  const sidebarEl = document.getElementById('recetasSidebar');
  const backdropEl = document.getElementById('recetasSidebarBackdrop');

  document.addEventListener('touchstart', (e) => {
    if (document.getElementById('paginaDetalle')?.classList.contains('abierta')) return;
    const x = e.touches[0].clientX;
    if (isSidebarAbierto() || x < 24) {
      sbInicioX = x;
      sbArrastrando = true;
      sidebarEl.classList.add('arrastrando');
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!sbArrastrando || sbInicioX === null) return;
    const dx = e.touches[0].clientX - sbInicioX;
    const ancho = sidebarEl.getBoundingClientRect().width;
    let despl;
    if (isSidebarAbierto()) despl = Math.min(0, Math.max(-ancho, dx));
    else despl = Math.min(0, Math.max(-ancho, dx - ancho));
    sidebarEl.style.transform = `translateX(${despl}px)`;
    backdropEl.classList.add('visible');
    backdropEl.style.opacity = String(1 + despl / ancho);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!sbArrastrando || sbInicioX === null) { sbArrastrando = false; return; }
    const dx = e.changedTouches[0].clientX - sbInicioX;
    const ancho = sidebarEl.getBoundingClientRect().width;
    backdropEl.style.opacity = '';
    if (isSidebarAbierto()) {
      if (dx < -ancho * 0.25) cerrarSidebar();
      else abrirSidebar();
    } else {
      if (dx > ancho * 0.25) abrirSidebar();
      else cerrarSidebar();
    }
    sbInicioX = null;
    sbArrastrando = false;
  }, { passive: true });
}

function abrirSidebar() {
  setSidebarAbierto(true);
  const sidebarEl = document.getElementById('recetasSidebar');
  const backdropEl = document.getElementById('recetasSidebarBackdrop');
  const borde = document.getElementById('recetasBordeAgarre');
  if (sidebarEl) {
    sidebarEl.classList.remove('arrastrando');
    sidebarEl.style.transform = '';
    sidebarEl.classList.add('abierto');
  }
  if (backdropEl) backdropEl.classList.add('visible');
  if (borde) borde.classList.add('oculto');
  _pintarSidebarCapitulos();
}

function cerrarSidebar() {
  setSidebarAbierto(false);
  const sidebarEl = document.getElementById('recetasSidebar');
  const backdropEl = document.getElementById('recetasSidebarBackdrop');
  const borde = document.getElementById('recetasBordeAgarre');
  if (sidebarEl) {
    sidebarEl.classList.remove('arrastrando');
    sidebarEl.style.transform = '';
    sidebarEl.classList.remove('abierto');
  }
  if (backdropEl) backdropEl.classList.remove('visible');
  if (borde) borde.classList.remove('oculto');
}

/* ─── Sidebar: lista de capítulos ───────────── */
function _pintarSidebarCapitulos() {
  const container = document.getElementById('recetasSidebarCapitulos');
  if (!container) return;
  const state = Store.getState();
  const recetas = state.recetas || [];
  const categorias = _obtenerCategorias(recetas);
  setCategorias(categorias);
  const termino = getBusqueda().toLowerCase();

  let html = '';
  categorias.forEach((cat, i) => {
    const count = recetas.filter(r => (r.categoria || 'sin_categoria') === cat.id &&
      (!termino || (r._productoNombre || r.productoId || '').toLowerCase().includes(termino))).length;
    html += `<button class="recetas-sidebar-item ${getCategoriaActiva() === cat.id ? 'activo' : ''}" data-cap="${cat.id}" style="--cap-color:${cat.color}">
      <span class="recetas-sidebar-cap-color" style="background:${cat.color};"></span>
      <span>${cat.nombre}</span>
      <span class="recetas-sidebar-contador">${count}</span>
    </button>`;
  });

  if (!html) html = '<div style="padding:16px;color:var(--color-text-muted);text-align:center;font-size:12px;">Sin capítulos</div>';
  container.innerHTML = html;

  container.querySelectorAll('.recetas-sidebar-item[data-cap]').forEach(btn => {
    btn.addEventListener('click', () => {
      const capId = btn.dataset.cap;
      setCategoriaActiva(capId === getCategoriaActiva() ? 'todas' : capId);
      _pintarSidebarCapitulos();
      cerrarSidebar();
      pintarRecetario(document.getElementById('recetas-contenedor'));
    });
  });
}

/* ─── Categorías dinámicas ──────────────────── */
function _obtenerCategorias(recetas) {
  const cats = new Map();
  recetas.forEach(r => {
    const catId = r.categoria || 'sin_categoria';
    if (!cats.has(catId)) {
      cats.set(catId, {
        id: catId,
        nombre: catId === 'sin_categoria' ? 'Sin categoría' : catId.charAt(0).toUpperCase() + catId.slice(1),
        color: ''
      });
    }
  });
  const arr = Array.from(cats.values());
  arr.forEach((cat, i) => {
    cat.color = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
  });
  return arr;
}

/* ─── Recetario (Libro con subcategorías) ───── */
export function pintarRecetario(contenedor) {
  const state = Store.getState();
  const recetas = state.recetas || [];
  const productos = state.productos || [];
  const esProduccion = getModo() === 'produccion';
  const categorias = _obtenerCategorias(recetas);

  contenedor.innerHTML = `
    <div class="recetas-toolbar">
      <div class="recetas-busqueda">
        <i class="fas fa-search"></i>
        <input type="text" id="recetas-buscar" placeholder="Buscar receta..." value="${getBusqueda()}">
      </div>
      ${esProduccion ? `<button class="recetas-boton-nueva" id="recetas-boton-nueva"><i class="fas fa-plus"></i> Nueva</button>` : ''}
    </div>
    <div class="recetas-libro-layout">
      <div class="recetas-libro-paginas" id="recetasLibroPaginas"></div>
      <div class="recetas-libro-indice" id="recetasLibroIndice"></div>
    </div>
  `;

  document.getElementById('recetas-buscar').addEventListener('input', e => {
    setBusqueda(e.target.value.trim());
    pintarRecetario(contenedor);
  });
  if (esProduccion) {
    document.getElementById('recetas-boton-nueva').addEventListener('click', () => mostrarModalReceta());
  }

  _pintarLibro(recetas, productos, categorias, esProduccion);
}

function _pintarLibro(recetas, productos, categorias, esProduccion) {
  const paginas = document.getElementById('recetasLibroPaginas');
  const indice = document.getElementById('recetasLibroIndice');
  const subpestanasContainer = document.getElementById('recetas-subpestanas-container');
  if (!paginas) return;

  // Limpiar subpestañas previas
  if (subpestanasContainer) subpestanasContainer.innerHTML = '';

  const termino = getBusqueda().toLowerCase();
  const capActivo = getCategoriaActiva();

  let filtradas = recetas.map(r => {
    const prod = productos.find(p => p.id == r.productoId);
    return { ...r, _nombre: prod ? prod.nombre : (r.productoId || 'Sin nombre'), _activo: prod ? prod.activo !== false : true };
  }).filter(r => r._activo);

  if (termino) filtradas = filtradas.filter(r => r._nombre.toLowerCase().includes(termino));
  if (capActivo !== 'todas') filtradas = filtradas.filter(r => (r.categoria || 'sin_categoria') === capActivo);

  if (!filtradas.length) {
    paginas.innerHTML = '<div class="recetas-vacia">No se encontraron recetas</div>';
    if (indice) indice.innerHTML = '';
    return;
  }

  // Generar pestañas de nivel (subcategorías) en TODOS los casos
  const nivelesUnicos = [...new Set(filtradas.map(r => r.nivel || 'sin_nivel'))].sort();
  const nivelActivo = getFiltroNivel();

  if (subpestanasContainer && nivelesUnicos.length > 1) {
    subpestanasContainer.innerHTML = `
      <div class="recetas-subpestanas" id="recetas-subpestanas">
        <button class="recetas-subpestana ${nivelActivo === 'todos' ? 'activo' : ''}" data-nivel="todos">Todos</button>
        ${nivelesUnicos.map(n => `<button class="recetas-subpestana ${nivelActivo === n ? 'activo' : ''}" data-nivel="${n}">${n}</button>`).join('')}
      </div>`;
    subpestanasContainer.querySelectorAll('.recetas-subpestana').forEach(btn => {
      btn.addEventListener('click', () => {
        setFiltroNivel(btn.dataset.nivel);
        _pintarLibro(recetas, productos, categorias, esProduccion);
      });
    });
  }

  if (nivelActivo !== 'todos') {
    filtradas = filtradas.filter(r => (r.nivel || 'sin_nivel') === nivelActivo);
  }

  // Agrupar por capítulo si no hay capítulo activo, sino mostrar tarjetas directamente
  if (capActivo === 'todas') {
    const grupos = {};
    filtradas.forEach(r => {
      const cat = r.categoria || 'sin_categoria';
      (grupos[cat] = grupos[cat] || []).push(r);
    });
    const idsPresentes = categorias.map(c => c.id).filter(id => grupos[id] && grupos[id].length);
    
    paginas.innerHTML = idsPresentes.map(id => {
      const cat = categorias.find(c => c.id === id) || { nombre: id, color: PALETA_CATEGORIAS[0], icono: 'fa-box' };
      const items = grupos[id].sort((a, b) => a._nombre.localeCompare(b._nombre));
      return `
        <section class="recetas-capitulo" id="cap-${id}" style="--cap-color:${cat.color}">
          <div class="recetas-capitulo-header">
            <i class="fas ${cat.icono || 'fa-box'}"></i>
            <h3 class="recetas-font-libro">${cat.nombre}</h3>
            <span class="recetas-capitulo-count">${items.length}</span>
          </div>
          <div class="recetas-estante">${items.map(r => _tarjetaLibro(r, cat)).join('')}</div>
        </section>`;
    }).join('');

    if (indice && idsPresentes.length > 1 && !termino) {
      indice.innerHTML = idsPresentes.map((id, i) => {
        const cat = categorias.find(c => c.id === id) || { color: PALETA_CATEGORIAS[0], nombre: id };
        return `<button class="recetas-indice-tab ${i === 0 ? 'activo' : ''}" data-cap="${id}" style="background:${cat.color}" title="${cat.nombre}">${cat.nombre.slice(0, 3)}</button>`;
      }).join('');
      indice.querySelectorAll('.recetas-indice-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('cap-' + btn.dataset.cap)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(ent => {
          if (ent.isIntersecting) {
            const id = ent.target.id.replace('cap-', '');
            indice.querySelectorAll('.recetas-indice-tab').forEach(b => b.classList.toggle('activo', b.dataset.cap === id));
          }
        });
      }, { root: document.getElementById('recetasLibroPaginas'), threshold: 0.1 });
      document.querySelectorAll('.recetas-capitulo').forEach(s => observer.observe(s));
    } else if (indice) {
      indice.innerHTML = '';
    }
  } else {
    const cat = categorias.find(c => c.id === capActivo) || { color: PALETA_CATEGORIAS[0] };
    paginas.innerHTML = `
      <div class="recetas-estante" style="flex-wrap:wrap;gap:12px;">${filtradas.sort((a,b) => a._nombre.localeCompare(b._nombre)).map(r => _tarjetaLibro(r, cat)).join('')}</div>`;
    if (indice) indice.innerHTML = '';
  }

  paginas.querySelectorAll('.recetas-tarjeta-libro').forEach(t => {
    t.addEventListener('click', () => {
      if (esProduccion) mostrarVistaCompleta(t.dataset.receta);
      else mostrarDetalle(t.dataset.receta);
    });
  });
}

function _tarjetaLibro(r, cat) {
  const color = cat.color || obtenerColorDesdeNombre(r._nombre);
  const tipoBadge = r.es_intermedio
    ? '<span class="recetas-badge-intermedio">Prep</span>'
    : '<span class="recetas-badge-final">Final</span>';
  const numIng = r.ingredientes ? r.ingredientes.length : 0;
  const stockInfo = r.es_intermedio ? `<span class="recetas-badge-stock">${r.stockActual || 0} ${r.unidadStock || ''}</span>` : '';
  return `
    <div class="recetas-tarjeta-libro" data-receta="${r.id}" style="--cap-color:${color}">
      <div class="recetas-tarjeta-libro-img" style="background:linear-gradient(160deg, ${color}55, ${color}22);">${r._nombre.charAt(0).toUpperCase()}</div>
      <div class="recetas-tarjeta-libro-nombre">${r._nombre}</div>
      <div class="recetas-tarjeta-libro-meta">${stockInfo}${tipoBadge}</div>
    </div>`;
}

/* ─── Mi Stock ──────────────────────────────── */
export function pintarStock(contenedor) {
  const state = Store.getState();
  const recetas = (state.recetas || []).filter(r => r.es_intermedio);
  const productos = state.productos || [];
  const categorias = _obtenerCategorias(recetas);

  const stockItems = recetas.map(r => {
    const prod = productos.find(p => p.id == r.productoId);
    return { ...r, _nombre: prod ? prod.nombre : r.productoId, _activo: prod ? prod.activo !== false : true };
  }).filter(r => r._activo).sort((a, b) => a._nombre.localeCompare(b._nombre));

  const alertaBaja = stockItems.filter(r => (r.stockActual || 0) <= 1);

  contenedor.innerHTML = `
    <div class="recetas-stock-scroll">
      <div class="recetas-toolbar">
        <h3 class="recetas-font-libro"><i class="fas fa-boxes"></i> Stock Interno</h3>
        <span class="recetas-stock-resumen">${stockItems.length} preparaciones · ${alertaBaja.length} con stock bajo</span>
      </div>
      ${stockItems.length === 0 ? '<div class="recetas-vacia">No hay preparaciones con stock interno</div>' : `
        <table class="recetas-tabla-stock">
          <thead><tr><th>Preparación</th><th>Capítulo</th><th>Stock</th><th>Unidad</th><th>Acciones</th></tr></thead>
          <tbody>
            ${stockItems.map(r => {
              const cat = categorias.find(c => c.id === (r.categoria || 'sin_categoria')) || { nombre: 'Sin categoría', color: PALETA_CATEGORIAS[0] };
              return `<tr class="${(r.stockActual || 0) <= 1 ? 'recetas-stock-bajo' : ''}">
                <td><strong>${r._nombre}</strong></td>
                <td><span class="recetas-chip-nivel" style="background:${cat.color}33;color:${cat.color}">${cat.nombre}</span></td>
                <td><span class="recetas-stock-valor">${r.stockActual || 0}</span></td>
                <td>${r.unidadStock || ''}</td>
                <td>
                  <button class="recetas-accion-preparar" data-receta="${r.id}"><i class="fas fa-fire"></i> Preparar</button>
                  <button class="recetas-accion-ver" data-receta="${r.id}"><i class="fas fa-eye"></i></button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  contenedor.querySelectorAll('.recetas-accion-preparar').forEach(btn => {
    btn.addEventListener('click', () => ejecutarPreparacion(btn.dataset.receta));
  });
  contenedor.querySelectorAll('.recetas-accion-ver').forEach(btn => {
    btn.addEventListener('click', () => mostrarDetalle(btn.dataset.receta));
  });
}

/* ─── Planificación ─────────────────────────── */
export function pintarPlanificacion(contenedor) {
  contenedor.innerHTML = `
    <div class="recetas-planificacion-placeholder">
      <i class="fas fa-tasks" style="font-size:48px;opacity:.3;"></i>
      <h3 class="recetas-font-libro">Planificación de Tareas</h3>
      <p>Próximamente — Esta sección se integrará en la vista del KDS como parte del flujo de trabajo durante el turno.</p>
      <p class="recetas-nota">Podrás crear tareas de mise en place, asignarlas a ayudantes y seguir el avance en tiempo real.</p>
    </div>
  `;
}