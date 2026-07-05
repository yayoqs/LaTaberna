/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/config.js
   Versión: 1.0.7
   Propósito: Vista de configuración: productos, zonas, impresoras, mozos.
              v1.0.7: _asegurarVista corregida según estándar B1.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Auth } from '../auth.js';
import { fmtMoney, showToast } from '../utils.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';

const Config = (() => {
  function _asegurarVista() {
    let main = document.getElementById('view-config');
    if (main && main.querySelector('.view-toolbar')) return;
    
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-config';
      main.className = 'view';
      const referencia = document.getElementById('toastContainer') || document.body.lastChild;
      document.body.insertBefore(main, referencia);
    }

    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-sliders"></i> Configuración</h2>
      </div>
      <div class="config-grid">
        <section class="config-card">
          <h3><i class="fas fa-utensils"></i> Productos / Carta</h3>
          <div class="config-actions">
            <button class="btn-primary" id="btnNuevoProducto" data-rol="admin,master">
              <i class="fas fa-plus"></i> Nuevo Producto
            </button>
          </div>
          <div id="productosLista" class="productos-config-lista"></div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-print"></i> Impresoras</h3>
          <div class="impresoras-config">
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-fire-burner"></i>Cocina</span><input type="text" id="impCocinaIP" placeholder="IP o nombre" value="192.168.1.100"><select id="impCocinaProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" id="btnTestImpresoraCocina"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-wine-glass"></i>Barra</span><input type="text" id="impBarraIP" placeholder="IP o nombre" value="192.168.1.101"><select id="impBarraProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" id="btnTestImpresoraBarra"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="impresora-item"><span class="impresora-label"><i class="fas fa-cash-register"></i>Caja</span><input type="text" id="impCajaIP" placeholder="IP o nombre" value="192.168.1.102"><select id="impCajaProto"><option value="network">Red</option><option value="usb" selected>USB</option></select><button class="btn-test" id="btnTestImpresoraCaja"><i class="fas fa-vial"></i> Probar</button></div>
            <div class="info-box"><i class="fas fa-info-circle"></i><p>Para impresión directa instalá QZ Tray.</p></div>
          </div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-store"></i> Datos del Local</h3>
          <div class="local-config">
            <label>Nombre del Local</label><input type="text" id="cfgNombreLocal" value="Mi Pub Restaurant">
            <label>Dirección</label><input type="text" id="cfgDireccion" value="Av. Corrientes 1234, CABA">
            <label>CUIT / RUT</label><input type="text" id="cfgCuit" value="30-12345678-9">
            <label>Pie de ticket</label><input type="text" id="cfgPie" value="¡Gracias por visitarnos!">
            <label>Zonas / Espacios</label>
            <div id="zonasContainer" style="display:flex; flex-direction:column; gap:6px;"></div>
            <button class="btn-secondary" id="btnAgregarZona"><i class="fas fa-plus"></i> Añadir Zona</button>
            <button class="btn-danger" id="btnResetearMesas" style="margin-top:8px;"><i class="fas fa-sync-alt"></i> Resetear Mesas</button>

            <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--color-border);">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="checkbox" id="cfgBloquearStock" checked style="width:auto; accent-color:var(--color-accent);">
                <span><i class="fas fa-boxes"></i> Bloquear envío si falta stock</span>
              </label>
              <p style="font-size:11px; color:var(--color-text-muted); margin-top:4px;">
                Si está activado, al enviar una comanda se verificará que haya stock suficiente de cada ingrediente.
                En caso de faltante, se pedirá confirmación para forzar el envío.
              </p>
            </div>

            <button class="btn-primary" id="btnGuardarConfig"><i class="fas fa-save"></i> Guardar</button>
          </div>
        </section>
        <section class="config-card">
          <h3><i class="fas fa-user-tie"></i> Mozos</h3>
          <div class="local-config">
            <div id="mozosLista" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto;"></div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <input type="text" id="nuevoMozoNombre" placeholder="Nombre del mozo">
              <button class="btn-secondary" id="btnAgregarMozo"><i class="fas fa-plus"></i> Añadir</button>
            </div>
          </div>
        </section>
        <section class="config-card" id="usuariosCard" style="display:none;">
          <h3><i class="fas fa-key"></i> Contraseñas de Usuarios</h3>
          <div class="local-config">
            <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">Solo el master puede cambiar contraseñas.</p>
            <div id="usuariosLista" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </section>
      </div>
    `;

    _vincularEventos();
  }

  function _vincularEventos() {
    document.getElementById('btnNuevoProducto')?.addEventListener('click', () => abrirModalProducto());
    document.getElementById('btnAgregarZona')?.addEventListener('click', agregarZona);
    document.getElementById('btnResetearMesas')?.addEventListener('click', resetearMesas);
    document.getElementById('btnGuardarConfig')?.addEventListener('click', guardar);
    document.getElementById('btnAgregarMozo')?.addEventListener('click', agregarMozo);

    document.getElementById('productosLista')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-icon-sm.edit');
      const delBtn = e.target.closest('.btn-icon-sm.del');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        if (id) _editarProducto(id);
      }
      if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        if (id) _eliminarProducto(id);
      }
    });

    document.getElementById('zonasContainer')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-icon-sm.del');
      if (delBtn) {
        const idx = parseInt(delBtn.getAttribute('data-idx'));
        if (!isNaN(idx)) eliminarZona(idx);
      }
    });

    document.getElementById('zonasContainer')?.addEventListener('change', (e) => {
      if (e.target.matches('input[type="text"]') || e.target.matches('input[type="number"]')) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const campo = e.target.getAttribute('data-campo');
        if (!isNaN(idx) && campo) _updateZona(idx, campo, e.target.value);
      }
    });

    document.getElementById('mozosLista')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-icon-sm.del');
      if (delBtn) {
        const idx = parseInt(delBtn.getAttribute('data-idx'));
        if (!isNaN(idx)) eliminarMozo(idx);
      }
    });

    document.getElementById('usuariosLista')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-ajuste');
      if (btn) {
        const nombre = btn.getAttribute('data-nombre');
        if (nombre) _mostrarCambiarPassword(nombre);
      }
    });
  }

  function cargar() {
    _asegurarVista();
    const config = Store.getState().config || DB.config || {};
    if (config.cantidadMesas && !config.zonas) {
      config.zonas = [
        { nombre: 'salon',   cantidad: 12 },
        { nombre: 'terraza', cantidad: 0 }
      ];
      delete config.cantidadMesas;
      DB.saveConfig();
    }
    document.getElementById('cfgNombreLocal').value = config.nombreLocal || '';
    document.getElementById('cfgDireccion').value = config.direccion || '';
    document.getElementById('cfgCuit').value = config.cuit || '';
    document.getElementById('cfgPie').value = config.pieTicket || '';

    const bloquear = config.bloquearStockInsuficiente !== false;
    const chk = document.getElementById('cfgBloquearStock');
    if (chk) chk.checked = bloquear;

    _renderZonas();
    renderMozos();
    renderProductos();
    _renderUsuarios();
  }

  function _renderUsuarios() {
    const card = document.getElementById('usuariosCard');
    if (!card) return;

    if (typeof Auth !== 'undefined' && Auth.esMasterReal && Auth.esMasterReal()) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
      return;
    }

    const lista = document.getElementById('usuariosLista');
    if (!lista) return;

    let usuarios = [];
    try {
      const raw = localStorage.getItem('pubpos_usuarios');
      if (raw) usuarios = JSON.parse(raw);
    } catch (e) {
      usuarios = [];
    }

    if (!usuarios.length) {
      lista.innerHTML = '<p style="color:var(--color-text-muted);">No hay usuarios.</p>';
      return;
    }

    lista.innerHTML = usuarios.map(function(u) {
      return '<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--color-border);">' +
               '<span style="flex:1;"><strong>' + u.nombre + '</strong> (' + u.rol + ')</span>' +
               '<button class="btn-ajuste" data-nombre="' + u.nombre + '">' +
                 '<i class="fas fa-key"></i> Cambiar' +
               '</button>' +
             '</div>';
    }).join('');
  }

  async function _mostrarCambiarPassword(nombreUsuario) {
    if (!Auth.esMasterReal || !Auth.esMasterReal()) {
      showToast('error', 'Solo el master puede cambiar contraseñas');
      return;
    }

    const nueva = prompt('Nueva contraseña para ' + nombreUsuario + ':');
    if (!nueva || nueva.trim().length === 0) return;

    const confirmacion = prompt('Confirma la nueva contraseña:');
    if (confirmacion !== nueva) {
      showToast('error', 'Las contraseñas no coinciden');
      return;
    }

    if (typeof Auth.cambiarPassword === 'function') {
      const ok = await Auth.cambiarPassword(nombreUsuario, nueva.trim());
      if (ok) {
        _renderUsuarios();
      }
    } else {
      showToast('error', 'Función no disponible');
    }
  }

  function _renderZonas() {
    const container = document.getElementById('zonasContainer');
    if (!container) return;
    const config = Store.getState().config || {};
    const zonas = config.zonas || [];
    container.innerHTML = zonas.map((z, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="text" value="${z.nombre}" placeholder="Nombre zona" 
               data-idx="${idx}" data-campo="nombre" style="flex:1;">
        <input type="number" value="${z.cantidad}" min="0" step="1" style="width:80px;"
               data-idx="${idx}" data-campo="cantidad">
        <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function _updateZona(idx, campo, valor) {
    const config = Store.getState().config || {};
    if (!config.zonas) return;
    if (campo === 'cantidad') config.zonas[idx].cantidad = parseInt(valor) || 0;
    else config.zonas[idx].nombre = valor.trim() || `zona_${idx+1}`;
  }

  function agregarZona() {
    const config = Store.getState().config || {};
    if (!config.zonas) config.zonas = [];
    const nombre = prompt('Nombre de la nueva zona (ej: Terraza, Patio, VIP):');
    if (!nombre) return;
    const cantidad = parseInt(prompt('Cantidad de mesas inicial:') || '0');
    if (isNaN(cantidad)) return;
    config.zonas.push({ nombre: nombre.trim(), cantidad });
    _renderZonas();
  }

  function eliminarZona(idx) {
    const config = Store.getState().config || {};
    if (!config.zonas || config.zonas.length <= 1) {
      showToast('error', 'Debe existir al menos una zona.');
      return;
    }
    if (!confirm(`¿Eliminar la zona "${config.zonas[idx].nombre}"?`)) return;
    config.zonas.splice(idx, 1);
    _renderZonas();
  }

  async function guardar() {
    const zonasContainer = document.getElementById('zonasContainer');
    let config = Store.getState().config || {};

    if (zonasContainer) {
      const filas = zonasContainer.querySelectorAll('div');
      const zonasNuevas = Array.from(filas).map(fila => {
        const inputs = fila.querySelectorAll('input');
        return {
          nombre: inputs[0]?.value.trim() || 'sin_nombre',
          cantidad: parseInt(inputs[1]?.value) || 0
        };
      });

      if (zonasNuevas.length === 0) {
        showToast('error', 'Debe existir al menos una zona.');
        return;
      }
      config.zonas = zonasNuevas;
    }

    config = {
      ...config,
      nombreLocal: document.getElementById('cfgNombreLocal').value.trim(),
      direccion: document.getElementById('cfgDireccion').value.trim(),
      cuit: document.getElementById('cfgCuit').value.trim(),
      pieTicket: document.getElementById('cfgPie').value.trim(),
      zonas: config.zonas || [{ nombre: 'salon', cantidad: 12 }],
      bloquearStockInsuficiente: document.getElementById('cfgBloquearStock')?.checked ?? true
    };
    delete config.cantidadMesas;

    DB.config = config;
    DB.saveConfig();
    DB.saveMesas();

    if (typeof DB.sincronizarMesasConConfig === 'function') {
      await DB.sincronizarMesasConConfig();
    }

    EventBus.emit('config:actualizada');

    showToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        var datosConfig = {
          clave: 'global',
          valor: JSON.stringify(config)
        };
        var existente = await DBAppwrite.listar('configuracion');
        var docGlobal = existente.find(function(d) { return d.clave === 'global'; });
        if (docGlobal) {
          await DBAppwrite.actualizar('configuracion', docGlobal.id, datosConfig);
          Logger.info('[Config] Configuración actualizada en Appwrite.');
        } else {
          await DBAppwrite.crear('configuracion', 'global', datosConfig);
          Logger.info('[Config] Configuración creada en Appwrite.');
        }
      } catch (e) {
        Logger.warn('[Config] No se pudo sincronizar configuración con Appwrite:', e);
      }
    }
  }

  function renderProductos() {
    _asegurarVista();
    const cont = document.getElementById('productosLista');
    if (!cont) return;
    const todos = Store.getState().productos || [];
    if (!todos.length) {
      cont.innerHTML = `<p style="text-align:center;padding:20px;">No hay productos</p>`;
      return;
    }
    const grupos = {};
    todos.forEach(p => { const cat = p.categoria || 'Sin categoría'; if (!grupos[cat]) grupos[cat] = []; grupos[cat].push(p); });
    cont.innerHTML = Object.entries(grupos).map(([cat, prods]) => `
      <div><p class="prod-config-group-title">${cat}</p>${prods.map(_htmlProdConfigItem).join('')}</div>
    `).join('');
  }

  function _htmlProdConfigItem(p) {
    return `
      <div class="prod-config-item${p.activo === false ? ' inactivo' : ''}">
        <span class="prod-config-nombre">${p.nombre}</span>
        <span class="prod-config-cat">${p.destino}</span>
        <span class="prod-config-precio">${fmtMoney(p.precio)}</span>
        ${p.imagen ? '<span class="prod-config-img"><i class="fas fa-image"></i></span>' : ''}
        <button class="btn-icon-sm edit" data-id="${p.id}"><i class="fas fa-pen"></i></button>
        <button class="btn-icon-sm del" data-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>`;
  }

  function abrirModalProducto(prod = null) {
    let modal = document.getElementById('modalProducto');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalProducto';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-small">
          <div class="modal-header"><h3><i class="fas fa-utensils"></i> <span id="productoModalTitulo">Nuevo Producto</span></h3><button class="modal-close" id="btnCerrarModalProducto"><i class="fas fa-times"></i></button></div>
          <div class="modal-small-body">
            <input type="hidden" id="prodId">
            <label for="prodNombre">Nombre *</label><input type="text" id="prodNombre" placeholder="Nombre del producto" autocomplete="off">
            <label for="prodPrecio">Precio *</label><input type="number" id="prodPrecio" placeholder="0.00" min="0" step="0.01">
            <label for="prodCategoria">Categoría *</label><select id="prodCategoria"><option>Bebidas</option><option>Cervezas</option><option>Cocteles</option><option>Vinos</option><option>Entradas</option><option>Comidas</option><option>Postres</option></select>
            <label for="prodDestino">Destino Comanda *</label><select id="prodDestino"><option value="barra">Barra</option><option value="cocina">Cocina</option><option value="ambos">Ambos</option></select>
            <label for="prodDescripcion">Descripción</label><input type="text" id="prodDescripcion" placeholder="Descripción breve (opcional)">
            <label for="prodImagen">Imagen (URL)</label><input type="text" id="prodImagen" placeholder="https://... (opcional)">
            <div id="vistaPreviaImagen" style="margin-top:8px; max-width:200px;"></div>
            <div class="prod-activo-row"><label for="prodActivo">Activo</label><input type="checkbox" id="prodActivo" checked></div>
            <div class="modal-small-footer"><button class="btn-secondary" id="btnCancelarProducto">Cancelar</button><button class="btn-primary" id="btnGuardarProducto"><i class="fas fa-save"></i> Guardar</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      document.getElementById('btnCerrarModalProducto').addEventListener('click', cerrarModalProducto);
      document.getElementById('btnCancelarProducto').addEventListener('click', cerrarModalProducto);
      document.getElementById('btnGuardarProducto').addEventListener('click', guardarProducto);
    }

    document.getElementById('productoModalTitulo').textContent = prod ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('prodId').value = prod?.id || '';
    document.getElementById('prodNombre').value = prod?.nombre || '';
    document.getElementById('prodPrecio').value = prod?.precio || '';
    document.getElementById('prodCategoria').value = prod?.categoria || 'Comidas';
    document.getElementById('prodDestino').value = prod?.destino || 'cocina';
    document.getElementById('prodDescripcion').value = prod?.descripcion || '';
    document.getElementById('prodImagen').value = prod?.imagen || '';
    document.getElementById('prodActivo').checked = prod ? (prod.activo !== false) : true;
    _vistaPreviaImagen();
    modal.style.display = 'flex';
  }

  function cerrarModalProducto() {
    const modal = document.getElementById('modalProducto');
    if (modal) modal.style.display = 'none';
  }

  function _autoajustarPrecio() {
    const precioInput = document.getElementById('prodPrecio');
    if (!precioInput) return;
    let valor = parseFloat(precioInput.value);
    if (isNaN(valor) || valor < 0) {
      precioInput.value = '0';
    }
  }

  function _vistaPreviaImagen() {
    const url = document.getElementById('prodImagen')?.value.trim() || '';
    const contenedor = document.getElementById('vistaPreviaImagen');
    if (!contenedor) return;
    if (url) {
      contenedor.innerHTML = `<img src="${url}" alt="Vista previa" style="max-width:200px; max-height:200px; border-radius:8px; border:1px solid var(--color-border);" onerror="this.style.display='none'">`;
    } else {
      contenedor.innerHTML = '';
    }
  }

  async function guardarProducto() {
    const nombre = document.getElementById('prodNombre').value.trim();
    const precio = parseFloat(document.getElementById('prodPrecio')?.value) || 0;
    if (!nombre) { showToast('error', 'Nombre obligatorio'); return; }
    if (precio < 0) { showToast('error', 'Precio no puede ser negativo'); return; }
    const id = document.getElementById('prodId').value || `prod_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const producto = {
      id, nombre, precio,
      categoria: document.getElementById('prodCategoria')?.value || 'General',
      destino: document.getElementById('prodDestino')?.value || 'cocina',
      descripcion: document.getElementById('prodDescripcion').value.trim(),
      imagen: document.getElementById('prodImagen').value.trim(),
      activo: document.getElementById('prodActivo')?.checked ?? true
    };

    if (!DB.productos) DB.productos = [];
    var idx = DB.productos.findIndex(function(p) { return p.id === id; });
    if (idx >= 0) {
      DB.productos[idx] = producto;
    } else {
      DB.productos.push(producto);
    }

    localStorage.setItem('pubpos_productos', JSON.stringify(DB.productos));

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        var existenteEnAppwrite = await DBAppwrite.listar('productos').then(function(l) {
          return l.find(function(p) { return p.id === id; });
        });
        if (existenteEnAppwrite) {
          await DBAppwrite.actualizar('productos', id, producto);
        } else {
          await DBAppwrite.crear('productos', id, producto);
        }
      } catch (e) {
        Logger.warn('[Config] Error al sincronizar producto con Appwrite:', e);
      }
    }

    Store.dispatch({ type: 'PRODUCTOS_INICIALIZAR', payload: DB.productos });

    showToast('success', 'Producto guardado y sincronizado');
    cerrarModalProducto();
    renderProductos();
  }

  async function _editarProducto(id) {
    const prod = (Store.getState().productos || []).find(p => p.id === id);
    if (prod) abrirModalProducto(prod);
  }

  async function _eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;

    if (DB.productos) {
      DB.productos = DB.productos.filter(function(p) { return p.id !== id; });
      localStorage.setItem('pubpos_productos', JSON.stringify(DB.productos));
    }

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        await DBAppwrite.eliminar('productos', id);
      } catch (e) {
        Logger.warn('[Config] Error al eliminar producto de Appwrite:', e);
      }
    }

    Store.dispatch({ type: 'PRODUCTOS_INICIALIZAR', payload: DB.productos });

    renderProductos();
    showToast('success', 'Producto eliminado');
  }

  async function resetearMesas() {
    if (!confirm('¿Resetear todas las mesas? Se eliminarán las mesas libres y se recrearán según las zonas configuradas. Las mesas ocupadas se conservarán al final.')) return;
    if (typeof DB.resetearMesas === 'function') {
      await DB.resetearMesas();
      EventBus.emit('config:actualizada');
      showToast('success', 'Mesas reseteadas correctamente');
    } else {
      showToast('error', 'Función no disponible');
    }
  }

  function renderMozos() {
    const container = document.getElementById('mozosLista');
    if (!container) return;
    const mozos = Store.getState().mozos || [];
    container.innerHTML = mozos.map((m, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">${m.nombre}</span>
        <span style="font-size:10px; color:${m.activo !== false ? 'var(--color-success)' : 'var(--color-text-muted)'};">
          ${m.activo !== false ? 'Activo' : 'Inactivo'}
        </span>
        <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function agregarMozo() {
    const nombre = document.getElementById('nuevoMozoNombre').value.trim();
    if (!nombre) return;
    DB.mozos.push({ id: 'mozo_' + Date.now(), nombre, activo: true });
    DB.saveMozos();
    document.getElementById('nuevoMozoNombre').value = '';
    showToast('success', 'Mozo añadido');
  }

  function eliminarMozo(idx) {
    if (!confirm('¿Eliminar mozo?')) return;
    DB.mozos.splice(idx, 1);
    DB.saveMozos();
    showToast('warning', 'Mozo eliminado');
  }

  function _initListeners() {
      Store.subscribe((state, action) => {
        if (action.type.startsWith('PRODUCTO')) renderProductos();
        if (action.type.startsWith('MOZO')) renderMozos();
        if (action.type === 'CONFIG_INICIALIZAR') _renderZonas();
      });
  
      EventBus.on('vista:cambiada', (vista) => {
        if (vista === 'config') cargar();
      });
    }
  
    _initListeners();
  
    return {
      cargar,
      guardar,
      renderProductos,
      abrirModalProducto,
      cerrarModalProducto,
      guardarProducto,
      _editarProducto,
      _eliminarProducto,
      renderMozos,
      agregarMozo,
      eliminarMozo,
      agregarZona,
      eliminarZona,
      resetearMesas,
      _updateZona,
      _mostrarCambiarPassword,
      _autoajustarPrecio,
      _vistaPreviaImagen
    };
  })();

export { Config };