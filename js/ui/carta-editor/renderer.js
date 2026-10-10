/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/renderer.js
   Versión: 2.1.0
   Propósito: Construcción del DOM y renderizado de la vista del
              diseñador de cartas.
   v2.1.0: agrega switch Modo Lienzo / Modo Variantes en el header,
           banda de contexto para modo Variantes, y dos contenedores
           separados (uno para el canvas, otro para la tabla de
           asignación). Los botones de contexto (⚙️) y vista previa
           (👁) se ocultan en modo Variantes.
   v2.0.0: rename Menus → Cartas. Elimina eventos inline onerror.
           Corrige variables CSS inexistentes. Quita import muerto
           de Store.
   ================================================================ */

import { formatearDinero } from '../../utils.js';

export function asegurarVista(signal) {
  let main = document.getElementById('view-carta-editor');
  if (main && main.querySelector('.canvas-wrap')) return;

  if (!main) {
    main = document.createElement('main');
    main.id = 'view-carta-editor';
    main.className = 'view';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  main.innerHTML = `
    <div class="menu-header">
      <button class="hamburger" id="menuHamburgerBtn" title="Cartas">☰</button>
      <h2>📋 <input type="text" id="menuNameInput" value="Nueva Carta"></h2>

      <div class="menu-modo-switch" id="menuModoSwitch">
        <button class="menu-modo-btn activo" data-modo="lienzo" type="button">🎨 Lienzo</button>
        <button class="menu-modo-btn" data-modo="variantes" type="button">🧩 Variantes</button>
      </div>

      <div class="header-actions">
        <button class="icon-btn menu-btn-lienzo" id="menuCtxBtn" title="Opciones">⚙️</button>
        <button class="icon-btn menu-btn-lienzo" id="menuPreviewBtn" title="Vista previa">👁</button>
        <button class="icon-btn" id="menuSaveBtn" title="Guardar">💾</button>
      </div>
    </div>

    <div class="menu-modo-contexto" id="menuModoContexto" style="display:none;">
      ℹ️ Asigna variantes a cada producto de la carta. El lienzo permanece guardado. Los cambios se guardan al instante.
    </div>

    <div class="menu-modo-lienzo" id="menuModoLienzoContainer">
      <div class="canvas-wrap">
        <div class="canvas" id="menuCanvas" style="background-color:#1a1a2e;"></div>
      </div>
    </div>

    <div class="menu-modo-variantes" id="menuModoVariantesContainer" style="display:none;"></div>

    <div class="sidebar-overlay" id="menuSidebarOverlay"></div>
    <div class="sidebar" id="menuSidebar">
      <div class="sidebar-header">
        <h3>📁 Mis Cartas</h3>
        <button class="icon-btn" id="menuCloseSidebarBtn" style="border-radius:8px;">✕</button>
      </div>
      <div class="sidebar-list" id="menuSidebarList"></div>
      <div class="sidebar-footer">
        <button class="btn-accion" id="menuNuevoBtn">+ Nueva Carta</button>
      </div>
    </div>

    <div class="context-menu" id="menuContextMenu">
      <label>Fondo</label>
      <select id="menuBgSelect">
        <option value="#1a1a2e">Oscuro</option><option value="#2e2e2e">Gris</option>
        <option value="#1e3a2f">Verde</option><option value="#3a1e1e">Burdeos</option>
      </select>
      <label>Tipografía</label>
      <select id="menuFontSelect">
        <option value="'Inter', sans-serif">Inter</option>
        <option value="'Georgia', serif">Georgia</option>
        <option value="'Courier New', monospace">Courier</option>
      </select>
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="menuGridToggle"> Grilla
      </label>
      <button id="menuPublishBtn">🚀 Publicar</button>
    </div>

    <div class="fab-overlay" id="menuFabOverlay"></div>
    <div class="radial-menu" id="menuRadialMenu">
      <button class="radial-btn" data-action="producto">🍔 Producto del recetario</button>
      <button class="radial-btn" data-action="titulo">🔤 Título de sección</button>
      <button class="radial-btn" data-action="descripcion">📝 Descripción</button>
      <button class="radial-btn" data-action="imagen">🖼️ Imagen decorativa</button>
      <button class="radial-btn" data-action="fondo">🎨 Fondo de sección</button>
    </div>
    <button class="fab menu-btn-lienzo" id="menuFabBtn">+</button>

    <div class="sheet-overlay" id="menuSheetOverlay"></div>
    <div class="bottom-sheet" id="menuBottomSheet">
      <div class="sheet-handle">☰ Biblioteca de Productos</div>
      <div class="sheet-list" id="menuSheetList"></div>
    </div>

    <div class="overlay" id="menuPropsOverlay"></div>
    <div class="props-panel" id="menuPropsPanel">
      <h3>Propiedades</h3>
      <label>Contenido</label>
      <textarea id="menuPropContent" rows="2"></textarea>
      <label>Forma</label>
      <select id="menuPropShape"><option value="rect">Rectángulo</option><option value="circle">Círculo</option></select>
      <label>Mostrar</label>
      <select id="menuPropDisplay"><option value="both">Nombre + Imagen</option><option value="name">Solo nombre</option><option value="img">Solo imagen</option></select>
      <label>Precio venta</label>
      <input type="number" id="menuPropPrice" step="1" value="0">
      <label>Costo: <span id="menuPropCost">$0</span> — Margen: <span id="menuPropMargin">0%</span></label>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        <button id="menuClosePropsBtn" style="background:transparent; border:1px solid var(--color-border); color:var(--color-text); padding:8px 16px; border-radius:6px;">Cerrar</button>
        <button id="menuDeleteFichaBtn" style="background:var(--color-danger); border:none; color:#fff; padding:8px 16px; border-radius:6px;">Eliminar</button>
      </div>
    </div>

    <div class="preview-modal" id="menuPreviewModal">
      <div class="preview-content" id="menuPreviewContent">
        <button class="close-btn" id="menuClosePreviewBtn">✕ Cerrar</button>
      </div>
    </div>
  `;

  if (signal) {
    main.addEventListener('error', (e) => {
      const objetivo = e.target;
      if (objetivo && objetivo.tagName === 'IMG') {
        objetivo.style.display = 'none';
      }
    }, { capture: true, signal });
  }
}

export function renderSidebar(menus, menuActivo) {
  const lista = document.getElementById('menuSidebarList');
  if (!lista) return;
  lista.innerHTML = menus.map(m => `
    <div class="menu-item ${m.id === menuActivo?.id ? 'activo' : ''}" data-id="${m.id}">
      <span class="menu-icon">📄</span>
      <div class="menu-info">
        <strong>${m.nombre}</strong>
        <span>${m.estado === 'publicado' ? '🟢 Publicado' : '📝 Borrador'}</span>
      </div>
      <button class="btn-eliminar-menu" data-id="${m.id}" title="Eliminar carta">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

export function renderBiblioteca(productos) {
  const lista = document.getElementById('menuSheetList');
  if (!lista) return;
  lista.innerHTML = productos.map(p => `
    <div class="product-card" draggable="true" data-id="${p.id}" data-nombre="${p.nombre}" data-costo="${p.costo || 0}" data-imagen="${p.imagen || ''}">
      ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}">` : ''}
      <div class="info"><strong>${p.nombre}</strong><span>Costo ${formatearDinero(p.costo)}</span></div>
    </div>
  `).join('');
}

export function renderLienzo(productos) {
  const canvas = document.getElementById('menuCanvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  (productos || []).forEach(prod => {
    const ficha = document.createElement('div');
    ficha.className = `ficha ${prod.tipo || 'producto'}`;
    ficha.style.left = (prod.x || 100) + 'px';
    ficha.style.top = (prod.y || 100) + 'px';
    ficha.dataset.id = prod.id;
    ficha.dataset.tipo = prod.tipo || 'producto';

    switch (prod.tipo) {
      case 'producto':
        ficha.dataset.shape = prod.shape || 'rect';
        ficha.dataset.display = prod.display || 'both';
        ficha.dataset.price = prod.price || 0;
        ficha.dataset.cost = prod.cost || 0;
        ficha.innerHTML = `
          ${prod.imagen ? `<img src="${prod.imagen}">` : ''}
          <div class="nombre">${prod.nombre}</div>
          <div class="precio">${formatearDinero(prod.price)}</div>
        `;
        if (prod.shape === 'circle') ficha.classList.add('circulo');
        break;
      case 'titulo':
        ficha.dataset.content = prod.content || '';
        ficha.textContent = prod.content || '';
        ficha.style.fontSize = '24px';
        ficha.style.fontWeight = '800';
        break;
      case 'descripcion':
        ficha.dataset.content = prod.content || '';
        ficha.textContent = prod.content || '';
        break;
      case 'imagen':
        ficha.dataset.imagen = prod.imagen || '';
        ficha.innerHTML = `<img src="${prod.imagen}" style="width:200px; height:100px; object-fit:cover; border-radius:8px;">`;
        break;
      case 'fondo':
        ficha.dataset.color = prod.color || 'rgba(255,255,255,0.03)';
        ficha.style.backgroundColor = prod.color;
        ficha.style.width = prod.width || '200px';
        ficha.style.height = prod.height || '80px';
        ficha.style.borderRadius = '12px';
        ficha.innerHTML = '';
        break;
    }

    canvas.appendChild(ficha);
  });
}

export function abrirSidebar() {
  document.getElementById('menuSidebar')?.classList.add('active');
  document.getElementById('menuSidebarOverlay')?.classList.add('active');
}

export function cerrarSidebar() {
  document.getElementById('menuSidebar')?.classList.remove('active');
  document.getElementById('menuSidebarOverlay')?.classList.remove('active');
}

export function toggleFabMenu() {
  const menu = document.getElementById('menuRadialMenu');
  const overlay = document.getElementById('menuFabOverlay');
  const fab = document.getElementById('menuFabBtn');
  if (menu.classList.contains('active')) {
    menu.classList.remove('active');
    overlay.classList.remove('active');
    fab.textContent = '+';
  } else {
    menu.classList.add('active');
    overlay.classList.add('active');
    fab.textContent = '✕';
  }
}

export function abrirBiblioteca() {
  document.getElementById('menuBottomSheet')?.classList.add('active');
  document.getElementById('menuSheetOverlay')?.classList.add('active');
}

export function cerrarBiblioteca() {
  document.getElementById('menuBottomSheet')?.classList.remove('active');
  document.getElementById('menuSheetOverlay')?.classList.remove('active');
}

export function actualizarModoActivo(modo) {
  document.querySelectorAll('#menuModoSwitch .menu-modo-btn').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.modo === modo);
  });

  const contexto = document.getElementById('menuModoContexto');
  if (contexto) contexto.style.display = modo === 'variantes' ? 'block' : 'none';

  const lienzo = document.getElementById('menuModoLienzoContainer');
  const variantes = document.getElementById('menuModoVariantesContainer');
  if (lienzo) lienzo.style.display = modo === 'lienzo' ? 'flex' : 'none';
  if (variantes) variantes.style.display = modo === 'variantes' ? 'flex' : 'none';

  document.querySelectorAll('.menu-btn-lienzo').forEach(el => {
    el.style.display = modo === 'lienzo' ? '' : 'none';
  });

  document.getElementById('menuContextMenu')?.classList.remove('active');
}

export function obtenerContenedorVariantes() {
  return document.getElementById('menuModoVariantesContainer');
}