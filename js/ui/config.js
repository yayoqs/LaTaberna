/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/config.js
   Versión: 2.0.3
   Propósito: Vista de configuración del local: datos, zonas, impresoras,
              mozos y contraseñas.
              v2.0.3: despacha MOZOS_INICIALIZAR al agregar/eliminar mozo.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Auth } from '../auth.js';
import { mostrarToast, mostrarConfirmacion, mostrarEntrada } from '../utils.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';

const Config = (() => {
  let _abortController = null;
  let _desuscripciones = [];

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
    const { signal } = _abortController || {};
    document.getElementById('btnAgregarZona')?.addEventListener('click', agregarZona, { signal });
    document.getElementById('btnResetearMesas')?.addEventListener('click', resetearMesas, { signal });
    document.getElementById('btnGuardarConfig')?.addEventListener('click', guardar, { signal });
    document.getElementById('btnAgregarMozo')?.addEventListener('click', agregarMozo, { signal });

    document.getElementById('zonasContainer')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-icon-sm.del');
      if (delBtn) { const idx = parseInt(delBtn.getAttribute('data-idx')); if (!isNaN(idx)) eliminarZona(idx); }
    }, { signal });

    document.getElementById('zonasContainer')?.addEventListener('change', (e) => {
      if (e.target.matches('input[type="text"]') || e.target.matches('input[type="number"]')) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const campo = e.target.getAttribute('data-campo');
        if (!isNaN(idx) && campo) _actualizarZona(idx, campo, e.target.value);
      }
    });

    document.getElementById('mozosLista')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-icon-sm.del');
      if (delBtn) { const idx = parseInt(delBtn.getAttribute('data-idx')); if (!isNaN(idx)) eliminarMozo(idx); }
    }, { signal });

    document.getElementById('usuariosLista')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-ajuste');
      if (btn) { const nombre = btn.getAttribute('data-nombre'); if (nombre) _mostrarCambiarPassword(nombre); }
    }, { signal });
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();

    const unsubscribeStore = Store.suscribir((state, action) => {
      if (action.type.startsWith('MOZO')) renderMozos();
      if (action.type === 'CONFIG_INICIALIZAR') _renderZonas();
    });
    _desuscripciones.push(unsubscribeStore);

    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'config') cargar();
    }));
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
  }

  function cargar() {
    _asegurarVista();
    const config = Store.obtenerEstado().config || DB.config || {};
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
    } catch (e) { usuarios = []; }

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
    if (!Auth.esMasterReal()) {
      mostrarToast('error', 'Solo el master puede cambiar contraseñas');
      return;
    }

    const nueva = await mostrarEntrada('Cambiar contraseña', 'Nueva contraseña para ' + nombreUsuario + ':', { type: 'password' });
    if (!nueva || nueva.trim().length === 0) return;

    const confirmacion = await mostrarEntrada('Cambiar contraseña', 'Confirma la nueva contraseña:', { type: 'password' });
    if (confirmacion !== nueva) {
      mostrarToast('error', 'Las contraseñas no coinciden');
      return;
    }

    if (typeof Auth.cambiarPassword === 'function') {
      const ok = await Auth.cambiarPassword(nombreUsuario, nueva.trim());
      if (ok) _renderUsuarios();
    } else {
      mostrarToast('error', 'Función no disponible');
    }
  }

  function _renderZonas() {
    const container = document.getElementById('zonasContainer');
    if (!container) return;
    const config = Store.obtenerEstado().config || {};
    const zonas = config.zonas || [];
    container.innerHTML = zonas.map((z, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="text" value="${z.nombre}" placeholder="Nombre zona" data-idx="${idx}" data-campo="nombre" style="flex:1;">
        <input type="number" value="${z.cantidad}" min="0" step="1" style="width:80px;" data-idx="${idx}" data-campo="cantidad">
        <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function _actualizarZona(idx, campo, valor) {
    const config = Store.obtenerEstado().config || {};
    if (!config.zonas) return;
    if (campo === 'cantidad') config.zonas[idx].cantidad = parseInt(valor) || 0;
    else config.zonas[idx].nombre = valor.trim() || `zona_${idx+1}`;
  }

  async function agregarZona() {
    const config = Store.obtenerEstado().config || {};
    if (!config.zonas) config.zonas = [];
    const nombre = await mostrarEntrada('Nueva zona', 'Nombre de la nueva zona:', { placeholder: 'Terraza' });
    if (!nombre) return;
    const cantidadStr = await mostrarEntrada('Nueva zona', 'Cantidad de mesas inicial:', { type: 'number', placeholder: '0' });
    const cantidad = parseInt(cantidadStr || '0');
    if (isNaN(cantidad)) return;
    config.zonas.push({ nombre: nombre.trim(), cantidad });
    _renderZonas();
  }

  async function eliminarZona(idx) {
    const config = Store.obtenerEstado().config || {};
    if (!config.zonas || config.zonas.length <= 1) {
      mostrarToast('error', 'Debe existir al menos una zona.');
      return;
    }
    const confirmado = await mostrarConfirmacion('Eliminar zona', `¿Eliminar la zona "${config.zonas[idx].nombre}"?`);
    if (!confirmado) return;
    config.zonas.splice(idx, 1);
    _renderZonas();
  }

  async function guardar() {
    const zonasContainer = document.getElementById('zonasContainer');
    let config = Store.obtenerEstado().config || {};

    if (zonasContainer) {
      const filas = zonasContainer.querySelectorAll('div');
      const zonasNuevas = Array.from(filas).map(fila => {
        const inputs = fila.querySelectorAll('input');
        return { nombre: inputs[0]?.value.trim() || 'sin_nombre', cantidad: parseInt(inputs[1]?.value) || 0 };
      });
      if (zonasNuevas.length === 0) {
        mostrarToast('error', 'Debe existir al menos una zona.');
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
    mostrarToast('success', '<i class="fas fa-check-circle"></i> Configuración guardada');

    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      try {
        var datosConfig = { clave: 'global', valor: JSON.stringify(config) };
        var existente = await DBAppwrite.listar('configuracion');
        var docGlobal = existente.find(function(d) { return d.clave === 'global'; });
        if (docGlobal) {
          await DBAppwrite.actualizar('configuracion', docGlobal.id, datosConfig);
        } else {
          await DBAppwrite.crear('configuracion', 'global', datosConfig);
        }
      } catch (e) {
        Logger.warn('[Config] No se pudo sincronizar configuración con Appwrite:', e);
      }
    }
  }

  function renderMozos() {
    const container = document.getElementById('mozosLista');
    if (!container) return;
    const mozos = Store.obtenerEstado().mozos || [];
    container.innerHTML = mozos.map((m, idx) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">${m.nombre}</span>
        <span style="font-size:10px; color:${m.activo !== false ? 'var(--color-success)' : 'var(--color-text-muted)'};">${m.activo !== false ? 'Activo' : 'Inactivo'}</span>
        <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function agregarMozo() {
    const nombre = document.getElementById('nuevoMozoNombre').value.trim();
    if (!nombre) return;
    const nuevoMozo = { id: 'mozo_' + Date.now(), nombre, activo: true };
    DB.mozos.push(nuevoMozo);
    DB.saveMozos();
    document.getElementById('nuevoMozoNombre').value = '';
    // ✅ Despachar acción para que el Store se actualice y la UI se refresque
    Store.despachar({ type: 'MOZOS_INICIALIZAR', payload: [...DB.mozos] });
    mostrarToast('success', 'Mozo añadido');
  }

  async function eliminarMozo(idx) {
    const confirmado = await mostrarConfirmacion('Eliminar mozo', '¿Eliminar mozo?');
    if (!confirmado) return;
    DB.mozos.splice(idx, 1);
    DB.saveMozos();
    // ✅ Despachar acción para refrescar la UI
    Store.despachar({ type: 'MOZOS_INICIALIZAR', payload: [...DB.mozos] });
    mostrarToast('warning', 'Mozo eliminado');
  }

  async function resetearMesas() {
    const confirmado = await mostrarConfirmacion('Resetear mesas', '¿Resetear todas las mesas? Se recrearán según las zonas configuradas.');
    if (!confirmado) return;
    if (typeof DB.resetearMesas === 'function') {
      await DB.resetearMesas();
      EventBus.emit('config:actualizada');
      mostrarToast('success', 'Mesas reseteadas correctamente');
    } else {
      mostrarToast('error', 'Función no disponible');
    }
  }

  return {
    activar, limpiar, cargar, guardar,
    renderMozos, agregarMozo, eliminarMozo,
    agregarZona, eliminarZona, resetearMesas,
    _actualizarZona, _mostrarCambiarPassword
  };
})();

export { Config };