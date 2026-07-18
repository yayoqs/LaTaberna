/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/renderer.js
   Versión: 1.0.1
   Propósito: Construcción del DOM y renderizado de la vista de menú.
              v1.0.1: usa view-carta-editor como id de contenedor.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { formatearDinero } from '../../utils.js';

// ── CONSTRUCCIÓN DEL DOM ──────────────────────────────────

export function asegurarVista() {
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
    <!-- Header simplificado -->
    <div class="menu-header">
      <button class="hamburger" id="menuHamburgerBtn" title="Menús">☰</button>
      <h2>📋 <input type="text" id="menuNameInput" value="Nuevo Menú"></h2>
      <div class="header-actions">
        <button class="icon-btn" id="menuCtxBtn" title="Opciones">⚙️</button>
        <button class="icon-btn" id="menuPreviewBtn" title="Vista previa">👁</button>
        <button class="icon-btn" id="menuSaveBtn" title="Guardar">💾</button>
      </div>
    </div>

    <!-- Lienzo -->
    <div class="canvas-wrap">
      <div class="canvas" id="menuCanvas" style="background-color:#1a1a2e;"></div>
    </div>

    <!-- Panel lateral de menús (sidebar) -->
    <div class="sidebar-overlay" id="menuSidebarOverlay"></div>
    <div class="sidebar" id="menuSidebar">
      <div class="sidebar-header">
        <h3>📁 Mis Menús</h3>
        <button class="icon-btn" id="menuCloseSidebarBtn" style="border-radius:8px;">✕</button>
      </div>
      <div class="sidebar-list" id="menuSidebarList"></div>
    </div>

    <!-- Menú contextual (⚙️) -->
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

    <!-- FAB y menú radial -->
    <div class="fab-overlay" id="menuFabOverlay"></div>
    <div class="radial-menu" id="menuRadialMenu">
      <button class="radial-btn" data-action="producto">🍔 Producto del recetario</button>
      <button class="radial-btn" data-action="titulo">🔤 Título de sección</button>
      <button class="radial-btn" data-action="descripcion">📝 Descripción</button>
      <button class="radial-btn" data-action="imagen">🖼️ Imagen decorativa</button>
      <button class="radial-btn" data-action="fondo">🎨 Fondo de sección</button>
    </div>
    <button class="fab" id="menuFabBtn">+</button>

    <!-- Bottom Sheet (Biblioteca) -->
    <div class="sheet-overlay" id="menuSheetOverlay"></div>
    <div class="bottom-sheet" id="menuBottomSheet">
      <div class="sheet-handle">☰ Biblioteca de Productos</div>
      <div class="sheet-list" id="menuSheetList"></div>
    </div>

    <!-- Panel de propiedades (modal) -->
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
        <button id="menuClosePropsBtn" style="background:transparent; border:1px solid var(--border); color:var(--text); padding:8px 16px; border-radius:6px;">Cerrar</button>
        <button id="menuDeleteFichaBtn" style="background:var(--danger); border:none; color:#fff; padding:8px 16px; border-radius:6px;">Eliminar</button>
      </div>
    </div>

    <!-- Modal de vista previa -->
    <div class="preview-modal" id="menuPreviewModal">
      <div class="preview-content" id="menuPreviewContent">
        <button class="close-btn" id="menuClosePreviewBtn">✕ Cerrar</button>
      </div>
    </div>
  `;

  // Vincular estilos mínimos si no existen
  if (!document.getElementById('menu-inline-styles')) {
    const style = document.createElement('style');
    style.id = 'menu-inline-styles';
    style.textContent = `
      .menu-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--color-card); border-bottom: 1px solid var(--color-border); }
      .menu-header h2 { font-size: 18px; margin: 0; display: flex; align-items: center; gap: 8px; flex: 1; }
      .menu-header h2 input { background: transparent; border: none; color: var(--color-text); font-size: 18px; font-weight: 600; outline: none; border-bottom: 1px dashed transparent; width: 160px; }
      .menu-header h2 input:focus { border-bottom-color: var(--color-accent); }
      .canvas-wrap { flex: 1; overflow: auto; position: relative; padding: 16px; display: flex; align-items: center; justify-content: center; }
      .canvas { width: 100%; max-width: 600px; min-height: 400px; height: 70vh; position: relative; border-radius: 12px; box-shadow: 0 0 0 1px var(--color-border); }
      .canvas.grid { background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 40px 40px; }
      .ficha { position: absolute; min-width: 90px; background: rgba(0,0,0,.7); border: 2px solid transparent; border-radius: 8px; display: flex; flex-direction: column; align-items: center; padding: 8px; cursor: move; touch-action: none; }
      .ficha img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; pointer-events: none; }
      .ficha .nombre { font-weight: 600; font-size: 12px; margin-top: 4px; text-align: center; }
      .ficha .precio { font-size: 11px; color: var(--color-accent); margin-top: 2px; }
      .ficha.titulo { background: transparent; font-size: 24px; font-weight: 800; padding: 12px; border: none; }
      .ficha.descripcion { background: rgba(255,255,255,.05); font-size: 14px; padding: 12px; max-width: 300px; }
      .ficha.imagen-decorativa { background: transparent; padding: 0; border-radius: 8px; }
      .ficha.fondo-seccion { background: rgba(255,255,255,.03); border-radius: 12px; min-width: 200px; min-height: 80px; z-index: -1; }
      .ficha.circulo { border-radius: 50%; min-width: 80px; min-height: 80px; }
      .fab { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; background: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #000; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.4); z-index: 40; border: none; }
      .radial-menu { position: fixed; bottom: 90px; right: 30px; z-index: 50; display: none; flex-direction: column-reverse; align-items: flex-end; gap: 8px; }
      .radial-menu.active { display: flex; }
      .radial-btn { background: var(--color-card); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 24px; padding: 10px 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.3); }
      .fab-overlay { position: fixed; inset: 0; z-index: 39; display: none; background: rgba(0,0,0,.4); }
      .fab-overlay.active { display: block; }
      .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 30; display: none; }
      .sidebar-overlay.active { display: block; }
      .sidebar { position: fixed; top: 0; left: 0; bottom: 0; z-index: 40; width: 280px; max-width: 85vw; background: var(--color-card); border-right: 1px solid var(--color-border); transform: translateX(-100%); transition: transform .3s; display: flex; flex-direction: column; box-shadow: 4px 0 20px rgba(0,0,0,.3); }
      .sidebar.active { transform: translateX(0); }
      .sidebar-header { padding: 16px; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; }
      .sidebar-header h3 { margin: 0; font-size: 16px; }
      .sidebar-list { flex: 1; overflow-y: auto; padding: 8px; }
      .menu-item { padding: 12px 16px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
      .menu-item:hover, .menu-item:active { background: #252535; }
      .menu-item.activo { background: rgba(245,158,11,.15); border-left: 3px solid var(--color-accent); }
      .menu-item .menu-icon { font-size: 20px; }
      .menu-item .menu-info { flex: 1; }
      .menu-item .menu-info strong { font-size: 14px; display: block; }
      .menu-item .menu-info span { font-size: 11px; color: var(--color-text-muted); }
      .sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 50; display: none; }
      .sheet-overlay.active { display: block; }
      .bottom-sheet { position: fixed; bottom: 0; left: 0; right: 0; z-index: 60; background: var(--color-card); border-radius: 16px 16px 0 0; max-height: 60vh; transform: translateY(100%); transition: transform .3s; display: flex; flex-direction: column; box-shadow: 0 -8px 30px rgba(0,0,0,.5); }
      .bottom-sheet.active { transform: translateY(0); }
      .sheet-handle { padding: 12px; text-align: center; font-weight: 700; font-size: 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); }
      .sheet-list { flex: 1; overflow-y: auto; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
      .product-card { background: #252535; border-radius: 8px; padding: 8px; cursor: grab; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; touch-action: none; }
      .product-card img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; pointer-events: none; }
      .product-card .info strong { font-size: 12px; }
      .product-card .info span { font-size: 10px; color: var(--color-text-muted); }
      .props-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; width: calc(100% - 40px); max-width: 360px; z-index: 100; display: none; flex-direction: column; gap: 10px; }
      .props-panel.active { display: flex; }
      .props-panel label { font-size: 12px; color: var(--color-text-muted); }
      .props-panel input, .props-panel select, .props-panel textarea { background: #252535; border: 1px solid var(--color-border); color: var(--color-text); padding: 8px 12px; border-radius: 6px; width: 100%; resize: vertical; }
      .preview-modal { position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 200; display: none; align-items: center; justify-content: center; }
      .preview-modal.active { display: flex; }
      .preview-content { width: 90vw; max-height: 80vh; background: var(--color-card); border-radius: 12px; overflow: auto; padding: 20px; position: relative; }
      .preview-content .close-btn { position: absolute; top: 10px; right: 20px; background: var(--color-danger); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
      .context-menu { position: absolute; top: 50px; right: 20px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px; padding: 8px; z-index: 80; display: none; flex-direction: column; gap: 6px; box-shadow: 0 8px 20px rgba(0,0,0,.5); min-width: 200px; }
      .context-menu.active { display: flex; }
      .context-menu label { font-size: 12px; color: var(--color-text-muted); }
      .context-menu select, .context-menu input { background: #252535; border: 1px solid var(--color-border); color: var(--color-text); padding: 6px 10px; border-radius: 6px; width: 100%; }
      .context-menu button { margin-top: 4px; background: var(--color-accent); border: none; color: #000; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }
}

// ── RENDERIZADO DE COMPONENTES ────────────────────────────

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
    </div>
  `).join('');
}

export function renderBiblioteca(productos) {
  const lista = document.getElementById('menuSheetList');
  if (!lista) return;
  lista.innerHTML = productos.map(p => `
    <div class="product-card" draggable="true" data-id="${p.id}" data-nombre="${p.nombre}" data-costo="${p.costo || 0}" data-imagen="${p.imagen || ''}">
      ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.style.display='none'">` : ''}
      <div class="info"><strong>${p.nombre}</strong><span>Costo $${p.costo || 0}</span></div>
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
          ${prod.imagen ? `<img src="${prod.imagen}" onerror="this.style.display='none'">` : ''}
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