/* ================================================================
   LaTaberna - Ecosistema Elisekai — MÓDULO JS (ES6)
   Archivo: js/db-appwrite.js
   Versión: 1.20.0
   Propósito: Cliente de Appwrite (API TablesDB), Realtime y operadores.
              Soporte multi-espacio con espacioId dinámico.
              v1.20.0: A.74: se agrega 'movimientos' a COLECCIONES y
                       a MATRIZ_PERMISOS. La colección
                       laTaberna_Movimientos se crea en Appwrite
                       Console como log append-only de ajustes y
                       consumos de stock. Permisos de fila:
                       update/delete solo admin. Alineado con
                       asignar-rol/index.js v1.9.1.
              v1.19.1: A.71: invocarAsignarRol expuesto. Fix CORS
                       en db.js.
              v1.19.0: A.70: crearPrecargaCliente.
              v1.18.0: A.44: rename laTaberna_Menus → laTaberna_Cartas.
              v1.17.0: A.41: 'variantes'.
              v1.16.0: A.22: _crearFilaSegura loguea con detalles.
              v1.15.0: A.12: matriz de permisos.
              v1.14.0: A.2/A.3/A.10.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { Deps } from './lib/deps.js';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, ID_FUNCION_ASIGNAR_ROL } from './config-appwrite.js';

export const DBAppwrite = (function() {
  const modulo = {};

  modulo.cliente = null;
  modulo.baseDeDatos = null;
  modulo.cuenta = null;
  modulo.idBaseDeDatos = '6a0275cb0022ebf7d30d';
  modulo.habilitado = false;

  modulo.COLECCIONES = {
    productos: 'laTaberna_Productos',
    pedidos: 'laTaberna_Pedidos',
    mesas: 'laTaberna_Mesas',
    comandas: 'laTaberna_Comandas',
    insumos: 'laTaberna_Insumos',
    recetas: 'laTaberna_Recetas',
    staff: 'laTaberna_Staff',
    configuracion: 'laTaberna_Configuracion',
    eventos_en_vivo: 'laTaberna_Eventos_en_vivo',
    cartas: 'laTaberna_Cartas',
    proveedores: 'laTaberna_Proveedores',
    entradas: 'laTaberna_Entradas',
    comensales: 'laTaberna_Comensales',
    avisos: 'laTaberna_Avisos',
    variantes: 'laTaberna_Variantes',
    movimientos: 'laTaberna_Movimientos',
    global_perfiles: 'global_Perfiles',
    global_puntos: 'global_Puntos',
    global_eventos: 'global_Eventos',
    global_espacios: 'global_Espacios'
  };

  const COLECCIONES_SIN_ESPACIO = [
    'global_perfiles',
    'global_puntos',
    'global_eventos',
    'global_espacios'
  ];

  // ── MATRIZ DE PERMISOS DE FILA (v1, 2026-09-12) ────────────
  // Fuente de verdad: Coordinación de Integración, Fase 2 A.12.
  // Debe coincidir con `MATRIZ_PERMISOS` en asignar-rol/index.js.
  // `owner` se agrega siempre en update y delete.

  const MATRIZ_PERMISOS = {
    mesas:           { update: ['admin', 'mesero'],         delete: ['admin'] },
    comandas:        { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
    pedidos:         { update: ['admin', 'mesero', 'caja'], delete: ['admin'] },
    productos:       { update: ['admin'],                   delete: ['admin'] },
    insumos:         { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
    recetas:         { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
    proveedores:     { update: ['admin'],                   delete: ['admin'] },
    entradas:        { update: ['admin'],                   delete: ['admin'] },
    cartas:          { update: ['admin'],                   delete: ['admin'] },
    eventos_en_vivo: { update: ['admin', 'artista'],        delete: ['admin'] },
    staff:           { update: ['admin'],                   delete: ['admin'] },
    configuracion:   { update: [],                          delete: [] },
    comensales:      { update: ['admin', 'mesero'],         delete: ['admin'] },
    avisos:          { update: ['admin', 'mesero'],         delete: ['admin'] },
    variantes:       { update: ['admin'],                   delete: ['admin'] },
    movimientos:     { update: ['admin'],                   delete: ['admin'] }
  };

  function _obtenerEspacioActivo() {
    try {
      const auth = Deps.obtener('auth');
      if (auth && typeof auth.obtenerLocalActivo === 'function') {
        return auth.obtenerLocalActivo();
      }
    } catch (e) {
      // Dependencia aún no registrada.
    }
    return null;
  }

  function _esColeccionSinFiltro(coleccion) {
    return COLECCIONES_SIN_ESPACIO.includes(coleccion);
  }

  function _limpiarFila(fila) {
    const datos = Object.assign({}, fila);
    const creado = datos.$createdAt || null;
    const actualizado = datos.$updatedAt || null;

    Object.keys(datos).forEach(function(clave) {
      if (clave.startsWith('$')) delete datos[clave];
    });

    datos.id = fila.$id;
    datos.creadoEn = creado;
    datos.actualizadoEn = actualizado;

    return datos;
  }

  function _permisosFila(coleccion, espacioId) {
    if (!espacioId || _esColeccionSinFiltro(coleccion)) return [];

    const permisos = [
      Appwrite.Permission.read(Appwrite.Role.team(espacioId))
    ];

    const reglas = MATRIZ_PERMISOS[coleccion] || { update: ['admin'], delete: ['admin'] };

    const rolesUpdate = new Set([...reglas.update, 'owner']);
    const rolesDelete = new Set([...reglas.delete, 'owner']);

    rolesUpdate.forEach(rol => {
      permisos.push(Appwrite.Permission.update(Appwrite.Role.team(espacioId, rol)));
    });

    rolesDelete.forEach(rol => {
      permisos.push(Appwrite.Permission.delete(Appwrite.Role.team(espacioId, rol)));
    });

    return permisos;
  }

  async function _reintentarConBackoff(fn, descripcion, maxReintentos = 2) {
    let intento = 0;
    while (true) {
      try {
        return await fn();
      } catch (e) {
        const esTransitorio = e.code === 429 || e.code === 503 || e.type === 'general_rate_limit_exceeded' || e.type === 'general_service_disabled';
        if (!esTransitorio || intento >= maxReintentos) {
          throw e;
        }
        intento++;
        const espera = Math.min(1000 * Math.pow(2, intento), 4000);
        Logger.warn(`[Backoff] Reintento ${intento} para ${descripcion} en ${espera}ms`);
        await new Promise(resolve => setTimeout(resolve, espera));
      }
    }
  }

  modulo.iniciar = async function() {
    if (typeof window.Appwrite === 'undefined') {
      Logger.warn('[Appwrite] SDK no cargado.');
      modulo.habilitado = false;
      return false;
    }

    const endpoint = APPWRITE_ENDPOINT;
    const projectId = APPWRITE_PROJECT_ID;

    try {
      modulo.cliente = new Appwrite.Client()
        .setEndpoint(endpoint)
        .setProject(projectId);

      modulo.cuenta = new Appwrite.Account(modulo.cliente);
      try {
        await modulo.cuenta.createAnonymousSession();
        Logger.info('[Appwrite] Sesión anónima creada correctamente.');
      } catch (e) {
        Logger.info('[Appwrite] Usando sesión anónima existente.');
      }

      modulo.baseDeDatos = new Appwrite.TablesDB(modulo.cliente);
      modulo.habilitado = true;
      Logger.info('[Appwrite] Cliente inicializado (API TablesDB).');
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al iniciar:', e);
      modulo.habilitado = false;
      return false;
    }
  };

  modulo.listar = async function(coleccion, opciones = {}) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      const queries = [];
      if (!_esColeccionSinFiltro(coleccion)) {
        const espacio = _obtenerEspacioActivo();
        if (espacio && espacio.id) {
          queries.push(Appwrite.Query.equal('espacioId', espacio.id));
        }
      }

      if (opciones.filtros && Array.isArray(opciones.filtros)) {
        opciones.filtros.forEach(filtro => queries.push(filtro));
      }

      if (opciones.orden && Array.isArray(opciones.orden)) {
        opciones.orden.forEach(orden => queries.push(orden));
      }

      if (opciones.limite) {
        queries.push(Appwrite.Query.limit(opciones.limite));
      } else {
        queries.push(Appwrite.Query.limit(100));
      }

      if (opciones.desplazamiento) {
        queries.push(Appwrite.Query.offset(opciones.desplazamiento));
      }

      if (opciones.cursorDespues) {
        queries.push(Appwrite.Query.cursorAfter(opciones.cursorDespues));
      }

      if (opciones.cursorAntes) {
        queries.push(Appwrite.Query.cursorBefore(opciones.cursorAntes));
      }

      if (opciones.select && Array.isArray(opciones.select) && opciones.select.length > 0) {
        queries.push(Appwrite.Query.select(opciones.select));
      }

      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        queries,
        total: opciones.total === false ? false : true
      };

      if (opciones.ttl && typeof opciones.ttl === 'number' && opciones.ttl > 0) {
        params.ttl = Math.min(Math.max(opciones.ttl, 1), 86400);
      }

      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows(params), `listar ${coleccion}`);

      return respuesta.rows.map(_limpiarFila);
    } catch (e) {
      Logger.error('[Appwrite] Error al listar ' + coleccion + ':', e);
      return [];
    }
  };

  /* ── ESPACIOS ───────────────────────────────────────────── */

  modulo.listarEspacios = async function(opciones = {}) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      const queries = [];

      if (opciones.app) {
        queries.push(Appwrite.Query.equal('app', opciones.app));
      }

      if (opciones.adminAsignado) {
        queries.push(Appwrite.Query.equal('adminAsignado', opciones.adminAsignado));
      }

      if (opciones.activo !== undefined) {
        queries.push(Appwrite.Query.equal('activo', opciones.activo));
      }

      queries.push(Appwrite.Query.limit(100));

      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES.global_espacios,
        queries,
        total: false
      };

      if (opciones.ttl && typeof opciones.ttl === 'number' && opciones.ttl > 0) {
        params.ttl = Math.min(Math.max(opciones.ttl, 1), 86400);
      }

      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows(params), 'listar espacios');

      return respuesta.rows.map(_limpiarFila);
    } catch (e) {
      Logger.error('[Appwrite] Error al listar espacios:', e);
      return [];
    }
  };

  modulo.listarEspaciosPorApp = async function(app) {
    return modulo.listarEspacios({ app, activo: true });
  };

  modulo.listarEspaciosPorAdmin = async function(usuarioId) {
    return modulo.listarEspacios({ adminAsignado: usuarioId, activo: true });
  };

  modulo.listarTodosLosEspacios = async function() {
    return modulo.listarEspacios({ activo: true });
  };

  modulo.obtenerEspacioPorId = async function(espacioId) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.getRow({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.global_espacios,
          rowId: espacioId
        }), 'obtener espacio');
      return _limpiarFila(respuesta);
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo obtener espacio por ID:', e.message);
      return null;
    }
  };

  // ── CREAR ────────────────────────────────────────────────
  // A.2: si idFila es 'unique()', null o undefined, se omite rowId.
  // A.10: forzarError se propaga correctamente.
  // A.22: Logger.error siempre con detalles cuando falla.
  async function _crearFilaSegura(coleccion, idFila, datos, forzarError) {
    const funciones = new Appwrite.Functions(modulo.cliente);

    const payload = {
      accion: 'crear',
      coleccion,
      datos
    };

    // A.2: solo incluir rowId si es un ID válido
    if (idFila && idFila !== 'unique()' && idFila !== null && idFila !== undefined) {
      payload.rowId = idFila;
    }

    const ejecucion = await funciones.createExecution({
      functionId: ID_FUNCION_ASIGNAR_ROL,
      body: JSON.stringify(payload),
      async: false
    });

    const cuerpo = ejecucion.responseBody || ejecucion.body || ejecucion.response;

    let respuesta;
    try {
      respuesta = JSON.parse(cuerpo);
    } catch (e) {
      // A.22: log de respuesta no parseable
      Logger.error(
        '[Appwrite] Respuesta no parseable de asignar-rol' +
        ' · coleccion: ' + coleccion +
        ' · rowId: ' + (idFila || 'auto') +
        ' · cuerpo (primeros 500): ' + String(cuerpo).substring(0, 500)
      );
      const error = new Error('Respuesta no parseable de la función de creación segura');
      error.code = 500;
      if (forzarError) throw error;
      return null;
    }

    if (!respuesta.exito || !respuesta.row) {
      const mensaje = respuesta.error || 'Error en creación segura';
      // A.22: log detallado de error de la función
      Logger.error(
        '[Appwrite] Falló creación segura' +
        ' · coleccion: ' + coleccion +
        ' · rowId: ' + (idFila || 'auto') +
        ' · error: ' + mensaje +
        ' · keys del payload: ' + Object.keys(datos || {}).join(',')
      );
      const error = new Error(mensaje);
      error.code = respuesta.code || 400;
      if (forzarError) throw error;
      return null;
    }

    return _limpiarFila(respuesta.row);
  }

  /**
   * A.70/A.71: invoca la función serverless asignar-rol vía SDK
   * oficial. No sobrescribe espacioId. Devuelve la respuesta
   * completa de la función para que el llamador pueda interpretar
   * los distintos flujos (crear, roles, vinculacion).
   *
   * @param {object} payload - Payload completo para la función.
   * @returns {Promise<{ok: boolean, respuesta: object|null, error: string|null}>}
   */
  async function _invocarFuncionAsignarRol(payload) {
    if (!modulo.habilitado || !modulo.cliente) {
      Logger.error('[Appwrite] _invocarFuncionAsignarRol: cliente no inicializado.');
      return { ok: false, respuesta: null, error: 'Cliente no inicializado' };
    }

    try {
      const funciones = new Appwrite.Functions(modulo.cliente);
      const ejecucion = await funciones.createExecution({
        functionId: ID_FUNCION_ASIGNAR_ROL,
        body: JSON.stringify(payload),
        async: false
      });

      const cuerpo = ejecucion.responseBody || ejecucion.body || ejecucion.response;

      let respuesta;
      try {
        respuesta = JSON.parse(cuerpo);
      } catch (e) {
        Logger.error(
          '[Appwrite] Respuesta no parseable de asignar-rol' +
          ' · coleccion: ' + (payload && payload.coleccion ? payload.coleccion : 'n/a') +
          ' · cuerpo (primeros 500): ' + String(cuerpo).substring(0, 500)
        );
        return { ok: false, respuesta: null, error: 'Respuesta no parseable' };
      }

      return { ok: true, respuesta, error: null };
    } catch (e) {
      // El SDK puede lanzar excepción si Appwrite Cloud rechaza la
      // ejecución antes de llegar a la función (execute access).
      Logger.error(
        '[Appwrite] Excepción al invocar asignar-rol' +
        ' · coleccion: ' + (payload && payload.coleccion ? payload.coleccion : 'n/a') +
        ' · code: ' + (e.code || 'n/a') +
        ' · type: ' + (e.type || 'n/a') +
        ' · message: ' + e.message
      );
      return { ok: false, respuesta: null, error: e.message };
    }
  }

  /**
   * A.70: valida que un espacioId pertenezca a la app lataberna y
   * esté activo. Se usa antes de crear precargas de cliente.
   *
   * @param {string} espacioId
   * @returns {Promise<boolean>}
   */
  async function _validarEspacioLatabernaParaPrecarga(espacioId) {
    if (!espacioId || typeof espacioId !== 'string') return false;
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;

    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.getRow({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.global_espacios,
          rowId: espacioId
        }), 'validar espacio para precarga');

      if (!respuesta) return false;
      if (respuesta.app !== 'lataberna') return false;
      if (respuesta.activo !== true) return false;
      return true;
    } catch (e) {
      Logger.warn('[Appwrite] Espacio inválido para precarga: ' + espacioId + ' · ' + e.message);
      return false;
    }
  }

  /**
   * A.71: invoca la función serverless asignar-rol vía SDK oficial y
   * devuelve la respuesta cruda. Método público para que módulos como
   * db.js puedan reemplazar el fetch directo (bloqueado por CORS).
   *
   * @param {object} payload - Payload completo para la función.
   * @returns {Promise<object|null>} Respuesta de la función o null.
   */
  modulo.invocarAsignarRol = async function(payload) {
    const resultado = await _invocarFuncionAsignarRol(payload);
    return resultado.respuesta;
  };

  modulo.crear = async function(coleccion, idFila, datos, permisos, idTransaccion, forzarError = false) {
    if (!modulo.habilitado || !modulo.baseDeDatos) {
      if (forzarError) throw new Error('DBAppwrite no está habilitado');
      return null;
    }

    const datosLimpios = Object.assign({}, datos);
    delete datosLimpios.id;
    delete datosLimpios.creadoEn;
    delete datosLimpios.actualizadoEn;
    delete datosLimpios.created_at;
    delete datosLimpios.updated_at;

    if (!_esColeccionSinFiltro(coleccion)) {
      const espacio = _obtenerEspacioActivo();
      if (espacio && espacio.id) {
        datosLimpios.espacioId = espacio.id;
      }
    }

    if (!_esColeccionSinFiltro(coleccion)) {
      try {
        return await _crearFilaSegura(coleccion, idFila, datosLimpios, forzarError);
      } catch (e) {
        if (forzarError) throw e;
        Logger.warn('[Appwrite] Falló creación segura, intentando directa:', e.message);
      }
    }

    try {
      let id = idFila;
      if (id === 'unique()' || id === null || id === undefined) {
        id = Appwrite.ID.unique();
      }

      let permisosFila = permisos && Array.isArray(permisos) && permisos.length > 0
        ? permisos
        : _permisosFila(coleccion, datosLimpios.espacioId || _obtenerEspacioActivo()?.id);

      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: datosLimpios
      };

      if (permisosFila && permisosFila.length > 0) params.permissions = permisosFila;
      if (idTransaccion) params.transactionId = idTransaccion;

      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.createRow(params), `crear en ${coleccion}`);
      return _limpiarFila(respuesta);
    } catch (e) {
      if (forzarError) throw e;
      if (e.code !== 409) Logger.error('[Appwrite] Error al crear en ' + coleccion + ':', e);
      return null;
    }
  };

  /**
   * A.70: crea una precarga de cliente en el espacio del restaurante
   * del QR. El cliente sin Team no puede usar DBAppwrite.crear porque
   * ese wrapper sobrescribe espacioId con el del espacio activo del
   * usuario (por ejemplo mirefugio_usr_xxx). Este método respeta el
   * espacioId del parámetro y valida que pertenezca a lataberna.
   *
   * No pasa por _crearFilaSegura. Invoca la función serverless
   * asignar-rol directamente. La función v1.9.0 tiene una rama
   * restringida para jugadores sin Team que solo acepta este flujo.
   *
   * @param {object} datos - Campos del pedido (mesa, items, etc.).
   * @param {string} espacioId - Espacio del restaurante del QR.
   * @returns {Promise<object|null>} Fila creada o null.
   */
  modulo.crearPrecargaCliente = async function(datos, espacioId) {
    if (!modulo.habilitado || !modulo.cliente) {
      Logger.error('[Appwrite] crearPrecargaCliente: cliente no inicializado.');
      return null;
    }

    if (!espacioId || typeof espacioId !== 'string' || !espacioId.trim()) {
      Logger.error('[Appwrite] crearPrecargaCliente: espacioId inválido o vacío.');
      return null;
    }

    const espacioValido = await _validarEspacioLatabernaParaPrecarga(espacioId);
    if (!espacioValido) {
      Logger.error(
        '[Appwrite] crearPrecargaCliente: espacio no válido para precarga' +
        ' · espacioId: ' + espacioId
      );
      return null;
    }

    if (!datos || typeof datos !== 'object') {
      Logger.error('[Appwrite] crearPrecargaCliente: datos inválidos.');
      return null;
    }

    const datosConEspacio = Object.assign({}, datos, { espacioId });

    delete datosConEspacio.id;
    delete datosConEspacio.creadoEn;
    delete datosConEspacio.actualizadoEn;
    delete datosConEspacio.created_at;
    delete datosConEspacio.updated_at;

    const payload = {
      accion: 'crear',
      coleccion: 'pedidos',
      datos: datosConEspacio
    };

    Logger.info(
      '[Appwrite] crearPrecargaCliente: enviando precarga' +
      ' · espacioId: ' + espacioId +
      ' · keys: ' + Object.keys(datosConEspacio).join(',')
    );

    const resultado = await _invocarFuncionAsignarRol(payload);

    if (!resultado.ok || !resultado.respuesta) {
      // El helper ya logueó el error.
      return null;
    }

    if (!resultado.respuesta.exito || !resultado.respuesta.row) {
      Logger.error(
        '[Appwrite] crearPrecargaCliente: función respondió sin fila' +
        ' · error: ' + (resultado.respuesta.error || 'desconocido')
      );
      return null;
    }

    return _limpiarFila(resultado.respuesta.row);
  };

  modulo.actualizar = async function(coleccion, id, cambios, idTransaccion, forzarError = false) {
    if (!modulo.habilitado || !modulo.baseDeDatos) {
      if (forzarError) throw new Error('DBAppwrite no está habilitado');
      return null;
    }
    try {
      const cambiosLimpios = Object.assign({}, cambios);
      delete cambiosLimpios.creadoEn;
      delete cambiosLimpios.actualizadoEn;
      delete cambiosLimpios.created_at;
      delete cambiosLimpios.updated_at;
      delete cambiosLimpios.id;

      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: cambiosLimpios
      };

      if (idTransaccion) params.transactionId = idTransaccion;

      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.updateRow(params), `actualizar ${coleccion}`);
      return _limpiarFila(respuesta);
    } catch (e) {
      if (forzarError) throw e;
      if (e.code !== 404) Logger.error('[Appwrite] Error al actualizar ' + coleccion + ':', e);
      return null;
    }
  };

  modulo.eliminar = async function(coleccion, id, idTransaccion, forzarError = false) {
    if (!modulo.habilitado || !modulo.baseDeDatos) {
      if (forzarError) throw new Error('DBAppwrite no está habilitado');
      return false;
    }
    try {
      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id
      };
      if (idTransaccion) params.transactionId = idTransaccion;
      await _reintentarConBackoff(() =>
        modulo.baseDeDatos.deleteRow(params), `eliminar en ${coleccion}`);
      return true;
    } catch (e) {
      if (forzarError) throw e;
      Logger.error('[Appwrite] Error al eliminar en ' + coleccion + ':', e);
      return false;
    }
  };

  modulo.incrementarCampo = async function(coleccion, id, columna, valor, maximo, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        column: columna,
        value: valor
      };
      if (maximo !== undefined) params.max = maximo;
      if (idTransaccion) params.transactionId = idTransaccion;
      return await _reintentarConBackoff(() =>
        modulo.baseDeDatos.incrementRowColumn(params), `incrementar ${columna}`);
    } catch (e) {
      Logger.error('[Appwrite] Error al incrementar ' + columna + ':', e);
      return null;
    }
  };

  modulo.decrementarCampo = async function(coleccion, id, columna, valor, minimo, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        column: columna,
        value: valor
      };
      if (minimo !== undefined) params.min = minimo;
      if (idTransaccion) params.transactionId = idTransaccion;
      return await _reintentarConBackoff(() =>
        modulo.baseDeDatos.decrementRowColumn(params), `decrementar ${columna}`);
    } catch (e) {
      Logger.error('[Appwrite] Error al decrementar ' + columna + ':', e);
      return null;
    }
  };

  modulo.actualizarConOperadores = async function(coleccion, id, datosConOperadores, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: datosConOperadores
      };
      if (idTransaccion) params.transactionId = idTransaccion;
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.updateRow(params), `actualizar con operadores`);
      return _limpiarFila(respuesta);
    } catch (e) {
      Logger.error('[Appwrite] Error al actualizar con operadores:', e);
      return null;
    }
  };

  modulo.crearTransaccion = async function() {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try { return await _reintentarConBackoff(() => modulo.baseDeDatos.createTransaction(), 'crear transacción'); }
    catch (e) { Logger.error('[Appwrite] Error al crear transacción:', e); return null; }
  };

  modulo.confirmarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await _reintentarConBackoff(() =>
        modulo.baseDeDatos.updateTransaction({ transactionId: idTransaccion, commit: true }), 'confirmar transacción');
      return true;
    } catch (e) { Logger.error('[Appwrite] Error al confirmar transacción:', e); return false; }
  };

  modulo.cancelarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await _reintentarConBackoff(() =>
        modulo.baseDeDatos.updateTransaction({ transactionId: idTransaccion, rollback: true }), 'cancelar transacción');
      return true;
    } catch (e) { Logger.error('[Appwrite] Error al cancelar transacción:', e); return false; }
  };

  /* ── TEAMS ─────────────────────────────────────────────── */

  modulo.obtenerEquiposDelUsuario = async function() {
    if (!modulo.habilitado || !modulo.cliente) return [];
    try {
      const equipos = new Appwrite.Teams(modulo.cliente);
      const respuesta = await _reintentarConBackoff(() => equipos.list(), 'listar equipos');
      return respuesta.teams || [];
    } catch (e) {
      Logger.error('[Appwrite] Error al listar equipos del usuario:', e);
      return [];
    }
  };

  modulo.obtenerMembresiaDeEquipo = async function(teamId, usuarioId) {
    if (!modulo.habilitado || !modulo.cliente) return null;
    try {
      const equipos = new Appwrite.Teams(modulo.cliente);
      const respuesta = await _reintentarConBackoff(() => equipos.listMemberships({ teamId }), 'listar membresías');
      return (respuesta.memberships || []).find(m => m.userId === usuarioId) || null;
    } catch (e) {
      Logger.error('[Appwrite] Error al obtener membresía de equipo:', e);
      return null;
    }
  };

  /* ── CONSULTAS ESPECÍFICAS ──────────────────────────────── */

  function _parsearRoles(staff) {
    if (!staff) return null;
    try {
      if (typeof staff.roles === 'string') staff.roles = JSON.parse(staff.roles || '[]');
    } catch { staff.roles = []; }
    return staff;
  }

  modulo.obtenerStaffPorUsuario = async function(usuarioId) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.staff,
          queries: [
            Appwrite.Query.equal('usuarioId', usuarioId),
            Appwrite.Query.limit(100)
          ]
        }), 'obtener staff por usuario');
      return respuesta.rows.map(_limpiarFila).map(_parsearRoles);
    } catch (e) {
      Logger.error('[Appwrite] Error al obtener staff por usuario:', e);
      return [];
    }
  };

  modulo.obtenerStaffPorUsuarioEspacio = async function(usuarioId, espacioId) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.staff,
          queries: [
            Appwrite.Query.equal('usuarioId', usuarioId),
            Appwrite.Query.equal('espacioId', espacioId),
            Appwrite.Query.limit(100)
          ]
        }), 'obtener staff por usuario+espacio');
      return _parsearRoles(respuesta.rows.map(_limpiarFila)[0] || null);
    } catch (e) {
      Logger.error('[Appwrite] Error al obtener staff por usuario+espacio:', e);
      return null;
    }
  };

  modulo.obtenerStaffPorEspacio = async function(espacioId) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.staff,
          queries: [
            Appwrite.Query.equal('espacioId', espacioId),
            Appwrite.Query.limit(100)
          ]
        }), 'obtener staff por espacio');
      return respuesta.rows.map(_limpiarFila).map(_parsearRoles);
    } catch (e) {
      Logger.error('[Appwrite] Error al obtener staff por espacio:', e);
      return [];
    }
  };

  modulo.obtenerPerfilPorNombreUsuario = async function(nombreUsuario) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.global_perfiles,
          queries: [
            Appwrite.Query.equal('nombreUsuario', nombreUsuario),
            Appwrite.Query.limit(1)
          ]
        }), 'buscar perfil por nombreUsuario');
      return respuesta.rows.map(_limpiarFila)[0] || null;
    } catch (e) {
      Logger.error('[Appwrite] Error al buscar perfil por nombreUsuario:', e);
      return null;
    }
  };

  modulo.obtenerPerfilPorUsuarioId = async function(usuarioId) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.global_perfiles,
          queries: [
            Appwrite.Query.equal('usuarioId', usuarioId),
            Appwrite.Query.limit(1)
          ]
        }), 'buscar perfil por usuarioId');
      return respuesta.rows.map(_limpiarFila)[0] || null;
    } catch (e) {
      Logger.error('[Appwrite] Error al buscar perfil por usuarioId:', e);
      return null;
    }
  };

  modulo.buscarStaffPorToken = async function(token) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const respuesta = await _reintentarConBackoff(() =>
        modulo.baseDeDatos.listRows({
          databaseId: modulo.idBaseDeDatos,
          tableId: modulo.COLECCIONES.staff,
          queries: [
            Appwrite.Query.equal('tokenVinculacion', token),
            Appwrite.Query.limit(1)
          ]
        }), 'buscar staff por token');
      return _parsearRoles(respuesta.rows.map(_limpiarFila)[0] || null);
    } catch (e) {
      Logger.error('[Appwrite] Error al buscar staff por token:', e);
      return null;
    }
  };

  /* ── REALTIME ───────────────────────────────────────────── */

  let _tiempoReal = null;
  let _suscripcionesRealtime = [];
  let _realtimeActivo = false;

  function _construirCanal(nombreTabla) {
    if (window.Appwrite && typeof Appwrite.Channel === 'function') {
      try {
        return Appwrite.Channel.tablesdb(modulo.idBaseDeDatos).table(nombreTabla).row();
      } catch (e) {
        Logger.warn('[Realtime] No se pudo usar helper Channel. Se usará string.');
      }
    }
    return `tablesdb.${modulo.idBaseDeDatos}.tables.${nombreTabla}.rows`;
  }

  function _obtenerQueriesEspacio(coleccion) {
    if (_esColeccionSinFiltro(coleccion)) return [];
    const espacio = _obtenerEspacioActivo();
    if (espacio && espacio.id) {
      return [Appwrite.Query.equal('espacioId', espacio.id)];
    }
    return [];
  }

  modulo.suscribirRealtime = async function(alCambiar) {
    if (!modulo.habilitado || !modulo.cliente) return;

    if (!_tiempoReal) {
      _tiempoReal = new Appwrite.Realtime(modulo.cliente);
    }

    const claves = Object.keys(modulo.COLECCIONES);

    for (let i = 0; i < claves.length; i++) {
      const clave = claves[i];
      const nombreTabla = modulo.COLECCIONES[clave];
      const canal = _construirCanal(nombreTabla);
      const queries = _obtenerQueriesEspacio(clave);

      try {
        const suscripcion = await _tiempoReal.subscribe(canal, function(payload) {
          let tipo = 'update';
          if (Array.isArray(payload.events)) {
            if (payload.events.some(evento => evento.endsWith('.create'))) tipo = 'create';
            else if (payload.events.some(evento => evento.endsWith('.delete'))) tipo = 'delete';
            else if (payload.events.some(evento => evento.endsWith('.update'))) tipo = 'update';
          }

          if (alCambiar) {
            alCambiar(clave, tipo, payload.payload);
          }
        }, queries);

        _suscripcionesRealtime.push(suscripcion);
      } catch (e) {
        Logger.warn('[Realtime] No se pudo suscribir a ' + clave + ':', e.message);
      }
    }

    Logger.info('[Appwrite] Suscripciones Realtime activas: ' + _suscripcionesRealtime.length);
  };

  // A.3: pedidos emite 'pedidos:actualizada'
  modulo.iniciarRealtime = async function() {
    if (!modulo.habilitado) return;
    if (_realtimeActivo) {
      Logger.info('[Realtime] Ya activo, reconfigurando...');
      await modulo.desconectarRealtime();
    }
    _realtimeActivo = true;

    await modulo.suscribirRealtime(function(coleccion, tipo, payload) {
      if (!payload || !payload.$id) return;

      modulo.baseDeDatos.getRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: payload.$id
      }).then(function(doc) {
        const datos = _limpiarFila(doc);
        EventBus.emit('realtime:documento_actualizado', { coleccion, tipo, datos });
        if (coleccion === 'pedidos') EventBus.emit('pedidos:actualizada', datos);
        else if (coleccion === 'comandas') EventBus.emit('comanda:enviada', datos);
        else if (coleccion === 'mesas') EventBus.emit('mesa:actualizada', { mesa: datos.numero, estado: datos.estado });
        else EventBus.emit(coleccion + ':actualizada', datos);
      }).catch(function(e) {
        Logger.warn('[Realtime] Error al obtener fila de ' + coleccion + ':', e);
      });
    });
  };

  modulo.desconectarRealtime = async function() {
    if (!_tiempoReal) {
      _realtimeActivo = false;
      return;
    }

    if (_suscripcionesRealtime.length > 0) {
      for (let i = 0; i < _suscripcionesRealtime.length; i++) {
        const suscripcion = _suscripcionesRealtime[i];
        try {
          if (suscripcion && typeof suscripcion.unsubscribe === 'function') {
            await suscripcion.unsubscribe();
          } else if (suscripcion && typeof suscripcion.close === 'function') {
            await suscripcion.close();
          }
        } catch (e) {
          Logger.warn('[Realtime] Error al desuscribir:', e.message);
        }
      }
      _suscripcionesRealtime = [];
    }

    if (typeof _tiempoReal.disconnect === 'function') {
      try {
        await _tiempoReal.disconnect();
      } catch (e) {
        Logger.warn('[Realtime] Error al desconectar:', e.message);
      }
    }

    _realtimeActivo = false;
    Logger.info('[Realtime] Suscripciones desconectadas.');
  };

  modulo.reconfigurarRealtime = async function() {
    await modulo.desconectarRealtime();
    await modulo.iniciarRealtime();
  };

  return modulo;
})();