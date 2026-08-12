/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db.js
   Versión: 1.1.3
   Propósito: Orquestador de base de datos (Appwrite + localStorage).
              v1.1.3: _procesarPedidos convierte items a array en
                      memoria, no a string.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Store } from './lib/store.js';
import { DBCore, mesaVacia } from './db-core.js';
import { DBInventario } from './db-inventario.js';
import { DBFusion } from './db-fusion.js';
import { DBAppwrite } from './db-appwrite.js';
import { DBShim } from './db-shim.js';
import { inicializarAuth } from './auth.js';

export const DB = (function() {
  const core = DBCore;
  const inventario = DBInventario;
  const fusion = DBFusion;
  const appwrite = DBAppwrite;
  const shim = DBShim;

  const combined = {
    ...core,
    ...inventario,
    ...fusion,
    ...shim,
    mesaVacia
  };

  combined.init = async function() {
    try {
      Logger.info("[DB] Iniciando carga de datos...");

      let appwriteOk = false;
      if (appwrite && appwrite.iniciar) {
        try {
          appwriteOk = await appwrite.iniciar();
        } catch (e) {
          Logger.warn("[DB] No se pudo iniciar Appwrite:", e.message);
          appwriteOk = false;
        }
      }

      await inicializarAuth();
      await this._cargarConfiguracion();
      this._cargarMozosLocal();

      if (appwriteOk) {
        Logger.info('[DB] Appwrite disponible. Cargando datos desde la nube (paralelo)...');
        try {
          const resultados = {};
          const promesas = [
            'productos',
            'pedidos',
            'mesas',
            'comandas',
            'insumos',
            'recetas'
          ].map(function(coleccion) {
            return appwrite.listar(coleccion).then(function(lista) {
              resultados[coleccion] = lista;
            }).catch(function(e) {
              Logger.warn('[DB] Error al cargar ' + coleccion + ' desde Appwrite, usando fallback local:', e.message);
              resultados[coleccion] = null;
            });
          });

          await Promise.all(promesas);

          this._procesarProductos(resultados.productos);
          this._procesarPedidos(resultados.pedidos);
          this._procesarMesas(resultados.mesas);
          this._procesarComandas(resultados.comandas);
          this._procesarInsumos(resultados.insumos);
          this._procesarRecetas(resultados.recetas);

          Logger.info('[DB] Datos cargados exitosamente.');
        } catch (e) {
          Logger.error('[DB] Error al cargar desde Appwrite, usando fallback local:', e);
          this._cargarTodoLocal();
        }
      } else {
        Logger.info('[DB] Appwrite no disponible. Cargando datos desde localStorage...');
        this._cargarTodoLocal();
      }

      Logger.info("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      Logger.error("[DB] Error crítico en init:", e);
      EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
      return false;
    }
  };

  combined._procesarProductos = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.productos = lista.map(p => this._normalizarProducto(p));
    } else {
      this._cargarProductosLocal();
    }
    EventBus.emit('productos:cargados', this.productos);
  };

  combined._cargarProductosLocal = function() {
    const raw = localStorage.getItem('pubpos_productos');
    if (raw) {
      try {
        this.productos = JSON.parse(raw).map(p => this._normalizarProducto(p));
      } catch (e) {
        Logger.error('[DB] Error al parsear productos locales:', e);
        this.productos = [];
      }
    }
  };

  combined._procesarPedidos = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.pedidos = lista.map(p => ({
        ...p,
        items: Array.isArray(p.items) ? p.items : (() => {
          try { return JSON.parse(p.items || '[]'); } catch { return []; }
        })()
      }));
    } else {
      this._cargarPedidosLocal();
    }
  };

  combined._procesarComandas = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.comandas = lista.map(c => ({
        ...c,
        items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items
      }));
    } else {
      this._cargarComandasLocal();
    }
  };

  combined._procesarMesas = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.mesas = lista.map(m => this._normalizarMesa(m));
    } else {
      this._cargarMesasLocal();
    }
    this.mesas.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  };

  combined._procesarInsumos = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.insumos = lista.map(i => this._normalizarInsumo(i));
    } else {
      this._cargarInsumosLocal();
    }
  };

  combined._procesarRecetas = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.recetas = lista.map(function(r) {
        if (typeof r.ingredientes === 'string') {
          try { r.ingredientes = JSON.parse(r.ingredientes); } catch (e) { r.ingredientes = []; }
        }
        r.categoria = r.categoria || 'sin_categoria';
        r.nivel     = r.nivel || 'sin_nivel';
        return r;
      });
    } else {
      this._cargarRecetasLocal();
    }
  };

  combined._cargarTodoLocal = function() {
    this._cargarProductosLocal();
    this._cargarPedidosLocal();
    this._cargarMesasLocal();
    this._cargarComandasLocal();
    this._cargarInsumosLocal();
    this._cargarRecetasLocal();
    this.saveMesas();
    Logger.info('[DB] Todos los datos cargados desde localStorage.');
  };

  combined.sincronizarMesasConConfig = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    const zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    let totalDeseado = 0;
    for (let i = 0; i < zonas.length; i++) {
      totalDeseado += zonas[i].cantidad;
    }

    const virtuales = this.mesas.filter(function(m) { return m.esVirtual; });
    let reales = this.mesas.filter(function(m) { return !m.esVirtual; });

    const ocupadas = reales.filter(function(m) { return m.estado !== 'libre'; });
    let libres = reales.filter(function(m) { return m.estado === 'libre'; });

    Logger.info('[DB] Sincronizando mesas. Deseadas: ' + totalDeseado + ', Actuales: ' + reales.length + ', Ocupadas: ' + ocupadas.length);

    const libresNecesarias = Math.max(0, totalDeseado - ocupadas.length);

    const nuevasMesas = [];
    let mesasAEliminar = [];
    let maxNumero = 0;

    if (reales.length > 0) {
      maxNumero = Math.max.apply(null, reales.map(function(m) { return parseInt(m.numero) || 0; }));
    }

    if (libres.length > libresNecesarias) {
      const sobrantes = libres.length - libresNecesarias;
      libres.sort(function(a, b) { return parseInt(b.numero) - parseInt(a.numero); });
      mesasAEliminar = libres.slice(0, sobrantes);
      libres = libres.slice(sobrantes);
    }

    if (libres.length < libresNecesarias) {
      const faltantes = libresNecesarias - libres.length;
      let numero = maxNumero + 1;
      let creadas = 0;
      for (const zona of zonas) {
        for (let i = 0; i < zona.cantidad && creadas < faltantes; i++) {
          const nueva = mesaVacia(numero, zona.nombre);
          libres.push(nueva);
          nuevasMesas.push(nueva);
          numero++;
          creadas++;
        }
        if (creadas >= faltantes) break;
      }
    }

    for (let i = 0; i < mesasAEliminar.length; i++) {
      const mesa = mesasAEliminar[i];
      try {
        await appwrite.eliminar('mesas', mesa.numero);
        Logger.info('[DB] Mesa ' + mesa.numero + ' eliminada (sobrante).');
      } catch (e) {
        Logger.warn('[DB] Error al eliminar mesa ' + mesa.numero + ':', e);
      }
    }

    for (let i = 0; i < nuevasMesas.length; i++) {
      const mesa = nuevasMesas[i];
      try {
        const dataMesa = {
          numero: mesa.numero,
          estado: 'libre',
          pedidoId: '',
          comensales: 1,
          zona: mesa.zona || 'salon',
          esVirtual: false
        };
        await appwrite.crear('mesas', mesa.numero, dataMesa);
        Logger.info('[DB] Mesa ' + mesa.numero + ' creada en Appwrite (zona: ' + mesa.zona + ').');
      } catch (e) {
        Logger.warn('[DB] Error al crear mesa ' + mesa.numero + ':', e);
      }
    }

    this.mesas = [].concat(ocupadas, libres, virtuales);
    this.mesas.sort(function(a, b) { return parseInt(a.numero) - parseInt(b.numero); });

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    Logger.info('[DB] Sincronización de mesas completada. Total: ' + this.mesas.length);
  };

  combined.resetearMesas = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    const zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    const virtuales = this.mesas.filter(function(m) { return m.esVirtual; });
    const reales = this.mesas.filter(function(m) { return !m.esVirtual; });

    const ocupadas = reales.filter(function(m) { return m.estado !== 'libre'; });
    const libres = reales.filter(function(m) { return m.estado === 'libre'; });

    Logger.info('[DB] Reseteando mesas. Ocupadas: ' + ocupadas.length + ', Libres: ' + libres.length);

    for (let i = 0; i < libres.length; i++) {
      const mesa = libres[i];
      try {
        await appwrite.eliminar('mesas', mesa.numero);
        Logger.info('[DB] Mesa libre ' + mesa.numero + ' eliminada.');
      } catch (e) {
        Logger.warn('[DB] Error al eliminar mesa libre ' + mesa.numero + ':', e);
      }
    }

    let totalDeseado = 0;
    for (let i = 0; i < zonas.length; i++) {
      totalDeseado += zonas[i].cantidad;
    }

    const nuevasMesas = [];
    let numero = 1;
    for (let z = 0; z < zonas.length; z++) {
      const zona = zonas[z];
      for (let n = 0; n < zona.cantidad; n++) {
        const nueva = mesaVacia(String(numero), zona.nombre);
        nuevasMesas.push(nueva);
        numero++;
      }
    }

    let siguienteNumero = totalDeseado + 1;
    for (let i = 0; i < ocupadas.length; i++) {
      const ocupada = ocupadas[i];
      ocupada.numero = String(siguienteNumero);
      siguienteNumero++;
      nuevasMesas.push(ocupada);
    }

    for (let i = 0; i < nuevasMesas.length; i++) {
      const mesa = nuevasMesas[i];
      try {
        const dataMesa = {
          numero: mesa.numero,
          estado: mesa.estado || 'libre',
          pedidoId: mesa.pedidoId || '',
          comensales: mesa.comensales || 1,
          zona: mesa.zona || 'salon',
          esVirtual: mesa.esVirtual || false
        };
        await appwrite.crear('mesas', mesa.numero, dataMesa);
        Logger.info('[DB] Mesa ' + mesa.numero + ' creada en Appwrite (reset).');
      } catch (e) {
        Logger.warn('[DB] Error al crear mesa ' + mesa.numero + ':', e);
      }
    }

    this.mesas = nuevasMesas.concat(virtuales);
    this.mesas.sort(function(a, b) { return parseInt(a.numero) - parseInt(b.numero); });

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    Logger.info('[DB] Reseteo de mesas completado. Total: ' + this.mesas.length);
  };

  combined._cargarConfiguracion = async function() {
    if (typeof appwrite !== 'undefined' && appwrite.habilitado) {
      try {
        const configAppwrite = await appwrite.listar('configuracion');
        const docGlobal = configAppwrite.find(function(d) { return d.clave === 'global'; });
        if (docGlobal && docGlobal.valor) {
          this.config = JSON.parse(docGlobal.valor);
          Logger.info('[DB] Configuración cargada desde Appwrite.');
          if (!this.config.zonas) {
            this.config.zonas = [{ nombre: 'salon', cantidad: 12 }];
          }
          return;
        }
      } catch (e) {
        Logger.warn('[DB] No se pudo cargar configuración desde Appwrite, usando local. Error:', e.message);
      }
    }

    if (typeof DBCore._cargarConfigLocal === 'function') {
      DBCore._cargarConfigLocal.call(this);
    } else {
      Logger.error('[DB] Método _cargarConfigLocal no disponible. Usando configuración por defecto.');
      this.config = {
        nombreLocal: 'La Taberna',
        direccion: 'Av. Corrientes 1234',
        cuit: '30-12345678-9',
        pieTicket: '¡Gracias por visitarnos!',
        zonas: [
          { nombre: 'salon',   cantidad: 12 },
          { nombre: 'terraza', cantidad: 0 }
        ]
      };
    }

    if (!this.config.zonas) {
      this.config.zonas = [{ nombre: 'salon', cantidad: 12 }];
    }
  };

  combined._mostrarErrorCarga = function() {
    EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
  };

  combined.espacioActivoId = function() {
    if (typeof Auth !== 'undefined' && Auth.obtenerLocalActivo) {
      const espacio = Auth.obtenerLocalActivo();
      if (espacio && espacio.id) return espacio.id;
    }
    return 'esp_taberna';
  };

  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) { Logger.warn(`[DB] Pedido ${id} no encontrado.`); return null; }
    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      Logger.warn(`[DB] El pedido ${id} ya está cerrado.`);
      return pedido;
    }
    if (appwrite && appwrite.habilitado) {
      try {
        await appwrite.actualizar('pedidos', id, { estado: 'cerrada', total: total });
        Logger.info(`[DB] Pedido ${id} actualizado en Appwrite.`);
      } catch (e) { Logger.error("[DB] Error al actualizar pedido en Appwrite:", e); return null; }
    }
    pedido.estado = 'cerrada';
    pedido.total = total;
    pedido.actualizadoEn = new Date().toISOString();
    return pedido;
  };

  return combined;
})();