/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/pedido-repository.js
   Versión: 1.2.2
   Propósito: Implementación local del repositorio de pedidos con
              sincronización directa a Appwrite.
              v1.2.2: A.11: enviarComanda despacha COMANDA_AGREGADA
                      al Store, para que el KDS la vea al instante sin
                      esperar Realtime.
              v1.2.1: Se renombra idempotencyKey a claveIdempotencia.
                      La clave viaja dentro del objeto de datos.
   ================================================================ */

import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';
import { Logger } from '../lib/logger.js';
import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { calcularTotal } from '../utils.js';
import { mesaVacia } from '../db-core.js';
import { Auth } from '../auth.js';

const PedidoRepository = {
  async crearPedidoMesa(datos) { throw new Error('No implementado'); },
  async obtenerPorId(id) { throw new Error('No implementado'); },
  async cerrarPedido(id, datosCierre) { throw new Error('No implementado'); },
  async cerrarPedidoSinLiberar(id, datosCierre) { throw new Error('No implementado'); },
  async agregarTransaccion(pedidoId, datosTransaccion, claveIdempotencia) { throw new Error('No implementado'); },
  async obtenerTodos() { throw new Error('No implementado'); },
  async obtenerPedidosConSaldoPendiente() { throw new Error('No implementado'); },
  async abrirMesa(numeroMesa, mozo, comensales) { throw new Error('No implementado'); },
  async enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) { throw new Error('No implementado'); },
  async agregarMesa(datosMesa) { throw new Error('No implementado'); },
  async liberarMesa(numeroMesa) { throw new Error('No implementado'); },
  async guardarPedido(datosPedido) { throw new Error('No implementado'); }
};

