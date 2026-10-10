/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db.js
   Versión: 1.6.7
   Propósito: Orquestador de base de datos (Appwrite + localStorage).
              v1.6.7: A.76: se agrega carga inicial de cartas.
                      'cartas' se suma a la lista de colecciones
                      paralelas en init(). Se agrega
                      _procesarCartas siguiendo el patrón de
                      _procesarVariantes. Célula E agrega el
                      despacho CARTAS_INICIALIZAR en bootstrap.js
                      v1.0.23. Coexistencia con el despacho
                      incremental de carta-editor/acciones.js
                      v2.0.3 (guardar y cargar manual). Aprobado
                      por Coordinación 2026-10-09 20:00 UTC.
              v1.6.6: hallazgo 3 del saneamiento post-movimientos.
              v1.6.5: A.74: carga inicial de movimientos en paralelo.
              v1.6.4: A.71: sincronizarLabelsStaff y vincularCuentaStaff
                      usan DBAppwrite.invocarAsignarRol (SDK oficial).
              v1.6.3: A.46: carga inicial de variantes.
              v1.6.2: A.13: _cargarConfiguracion filtra por espacioId.
              v1.6.1: Restaurado el bloque de idempotencia en
                      cerrarPedido.
              v1.6.0: JWT en llamadas a asignar-rol.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Store } from './lib/store.js';
