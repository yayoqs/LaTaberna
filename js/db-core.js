/* ================================================================
   PubPOS — MÓDULO: db-core.js (v2.1 – zonas con ajuste automático)
   Propósito: Núcleo de base de datos. Ahora sincroniza las mesas
              con DB.config.zonas sin perder el estado de las ocupadas.
   ================================================================ */

const DBCore = (function() {
  const module = {};

  module.productos = [];
  module.pedidos = [];
  module.mesas = [];
  module.comandas = [];
  module.config = {};
  module.mozos = [];

  /* ── VALIDACIÓN Y NORMALIZACIÓN ───────────────────────────── */
  module._normalizarProducto = function(p) {
    return {
      id: this._validarId(p.id, 'prod'),
      nombre: this._validarString(p.nombre, 'Sin nombre'),
      precio: this._validarNumero(p.precio, 0),
      categoria: this._validarString(p.categoria, 'General'),
      destino: this._validarDestino(p.destino),
      descripcion: this._validarString(p.descripcion, ''),
      activo: this._validarBooleano(p.activo, true)
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
      // Migración única: cantidadMesas -> zonas
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

  /**
   * Sincroniza las mesas reales con la configuración de zonas.
   * - Si no hay mesas, las crea todas desde cero.
   * - Si ya hay mesas, ajusta las cantidades por zona:
   *   * Añade mesas libres si faltan.
   *   * Elimina mesas libres sobrantes (las de mayor número).
   *   * No modifica mesas con estado != 'libre'.
   */
  module._inicializarMesas = function() {
    const zonas = this.config.zonas || [{ nombre: 'salon', cantidad: 12 }];

    if (this.mesas.length === 0) {
      // Crear desde cero
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
      // Filtrar solo mesas reales (no virtuales)
      const mesasReales = this.mesas.filter(m => !m.esVirtual);
      const mesasOcupadas = mesasReales.filter(m => m.estado !== 'libre');

      const porZona = {};
      zonas.forEach(z => { porZona[z.nombre] = { deseado: z.cantidad, actuales: [], libres: [] }; });

      // Clasificar mesas existentes
      mesasReales.forEach(m => {
        const zona = m.zona || 'salon';
        if (porZona[zona]) {
          porZona[zona].actuales.push(m);
          if (m.estado === 'libre') porZona[zona].libres.push(m);
        } else {
          // Si la mesa tiene una zona que ya no existe, la tratamos como libre para reasignar
          m.zona = 'salon';
          if (!porZona['salon']) porZona['salon'] = { deseado: 0, actuales: [], libres: [] };
          porZona['salon'].actuales.push(m);
          if (m.estado === 'libre') porZona['salon'].libres.push(m);
        }
      });

      const nuevasMesas = [];
      let maxNumero = Math.max(0, ...mesasReales.map(m => m.numero));

      // Para cada zona, ajustar cantidad
      zonas.forEach(z => {
        const zonaData = porZona[z.nombre] || { deseado: z.cantidad, actuales: [], libres: [] };
        if (!porZona[z.nombre]) porZona[z.nombre] = zonaData;

        const actuales = zonaData.actuales;
        const libres = zonaData.libres;
        const diferencia = z.cantidad - actuales.length;

        if (diferencia > 0) {
          // Faltan mesas: crearlas libres con números nuevos
          for (let i = 0; i < diferencia; i++) {
            maxNumero++;
            const nueva = { ...mesaVacia(maxNumero, z.nombre), numero: maxNumero };
            nuevasMesas.push(nueva);
            actuales.push(nueva);
          }
        } else if (diferencia < 0) {
          // Sobran mesas: eliminar libres (las de mayor número)
          const aEliminar = Math.min(-diferencia, libres.length);
          // Ordenar libres por número descendente para eliminar las más altas
          libres.sort((a,b) => b.numero - a.numero);
          for (let i = 0; i < aEliminar; i++) {
            const mesa = libres[i];
            const idx = actuales.indexOf(mesa);
            if (idx >= 0) actuales.splice(idx, 1);
            // También quitarla del array global más tarde
          }
        }

        // Añadir las actuales (sin las eliminadas) al pool final
        nuevasMesas.push(...actuales);
      });

      // Reasignar el array global, asegurando no duplicar mesas ocupadas
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
      const mozosParseados = JSON.parse(raw);
      this.mozos = mozosParseados.map(m => this._normalizarMozo(m));
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

  /* ── GESTIÓN DE PEDIDOS ──────────────────────────────────── */
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