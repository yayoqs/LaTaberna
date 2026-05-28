/* ================================================================
   Raíz — MÓDULO: db.js (Orquestador v5.3 – mesas ordenadas)
   Propósito: Appwrite es la única fuente de verdad. La configuración
              de zonas se carga desde Appwrite (con fallback local).
              Las mesas se generan según la configuración si Appwrite
              está vacío y siempre se ordenan por número.
   ================================================================ */
var DB = (function() {
  const core = DBCore;
  const inventario = DBInventario;
  const fusion = DBFusion;
  var appwrite = window.DBAppwrite;
  var shim = window.DBShim;

  const combined = {
    ...core,
    ...inventario,
    ...fusion,
    ...shim
  };

  combined.init = async function() {
    try {
      Logger.info("[DB] Iniciando carga de datos (Appwrite)...");

      var appwriteOk = false;
      if (appwrite && appwrite.init) {
        appwriteOk = await appwrite.init();
      }

      if (!appwriteOk) {
        Logger.warn("[DB] Appwrite no disponible. La aplicación no puede iniciar.");
        this._mostrarErrorCarga();
        return false;
      }

      // Cargar configuración desde Appwrite (o localStorage si no existe)
      await this._cargarConfiguracion();

      this._cargarMozosLocal();

      Logger.info('[DB] Cargando datos desde Appwrite...');
      try {
        var prodAppwrite = await appwrite.listar('productos');
        if (prodAppwrite.length) {
          this.productos = prodAppwrite.map(p => this._normalizarProducto(p));
          EventBus.emit('productos:cargados', this.productos);
        }

        var pedidosAppwrite = await appwrite.listar('pedidos');
        if (pedidosAppwrite.length) {
          this.pedidos = pedidosAppwrite.map(p => ({
            ...p,
            items: typeof p.items === 'string' ? p.items : JSON.stringify(p.items)
          }));
        }

        var comandasAppwrite = await appwrite.listar('comandas');
        if (comandasAppwrite.length) {
          this.comandas = comandasAppwrite.map(c => ({
            ...c,
            items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items
          }));
        }

        var mesasAppwrite = await appwrite.listar('mesas');
        if (mesasAppwrite.length > 0) {
          this.mesas = mesasAppwrite.map(m => this._normalizarMesa(m));
          this.mesas.sort((a, b) => a.numero - b.numero); // ← Ordenar siempre
          Logger.info('[DB] ' + this.mesas.length + ' mesas cargadas desde Appwrite.');
        } else {
          Logger.info('[DB] Sin mesas en Appwrite. Generando desde config.zonas...');
          this.mesas = [];
          var zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];
          var numero = 1;
          for (var z = 0; z < zonas.length; z++) {
            var zona = zonas[z];
            for (var n = 0; n < zona.cantidad; n++) {
              this.mesas.push({
                ...mesaVacia(numero, zona.nombre),
                numero: numero
              });
              numero++;
            }
          }
          this.mesas.sort((a, b) => a.numero - b.numero); // ← Ordenar también las generadas
          Logger.info('[DB] ' + this.mesas.length + ' mesas iniciales generadas localmente.');
          this._mesasPendientesSync = true;
        }

        var ingAppwrite = await appwrite.listar('ingredientes');
        if (ingAppwrite.length) {
          this.ingredientes = ingAppwrite.map(i => this._normalizarIngrediente(i));
        }

        var recAppwrite = await appwrite.listar('recetas');
        if (recAppwrite.length) {
          this.recetas = recAppwrite.map(function(r) {
            if (typeof r.ingredientes === 'string') {
              try { r.ingredientes = JSON.parse(r.ingredientes); } catch (e) { r.ingredientes = []; }
            }
            return r;
          });
        }

        try {
          var delivAppwrite = await appwrite.listar('pedidos_delivery');
          if (delivAppwrite.length) {
            this.pedidosDelivery = delivAppwrite;
          }
        } catch (e) {
          Logger.debug('[DB] Sin pedidos delivery en Appwrite.');
        }

        Logger.info('[DB] Datos de Appwrite cargados exitosamente.');
      } catch (e) {
        Logger.error('[DB] Error al cargar desde Appwrite:', e);
        this._mostrarErrorCarga();
        return false;
      }

      Logger.info("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      Logger.error("[DB] Error crítico en init:", e);
      this._mostrarErrorCarga();
      return false;
    }
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
        Logger.warn('[DB] No se pudo cargar configuración desde Appwrite, usando local.');
      }
    }
    this._cargarConfigLocal();
    if (!this.config.zonas) {
      this.config.zonas = [{ nombre: 'salon', cantidad: 12 }];
    }
  };

  combined._mostrarErrorCarga = function() {
    EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
  };

  combined.espacioActivoId = function() {
    if (typeof Auth !== 'undefined' && Auth.getEspacioActivo) {
      const espacio = Auth.getEspacioActivo();
      if (espacio && espacio.id) return espacio.id;
    }
    return 'esp_taberna';
  };

  combined.cerrarPedido = async function(id, formaPago, total, descuento) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) {
      Logger.warn(`[DB] Pedido ${id} no encontrado.`);
      return null;
    }

    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      Logger.warn(`[DB] El pedido ${id} ya está cerrado.`);
      return pedido;
    }

    if (appwrite && appwrite.habilitado) {
      try {
        await appwrite.actualizar('pedidos', id, {
          estado: 'cerrada',
          total: total,
          updated_at: new Date().toISOString()
        });
        Logger.info(`[DB] Pedido ${id} actualizado en Appwrite.`);
      } catch (e) {
        Logger.error("[DB] Error al actualizar pedido en Appwrite:", e);
        return null;
      }
    }

    pedido.estado = 'cerrada';
    pedido.total = total;
    pedido.updated_at = new Date().toISOString();

    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'PEDIDO_CERRADO', payload: { id, total, updated_at: pedido.updated_at } });
    }

    return pedido;
  };

  return combined;
})();

window.DB = DB;