import { DBCore, mesaVacia } from './db-core.js';
import { DBInventario } from './db-inventario.js';
import { DBFusion } from './db-fusion.js';
import { DBAppwrite } from './db-appwrite.js';
import { DBShim } from './db-shim.js';
import { Deps } from './lib/deps.js';
import { Roles } from './roles.js';
import { Auth } from './auth.js';

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

  // ── IDEMPOTENCIA DE CIERRE DE PEDIDO ─────────────────────
  const _clavesIdempotencia = new Map();

  function _cargarClavesIdempotencia() {
    try {
      const raw = localStorage.getItem('db_idempotencia');
      if (raw) {
        const obj = JSON.parse(raw);
        Object.keys(obj).forEach(k => _clavesIdempotencia.set(k, obj[k]));
      }
    } catch (e) {
      Logger.warn('[DB] No se pudo cargar claves de idempotencia:', e.message);
    }
  }

  function _guardarClavesIdempotencia() {
    try {
      const obj = {};
      _clavesIdempotencia.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('db_idempotencia', JSON.stringify(obj));
    } catch (e) {
      Logger.warn('[DB] No se pudo guardar claves de idempotencia:', e.message);
    }
  }

  _cargarClavesIdempotencia();

  /* ── STAFF ─────────────────────────────────────────────── */

  function _rolesActuales() {
    try {
      return Auth.obtenerRolesEfectivos();
    } catch {
      return [];
    }
  }

  function _validarAsignacionRoles(rolesObjetivo, rolPrincipal) {
    const rolesActuales = _rolesActuales();
    if (rolesActuales.includes('master')) return;

    const puedeAsignar = rolesObjetivo.every(rolObjetivo =>
      rolesActuales.some(rolActual =>
        Roles.puedeAsignar(rolActual, rolObjetivo)
      )
    );

    if (!puedeAsignar) {
      throw new Error('No tienes permisos para asignar esos roles.');
    }

    if (!rolesObjetivo.includes(rolPrincipal)) {
      throw new Error('El rol principal debe estar incluido en los roles asignados.');
    }
  }

  combined.obtenerStaffPorUsuario = async function(usuarioId, espacioId) {
    if (appwrite && appwrite.habilitado) {
      return await appwrite.obtenerStaffPorUsuarioEspacio(usuarioId, espacioId);
    }
    return (this.staff || []).find(s => s.usuarioId === usuarioId && s.espacioId === espacioId) || null;
  };

  combined.obtenerStaffPorEspacio = async function(espacioId) {
    if (appwrite && appwrite.habilitado) {
      return await appwrite.obtenerStaffPorEspacio(espacioId);
    }
    return (this.staff || []).filter(s => s.espacioId === espacioId);
  };

  combined.crearOActualizarStaff = async function(datos) {
    const {
      nombre, usuarioId, espacioId, roles, rolPrincipal, estado,
      fechaIngreso, telefono, email, notas, tokenVinculacion
    } = datos;

    if (!usuarioId || !espacioId) throw new Error('usuarioId y espacioId son obligatorios');
    if (!nombre) throw new Error('nombre es obligatorio');

    const rolesArray = Array.isArray(roles) ? roles : (() => {
      try { return JSON.parse(roles || '[]'); } catch { return []; }
    })();

    const rolPrincipalFinal = rolPrincipal || rolesArray[0] || 'mesero';
    _validarAsignacionRoles(rolesArray, rolPrincipalFinal);

    const registro = {
      nombre, usuarioId, espacioId,
      roles: JSON.stringify(rolesArray),
      rolPrincipal: rolPrincipalFinal,
      estado: estado || 'activo',
      fechaIngreso: fechaIngreso || null,
      telefono: telefono || '',
      email: email || '',
      notas: notas || '',
      tokenVinculacion: tokenVinculacion || ''
    };

    let resultado;
    if (appwrite && appwrite.habilitado) {
      const existente = await this.obtenerStaffPorUsuario(usuarioId, espacioId);
      if (existente) {
        await appwrite.actualizar('staff', existente.id, registro);
        resultado = { ...existente, ...registro, id: existente.id };
      } else {
        resultado = await appwrite.crear('staff', null, registro);
      }
    } else {
      this.staff = this.staff || [];
      const idx = this.staff.findIndex(s => s.usuarioId === usuarioId && s.espacioId === espacioId);
      if (idx >= 0) {
        this.staff[idx] = { ...this.staff[idx], ...registro };
        resultado = this.staff[idx];
      } else {
        this.staff.push({ id: 'staff_' + Date.now(), ...registro });
        resultado = this.staff[this.staff.length - 1];
      }
    }

    if (resultado) {
      try {
        await this.sincronizarLabelsStaff(usuarioId, espacioId, rolesArray);
      } catch (e) {
        Logger.warn('[DB] No se pudo sincronizar labels de staff:', e.message);
      }
    }

    return resultado;
  };

  combined.vincularCuentaStaff = async function(token) {
    if (!token) throw new Error('Token de vinculación requerido');
    const usuarioId = await this.obtenerIdUsuarioActual?.();
    if (!usuarioId) return { exito: false, error: 'No hay cuenta activa para vincular' };

    try {
      const respuesta = await DBAppwrite.invocarAsignarRol({ token, userId: usuarioId });

      if (!respuesta || respuesta.exito !== true) {
        const mensaje = respuesta?.error || 'Error al canjear token';
        Logger.warn('[DB] No se pudo canjear token:', mensaje);
        return { exito: false, error: mensaje };
      }

      return { exito: true, staff: respuesta.staff };
    } catch (e) {
      Logger.error('[DB] Error al invocar asignar-rol para vinculación:', e);
      return { exito: false, error: 'No se pudo conectar con el servicio de vinculación' };
    }
  };

  combined.sincronizarLabelsStaff = async function(usuarioId, espacioId, roles) {
    Logger.info(`[DB] Sincronizando labels de staff para usuario ${usuarioId} en espacio ${espacioId}`);

    if (appwrite && appwrite.habilitado) {
      try {
        const respuesta = await DBAppwrite.invocarAsignarRol({ userId: usuarioId, espacioId, roles });

        if (!respuesta || respuesta.success !== true) {
          const mensaje = respuesta?.error || 'Error al sincronizar labels';
          Logger.warn('[DB] No se pudo sincronizar labels:', mensaje);
          return { exito: false, error: mensaje };
        }

        return { exito: true };
      } catch (e) {
        Logger.error('[DB] Error al invocar la función de sincronización:', e);
        return { exito: false, error: e.message };
      }
    }

    return { exito: true, local: true };
  };

  combined.obtenerIdUsuarioActual = async function() {
    try {
      return await Auth.obtenerIdUsuarioAppwrite();
    } catch (e) {
      Logger.warn('[DB] No se pudo obtener el ID del usuario actual:', e);
      return null;
    }
  };

  /* ── RESTO DEL ORQUESTADOR ───────────────── */

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

      Deps.registrar('db', combined);

      // NOTA: El arranque de Auth se hace exclusivamente en bootstrap.js.
      // No llamar a inicializarAuth() aquí.

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
            'recetas',
            'variantes',
            'movimientos',
            'cartas'
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
          this._procesarVariantes(resultados.variantes);
          this._procesarMovimientos(resultados.movimientos);
          this._procesarCartas(resultados.cartas);

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
      if (!this.mesas || this.mesas.length === 0) {
        this._inicializarMesas();
      }
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

  combined._procesarVariantes = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.variantes = lista.map(v => this._normalizarVariante(v));
    } else {
      this._cargarVariantesLocal();
    }
    Store.despachar({ type: 'VARIANTES_INICIALIZAR', payload: this.variantes || [] });
  };

  /**
   * A.74: normaliza los movimientos que llegan de Appwrite.
   * Aplica la retención de 30 días antes de cargar al array.
   */
  combined._procesarMovimientos = function(lista) {
    const limiteFecha = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.movimientos = lista
        .map(m => this._normalizarMovimiento(m))
        .filter(m => m.fecha && m.fecha >= limiteFecha)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else {
      this._cargarMovimientosLocal();
      this.movimientos = (this.movimientos || [])
        .filter(m => m.fecha && m.fecha >= limiteFecha)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
  };

  /**
   * A.76: normaliza las cartas que llegan de Appwrite y las carga
   * en DB.cartas. El despacho al Store lo hace bootstrap.js
   * (Célula E, v1.0.23) o el propio carta-editor al guardar. El
   * array `productos` puede venir serializado como string JSON
   * desde la columna varchar 10000. Se parsea aquí.
   *
   * Coexistencia: el despacho de carta-editor/acciones.js sigue
   * vivo para actualizaciones incrementales tras guardar o cargar
   * manual. Este método cubre solo la carga inicial.
   */
  combined._procesarCartas = function(lista) {
    if (lista && Array.isArray(lista) && lista.length > 0) {
      this.cartas = lista.map(c => {
        const carta = { ...c };
        if (typeof carta.productos === 'string') {
          try {
            const parsed = JSON.parse(carta.productos);
            carta.productos = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            Logger.warn('[DB] Error al parsear productos de carta ' + carta.id + ':', e.message);
            carta.productos = [];
          }
        } else if (!Array.isArray(carta.productos)) {
          carta.productos = [];
        }
        return carta;
      });
    } else {
      this._cargarCartasLocal();
    }
    Logger.info('[DB] Cartas procesadas: ' + (this.cartas || []).length);
  };

  combined._cargarCartasLocal = function() {
    const raw = localStorage.getItem('pubpos_cartas');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cartas = parsed.map(c => {
            const carta = { ...c };
            if (typeof carta.productos === 'string') {
              try {
                const p = JSON.parse(carta.productos);
                carta.productos = Array.isArray(p) ? p : [];
              } catch { carta.productos = []; }
            } else if (!Array.isArray(carta.productos)) {
              carta.productos = [];
            }
            return carta;
          });
        } else {
          this.cartas = [];
        }
      } catch (e) {
        Logger.error('[DB] Error al parsear cartas locales:', e);
        this.cartas = [];
      }
    } else {
      this.cartas = [];
    }
  };

  combined._cargarTodoLocal = function() {
    this._cargarProductosLocal();
    this._cargarPedidosLocal();
    this._cargarMesasLocal();
    this._cargarComandasLocal();
    this._cargarInsumosLocal();
    this._cargarRecetasLocal();
    this._cargarVariantesLocal();
    this._cargarMovimientosLocal();
    this._cargarCartasLocal();
    // v1.6.6: los tres cargadores que faltaban en el path offline.
    this._cargarPedidosDeliveryLocal();
    this._cargarProveedoresLocal();
    this._cargarEntradasLocal();
    if (!this.mesas || this.mesas.length === 0) {
      this._inicializarMesas();
    } else {
      this.saveMesas();
    }
    Logger.info('[DB] Todos los datos cargados desde localStorage.');
  };

  combined.sincronizarMesasConConfig = async function() {
    if (!appwrite || !appwrite.habilitado) return;
    Logger.info('[DB] Sincronizar mesas con config: delegando en resetearMesas.');
    await this.resetearMesas();
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
    Store.despachar({ type: 'MESAS_INICIALIZAR', payload: this.mesas });
    EventBus.emit('mesas:guardadas', this.mesas);
    Logger.info('[DB] Reseteo de mesas completado. Total: ' + this.mesas.length);
  };

  combined._cargarConfiguracion = async function() {
    const espacioId = this.espacioActivoId();

    if (typeof appwrite !== 'undefined' && appwrite.habilitado && espacioId) {
      try {
        const configAppwrite = await appwrite.listar('configuracion', {
          filtros: [Appwrite.Query.equal('clave', 'global')]
        });

        let docGlobal = configAppwrite.find(function(d) {
          return d.espacioId === espacioId && d.clave === 'global';
        });

        if (!docGlobal) {
          docGlobal = configAppwrite.find(function(d) {
            return d.id === 'global' && d.espacioId === espacioId;
          });
        }

        if (docGlobal && docGlobal.valor) {
          this.config = JSON.parse(docGlobal.valor);
          Logger.info('[DB] Configuración cargada desde Appwrite para espacio ' + espacioId + '.');
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

  combined.recargarMovimientos = async function() {
    if (!appwrite || !appwrite.habilitado) {
      this._cargarMovimientosLocal();
      Store.despachar({
        type: 'MOVIMIENTOS_INICIALIZAR',
        payload: this.movimientos || []
      });
      return this.movimientos || [];
    }

    try {
      const lista = await appwrite.listar('movimientos');
      this._procesarMovimientos(lista);
      Store.despachar({
        type: 'MOVIMIENTOS_INICIALIZAR',
        payload: this.movimientos || []
      });
      Logger.info('[DB] Movimientos recargados al Store: ' + (this.movimientos || []).length);
      return this.movimientos || [];
    } catch (e) {
      Logger.warn('[DB] Error al recargar movimientos:', e);
      return this.movimientos || [];
    }
  };

  // ── CIERRE DE PEDIDO CON IDEMPOTENCIA ─────────────────────
  combined.cerrarPedido = async function(id, formaPago, total, descuento, claveIdempotencia) {
    const pedido = this.pedidos.find(p => p.id === id);
    if (!pedido) { Logger.warn(`[DB] Pedido ${id} no encontrado.`); return null; }

    if (claveIdempotencia) {
      const resultadoPrevio = _clavesIdempotencia.get(claveIdempotencia);
      if (resultadoPrevio) {
        Logger.info(`[DB] Idempotencia: operación ${claveIdempotencia} ya ejecutada, devolviendo resultado previo.`);
        return this.pedidos.find(p => p.id === resultadoPrevio.pedidoId) || pedido;
      }
      _clavesIdempotencia.set(claveIdempotencia, { pedidoId: id, timestamp: Date.now() });
      _guardarClavesIdempotencia();
    }

    if (pedido.estado === 'cerrada' || pedido.estado === 'cerrado') {
      Logger.warn(`[DB] El pedido ${id} ya está cerrado.`);
      return pedido;
    }

    if (appwrite && appwrite.habilitado) {
      try {
        await appwrite.actualizar('pedidos', id, { estado: 'cerrada', total });
        Logger.info(`[DB] Pedido ${id} actualizado en Appwrite.`);
      } catch (e) {
        Logger.error("[DB] Error al actualizar pedido en Appwrite:", e);
        return null;
      }
    }

    pedido.estado = 'cerrada';
    pedido.total = total;
    pedido.descuento = descuento || 0;
    pedido.actualizadoEn = new Date().toISOString();
    this.savePedidos();
    EventBus.emit('pedido:cerrado', { id, total, pedidoId: id });
    return pedido;
  };

  return combined;
})();