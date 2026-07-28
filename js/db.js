/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db.js
   Versión: 1.0.14
   Propósito: Orquestador de base de datos (Appwrite + localStorage).
              Sincronización y reseteo de mesas por configuración de zonas.
              Fallback offline robusto: si Appwrite no responde,
              carga desde localStorage y continúa operando.
              v1.0.14: Auth.getEspacioActivo → Auth.obtenerEspacioActivo.
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
  var appwrite = DBAppwrite;
  var shim = DBShim;

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

      var appwriteOk = false;
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
          var resultados = {};
          var promesas = [
            'productos',
            'pedidos',
            'mesas',
            'comandas',
            'ingredientes',
            'recetas',
            'pedidos_delivery'
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
          this._procesarIngredientes(resultados.ingredientes);
          this._procesarRecetas(resultados.recetas);
          this._procesarPedidosDelivery(resultados.pedidos_delivery);

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
        items: typeof p.items === 'string' ? p.items : JSON.stringify(p.items)
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
    this.mesas.sort((a, b) => a.numero - b.numero);
  };

  combined._procesarIngredientes = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.ingredientes = lista.map(i => this._normalizarIngrediente(i));
    } else {
      this._cargarIngredientesLocal();
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

  combined._procesarPedidosDelivery = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.pedidosDelivery = lista;
    } else {
      this._cargarPedidosDeliveryLocal();
    }
  };

  combined._cargarTodoLocal = function() {
    this._cargarProductosLocal();
    this._cargarPedidosLocal();
    this._cargarMesasLocal();
    this._cargarComandasLocal();
    this._cargarIngredientesLocal();
    this._cargarRecetasLocal();
    this._cargarPedidosDeliveryLocal();
    this.saveMesas();
    Logger.info('[DB] Todos los datos cargados desde localStorage.');
  };

  combined.sincronizarMesasConConfig = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    var zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    var totalDeseado = 0;
    for (var i = 0; i < zonas.length; i++) {
      totalDeseado += zonas[i].cantidad;
    }

    var virtuales = this.mesas.filter(function(m) { return m.esVirtual; });
    var reales = this.mesas.filter(function(m) { return !m.esVirtual; });

    var ocupadas = reales.filter(function(m) { return m.estado !== 'libre'; });
    var libres = reales.filter(function(m) { return m.estado === 'libre'; });

    Logger.info('[DB] Sincronizando mesas. Deseadas: ' + totalDeseado + ', Actuales: ' + reales.length + ', Ocupadas: ' + ocupadas.length);

    var libresNecesarias = Math.max(0, totalDeseado - ocupadas.length);

    var nuevasMesas = [];
    var mesasAEliminar = [];
    var maxNumero = 0;

    if (reales.length > 0) {
      maxNumero = Math.max.apply(null, reales.map(function(m) { return m.numero; }));
    }

    if (libres.length > libresNecesarias) {
      var sobrantes = libres.length - libresNecesarias;
      libres.sort(function(a, b) { return b.numero - a.numero; });
      mesasAEliminar = libres.slice(0, sobrantes);
      libres = libres.slice(sobrantes);
    }

    if (libres.length < libresNecesarias) {
      var faltantes = libresNecesarias - libres.length;
      for (var j = 0; j < faltantes; j++) {
        maxNumero++;
        var zonaNombre = zonas[0]?.nombre || 'salon';
        var nueva = mesaVacia(maxNumero, zonaNombre);
        libres.push(nueva);
        nuevasMesas.push(nueva);
      }
    }

    for (var i = 0; i < mesasAEliminar.length; i++) {
      var mesa = mesasAEliminar[i];
      try {
        await appwrite.eliminar('mesas', String(mesa.numero));
        Logger.info('[DB] Mesa ' + mesa.numero + ' eliminada (sobrante).');
      } catch (e) {
        Logger.warn('[DB] Error al eliminar mesa ' + mesa.numero + ':', e);
      }
    }

    for (var i = 0; i < nuevasMesas.length; i++) {
      var mesa = nuevasMesas[i];
      try {
        var dataMesa = {
          numero: mesa.numero,
          estado: 'libre',
          pedidoId: '',
          items: '[]',
          mozo: '',
          comensales: 1,
          abiertaEn: new Date().toISOString(),
          observaciones: '',
          zona: mesa.zona || 'salon',
          esVirtual: false,
          permite_prepedidos: false
        };
        await appwrite.crear('mesas', String(mesa.numero), dataMesa);
        Logger.info('[DB] Mesa ' + mesa.numero + ' creada en Appwrite.');
      } catch (e) {
        Logger.warn('[DB] Error al crear mesa ' + mesa.numero + ':', e);
      }
    }

    this.mesas = [].concat(ocupadas, libres, virtuales);
    this.mesas.sort(function(a, b) { return a.numero - b.numero; });

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    Logger.info('[DB] Sincronización de mesas completada. Total: ' + this.mesas.length);
  };

  combined.resetearMesas = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    var zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    var virtuales = this.mesas.filter(function(m) { return m.esVirtual; });
    var reales = this.mesas.filter(function(m) { return !m.esVirtual; });

    var ocupadas = reales.filter(function(m) { return m.estado !== 'libre'; });
    var libres = reales.filter(function(m) { return m.estado === 'libre'; });

    Logger.info('[DB] Reseteando mesas. Ocupadas: ' + ocupadas.length + ', Libres: ' + libres.length);

    for (var i = 0; i < libres.length; i++) {
      var mesa = libres[i];
      try {
        await appwrite.eliminar('mesas', String(mesa.numero));
        Logger.info('[DB] Mesa libre ' + mesa.numero + ' eliminada.');
      } catch (e) {
        Logger.warn('[DB] Error al eliminar mesa libre ' + mesa.numero + ':', e);
      }
    }

    var totalDeseado = 0;
    for (var i = 0; i < zonas.length; i++) {
      totalDeseado += zonas[i].cantidad;
    }

    var nuevasMesas = [];
    var numero = 1;
    for (var z = 0; z < zonas.length; z++) {
      var zona = zonas[z];
      for (var n = 0; n < zona.cantidad; n++) {
        var nueva = mesaVacia(numero, zona.nombre);
        nuevasMesas.push(nueva);
        numero++;
      }
    }

    var siguienteNumero = totalDeseado + 1;
    for (var i = 0; i < ocupadas.length; i++) {
      var ocupada = ocupadas[i];
      ocupada.numero = siguienteNumero;
      siguienteNumero++;
      nuevasMesas.push(ocupada);
    }

    for (var i = 0; i < nuevasMesas.length; i++) {
      var mesa = nuevasMesas[i];
      try {
        var dataMesa = {
          numero: mesa.numero,
          estado: mesa.estado || 'libre',
          pedidoId: mesa.pedidoId || '',
          items: Array.isArray(mesa.items) ? JSON.stringify(mesa.items) : (mesa.items || '[]'),
          mozo: mesa.mozo || '',
          comensales: mesa.comensales || 1,
          abiertaEn: mesa.abiertaEn || new Date().toISOString(),
          observaciones: mesa.observaciones || '',
          zona: mesa.zona || 'salon',
          esVirtual: mesa.esVirtual || false,
          permite_prepedidos: mesa.permite_prepedidos || false
        };
        await appwrite.crear('mesas', String(mesa.numero), dataMesa);
        Logger.info('[DB] Mesa ' + mesa.numero + ' creada en Appwrite (reset).');
      } catch (e) {
        Logger.warn('[DB] Error al crear mesa ' + mesa.numero + ':', e);
      }
    }

    this.mesas = nuevasMesas.concat(virtuales);
    this.mesas.sort(function(a, b) { return a.numero - b.numero; });

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    Logger.info('[DB] Reseteo de mesas completado. Total: ' + this.mesas.length);
  };

  combined._cargarConfiguracion = async function() {
    if (typeof appwrite !== 'undefined' && appwrite.habilitado) {
      try {
        var configAppwrite = await appwrite.listar('configuracion');
        var docGlobal = configAppwrite.find(function(d) { return d.clave === 'global'; });
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
    if (typeof Auth !== 'undefined' && Auth.obtenerEspacioActivo) {
      const espacio = Auth.obtenerEspacioActivo();
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