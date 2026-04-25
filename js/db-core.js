/* ================================================================
   PubPOS — MÓDULO: db-core.js
   Propósito: Núcleo de base de datos: inicialización, mesas, pedidos,
              comandas, mozos, configuración y persistencia local.
   Cambios (2026-04-25):
     • _normalizarMesa ahora mantiene el número como string
       (soporta prefijos como "1A", "2B").
     • _inicializarMesas asigna zona y prefijo sin sobreescribir
       números ya con prefijo.
   ================================================================ */

const DBCore = (function() {
  const module = {};

  // Propiedades internas (se expondrán al objeto DB final)
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

  // ════════════════════════════════════════════════════════════
  // CAMBIO IMPORTANTE: numero se guarda como string para
  // permitir prefijos como "1A", "2B".
  // ════════════════════════════════════════════════════════════
  module._normalizarMesa = function(m) {
    return {
      numero: m.numero != null ? String(m.numero) : '0',
      estado: this._validarEstadoMesa(m.estado),
      pedidoId: m.pedidoId || null,
      items: Array.isArray(m.items) ? m.items : [],
      mozo: this._validarString(m.mozo, ''),
      comensales: this._validarNumero(m.comensales, 1),
      abiertaEn: m.abiertaEn || null,
      observaciones: this._validarString(m.observaciones, ''),
      mesasFusionadas: m.mesasFusionadas || null,
      esVirtual: m.esVirtual || false
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
    this.config = raw ? JSON.parse(raw) : {
      nombreLocal: 'La Taberna',
      direccion: 'Av. Corrientes 1234',
      cuit: '30-12345678-9',
      pieTicket: '¡Gracias por visitarnos!',
      cantidadMesas: 12
    };
  };

  // ════════════════════════════════════════════════════════════
  // INICIALIZACIÓN DE MESAS (con zona y prefijo)
  // ════════════════════════════════════════════════════════════
  module._inicializarMesas = function() {
    const raw = localStorage.getItem('pubpos_mesas');
    if (raw) {
      const mesasParseadas = JSON.parse(raw);
      this.mesas = mesasParseadas.map(m => {
        // Normalizar estructura
        const mesa = this._normalizarMesa(m);
        // Si no tiene zona, asignar salón por defecto
        if (!mesa.zona) mesa.zona = 'salon';
        // Si el número NO tiene prefijo (solo dígitos), agregarlo según zona
        if (/^\d+$/.test(mesa.numero)) {
          const prefijo = mesa.zona === 'terraza' ? 'B' : 'A';
          mesa.numero = mesa.numero + prefijo;
        }
        return mesa;
      });
    } else {
      const cant = this.config.cantidadMesas || 12;
      // Crear mesas nuevas ya con zona 'salon' y prefijo A
      this.mesas = Array.from({ length: cant }, (_, i) => {
        const mesa = mesaVacia(i + 1);
        mesa.numero = String(i + 1) + 'A';
        mesa.zona = 'salon';
        return mesa;
      });
      this.saveMesas();
    }
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
    // Comparación flexible: el número puede venir como string o número
    return this.mesas.find(m => m.numero == num);
  };

  return module;
})();

// Función auxiliar global
function mesaVacia(num) {
  return {
    numero: String(num),   // <-- Convertir a string para consistencia
    estado: 'libre',
    pedidoId: null,
    items: [],
    mozo: '',
    comensales: 1,
    abiertaEn: null,
    observaciones: ''
  };
}