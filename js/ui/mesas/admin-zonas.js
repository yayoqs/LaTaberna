/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/admin-zonas.js
   Versión: 1.1.2
   Propósito: Gestión de zonas y mesas por zona.
              v1.1.2: Retirado workaround de reseteo manual.
                      sincronizarMesasConConfig de Core ahora
                      resetea y recrea consistentemente.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { DB } from '../../db.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { mostrarToast, mostrarConfirmacion, mostrarEntrada } from '../../utils.js';

function _obtenerZonas() {
  const config = Store.obtenerEstado().config || {};
  return config.zonas && Array.isArray(config.zonas) && config.zonas.length > 0
    ? [...config.zonas]
    : (DB.config && DB.config.zonas ? [...DB.config.zonas] : [{ nombre: 'salon', cantidad: 12 }]);
}

function _renderFilas(zonas, contenedor) {
  const container = contenedor.querySelector('#zonasContainer');
  if (!container) return;

  container.innerHTML = zonas.map((z, idx) => `
    <div class="zona-row">
      <input type="text" value="${z.nombre}" placeholder="Nombre zona" data-idx="${idx}" data-campo="nombre">
      <input type="number" value="${z.cantidad}" min="0" step="1" style="width:80px;" data-idx="${idx}" data-campo="cantidad">
      <button class="btn-icon-sm del" data-idx="${idx}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-icon-sm.del').forEach(btn => {
    btn.addEventListener('click', () => _eliminarZona(zonas, parseInt(btn.dataset.idx), contenedor));
  });
}

async function _agregarZona(zonas, contenedor) {
  const nombre = await mostrarEntrada('Nueva zona', 'Nombre de la nueva zona:', { placeholder: 'Terraza' });
  if (!nombre) return;
  const cantidadStr = await mostrarEntrada('Nueva zona', 'Cantidad de mesas inicial:', { type: 'number', placeholder: '0' });
  const cantidad = parseInt(cantidadStr || '0');
  if (isNaN(cantidad)) return;
  zonas.push({ nombre: nombre.trim(), cantidad });
  _renderFilas(zonas, contenedor);
}

async function _eliminarZona(zonas, idx, contenedor) {
  if (!zonas || zonas.length <= 1) {
    mostrarToast('error', 'Debe existir al menos una zona.');
    return;
  }
  const confirmado = await mostrarConfirmacion('Eliminar zona', `¿Eliminar la zona "${zonas[idx].nombre}"?`);
  if (!confirmado) return;
  zonas.splice(idx, 1);
  _renderFilas(zonas, contenedor);
}

async function _resetearMesas() {
  const confirmado = await mostrarConfirmacion('Resetear mesas', '¿Resetear todas las mesas? Se recrearán según las zonas configuradas.');
  if (!confirmado) return;
  if (typeof DB.resetearMesas === 'function') {
    await DB.resetearMesas();
    Store.despachar({ type: 'MESAS_INICIALIZAR', payload: DB.mesas });
    EventBus.emit('config:actualizada');
    mostrarToast('success', 'Mesas reseteadas correctamente');
  } else {
    mostrarToast('error', 'Función no disponible');
  }
}

async function _guardarZonas(contenedor) {
  const container = contenedor.querySelector('#zonasContainer');
  if (!container) return;

  const filas = container.querySelectorAll('.zona-row');
  const zonasNuevas = Array.from(filas).map(fila => {
    const inputs = fila.querySelectorAll('input');
    return {
      nombre: inputs[0]?.value.trim() || 'sin_nombre',
      cantidad: parseInt(inputs[1]?.value) || 0
    };
  });

  if (zonasNuevas.length === 0) {
    mostrarToast('error', 'Debe existir al menos una zona.');
    return;
  }

  const configActual = Store.obtenerEstado().config || {};
  const configActualizado = { ...configActual, zonas: zonasNuevas };
  delete configActualizado.cantidadMesas;

  DB.config = configActualizado;
  DB.saveConfig();

  if (typeof DB.sincronizarMesasConConfig === 'function') {
    await DB.sincronizarMesasConConfig();
  }

  // Sincronizar Store con DB.mesas
  Store.despachar({ type: 'MESAS_INICIALIZAR', payload: DB.mesas });

  EventBus.emit('config:actualizada');
  mostrarToast('success', '<i class="fas fa-check-circle"></i> Zonas guardadas y mesas sincronizadas');

  if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
    try {
      const datosConfig = { clave: 'global', valor: JSON.stringify(configActualizado) };
      const existente = await DBAppwrite.listar('configuracion');
      const docGlobal = existente.find(d => d.clave === 'global');
      if (docGlobal) {
        await DBAppwrite.actualizar('configuracion', docGlobal.id, datosConfig);
      } else {
        await DBAppwrite.crear('configuracion', 'global', datosConfig);
      }
    } catch (e) {
      Logger.warn('[admin-zonas] No se pudo sincronizar configuración con Appwrite:', e);
    }
  }
}

export function renderZonas(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const zonas = _obtenerZonas();

  contenedor.innerHTML = `
    <h3><i class="fas fa-map-marker-alt"></i> Zonas / Espacios</h3>
    <div id="zonasContainer"></div>
    <button class="btn-secondary" id="btnAgregarZona" style="margin-top:8px;"><i class="fas fa-plus"></i> Añadir Zona</button>
    <button class="btn-primary" id="btnGuardarZonas" style="margin-top:8px;"><i class="fas fa-save"></i> Guardar zonas</button>
    <button class="btn-danger" id="btnResetearMesas" style="margin-top:12px;"><i class="fas fa-sync-alt"></i> Resetear Mesas</button>
  `;

  _renderFilas(zonas, contenedor);

  contenedor.querySelector('#btnAgregarZona').addEventListener('click', () => _agregarZona(zonas, contenedor));
  contenedor.querySelector('#btnGuardarZonas').addEventListener('click', () => _guardarZonas(contenedor));
  contenedor.querySelector('#btnResetearMesas').addEventListener('click', _resetearMesas);
}