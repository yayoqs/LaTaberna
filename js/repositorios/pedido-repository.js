/* ================================================================
   Raíz — REPOSITORIO: pedido-repository.js (v2.0 – Appwrite directo)
   Propósito: Implementación local del repositorio de pedidos.
              Cada método que modifica datos sincroniza directamente
              con Appwrite después de actualizar el estado local.
   ================================================================ */
const PedidoRepository = {
  async crearPedidoMesa(datos) { throw new Error('No implementado'); },
  async obtenerPorId(id)   { throw new Error('No implementado'); },
  async cerrarPedido(id, datosCierre) { throw new Error('No implementado'); },
  async obtenerTodos()     { throw new Error('No implementado'); },
  async abrirMesa(numeroMesa, mozo, comensales) { throw new Error('No implementado'); },
  async enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) { throw new Error('No implementado'); },
  async agregarMesa(datosMesa) { throw new Error('No implementado'); },
  async liberarMesa(numeroMesa) { throw new Error('No implementado'); }
};

const PedidoRepositoryLocal = (() => {

  // ── Utilidades de sincronización con Appwrite ──────────
  function _normalizarFecha(valor) {
    if (!valor) return null;
    if (typeof valor === 'number') return new Date(valor).toISOString();
    var str = String(valor);
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return str.substring(0, 100);
  }

  function _sanitizarMesa(m) {
    return {
      numero: m.numero,
      estado: String(m.estado || 'libre'),
      pedidoId: String(m.pedidoId || '').substring(0, 50),
      items: Array.isArray(m.items) ? JSON.stringify(m.items).substring(0, 5000) : String(m.items || '[]').substring(0, 5000),
      mozo: String(m.mozo || '').substring(0, 100),
      comensales: Number(m.comensales) || 1,
      abiertaEn: _normalizarFecha(m.abiertaEn),
      observaciones: String(m.observaciones || '').substring(0, 500),
      zona: String(m.zona || 'salon').substring(0, 50),
      mesasFusionadas: Array.isArray(m.mesasFusionadas) ? JSON.stringify(m.mesasFusionadas).substring(0, 500) : String(m.mesasFusionadas || '').substring(0, 500),
      esVirtual: Boolean(m.esVirtual)
    };
  }

  function _sanitizarPedido(p) {
    var data = Object.assign({}, p);
    delete data.id;
    if (Array.isArray(data.items)) data.items = JSON.stringify(data.items).substring(0, 5000);
    else data.items = String(data.items || '[]').substring(0, 5000);
    return data;
  }

  function _sanitizarComanda(c) {
    var data = Object.assign({}, c);
    delete data.id;
    if (Array.isArray(data.items)) data.items = JSON.stringify(data.items).substring(0, 5000);
    else data.items = String(data.items || '[]').substring(0, 5000);
    return data;
  }

  async function _guardarEnAppwrite(coleccion, id, datos, esNuevo) {
    if (!window.DBAppwrite || !DBAppwrite.habilitado) return;
    try {
      if (esNuevo) {
        await DBAppwrite.crear(coleccion, id, datos);
      } else {
        await DBAppwrite.actualizar(coleccion, id, datos);
      }
    } catch (e) {
      if (esNuevo && e.code === 409) {
        try { await DBAppwrite.actualizar(coleccion, id, datos); } catch (e2) {}
      } else if (!esNuevo && e.code === 404) {
        try { await DBAppwrite.crear(coleccion, id, datos); } catch (e2) {}
      } else if (e.code !== 409) {
        Logger.error('[Repo] Error al guardar ' + coleccion + ' ' + id + ':', e);
      }
    }
  }

  async function _syncMesa(mesa) {
    if (!mesa || mesa.esVirtual) return;
    await _guardarEnAppwrite('mesas', String(mesa.numero), _sanitizarMesa(mesa), false);
  }

  async function _syncPedido(pedido, esNuevo) {
    if (!pedido || !pedido.id) return;
    await _guardarEnAppwrite('pedidos', pedido.id, _sanitizarPedido(pedido), esNuevo);
  }

  async function _syncComanda(comanda, esNuevo) {
    if (!comanda || !comanda.id) return;
    await _guardarEnAppwrite('comandas', comanda.id, _sanitizarComanda(comanda), esNuevo);
  }

  // ── MÉTODOS DEL REPOSITORIO ────────────────────────────

  async function abrirMesa(numeroMesa, mozo, comensales) {
    if (!window.DB || !DB.getMesa) throw new Error('DB.core no disponible');

    const mesa = DB.getMesa(numeroMesa);
    if (!mesa) throw new Error(`La mesa ${numeroMesa} no existe`);
    if (mesa.estado !== 'libre') throw new Error(`La mesa ${numeroMesa} no está libre`);

    mesa.estado = 'ocupada';
    mesa.abiertaEn = Date.now();
    mesa.mozo = mozo;
    mesa.comensales = comensales;
    mesa.items = [];
    mesa.observaciones = '';
    DB.saveMesas();

    const pedidoLocal = await DB.crearPedido(numeroMesa, mozo, comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    mesa.pedidoId = pedidoLocal.id;
    DB.saveMesas();

    // Sincronizar con Appwrite
    await _syncMesa(mesa);
    await _syncPedido(pedidoLocal, true);

    return pedidoLocal;
  }

  async function enviarComanda(mesa, itemsPendientes, mozo, comensales, observaciones) {
    if (!window.DB || !DB.comandas) throw new Error('DB.comandas no disponible');

    const cocinaItems = itemsPendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = itemsPendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
    if (!cocinaItems.length && !barraItems.length) throw new Error('Los ítems no tienen un destino válido');

    const _crearComanda = (items, destinoKds) => {
      items.forEach(it => {
        it.enviado = true;
        it.enviadoA = destinoKds;
        it.enviadoTs = Date.now();
      });

      const comanda = {
        id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
        mesa: mesa.numero,
        mozo: mozo,
        destino: destinoKds,
        items: items.map(it => ({ ...it })),
        observaciones: observaciones || '',
        estado: 'nueva',
        ts: Date.now()
      };

      DB.comandas.push(comanda);
      return comanda;
    };

    const comandasCreadas = [];

    if (cocinaItems.length && barraItems.length) {
      comandasCreadas.push(_crearComanda(cocinaItems, 'cocina'));
      comandasCreadas.push(_crearComanda(barraItems,  'barra'));
    } else if (cocinaItems.length) {
      comandasCreadas.push(_crearComanda(cocinaItems, 'cocina'));
    } else if (barraItems.length) {
      comandasCreadas.push(_crearComanda(barraItems,  'barra'));
    }

    DB.saveComandas();

    // Actualizar pedido localmente
    if (mesa.pedidoId && typeof DB.actualizarPedido === 'function') {
      await DB.actualizarPedido(mesa.pedidoId, {
        estado: 'en_proceso',
        items: JSON.stringify(mesa.items),
        total: calcularTotal(mesa.items),
        mozo: mesa.mozo,
        comensales: mesa.comensales,
        observaciones: mesa.observaciones
      });
    }

    // Sincronizar con Appwrite: comandas y pedido actualizado
    for (const c of comandasCreadas) {
      await _syncComanda(c, true);
    }
    if (mesa.pedidoId) {
      const pedidoActualizado = DB.pedidos.find(p => p.id === mesa.pedidoId);
      if (pedidoActualizado) {
        await _syncPedido(pedidoActualizado, false);
      }
    }

    return { comandas: comandasCreadas, ticketsHTML: {} };
  }

  async function crearPedidoMesa(datos) {
    if (!window.DB || !DB.crearPedido) throw new Error('DB.core no disponible');

    const pedidoLocal = await DB.crearPedido(datos.mesa, datos.mozo, datos.comensales);
    if (!pedidoLocal) throw new Error('No se pudo crear el pedido localmente');

    await _syncPedido(pedidoLocal, true);
    return pedidoLocal;
  }

  async function obtenerPorId(id) {
    if (!window.DB || !DB.pedidos) return null;
    return DB.pedidos.find(p => p.id === id) || null;
  }

  async function cerrarPedido(id, datosCierre) {
    if (!window.DB || typeof DB.cerrarPedido !== 'function') throw new Error('DB.cerrarPedido no disponible');
    const pedido = DB.pedidos.find(p => p.id === id);
    if (!pedido) throw new Error('Pedido no encontrado');

    await DB.cerrarPedido(id, datosCierre.formaPago, datosCierre.total, datosCierre.descuento || 0);
    const pedidoCerrado = DB.pedidos.find(p => p.id === id);

    if (pedidoCerrado) {
      await _syncPedido(pedidoCerrado, false);

      // Liberar la mesa asociada
      const mesa = DB.mesas.find(m => m.pedidoId === id);
      if (mesa && !mesa.esVirtual) {
        mesa.estado = 'libre';
        mesa.pedidoId = '';
        mesa.items = [];
        mesa.mozo = '';
        mesa.comensales = 1;
        mesa.observaciones = '';
        DB.saveMesas();
        await _syncMesa(mesa);
        EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
      }
    }

    return pedidoCerrado;
  }

  async function obtenerTodos() {
    if (!window.DB || !DB.pedidos) return [];
    return DB.pedidos;
  }

  async function agregarMesa(datosMesa) {
    if (!window.DB || !DB.mesas) throw new Error('DB no disponible');

    const existente = DB.mesas.find(m => m.numero === datosMesa.numero);
    if (existente) throw new Error(`Ya existe una mesa con el número ${datosMesa.numero}`);

    DB.mesas.push(datosMesa);
    DB.saveMesas();

    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'MESA_AGREGAR', payload: datosMesa });
    }

    await _syncMesa(datosMesa);
    return datosMesa;
  }

  async function liberarMesa(numeroMesa) {
    if (!window.DB || !DB.mesas) throw new Error('DB no disponible');

    const mesa = DB.mesas.find(m => m.numero == numeroMesa);
    if (!mesa) throw new Error('Mesa no encontrada');

    if (mesa.esVirtual) {
      DB.liberarMesasFusionadas(mesa);
    } else {
      const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(mesa.numero);
    }
    DB.saveMesas();

    if (typeof Store !== 'undefined') {
      if (mesa.esVirtual) {
        (mesa.mesasFusionadas || []).forEach(num => {
          Store.dispatch({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: num, estado: 'libre' } });
        });
        Store.dispatch({ type: 'MESA_ELIMINAR', payload: mesa.numero });
      } else {
        Store.dispatch({ type: 'MESA_CAMBIAR_ESTADO', payload: { numero: mesa.numero, estado: 'libre' } });
      }
    }

    // Sincronizar la mesa liberada
    if (!mesa.esVirtual) {
      const mesaActualizada = DB.mesas.find(m => m.numero == numeroMesa);
      if (mesaActualizada) await _syncMesa(mesaActualizada);
    } else {
      // Si era virtual, las mesas originales se liberaron, hay que sincronizarlas
      for (const num of mesa.mesasFusionadas || []) {
        const m = DB.mesas.find(x => x.numero === num);
        if (m) await _syncMesa(m);
      }
    }

    EventBus.emit('mesa:liberada', { numero: numeroMesa });
    return mesa;
  }

  return {
    abrirMesa,
    enviarComanda,
    crearPedidoMesa,
    obtenerPorId,
    cerrarPedido,
    obtenerTodos,
    agregarMesa,
    liberarMesa
  };
})();

window.PedidoRepository = PedidoRepository;
window.PedidoRepositoryLocal = PedidoRepositoryLocal;