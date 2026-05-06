/* ================================================================
   PubPOS — MÓDULO: db-core.js (v2.5 – persistencia de mesas)
   Propósito: Núcleo de base de datos: mesas, pedidos, comandas,
              mozos, configuración y pedidos de delivery.
              Ahora carga las mesas desde localStorage para que
              sobrevivan a una recarga (F5).
   ================================================================ */

const DBCore = (function() {
  const module = {};

  module.productos = [];
  module.pedidos = [];
  module.mesas = [];
  module.comandas = [];
  module.config = {};
  module.mozos = [];
  module.pedidosDelivery = [];

  /* ── NORMALIZACIONES ─────────────────────────────────────── */
  module._normalizarProducto = function(p) {
    return {
      id: this._validarId(p.id, 'prod'),
      nombre: this._validarString(p.nombre, 'Sin nombre'),
      precio: this._validarNumero(p.precio, 0),
      categoria: this._validarString(p.categoria, 'General'),
      destino: this._validarDestino(p.destino),
      descripcion: this._validarString(p.descripcion, ''),
      activo: this._validarBooleano(p.activo, true),
      imagen: this._validarString(p.imagen, '')
    };
  };

  module._normalizarMesa = function(m) {
    return {
      numero: this._validarNumero(m.numero, 0),
      estado: this._validarEstadoMesa(m.estado),
      pedidoId: m.pedidoId || null,
      items: Array.isArray(m.items) ? m.items : [],
      mozo: this._validarString(m.mozo, ''),
      comensales: this._validarNumero(m.comensales, 1),
      abiertaEn: m.abiertaEn || null,
      observaciones: this._validarString(m.observaciones, ''),
      mesasFusionadas: m.mesasFusionadas || null,
      esVirtual: m.esVirtual || false,
      zona: this._validarString(m.zona, (this.config.zonas && this.config.zonas[0]?.nombre) || 'salon')
    };
  };

  module._normalizarMozo = function(m) {
    return {
      id: this._validarId(m.id, 'mozo'),
      nombre: this._validarString(m.nombre, 'Sin nombre'),
      activo: this._validarBooleano(m.activo, true)
    };
  };

  module._normalizarPedidoDelivery = function(pd) {
    return {
      id: this._validarId(pd.id, 'deliv'),
      direccion: this._validarString(pd.direccion, 'Sin dirección'),
      telefono: this._validarString(pd.telefono, ''),
      items: Array.isArray(pd.items) ? pd.items : [],
      total: this._validarNumero(pd.total, 0),
      estado: ['pendiente','en_preparacion','en_camino','entregado'].includes(pd.estado) ? pd.estado : 'pendiente',
      repartidor: this._validarString(pd.repartidor, ''),
      created_at: pd.created_at || new Date().toISOString(),
      observaciones: this._validarString(pd.observaciones, '')
    };
  };

  /* ── VALIDACIONES BÁSICAS ────────────────────────────────── */
  module._validarId = function(val, prefijo) {
    if (typeof val === 'string' && val.length > 0) return val;
    return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  };
  module._validarString = function(val, defecto) {
    return (typeof val === 'string' && val.trim()) ? val.trim() : defecto;
  };
  module._validarNumero = function(val, defecto) {
    const num = Number(val);
    return isNaN(num) ? defecto : num;
  };
  module._validarBooleano = function(val, defecto) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return defecto;
  };
  module._validarDestino = function(val) {
    const destinos = ['cocina', 'barra', 'ambos'];
    return destinos.includes(val) ? val : 'cocina';
  };
  module._validarEstadoMesa = function(val) {
    const estados = ['libre', 'ocupada', 'esperando', 'cuenta', 'fusionada'];
    return estados.includes(val) ? val : 'libre';
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

  // 🆕 Carga las mesas desde localStorage antes de inicializar
  module._cargarMesasLocal = function() {
    const raw = localStorage.getItem('pubpos_mesas');
    if (raw) {
      try {
        this.mesas = JSON.parse(raw).map(m => this._normalizarMesa(m));
      } catch (e) {
        this.mesas = [];
      }
    } else {
      this.mesas = [];
    }
  };

  module._inicializarMesas = function() {
    // Primero cargar las mesas que ya estaban guardadas
    this._cargarMesasLocal();

    const zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    if (this.mesas.length === 0) {
      // Sin mesas guardadas, crear desde cero
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
      // Ya hay mesas (guardadas), ajustar cantidades por zona sin perder estado
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
        { id: 'mozo_1', nombre: 'Carlos', activo: true },
        { id: 'mozo_2', nombre: 'Ana', activo: true },
        { id: 'mozo_3', nombre: 'Luis', activo: true },
        { id: 'mozo_4', nombre: 'María', activo: true }
      ];
      this.saveMozos();
    }
  };

  module._cargarPedidosDeliveryLocal = function() {
    const raw = localStorage.getItem('pubpos_pedidos_delivery');
    if (raw) {
      this.pedidosDelivery = JSON.parse(raw).map(pd => this._normalizarPedidoDelivery(pd));
    } else {
      this.pedidosDelivery = [];
    }
  };

  /* ── GUARDADO ────────────────────────────────────────────── */
  module.saveConfig = function() { localStorage.setItem('pubpos_config', JSON.stringify(this.config)); };
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
  module.saveMozos = function() { localStorage.setItem('pubpos_mozos', JSON.stringify(this.mozos)); };
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
      created_at: new Date().toISOString()
    };
    this.pedidos.push(nuevo);
    this.savePedidos();
    return nuevo;
  };

  module.actualizarPedido = async function(id, cambios) {
    const idx = this.pedidos.findIndex(p => p.id === id);
    if (idx >= 0) {
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

  return module;
})();

function mesaVacia(num, zona = 'salon') {
  return {
    numero: num,
    estado: 'libre',
    pedidoId: null,
    items: [],
    mozo: '',
    comensales: 1,
    abiertaEn: null,
    observaciones: '',
    zona: zona
  };
}