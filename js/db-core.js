/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-core.js
   Versión: 1.0.8
   Propósito: Núcleo de datos: mesas, pedidos, productos, persistencia local.
              Métodos auxiliares de validación ahora son privados del módulo.
              Incluye imports de Logger, EventBus.
   ================================================================ */

import { Logger } from './lib/logger.js';
import { EventBus } from './lib/eventBus.js';

export const DBCore = (function() {
  const module = {};

  module.productos = [];
  module.pedidos = [];
  module.mesas = [];
  module.comandas = [];
  module.config = {};
  module.mozos = [];
  module.pedidosDelivery = [];

  // ══ FUNCIONES AUXILIARES PRIVADAS (no expuestas) ══

  function _validarId(val, prefijo) {
    if (typeof val === 'string' && val.length > 0) return val;
    return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function _validarString(val, defecto) {
    return (typeof val === 'string' && val.trim()) ? val.trim() : defecto;
  }

  function _validarNumero(val, defecto) {
    const num = Number(val);
    return isNaN(num) ? defecto : num;
  }

  function _validarBooleano(val, defecto) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return defecto;
  }

  function _validarDestino(val) {
    const destinos = ['cocina', 'barra', 'ambos'];
    return destinos.includes(val) ? val : 'cocina';
  }

  function _validarEstadoMesa(val) {
    const estados = ['libre', 'ocupada', 'esperando', 'cuenta', 'fusionada', 'pagada'];
    return estados.includes(val) ? val : 'libre';
  }

  /* ── NORMALIZACIONES ─────────────────────────────────────── */
  module._normalizarProducto = function(p) {
    return {
      id: _validarId(p.id, 'prod'),
      nombre: _validarString(p.nombre, 'Sin nombre'),
      precio: _validarNumero(p.precio, 0),
      categoria: _validarString(p.categoria, 'General'),
      destino: _validarDestino(p.destino),
      descripcion: _validarString(p.descripcion, ''),
      activo: _validarBooleano(p.activo, true),
      imagen: _validarString(p.imagen, ''),
      disponible: _validarBooleano(p.disponible, true)
    };
  };

  module._normalizarMesa = function(m) {
    const estado = _validarEstadoMesa(m.estado);
    return {
      numero: _validarNumero(m.numero, 0),
      estado: estado,
      pedidoId: m.pedidoId || null,
      items: Array.isArray(m.items) ? m.items : [],
      mozo: _validarString(m.mozo, ''),
      comensales: _validarNumero(m.comensales, 1),
      abiertaEn: m.abiertaEn || null,
      observaciones: _validarString(m.observaciones, ''),
      mesasFusionadas: m.mesasFusionadas || null,
      esVirtual: m.esVirtual || false,
      zona: _validarString(m.zona, (this.config.zonas && this.config.zonas[0]?.nombre) || 'salon'),
      permite_prepedidos: (estado === 'libre') ? false : _validarBooleano(m.permite_prepedidos, false)
    };
  };

  module._normalizarMozo = function(m) {
    return {
      id: _validarId(m.id, 'mozo'),
      nombre: _validarString(m.nombre, 'Sin nombre'),
      activo: _validarBooleano(m.activo, true)
    };
  };

  module._normalizarPedidoDelivery = function(pd) {
    return {
      id: _validarId(pd.id, 'deliv'),
      direccion: _validarString(pd.direccion, 'Sin dirección'),
      telefono: _validarString(pd.telefono, ''),
      items: Array.isArray(pd.items) ? pd.items : [],
      total: _validarNumero(pd.total, 0),
      estado: ['pendiente','en_preparacion','en_camino','entregado'].includes(pd.estado) ? pd.estado : 'pendiente',
      repartidor: _validarString(pd.repartidor, ''),
      creadoEn: pd.creadoEn || pd.$createdAt || pd.created_at || new Date().toISOString(),
      actualizadoEn: pd.actualizadoEn || pd.$updatedAt || pd.updated_at || null,
      observaciones: _validarString(pd.observaciones, '')
    };
  };

  /* ── PERSISTENCIA LOCAL ──────────────────────────────────── */
  module._cargarConfigLocal = function() {
    const raw = localStorage.getItem('pubpos_config');
    if (raw) {
      this.config = JSON.parse(raw);
      if (this.config.cantidadMesas && !this.config.zonas) {
        this.config.zonas = [
          { nombre: 'salon',   cantidad: this.config.cantidadMesas },
          { nombre: 'terraza', cantidad: 0 }
        ];
        delete this.config.cantidadMesas;
        this.saveConfig();
      }
    } else {
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
  };

  module._cargarMesasLocal = function() {
    const raw = localStorage.getItem('pubpos_mesas');
    if (raw) {
      try { this.mesas = JSON.parse(raw).map(m => this._normalizarMesa(m)); } catch { this.mesas = []; }
    } else {
      this.mesas = [];
    }
  };

  module._inicializarMesas = function() {
    this._cargarMesasLocal();
    const zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    if (this.mesas.length === 0) {
      let numero = 1;
      const nuevas = [];
      zonas.forEach(zona => {
        for (let i = 0; i < zona.cantidad; i++) {
          nuevas.push({ ...mesaVacia(numero, zona.nombre), numero });
          numero++;
        }
      });
      this.mesas = nuevas;
    } else {
      const mesasReales = this.mesas.filter(m => !m.esVirtual);
      const porZona = {};
      zonas.forEach(z => { porZona[z.nombre] = { deseado: z.cantidad, actuales: [], libres: [] }; });

      mesasReales.forEach(m => {
        const zona = m.zona || 'salon';
        if (!porZona[zona]) porZona[zona] = { deseado: 0, actuales: [], libres: [] };
        porZona[zona].actuales.push(m);
        if (m.estado === 'libre') porZona[zona].libres.push(m);
      });

      const nuevasMesas = [];
      let maxNumero = Math.max(0, ...mesasReales.map(m => m.numero));

      zonas.forEach(z => {
        const zonaData = porZona[z.nombre] || { deseado: z.cantidad, actuales: [], libres: [] };
        const actuales = zonaData.actuales;
        const libres = zonaData.libres;
        const diferencia = z.cantidad - actuales.length;

        if (diferencia > 0) {
          for (let i = 0; i < diferencia; i++) {
            maxNumero++;
            const nueva = { ...mesaVacia(maxNumero, z.nombre), numero: maxNumero };
            nuevasMesas.push(nueva);
            actuales.push(nueva);
          }
        } else if (diferencia < 0) {
          const aEliminar = Math.min(-diferencia, libres.length);
          libres.sort((a,b) => b.numero - a.numero);
          for (let i = 0; i < aEliminar; i++) {
            const mesa = libres[i];
            const idx = actuales.indexOf(mesa);
            if (idx >= 0) actuales.splice(idx, 1);
          }
        }
        nuevasMesas.push(...actuales);
      });

      const mapaFinal = new Map();
      nuevasMesas.forEach(m => mapaFinal.set(m.numero, m));
      this.mesas = Array.from(mapaFinal.values()).sort((a,b) => a.numero - b.numero);
    }

    this.saveMesas();
  };

  module._cargarComandasLocal = function() {
    const raw = localStorage.getItem('pubpos_comandas');
    this.comandas = raw ? JSON.parse(raw) : [];
  };

  module._cargarPedidosLocal = function() {
    const raw = localStorage.getItem('pubpos_pedidos');
    this.pedidos = raw ? JSON.parse(raw) : [];
  };

  module._cargarMozosLocal = function() {
    const raw = localStorage.getItem('pubpos_mozos');
    if (raw) {
      this.mozos = JSON.parse(raw).map(m => this._normalizarMozo(m));
    } else {
      this.mozos = [
        { id: 'mozo_1', nombre: 'Trini', activo: true }
      ];
      this.saveMozos();
    }
  };

  module._cargarPedidosDeliveryLocal = function() {
    const raw = localStorage.getItem('pubpos_pedidos_delivery');
    if (raw) {
      try {
        this.pedidosDelivery = JSON.parse(raw)
          .map(pd => this._normalizarPedidoDelivery(pd))
          .filter(pd => pd && pd.id);
      } catch (e) {
        this.pedidosDelivery = [];
      }
    } else {
      this.pedidosDelivery = [];
    }
  };

  /* ── GUARDADO ────────────────────────────────────────────── */
  module.saveConfig = function() {
    localStorage.setItem('pubpos_config', JSON.stringify(this.config));
  };

  module.saveMesas = function() {
    localStorage.setItem('pubpos_mesas', JSON.stringify(this.mesas));
    EventBus.emit('mesas:guardadas', this.mesas);
  };

  module.saveComandas = function() {
    localStorage.setItem('pubpos_comandas', JSON.stringify(this.comandas));
    EventBus.emit('comandas:guardadas', this.comandas);
  };

  module.savePedidos = function() {
    localStorage.setItem('pubpos_pedidos', JSON.stringify(this.pedidos));
    EventBus.emit('pedidos:guardados', this.pedidos);
  };

  module.saveMozos = function() {
    localStorage.setItem('pubpos_mozos', JSON.stringify(this.mozos));
  };

  module.savePedidosDelivery = function() {
    localStorage.setItem('pubpos_pedidos_delivery', JSON.stringify(this.pedidosDelivery));
    EventBus.emit('pedidosDelivery:guardados', this.pedidosDelivery);
  };

  /* ── GESTIÓN DE PEDIDOS (mesa) ───────────────────────────── */
  module.crearPedido = async function(mesa, mozo, comensales) {
    const nuevo = {
      id: 'ped_' + Date.now(),
      mesa, mozo, comensales,
      estado: 'abierta',
      items: '[]',
      total: 0,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    this.pedidos.push(nuevo);
    this.savePedidos();
    return nuevo;
  };

  module.actualizarPedido = async function(id, cambios) {
    const idx = this.pedidos.findIndex(p => p.id === id);
    if (idx >= 0) {
      if (cambios.items && Array.isArray(cambios.items)) {
        cambios.items = JSON.stringify(cambios.items);
      }
      cambios.actualizadoEn = new Date().toISOString();
      this.pedidos[idx] = { ...this.pedidos[idx], ...cambios };
      this.savePedidos();
    }
    return this.pedidos[idx];
  };

  module.fetchTodosPedidos = async function() {
    return this.pedidos;
  };

  module.getMesa = function(num) {
    return this.mesas.find(m => m.numero == num);
  };

  /* ── GESTIÓN DE DELIVERY ─────────────────────────────────── */
  module.crearPedidoDelivery = function(datos) {
    const nuevo = this._normalizarPedidoDelivery({
      ...datos,
      id: 'deliv_' + Date.now(),
      creadoEn: new Date().toISOString()
    });
    this.pedidosDelivery.push(nuevo);
    this.savePedidosDelivery();
    return nuevo;
  };

  module.actualizarPedidoDelivery = function(id, cambios) {
    const idx = this.pedidosDelivery.findIndex(p => p.id === id);
    if (idx >= 0) {
      cambios.actualizadoEn = new Date().toISOString();
      this.pedidosDelivery[idx] = { ...this.pedidosDelivery[idx], ...cambios };
      this.savePedidosDelivery();
    }
    return this.pedidosDelivery[idx] || null;
  };

  module.eliminarPedidoDelivery = function(id) {
    this.pedidosDelivery = this.pedidosDelivery.filter(p => p.id !== id);
    this.savePedidosDelivery();
  };

  return module;
})();

export function mesaVacia(num, zona = 'salon') {
  return {
    numero: num,
    estado: 'libre',
    pedidoId: null,
    items: [],
    mozo: '',
    comensales: 1,
    abiertaEn: null,
    observaciones: '',
    zona: zona,
    permite_prepedidos: false
  };
}