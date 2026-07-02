/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/bootstrap.js
   Versión: 1.0.5
   Propósito: Secuencia de arranque: Auth, DB, Store, dependencias.
              Incluye imports de TurnoManager y App. 
              Código muerto de Config eliminado.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Store } from './lib/store.js';
import { Deps } from './lib/deps.js';
import { Auth } from './auth.js';
import { DB } from './db.js';
import { showToast } from './utils.js';
import { TurnoManager } from './managers/turno-manager.js';
import { App } from './app.js';

const Bootstrap = (() => {

  async function arrancar() {
    Logger.setLevel('DEBUG');
    Logger.info('[Bootstrap] Iniciando aplicación...');

    // 1. Inicializar autenticación
    try {
      Auth.init();
      Logger.info('[Bootstrap] Auth listo.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en Auth:', e);
      showToast('error', 'Error crítico al iniciar autenticación');
      return;
    }

    // 2. Inicializar base de datos (Appwrite + localStorage)
    try {
      await DB.init();
      Logger.info('[Bootstrap] DB lista.');
    } catch (e) {
      Logger.error('[Bootstrap] Error en DB:', e);
      showToast('error', 'Error crítico al cargar los datos');
      return;
    }

    // 3. Poblar Store con los datos iniciales
    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'MESAS_INICIALIZAR',       payload: DB.mesas || [] });
      Store.dispatch({ type: 'PEDIDOS_INICIALIZAR',     payload: DB.pedidos || [] });
      Store.dispatch({ type: 'PRODUCTOS_INICIALIZAR',   payload: DB.productos || [] });
      Store.dispatch({ type: 'INGREDIENTES_INICIALIZAR', payload: DB.ingredientes || [] });
      Store.dispatch({ type: 'RECETAS_INICIALIZAR',      payload: DB.recetas || [] });
      Store.dispatch({ type: 'MOZOS_INICIALIZAR',        payload: DB.mozos || [] });
      Store.dispatch({ type: 'CONFIG_INICIALIZAR',       payload: DB.config || {} });
      Store.dispatch({ type: 'PEDIDOSDELIVERY_INICIALIZAR', payload: DB.pedidosDelivery || [] });
      Logger.info('[Bootstrap] Store poblado con datos iniciales.');
    }

    // 4. Configurar repositorios y servicios
    let pedidoRepo = typeof PedidoRepositoryLocal !== 'undefined' ? PedidoRepositoryLocal : null;

    const deliveryRepo = {
      async crearDelivery(datos) { return DB.crearPedidoDelivery(datos); },
      async obtenerPorId(id) { return (DB.pedidosDelivery || []).find(p => p.id === id) || null; },
      async guardarDelivery(datos) {
        const idx = (DB.pedidosDelivery || []).findIndex(p => p.id === datos.id);
        if (idx >= 0) { DB.pedidosDelivery[idx] = { ...DB.pedidosDelivery[idx], ...datos }; }
      }
    };

    const inventarioRepo = {
      async guardarIngrediente(datos) {
        if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
          await DBAppwrite.crear('ingredientes', datos);
        }
        return datos;
      },
      async obtenerPorId(id) { return (DB.ingredientes || []).find(i => i.id == id) || null; },
      async registrarMovimiento(movimiento) {
        if (typeof DB.ajustarStock === 'function') {
          DB.ajustarStock(movimiento.ingredienteId, movimiento.cantidad, movimiento.motivo);
        }
      }
    };

    if (typeof Deps !== 'undefined') {
      if (pedidoRepo) Deps.registrar('pedidoRepo', pedidoRepo);
      Deps.registrar('deliveryRepo', deliveryRepo);
      Deps.registrar('inventarioRepo', inventarioRepo);
      Logger.info('[Bootstrap] Dependencias registradas en el contenedor.');
    }

    if (typeof PedidoService !== 'undefined' && pedidoRepo) {
      PedidoService.configurar(pedidoRepo);
      if (typeof Deps !== 'undefined') Deps.registrar('pedidoService', PedidoService);
      Logger.info('[Bootstrap] PedidoService configurado y registrado.');
    }
    if (typeof DeliveryService !== 'undefined') {
      DeliveryService.configurar(deliveryRepo);
      if (typeof Deps !== 'undefined') Deps.registrar('deliveryService', DeliveryService);
      Logger.info('[Bootstrap] DeliveryService configurado.');
    }
    if (typeof InventarioService !== 'undefined') {
      InventarioService.configurar(inventarioRepo);
      if (typeof Deps !== 'undefined') Deps.registrar('inventarioService', InventarioService);
      Logger.info('[Bootstrap] InventarioService configurado.');
    }

    // 5. Inicializar gestor de turnos y pedidos
    try {
      if (typeof PedidoManager !== 'undefined') {
        const turno = PedidoManager.init({ pedidoRepo });
        Logger.info(`[Bootstrap] PedidoManager activo. Turno: ${turno?.id}`);
      }
    } catch (e) {
      Logger.error('[Bootstrap] Error al iniciar PedidoManager:', e);
    }

    if (typeof TurnoManager === 'undefined') {
      Logger.warn('[Bootstrap] TurnoManager no encontrado.');
    }

    // 6. Activar tiempo real de Appwrite
    if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
      DBAppwrite.iniciarRealtime();
      Logger.info('[Bootstrap] Realtime de Appwrite iniciado.');
    }

    // 7. Inicializar UI y mostrar vista según rol
    if (typeof App !== 'undefined' && App.init) {
      App.init();
      Logger.info('[Bootstrap] UI iniciada.');
    } else {
      Logger.warn('[Bootstrap] App no disponible, la UI no se iniciará automáticamente.');
    }

    try {
      if (Auth.getRol()) {
        const vistaDefecto = Auth.getDefaultView();
        if (typeof App !== 'undefined' && App.showView) {
          App.showView(vistaDefecto);
        }
      } else {
        if (typeof App !== 'undefined' && App.showView) {
          App.showView('inicio');
        }
      }
    } catch (e) {
      Logger.error('[Bootstrap] Error al mostrar vista inicial:', e);
    }

    Logger.info('[Bootstrap] Aplicación lista.');
  }

  return { arrancar };
})();

// Arranque seguro para módulos ES6
function _bootstrapArrancar() {
  Bootstrap.arrancar();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bootstrapArrancar);
} else {
  _bootstrapArrancar();
}