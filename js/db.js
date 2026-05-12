/* ================================================================
   Raíz — MÓDULO: db.js (Orquestador híbrido v4.0)
   Propósito: Si Appwrite está configurado y activo, lo usa como
              fuente primaria. Si no, usa Google Sheets.
              Combina DB core, sync, inventario y fusión.
   ================================================================ */
var DB = (function() {
  const core = DBCore;
  const sync = window.DBSync;
  const inventario = DBInventario;
  const fusion = DBFusion;
  var appwrite = window.DBAppwrite;

  const combined = {
    ...core,
    ...sync,
    ...inventario,
    ...fusion
  };

  combined.urlSheets = sync.urlSheets;

  /**
   * Inicializa la base de datos. Si Appwrite está habilitado, obtiene
   * los datos desde allí; si no, desde Google Sheets.
   * @returns {Promise<boolean>}
   */
  combined.init = async function() {
    try {
      Logger.info("[DB] Iniciando carga de datos...");

      // 1. Inicializar Appwrite (si hay credenciales y está activado)
      var appwriteOk = false;
      if (appwrite && appwrite.init) {
        appwriteOk = await appwrite.init();
      }

      // 2. Cargar datos locales de respaldo
      this._cargarConfigLocal();
      this._inicializarMesas();
      this._cargarComandasLocal();
      this._cargarPedidosLocal();
      this._cargarMozosLocal();
      this._cargarIngredientesLocal();
      this._cargarRecetasLocal();
      this._cargarMovimientosLocal();
      this._cargarSyncQueueLocal();
      this._cargarPedidosDeliveryLocal();

      // 3. Si Appwrite está activo, leer desde allí y pisar datos locales
      if (appwriteOk) {
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
            this.savePedidos();
          }

          var comandasAppwrite = await appwrite.listar('comandas');
          if (comandasAppwrite.length) {
            this.comandas = comandasAppwrite.map(c => ({
              ...c,
              items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items
            }));
            this.saveComandas();
          }

          var mesasAppwrite = await appwrite.listar('mesas');
          if (mesasAppwrite.length) {
            this.mesas = mesasAppwrite.map(m => this._normalizarMesa(m));
            this.saveMesas();
          }

          var ingAppwrite = await appwrite.listar('ingredientes');
          if (ingAppwrite.length) {
            this.ingredientes = ingAppwrite.map(i => this._normalizarIngrediente(i));
            this.saveIngredientes();
          }

          var recAppwrite = await appwrite.listar('recetas');
          if (recAppwrite.length) {
            this.recetas = recAppwrite;
            this.saveRecetas();
          }

          // Pedidos delivery desde Appwrite si existen
          try {
            var delivAppwrite = await appwrite.listar('pedidos_delivery');
            if (delivAppwrite.length) {
              this.pedidosDelivery = delivAppwrite;
              this.savePedidosDelivery();
            }
          } catch (e) {
            Logger.debug('[DB] Sin pedidos delivery en Appwrite.');
          }

          Logger.info('[DB] Datos de Appwrite cargados exitosamente.');
        } catch (e) {
          Logger.warn('[DB] Error al leer desde Appwrite, usando datos locales:', e);
        }
      } else {
        // Sin Appwrite, intentamos cargar de Sheets como siempre
        await this._fetchProductos();
        this._fetchMozos().catch(e => Logger.warn("[DB] Mozos remotos no disponibles", e));
        this._fetchIngredientes().catch(e => Logger.warn("[DB] Ingredientes remotos no disponibles", e));
        this._fetchRecetas().catch(e => Logger.warn("[DB] Recetas remotas no disponibles", e));
        this._fetchPedidos().catch(e => Logger.warn("[DB] Pedidos remotos no disponibles", e));
      }

      await this._procesarSyncQueue();

      Logger.info("[DB] Inicialización completada.");
      EventBus.emit('db:inicializada');
      return true;
    } catch (e) {
      Logger.error("[DB] Error crítico en init:", e);
      this._mostrarErrorCarga();
      return false;
    }
  };

  combined._mostrarErrorCarga = function() {
    EventBus.emit('app:error', 'No se pudieron cargar los datos iniciales.');
  };

  /**
   * Retorna el id del espacio activo actual.
   * @returns {string}
   */
  combined.espacioActivoId = function() {
    if (typeof Auth !== 'undefined' && Auth.getEspacioActivo) {
      const espacio = Auth.getEspacioActivo();
      if (espacio && espacio.id) return espacio.id;
    }
    return 'esp_taberna';
  };

  /**
   * Cierra un pedido. Si Appwrite está activo, actualiza allí también.
   * Luego sincroniza con Sheets como respaldo.
   */
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

    try {
      const items = JSON.parse(pedido.items || '[]');
      for (const item of items) {
        await this.consumirIngredientesDeProducto(item.prodId, item.qty, `Venta Mesa ${pedido.mesa}`);
      }
    } catch (e) {
      Logger.warn("[DB] Error descontando stock local:", e);
    }

    // Actualizar en Appwrite si está habilitado
    if (appwrite && appwrite.habilitado) {
      try {
        await appwrite.actualizar('pedidos', id, {
          estado: 'cerrada',
          total: total,
          updated_at: new Date().toISOString()
        });
        Logger.info(`[DB] Pedido ${id} actualizado en Appwrite.`);
      } catch (e) {
        Logger.warn("[DB] Error al actualizar pedido en Appwrite:", e);
      }
    }

    // Sincronizar con Sheets como respaldo (si está disponible)
    try {
      const items = JSON.parse(pedido.items || '[]');
      await fetch(this.urlSheets, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'procesarVenta',
          items: items.map(it => ({ productoId: it.prodId, cantidad: it.qty }))
        })
      });
    } catch (e) {
      Logger.warn("[DB] No se pudo descontar stock online, encolando.");
      this._encolarOperacion('procesarVenta', {
        items: JSON.parse(pedido.items || '[]').map(it => ({ productoId: it.prodId, cantidad: it.qty }))
      });
    }

    const pedidoActualizado = this.actualizarPedido(id, {
      estado: 'cerrada',
      total,
      updated_at: new Date().toISOString()
    });

    if (pedidoActualizado) {
      const pedidoParaSync = {
        id: pedidoActualizado.id,
        mesa: pedidoActualizado.mesa,
        mozo: pedidoActualizado.mozo || 'Sin mozo',
        comensales: pedidoActualizado.comensales || 1,
        estado: pedidoActualizado.estado,
        items: Array.isArray(pedidoActualizado.items)
                 ? JSON.stringify(pedidoActualizado.items)
                 : pedidoActualizado.items,
        total: pedidoActualizado.total,
        created_at: pedidoActualizado.created_at,
        updated_at: pedidoActualizado.updated_at
      };

      try {
        await this.syncGuardarPedido(pedidoParaSync);
        Logger.info(`[DB] Pedido ${id} sincronizado con Sheets como cerrado.`);
      } catch (e) {
        Logger.warn(`[DB] Error al sincronizar cierre del pedido ${id}. Encolando.`);
        this._encolarOperacion('guardarPedido', { pedido: pedidoParaSync });
      }
    }

    return pedidoActualizado;
  };

  return combined;
})();

window.DB = DB;