/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/db-fusion.js
   Versión: 1.0.2
   Propósito: Lógica de fusión y liberación de mesas virtuales.
              Ahora permite identificadores personalizados mediante
              prompt. Si no se ingresa nombre, se usa formato
              automático "1+2".
   Dependencias: DB, EventBus, Logger
   ================================================================ */

const DBFusion = (function() {
  const module = {};

  /**
   * Fusiona varias mesas en una mesa virtual.
   * @param {number[]} numeros - Números de las mesas a fusionar
   * @param {string} mozo - Mozo asignado a la mesa virtual
   * @param {string} [nombrePersonalizado] - Nombre opcional para la mesa virtual
   * @returns {object|null} La mesa virtual creada o null si falla
   */
  module.fusionarMesas = function(numeros, mozo, nombrePersonalizado) {
    const mesasSeleccionadas = numeros.map(num => this.getMesa(num)).filter(m => m);
    if (mesasSeleccionadas.length !== numeros.length) {
      Logger.warn('[DBFusion] Algunas mesas no existen.');
      return null;
    }

    const estadosPermitidos = ['libre', 'ocupada', 'esperando'];
    if (!mesasSeleccionadas.every(m => estadosPermitidos.includes(m.estado))) {
      Logger.warn('[DBFusion] Solo se pueden fusionar mesas libres, ocupadas o esperando.');
      return null;
    }

    // Recolectar todas las mesas originales involucradas
    let todasOriginales = [];
    mesasSeleccionadas.forEach(m => {
      if (m.esVirtual && m.mesasFusionadas) {
        todasOriginales.push(...m.mesasFusionadas);
      } else {
        todasOriginales.push(m.numero);
      }
    });
    todasOriginales = [...new Set(todasOriginales)].sort((a,b) => a-b);

    // Marcar las originales como fusionadas
    todasOriginales.forEach(num => {
      const original = this.mesas.find(m => m.numero === num && !m.esVirtual);
      if (original) original.estado = 'fusionada';
    });

    let itemsConsolidados = [];
    let pedidoIdUnico = null;
    let totalConsolidado = 0;

    mesasSeleccionadas.forEach(m => {
      if (m.items) itemsConsolidados.push(...m.items);
      totalConsolidado += m.total || 0;
      if (m.pedidoId) pedidoIdUnico = m.pedidoId;
      // Eliminar mesas virtuales intermedias
      if (m.esVirtual) {
        const idx = this.mesas.findIndex(mesa => mesa.numero === m.numero);
        if (idx >= 0) this.mesas.splice(idx, 1);
      }
    });

    // Determinar el identificador de la mesa virtual
    let numeroVirtual;

    if (nombrePersonalizado && nombrePersonalizado.trim() !== '') {
      const nombre = nombrePersonalizado.trim();

      // Validar que no exista otra mesa con ese identificador
      const existe = this.mesas.some(m => String(m.numero) === nombre);
      if (existe) {
        Logger.warn('[DBFusion] Ya existe una mesa con el identificador: ' + nombre);
        return null;
      }

      numeroVirtual = nombre;
    } else {
      // Formato automático: "1+2"
      numeroVirtual = todasOriginales.join('+');
    }

    const mesaVirtual = {
      numero: numeroVirtual,
      estado: itemsConsolidados.length > 0 ? 'ocupada' : 'libre',
      pedidoId: pedidoIdUnico,
      items: itemsConsolidados,
      mozo: mozo,
      comensales: mesasSeleccionadas.reduce((sum, m) => sum + (m.comensales || 1), 0),
      abiertaEn: Date.now(),
      observaciones: '',
      mesasFusionadas: todasOriginales,
      esVirtual: true,
      total: totalConsolidado,
      zona: mesasSeleccionadas[0].zona || 'salon'
    };

    this.mesas.push(mesaVirtual);
    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    return mesaVirtual;
  };

  /**
   * Libera las mesas que estaban fusionadas en una mesa virtual.
   * @param {object} mesaVirtual - La mesa virtual a liberar
   */
  module.liberarMesasFusionadas = function(mesaVirtual) {
    if (!mesaVirtual.esVirtual || !mesaVirtual.mesasFusionadas) return;

    mesaVirtual.mesasFusionadas.forEach(num => {
      const idx = this.mesas.findIndex(m => m.numero === num);
      if (idx >= 0) {
        this.mesas[idx] = mesaVacia(num);
      }
    });

    const idxVirtual = this.mesas.findIndex(m => m.numero === mesaVirtual.numero);
    if (idxVirtual >= 0) {
      this.mesas.splice(idxVirtual, 1);
    }

    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
  };

  return module;
})();

window.DBFusion = DBFusion;