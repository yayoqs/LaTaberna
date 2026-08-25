/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/db-core.js
   Versión: 1.1.5
   Propósito: Núcleo de datos: mesas, pedidos, productos, proveedores,
              persistencia local.
              v1.1.5: _normalizarProducto alineado a campo estado.
                      Métodos legacy de delivery marcados como deprecados.
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
  // DEPRECADO: se mantiene por compatibilidad con Célula D.
  // En la migración a pedidos unificados se eliminará.
  module.pedidosDelivery = [];
  module.proveedores = [];

  // ══ FUNCIONES AUXILIARES PRIVADAS ══

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

  function _validarEstadoProducto(val) {
    const estados = ['disponible', 'agotado'];
    return estados.includes(val) ? val : 'disponible';
  }

  /* ── NORMALIZACIONES ─────────────────────────────────────── */
  module._normalizarProducto = function(p) {
    const estado = _validarEstadoProducto(p.estado);
    return {
      id: _validarId(p.id, 'prod'),
      nombre: _validarString(p.nombre, 'Sin nombre'),
      precio: _validarNumero(p.precio, 0),
      categoria: _validarString(p.categoria, 'General'),
      destino: _validarDestino(p.destino),
      descripcion: _validarString(p.descripcion, ''),
      activo: _validarBooleano(p.activo, true),
      imagen: _validarString(p.imagen, ''),
      estado: estado,
      // Derivado para compatibilidad con consumidores que aún usan disponible
      disponible: estado !== 'agotado'
    };
  };

  module._normalizarMesa = function(m) {
    const estado = _validarEstadoMesa(m.estado);
    let mesasFusionadas = m.mesasFusionadas || null;
    if (typeof mesasFusionadas === 'string' && mesasFusionadas.trim()) {
      try { mesasFusionadas = JSON.parse(mesasFusionadas); } catch { mesasFusionadas = null; }
    }
    return {
      numero: _validarString(m.numero, '0'),
      estado: estado,
      pedidoId: m.pedidoId || null,
      comensales: _validarNumero(m.comensales, 1),
      mesasFusionadas: mesasFusionadas,
      esVirtual: m.esVirtual || false,
      zona: _validarString(m.zona, (this.config.zonas && this.config.zonas[0]?.nombre) || 'salon')
    };
  };

  module._normalizarMozo = function(m) {
    return {
      id: _validarId(m.id, 'mozo'),
      nombre: _validarString(m.nombre, 'Sin nombre'),
      activo: _validarBooleano(m.activo, true)
    };
  };

  // DEPRECADO: este normalizador se mantiene temporalmente.
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
          nuevas.push({ ...mesaVacia(String(numero), zona.nombre), numero: String(numero) });
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
      let maxNumero = Math.max(0, ...mesasReales.map(m => parseInt(m.numero) || 0));

      zonas.forEach(z => {
        const zonaData = porZona[z.nombre] || { deseado: z.cantidad, actuales: [], libres: [] };
        const actuales = zonaData.actuales;
        const libres = zonaData.libres;
        const diferencia = z.cantidad - actuales.length;

        if (diferencia > 0) {
          for (let i = 0; i < diferencia; i++) {
            maxNumero++;
            const nueva = { ...mesaVacia(String(maxNumero), z.nombre), numero: String(maxNumero) };
            nuevasMesas.push(nueva);
            actuales.push(nueva);
          }
        } else if (diferencia < 0) {
          const aEliminar = Math.min(-diferencia, libres.length);
          libres.sort((a,b) => parseInt(b.numero) - parseInt(a.numero));
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
      this.mesas = Array.from(mapaFinal.values()).sort((a,b) => parseInt(a.numero) - parseInt(b.numero));
    }

    this.saveMesas();
  };

  module._cargarComandasLocal = function() {
    const raw = localStorage.getItem('pubpos_comandas');
    this.comandas = raw ? JSON.parse(raw) : [];
  };

  module._cargarPedidosLocal = function() {
    const raw = localStorage.getItem('pubpos_pedidos');
    if (!raw) {
      this.pedidos = [];
      return;
    }
    try {
      this.pedidos = JSON.parse(raw).map(p => ({
        ...p,
        items: Array.isArray(p.items) ? p.items : (() => {
          try { return JSON.parse(p.items || '[]'); } catch { return []; }
        })()
      }));
    } catch {
      this.pedidos = [];
    }
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

  // DEPRECADO
  module._cargarPedidosDeliveryLocal = function() {
    const raw = localStorage.getItem('pubpos_pedidos_delivery');
    if (raw) {
      try {
        const parseados = JSON.parse(raw);
        const descartados = [];
        this.pedidosDelivery = parseados
          .map(pd => this._normalizarPedidoDelivery(pd))
          .filter(pd => {
            if (!pd || !pd.id) {
              descartados.push(pd);
              return false;
            }
            return true;
          });
        if (descartados.length > 0) {
          Logger.warn('[DBCore] _cargarPedidosDeliveryLocal: ' + descartados.length + ' pedido(s) descartado(s) por ID nulo o inválido.', descartados);
        }
      } catch (e) {
        Logger.error('[DBCore] Error al parsear pedidos delivery locales:', e);
        this.pedidosDelivery = [];
      }
    } else {
      this.pedidosDelivery = [];
    }
  };

  module._cargarProveedoresLocal = function() {
    const raw = localStorage.getItem('pubpos_proveedores');
    if (raw) {
      try {
        this.proveedores = JSON.parse(raw);
      } catch (e) {
        Logger.error('[DBCore] Error al parsear proveedores locales:', e);
        this.proveedores = [];
      }
    } else {
      this.proveedores = [];
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

  // DEPRECADO
  module.savePedidosDelivery = function() {
    localStorage.setItem('pubpos_pedidos_delivery', JSON.stringify(this.pedidosDelivery));
    EventBus.emit('pedidosDelivery:guardados', this.pedidosDelivery);
  };

  module.saveProveedores = function() {
    localStorage.setItem('pubpos_proveedores', JSON.stringify(this.proveedores));
    EventBus.emit('proveedores:guardados', this.proveedores);
  };

  /* ── GESTIÓN DE PEDIDOS (mesa) ───────────────────────────── */
  module.crearPedido = async function(mesa, mozo, comensales) {
    const nuevo = {
      id: 'ped_' + Date.now(),
      mesa, mozo, comensales,
      tipo: 'local',
      origen: 'staff',
      estado: 'abierta',
      items: [],
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
      if (cambios.items !== undefined && !Array.isArray(cambios.items)) {
        try { cambios.items = JSON.parse(cambios.items); } catch { cambios.items = []; }
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

  /* ── GESTIÓN DE DELIVERY (DEPRECADO) ─────────────────────── */

  // DEPRECADO: usar colección unificada `pedidos` con tipo 'reparto'.
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
    numero: String(num),
    estado: 'libre',
    pedidoId: null,
    comensales: 1,
    zona: zona,
    esVirtual: false
  };
}