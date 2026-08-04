/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-appwrite.js
   Versión: 1.2.2
   Propósito: Cliente de Appwrite (API TablesDB), Realtime y operadores.
              Soporte multi-espacio con espacioId dinámico.
              Colecciones globales exentas de filtro.
              v1.2.2: migración var→let/const.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './config-appwrite.js';

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
    ingredientes: 'laTaberna_Ingredientes',
    recetas: 'laTaberna_Recetas',
    pedidos_delivery: 'laTaberna_Pedidos_delivery',
    usuarios: 'laTaberna_Usuarios',
    configuracion: 'laTaberna_Configuracion',
    precargas_cliente: 'laTaberna_Precargas_cliente',
    eventos_en_vivo: 'laTaberna_Eventos_en_vivo',
    menus: 'laTaberna_Menus',
    proveedores: 'laTaberna_Proveedores',
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

  function _obtenerEspacioActivo() {
    try {
      if (typeof Auth !== 'undefined' && Auth.obtenerLocalActivo) {
        return Auth.obtenerLocalActivo();
      }
    } catch (e) { /* ignorar */ }
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
      if (clave.startsWith('$')) {
        delete datos[clave];
      }
    });

    datos.id = fila.$id;
    datos.creadoEn = creado;
    datos.actualizadoEn = actualizado;

    return datos;
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

  modulo.listar = async function(coleccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      const queries = [];
      if (!_esColeccionSinFiltro(coleccion)) {
        const espacio = _obtenerEspacioActivo();
        if (espacio && espacio.id) {
          queries.push(Appwrite.Query.equal('espacioId', espacio.id));
        }
      }

      const respuesta = await modulo.baseDeDatos.listRows({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        queries: queries
      });
      return respuesta.rows.map(_limpiarFila);
    } catch (e) {
      Logger.error('[Appwrite] Error al listar ' + coleccion + ':', e);
      return [];
    }
  };

  modulo.crear = async function(coleccion, idFila, datos, permisos, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const id = idFila || Appwrite.ID.unique();
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

      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: datosLimpios
      };

      if (permisos && Array.isArray(permisos) && permisos.length > 0) {
        params.permissions = permisos;
      }
      if (idTransaccion) {
        params.transactionId = idTransaccion;
      }

      const respuesta = await modulo.baseDeDatos.createRow(params);
      return _limpiarFila(respuesta);
    } catch (e) {
      if (e.code !== 409) {
        Logger.error('[Appwrite] Error al crear en ' + coleccion + ':', e);
      }
      return null;
    }
  };

  modulo.actualizar = async function(coleccion, id, cambios, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
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

      if (idTransaccion) {
        params.transactionId = idTransaccion;
      }

      const respuesta = await modulo.baseDeDatos.updateRow(params);
      return _limpiarFila(respuesta);
    } catch (e) {
      if (e.code !== 404) {
        Logger.error('[Appwrite] Error al actualizar ' + coleccion + ':', e);
      }
      return null;
    }
  };

  modulo.eliminar = async function(coleccion, id, idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      const params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id
      };

      if (idTransaccion) {
        params.transactionId = idTransaccion;
      }

      await modulo.baseDeDatos.deleteRow(params);
      return true;
    } catch (e) {
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

      return await modulo.baseDeDatos.incrementRowColumn(params);
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

      return await modulo.baseDeDatos.decrementRowColumn(params);
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

      const respuesta = await modulo.baseDeDatos.updateRow(params);
      return _limpiarFila(respuesta);
    } catch (e) {
      Logger.error('[Appwrite] Error al actualizar con operadores:', e);
      return null;
    }
  };

  modulo.crearTransaccion = async function() {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      const tx = await modulo.baseDeDatos.createTransaction();
      return tx;
    } catch (e) {
      Logger.error('[Appwrite] Error al crear transacción:', e);
      return null;
    }
  };

  modulo.confirmarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await modulo.baseDeDatos.updateTransaction({
        transactionId: idTransaccion,
        commit: true
      });
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al confirmar transacción:', e);
      return false;
    }
  };

  modulo.cancelarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await modulo.baseDeDatos.updateTransaction({
        transactionId: idTransaccion,
        rollback: true
      });
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al cancelar transacción:', e);
      return false;
    }
  };

  const _callbacksRealtime = [];

  modulo.suscribirRealtime = function(alCambiar) {
    if (!modulo.habilitado || !modulo.cliente) return;
    _callbacksRealtime.push(alCambiar);

    const claves = Object.keys(modulo.COLECCIONES);
    const canales = [];
    for (let i = 0; i < claves.length; i++) {
      const nombreColeccion = modulo.COLECCIONES[claves[i]];
      canales.push('databases.' + modulo.idBaseDeDatos + '.tables.' + nombreColeccion + '.rows');
    }

    try {
      const tiempoReal = new Appwrite.Realtime(modulo.cliente);
      canales.forEach(function(canal) {
        tiempoReal.subscribe(canal, function(payload) {
          let coleccion = '';
          for (let j = 0; j < claves.length; j++) {
            if (canal.indexOf(modulo.COLECCIONES[claves[j]]) !== -1) {
              coleccion = claves[j];
              break;
            }
          }
          let tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          _callbacksRealtime.forEach(function(cb) { cb(coleccion, tipo, payload.payload); });
        });
      });
      Logger.info('[Appwrite] Realtime activo para ' + claves.length + ' tablas.');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  modulo.iniciarRealtime = function() {
    if (!modulo.habilitado) return;
    modulo.suscribirRealtime(function(coleccion, tipo, payload) {
      if (!payload || !payload.$id) return;

      modulo.baseDeDatos.getRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: payload.$id
      }).then(function(doc) {
        const datos = _limpiarFila(doc);

        EventBus.emit('realtime:documento_actualizado', {
          coleccion: coleccion,
          tipo: tipo,
          datos: datos
        });

        if (coleccion === 'pedidos') {
          EventBus.emit('sincronizacion:completada');
        } else if (coleccion === 'comandas') {
          EventBus.emit('comanda:enviada', datos);
        } else if (coleccion === 'mesas') {
          EventBus.emit('mesa:actualizada', { mesa: datos.numero, estado: datos.estado });
        } else {
          EventBus.emit(coleccion + ':actualizada', datos);
        }
      }).catch(function(e) {
        Logger.warn('[Realtime] Error al obtener fila de ' + coleccion + ':', e);
      });
    });
  };

  return modulo;
})();