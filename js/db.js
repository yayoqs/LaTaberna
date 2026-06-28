/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/db.js
   Versión: 1.0.2
   Propósito: Orquestador de base de datos (Appwrite + localStorage).
              Sincronización y reseteo de mesas por configuración de zonas.
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
   * Sincroniza la grilla de mesas con la configuración de zonas.
   * - Crea las mesas que falten para alcanzar el total deseado.
   * - Elimina mesas libres sobrantes si hay más de las necesarias.
   * - Respeta las mesas ocupadas, incluso si exceden el total.
   */
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

  /**
   * Resetea completamente la grilla de mesas:
   * elimina todas las mesas libres de Appwrite y las recrea desde cero
   * según la configuración de zonas, comenzando desde el número 1.
   * Las mesas ocupadas se conservan y se reubican al final de la numeración.
   */
  combined.resetearMesas = async function() {
    if (!appwrite || !appwrite.habilitado) return;

    var zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    // Separar mesas virtuales
    var virtuales = this.mesas.filter(function(m) { return m.esVirtual; });
    var reales = this.mesas.filter(function(m) { return !m.esVirtual; });

    // Separar ocupadas y libres
    var ocupadas = reales.filter(function(m) { return m.estado !== 'libre'; });
    var libres = reales.filter(function(m) { return m.estado === 'libre'; });

    Logger.info('[DB] Reseteando mesas. Ocupadas: ' + ocupadas.length + ', Libres: ' + libres.length);

    // 1. Eliminar TODAS las mesas libres de Appwrite
    for (var i = 0; i < libres.length; i++) {
      var mesa = libres[i];
      try {
        await appwrite.eliminar('mesas', String(mesa.numero));
        Logger.info('[DB] Mesa libre ' + mesa.numero + ' eliminada.');
      } catch (e) {
        Logger.warn('[DB] Error al eliminar mesa libre ' + mesa.numero + ':', e);
      }
    }

    // 2. Crear la grilla nueva desde 1 según las zonas
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

    // 3. Reubicar mesas ocupadas al final
    var siguienteNumero = totalDeseado + 1;
    for (var i = 0; i < ocupadas.length; i++) {
      var ocupada = ocupadas[i];
      ocupada.numero = siguienteNumero;
      siguienteNumero++;
      nuevasMesas.push(ocupada);
    }

    // 4. Crear las mesas nuevas en Appwrite
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

    // 5. Actualizar array local
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

  return combined;
})();

window.DB = DB;