const PedidoRepositoryLocal = (() => {
  const _idempotencia = new Map();

  function _cargarIdempotencia() {
    try {
      const raw = localStorage.getItem('pubpos_idempotencia_pedidos');
      if (raw) {
        const obj = JSON.parse(raw);
        Object.keys(obj).forEach(clave => _idempotencia.set(clave, obj[clave]));
      }
    } catch (e) {
      Logger.warn('[Repo] No se pudo cargar idempotencia:', e.message);
    }
  }

  function _guardarIdempotencia() {
    try {
      const obj = {};
      _idempotencia.forEach((valor, clave) => { obj[clave] = valor; });
      localStorage.setItem('pubpos_idempotencia_pedidos', JSON.stringify(obj));
    } catch (e) {
      Logger.warn('[Repo] No se pudo guardar idempotencia:', e.message);
    }
  }

  function _obtenerResultadoIdempotente(clave) {
    return _idempotencia.get(clave) || null;
  }

  function _registrarResultadoIdempotente(clave, resultado) {
    _idempotencia.set(clave, { completado: true, resultado, timestamp: Date.now() });
    _guardarIdempotencia();
  }

  _cargarIdempotencia();

  function _obtenerEspacioId() {
    try {
      const local = Auth.obtenerLocalActivo();
      return local?.id || 'lataberna';
    } catch { return 'lataberna'; }
  }

  function _sanitizarMesa(m) {
    return {
      numero: String(m.numero),
      estado: String(m.estado || 'libre'),
      pedidoId: String(m.pedidoId || '').substring(0, 50),
      comensales: Number(m.comensales) || 1,
      zona: String(m.zona || 'salon').substring(0, 50),
      mesasFusionadas: Array.isArray(m.mesasFusionadas) ? JSON.stringify(m.mesasFusionadas).substring(0, 500) : String(m.mesasFusionadas || '').substring(0, 500),
      esVirtual: Boolean(m.esVirtual),
      espacioId: String(m.espacioId || _obtenerEspacioId()).substring(0, 100)
    };
  }

  function _sanitizarPedido(p) {
    const data = Object.assign({}, p);
    delete data.id;
    if (Array.isArray(data.items)) data.items = JSON.stringify(data.items).substring(0, 5000);
    else data.items = String(data.items || '[]').substring(0, 5000);
    if (Array.isArray(data.transacciones)) data.transacciones = JSON.stringify(data.transacciones).substring(0, 5000);
    else data.transacciones = String(data.transacciones || '[]').substring(0, 5000);
    data.comensales = Number(data.comensales) || 1;
    data.espacioId = String(data.espacioId || _obtenerEspacioId()).substring(0, 100);
    return data;
  }

  function _sanitizarComanda(c) {
    const data = Object.assign({}, c);
    delete data.id;
    if (Array.isArray(data.items)) data.items = JSON.stringify(data.items).substring(0, 5000);
    else data.items = String(data.items || '[]').substring(0, 5000);
    data.subcomandas = typeof data.subcomandas === 'string' ? data.subcomandas : JSON.stringify(data.subcomandas || {});
    data.espacioId = String(data.espacioId || _obtenerEspacioId()).substring(0, 100);
    return data;
  }

  async function _guardarEnAppwrite(coleccion, id, datos, esNuevo, idTransaccion) {
    if (!DBAppwrite || !DBAppwrite.habilitado) return;
    try {
      if (esNuevo) {
        const creado = await DBAppwrite.crear(coleccion, id, datos, null, idTransaccion);
        if (!creado) {
          const actualizado = await DBAppwrite.actualizar(coleccion, id, datos, idTransaccion);
          if (!actualizado) Logger.error(`[Repo] No se pudo crear ni actualizar ${coleccion} ${id}`);
        }
      } else {
        const actualizado = await DBAppwrite.actualizar(coleccion, id, datos, idTransaccion);
        if (!actualizado) {
          const creado = await DBAppwrite.crear(coleccion, id, datos, null, idTransaccion);
          if (!creado) Logger.error(`[Repo] No se pudo actualizar ni crear ${coleccion} ${id}`);
        }
      }
    } catch (e) {
      Logger.error(`[Repo] Error al guardar ${coleccion} ${id}:`, e);
    }
  }

  async function _syncMesa(mesa, idTransaccion) {
    if (!mesa || mesa.esVirtual) return true;
    let rowId = String(mesa._rowId || mesa.numero || '');
    if (!rowId || rowId.length > 36 || /[^a-zA-Z0-9._-]/.test(rowId)) {
      rowId = rowId.substring(0, 36).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!rowId) return false;
    }
    const datos = _sanitizarMesa(mesa);
    if (!DBAppwrite || !DBAppwrite.habilitado) return true;
    try {
      const actualizada = await DBAppwrite.actualizar('mesas', rowId, datos, idTransaccion);
      if (actualizada) return true;
      const creada = await DBAppwrite.crear('mesas', rowId, datos, null, idTransaccion);
      if (creada) return true;
      Logger.error('[Repo] _syncMesa: no se pudo actualizar ni crear mesa ' + rowId);
      return false;
    } catch (e) {
      Logger.error('[Repo] Error al sincronizar mesa en Appwrite:', e);
      return false;
    }
  }

  async function _syncPedido(pedido, esNuevo, idTransaccion) {
    if (!pedido || !pedido.id) return;
    await _guardarEnAppwrite('pedidos', pedido.id, _sanitizarPedido(pedido), esNuevo, idTransaccion);
  }

  async function _syncComanda(comanda, esNuevo, idTransaccion) {
    if (!comanda || !comanda.id) return;
    await _guardarEnAppwrite('comandas', comanda.id, _sanitizarComanda(comanda), esNuevo, idTransaccion);
  }

  async function abrirMesa(numeroMesa, mozo, comensales) {
    if (!DB || !DB.getMesa) throw new Error('DB.core no disponible');
    let mesa = DB.getMesa(numeroMesa);
    if (!mesa && DBAppwrite && DBAppwrite.habilitado) {
      try {
        const mesasRemotas = await DBAppwrite.listar('mesas');
        const mesaRemota = mesasRemotas.find(m => m.numero == numeroMesa);
        if (mesaRemota) { mesa = DB._normalizarMesa(mesaRemota); DB.mesas.push(mesa); }
      } catch (e) { Logger.warn('[Repo] No se pudo recargar la mesa:', e.message); }
    }
    if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
    if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

    mesa.estado = 'ocupada';
    mesa.comensales = comensales;
    mesa.pedidoId = null;
    DB.saveMesas();

    const pedidoLocal = await DB.crearPedido(numeroMesa, mozo, comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');
    pedidoLocal.transacciones = [];
    pedidoLocal.tipo = 'local';
    pedidoLocal.origen = 'staff';
    pedidoLocal.espacioId = _obtenerEspacioId();
    mesa.pedidoId = pedidoLocal.id;
    DB.saveMesas();

    Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: mesa.estado } });
    Store.despachar({ type: 'PEDIDO_CREADO', payload: pedidoLocal });

    await _syncMesa(mesa);
    await _syncPedido(pedidoLocal, true);
    return pedidoLocal;
  }

  async function enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) {
    if (!DB || !DB.comandas || !DB.pedidos) throw new Error('DB no disponible');
    const pedidoActivo = mesa.pedidoId ? DB.pedidos.find(p => p.id === mesa.pedidoId) : null;
    const itemsActuales = pedidoActivo ? (() => {
      try { return typeof pedidoActivo.items === 'string' ? JSON.parse(pedidoActivo.items) : (pedidoActivo.items || []); }
      catch { return []; }
    })() : [];
    const mozoActivo = pedidoActivo ? pedidoActivo.mozo : (mozo || '');
    const comensalesActivos = pedidoActivo ? pedidoActivo.comensales : (comensales || 1);

    const cocinaItems = itemsPendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = itemsPendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
    if (!cocinaItems.length && !barraItems.length) throw new Error('Los ítems no tienen un destino válido');

    const _crearComanda = (items, destinoKds) => {
      items.forEach(it => { it.enviado = true; it.enviadoA = destinoKds; it.enviadoTs = Date.now(); });
      const comanda = {
        id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
        mesa: mesa.numero, mozo: mozoActivo, destino: destinoKds,
        items: items.map(it => ({ ...it })), observaciones: observaciones || '',
        estado: 'nueva', ts: Date.now(), pedidoId: mesa.pedidoId || null,
        subcomandas: {}, espacioId: _obtenerEspacioId()
      };
      DB.comandas.push(comanda);
      return comanda;
    };

    const comandasCreadas = [];
    if (cocinaItems.length && barraItems.length) {
      comandasCreadas.push(_crearComanda(cocinaItems, 'cocina'));
      comandasCreadas.push(_crearComanda(barraItems, 'barra'));
    } else if (cocinaItems.length) {
      comandasCreadas.push(_crearComanda(cocinaItems, 'cocina'));
    } else if (barraItems.length) {
      comandasCreadas.push(_crearComanda(barraItems, 'barra'));
    }

    DB.saveComandas();

    if (mesa.pedidoId && typeof DB.actualizarPedido === 'function') {
      await DB.actualizarPedido(mesa.pedidoId, {
        estado: 'en_proceso',
        items: JSON.stringify(itemsActuales),
        total: calcularTotal(itemsActuales),
        mozo: mozoActivo,
        comensales: comensalesActivos,
        observaciones: observaciones || '',
        espacioId: _obtenerEspacioId()
      });
    }

    for (const c of comandasCreadas) {
      await _syncComanda(c, true);
      // A.11: despachar al Store para que el KDS vea la comanda al instante
      c.pedidoId = mesa.pedidoId || null;
      c.subcomandas = c.subcomandas || {};
      Store.despachar({ type: 'COMANDA_AGREGADA', payload: c });
    }

    if (mesa.pedidoId) {
      const pedidoActualizado = DB.pedidos.find(p => p.id === mesa.pedidoId);
      if (pedidoActualizado) await _syncPedido(pedidoActualizado, false);
    }

    return { comandas: comandasCreadas, ticketsHTML: {} };
  }

  async function crearPedidoMesa(datos) {
    if (!DB || !DB.crearPedido) throw new Error('DB.core no disponible');
    const pedidoLocal = await DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');
    pedidoLocal.transacciones = [];
    pedidoLocal.tipo = datos.tipo || 'local';
    pedidoLocal.origen = datos.origen || 'staff';
    pedidoLocal.espacioId = _obtenerEspacioId();

    Store.despachar({ type: 'PEDIDO_CREADO', payload: pedidoLocal });
    await _syncPedido(pedidoLocal, true);
    return pedidoLocal;
  }

  async function obtenerPorId(id) {
    if (!DB || !DB.pedidos) return null;
    return DB.pedidos.find(p => p.id === id) || null;
  }

  async function cerrarPedido(id, datosCierre) {
    const claveIdempotencia = datosCierre && datosCierre.claveIdempotencia;
    if (claveIdempotencia) {
      const previo = _obtenerResultadoIdempotente(claveIdempotencia);
      if (previo && previo.completado) {
        Logger.info(`[Repo] Idempotencia: ${claveIdempotencia} ya ejecutada.`);
        return DB.pedidos.find(p => p.id === id) || previo.resultado;
      }
    }

    const pedido = DB.pedidos.find(p => p.id === id);
    if (!pedido) throw new Error('Pedido no encontrado');

    let txId = null;
    const tx = await DBAppwrite.crearTransaccion();
    txId = tx && (tx.$id || tx);

    try {
      await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0, claveIdempotencia);
      const pedidoCerrado = DB.pedidos.find(p => p.id === id);

      if (pedidoCerrado) {
        await _syncPedido(pedidoCerrado, false, txId);
        const mesa = DB.mesas.find(m => m.pedidoId === id);
        if (mesa && !mesa.esVirtual) {
          mesa.estado = 'libre'; mesa.pedidoId = ''; mesa.comensales = 1;
          DB.saveMesas();
          Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: 'libre' } });
          await _syncMesa(mesa, txId);
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
        }
        Store.despachar({ type: 'PEDIDO_CERRADO', payload: { id, total: datosCierre.total, actualizadoEn: pedidoCerrado.actualizadoEn } });

        if (txId) await DBAppwrite.confirmarTransaccion(txId);
        if (claveIdempotencia) _registrarResultadoIdempotente(claveIdempotencia, pedidoCerrado);
        return pedidoCerrado;
      }
    } catch (e) {
      if (txId) await DBAppwrite.cancelarTransaccion(txId).catch(() => {});
      throw e;
    }

    if (txId) await DBAppwrite.cancelarTransaccion(txId).catch(() => {});
    return null;
  }

  async function cerrarPedidoSinLiberar(id, datosCierre) {
    const claveIdempotencia = datosCierre && datosCierre.claveIdempotencia;
    if (claveIdempotencia) {
      const previo = _obtenerResultadoIdempotente(claveIdempotencia);
      if (previo && previo.completado) {
        Logger.info(`[Repo] Idempotencia: ${claveIdempotencia} ya ejecutada.`);
        return DB.pedidos.find(p => p.id === id) || previo.resultado;
      }
    }

    const pedido = DB.pedidos.find(p => p.id === id);
    if (!pedido) throw new Error('Pedido no encontrado');

    let txId = null;
    const tx = await DBAppwrite.crearTransaccion();
    txId = tx && (tx.$id || tx);

    try {
      await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0, claveIdempotencia);
      const pedidoCerrado = DB.pedidos.find(p => p.id === id);

      if (pedidoCerrado) {
        if (datosCierre.transacciones) pedidoCerrado.transacciones = datosCierre.transacciones;
        await _syncPedido(pedidoCerrado, false, txId);
        const mesa = DB.mesas.find(m => m.pedidoId === id);
        if (mesa && !mesa.esVirtual) {
          mesa.estado = 'pagada';
          DB.saveMesas();
          Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: 'pagada' } });
          await _syncMesa(mesa, txId);
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'pagada' });
        }
        Store.despachar({ type: 'PEDIDO_CERRADO', payload: { id, total: datosCierre.total, actualizadoEn: pedidoCerrado.actualizadoEn } });

        if (txId) await DBAppwrite.confirmarTransaccion(txId);
        if (claveIdempotencia) _registrarResultadoIdempotente(claveIdempotencia, pedidoCerrado);
        return pedidoCerrado;
      }
    } catch (e) {
      if (txId) await DBAppwrite.cancelarTransaccion(txId).catch(() => {});
      throw e;
    }

    if (txId) await DBAppwrite.cancelarTransaccion(txId).catch(() => {});
    return null;
  }

  async function agregarTransaccion(pedidoId, datosTransaccion, claveIdempotencia) {
    if (claveIdempotencia) {
      const previo = _obtenerResultadoIdempotente(claveIdempotencia);
      if (previo && previo.completado) {
        Logger.info(`[Repo] Idempotencia en transacción: ${claveIdempotencia} ya ejecutada.`);
        return previo.resultado;
      }
    }

    if (!DB || !DB.pedidos) throw new Error('DB no disponible');
    const pedido = DB.pedidos.find(p => p.id === pedidoId);
    if (!pedido) throw new Error('Pedido no encontrado');

    if (pedido.estado === 'cerrada') {
      return { exito: false, error: 'El pedido ya está cerrado' };
    }

    if (!Array.isArray(pedido.transacciones)) pedido.transacciones = [];

    let totalCubierto = pedido.transacciones.reduce((sum, t) => sum + (t.monto || 0), 0);
    const totalPedido = pedido.total || 0;
    const saldoPendiente = totalPedido - totalCubierto;

    if (datosTransaccion.monto > saldoPendiente) {
      return { exito: false, error: 'El monto excede el saldo pendiente', saldoRestante: saldoPendiente };
    }

    const nuevaTransaccion = {
      persona: datosTransaccion.persona || 'General',
      monto: datosTransaccion.monto,
      formaPago: datosTransaccion.formaPago || 'efectivo',
      timestamp: datosTransaccion.timestamp || Date.now()
    };
    pedido.transacciones.push(nuevaTransaccion);

    totalCubierto = pedido.transacciones.reduce((sum, t) => sum + (t.monto || 0), 0);
    const nuevoSaldo = totalPedido - totalCubierto;
    let pedidoCerrado = false;

    let txId = null;
    try {
      const tx = await DBAppwrite.crearTransaccion();
      txId = tx && (tx.$id || tx);

      if (nuevoSaldo <= 0) {
        pedido.estado = 'cerrada';
        pedidoCerrado = true;
        DB.savePedidos();
        await _syncPedido(pedido, false, txId);
        const mesa = DB.mesas.find(m => m.pedidoId === pedidoId);
        if (mesa && !mesa.esVirtual) {
          mesa.estado = 'pagada';
          DB.saveMesas();
          Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: 'pagada' } });
          await _syncMesa(mesa, txId);
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'pagada' });
        }
        Store.despachar({ type: 'PEDIDO_CERRADO', payload: { id: pedidoId, total: totalPedido, actualizadoEn: new Date().toISOString() } });
      } else {
        DB.savePedidos();
        await _syncPedido(pedido, false, txId);
        Store.despachar({ type: 'PEDIDO_ACTUALIZADO', payload: { id: pedidoId, cambios: { transacciones: pedido.transacciones } } });
      }

      if (txId) await DBAppwrite.confirmarTransaccion(txId);

      const resultado = { exito: true, saldoRestante: nuevoSaldo > 0 ? nuevoSaldo : 0, pedidoCerrado };
      if (claveIdempotencia) _registrarResultadoIdempotente(claveIdempotencia, resultado);
      return resultado;
    } catch (e) {
      if (txId) await DBAppwrite.cancelarTransaccion(txId).catch(() => {});
      throw e;
    }
  }

  async function obtenerTodos() {
    if (!DB || !DB.pedidos) return [];
    return DB.pedidos.map(p => {
      if (!p.transacciones) p.transacciones = [];
      return p;
    });
  }

  async function obtenerPedidosConSaldoPendiente() {
    if (!DB || !DB.pedidos) return [];
    return DB.pedidos.filter(p => {
      if (p.estado === 'cerrada') return false;
      const totalCubierto = (Array.isArray(p.transacciones) ? p.transacciones : []).reduce((sum, t) => sum + (t.monto || 0), 0);
      const totalPedido = p.total || 0;
      return totalCubierto < totalPedido;
    }).map(p => {
      if (!p.transacciones) p.transacciones = [];
      return p;
    });
  }

  async function agregarMesa(datosMesa) {
    if (!DB || !DB.mesas) throw new Error('DB no disponible');
    const existente = DB.mesas.find(m => m.numero === datosMesa.numero);
    if (existente) throw new Error(`Ya existe una mesa con el número ${datosMesa.numero}`);
    if (!datosMesa.espacioId) datosMesa.espacioId = _obtenerEspacioId();
    DB.mesas.push(datosMesa);
    DB.saveMesas();
    const persistida = await _syncMesa(datosMesa);
    if (!persistida) throw new Error('No se pudo persistir la mesa en Appwrite');
    Store.despachar({ type: 'MESA_AGREGAR', payload: datosMesa });
    return datosMesa;
  }

  async function liberarMesa(numeroMesa) {
    if (!DB || !DB.mesas) throw new Error('DB no disponible');
    const mesa = DB.mesas.find(m => m.numero == numeroMesa);
    if (!mesa) throw new Error('Mesa no encontrada');
    if (mesa.estado !== 'ocupada' && mesa.estado !== 'pagada' && !mesa.esVirtual) {
      throw new Error(`La mesa ${numeroMesa} no se puede liberar en su estado actual (${mesa.estado})`);
    }
    if (mesa.esVirtual) {
      await DB.liberarMesasFusionadas(mesa);
    } else {
      const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(mesa.numero);
    }
    DB.saveMesas();
    if (mesa.esVirtual) {
      (mesa.mesasFusionadas || []).forEach(num => Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: num, estado: 'libre' } }));
      Store.despachar({ type: 'MESA_ELIMINAR', payload: mesa.numero });
    } else {
      Store.despachar({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: 'libre' } });
    }
    if (!mesa.esVirtual) {
      const mesaActualizada = DB.mesas.find(m => m.numero == numeroMesa);
      const sincronizado = await _syncMesa(mesaActualizada);
      if (!sincronizado) throw new Error('No se pudo sincronizar la mesa liberada');
    } else {
      for (const num of mesa.mesasFusionadas || []) {
        const m = DB.mesas.find(x => x.numero === num);
        if (m) {
          const sincronizado = await _syncMesa(m);
          if (!sincronizado) throw new Error('No se pudo sincronizar mesa fusionada');
        }
      }
    }
    EventBus.emit('mesa:liberada', { numero: numeroMesa });
    return mesa;
  }

  async function guardarPedido(datosPedido) {
    if (!DB || !DB.pedidos) throw new Error('DB no disponible');
    const idx = DB.pedidos.findIndex(p => p.id === datosPedido.id);
    if (idx === -1) throw new Error('Pedido no encontrado para guardar');
    DB.pedidos[idx] = { ...DB.pedidos[idx], ...datosPedido };
    DB.savePedidos();
    Store.despachar({ type: 'PEDIDO_ACTUALIZADO', payload: { id: datosPedido.id, cambios: datosPedido } });
    await _syncPedido(DB.pedidos[idx], false);
    return DB.pedidos[idx];
  }

  return {
    abrirMesa, enviarComanda, crearPedidoMesa, obtenerPorId,
    cerrarPedido, cerrarPedidoSinLiberar, agregarTransaccion,
    obtenerTodos, obtenerPedidosConSaldoPendiente,
    agregarMesa, liberarMesa, guardarPedido
  };
})();

export { PedidoRepository, PedidoRepositoryLocal };