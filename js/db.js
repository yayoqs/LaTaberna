/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/db.js
   Versión: 1.0.0
   Propósito: Orquestador de base de datos (Appwrite + localStorage).
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
      if (appwrite && appwrite.iniciar) {
        appwriteOk = await appwrite.iniciar();
      }

      if (!appwriteOk) {
        Logger.warn("[DB] Appwrite no disponible. La aplicación no puede iniciar.");
        this._mostrarErrorCarga();
        return false;
      }

      await this._cargarConfiguracion();
      this._cargarMozosLocal();

      Logger.info('[DB] Cargando datos desde Appwrite (paralelo)...');
      try {
        // ── Carga paralela de todas las colecciones ──────────
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
            Logger.warn('[DB] Error al cargar ' + coleccion + ':', e);
            resultados[coleccion] = [];
          });
        });

        await Promise.all(promesas);

        // ── Procesar resultados ──────────────────────────────
        var prodAppwrite = resultados.productos || [];
        if (prodAppwrite.length) {
          this.productos = prodAppwrite.map(p => this._normalizarProducto(p));
          EventBus.emit('productos:cargados', this.productos);
        }

        var pedidosAppwrite = resultados.pedidos || [];
        if (pedidosAppwrite.length) {
          this.pedidos = pedidosAppwrite.map(p => ({
            ...p,
            items: typeof p.items === 'string' ? p.items : JSON.stringify(p.items)
          }));
        }

        var comandasAppwrite = resultados.comandas || [];
        if (comandasAppwrite.length) {
          this.comandas = comandasAppwrite.map(c => ({
            ...c,
            items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items
          }));
        }

        var mesasAppwrite = resultados.mesas || [];
        this.mesas = mesasAppwrite.length > 0
          ? mesasAppwrite.map(m => this._normalizarMesa(m))
          : [];

        var ingAppwrite = resultados.ingredientes || [];
        if (ingAppwrite.length) {
          this.ingredientes = ingAppwrite.map(i => this._normalizarIngrediente(i));
        }

        var recAppwrite = resultados.recetas || [];
        if (recAppwrite.length) {
          this.recetas = recAppwrite.map(function(r) {
            if (typeof r.ingredientes === 'string') {
              try { r.ingredientes = JSON.parse(r.ingredientes); } catch (e) { r.ingredientes = []; }
            }
            return r;
          });
        }

        var delivAppwrite = resultados.pedidos_delivery || [];
        if (delivAppwrite.length) {
          this.pedidosDelivery = delivAppwrite;
        }

        Logger.info('[DB] Datos de Appwrite cargados exitosamente.');
      } catch (e) {
        Logger.error('[DB] Error al cargar desde Appwrite:', e);
        this._mostrarErrorCarga();
        return false;
      }

      // ── REPARACIÓN MÍNIMA: solo mesa 1 si no hay ninguna ──
      await this.repararMesas();

      Logger.info("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      Logger.error("[DB] Error crítico en init:", e);
      this._mostrarErrorCarga();
      return false;
    }
  };

  /**
   * Repara la grilla mínima: garantiza que exista la mesa 1 en salón.
   * No borra mesas existentes, no regenera la grilla completa.
   */
  combined.repararMesas = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    var zonaDefault = (this.config.zonas && this.config.zonas[0]?.nombre) || 'salon';

    var mesa1 = this.mesas.find(m => m.numero === 1);
    if (mesa1) return;

    Logger.info('[DB] Mesa 1 no encontrada. Creando automáticamente...');
    var nuevaMesa = mesaVacia(1, zonaDefault);

    try {
      var dataMesa = {
        numero: 1,
        estado: 'libre',
        pedidoId: '',
        items: '[]',
        mozo: '',
        comensales: 1,
        abiertaEn: new Date().toISOString(),
        observaciones: '',
        zona: zonaDefault,
        esVirtual: false,
        permite_prepedidos: false
      };
      await appwrite.crear('mesas', '1', dataMesa);
      this.mesas.push(nuevaMesa);
      this.mesas.sort((a, b) => a.numero - b.numero);
      this.saveMesas();
      EventBus.emit('mesas:guardadas', this.mesas);
      Logger.info('[DB] Mesa 1 creada exitosamente.');
    } catch (e) {
      Logger.warn('[DB] Error al crear mesa 1:', e);
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
    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'PEDIDO_CERRADO', payload: { id, total, updated_at: pedido.actualizadoEn } });
    }
    return pedido;
  };

  combined.sincronizarMesasConConfig = async function() {
    return this.repararMesas();
  };

  return combined;
})();

window.DB = DB;