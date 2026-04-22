/* ================================================================
   PubPOS — MÓDULO: db-fusion.js
   Propósito: Fusión y liberación de mesas virtuales.
   ================================================================ */

const DBFusion = (function() {
  const module = {};

  module.fusionarMesas = function(numeros, mozo) {
    const mesasSeleccionadas = numeros.map(num => this.getMesa(num)).filter(m => m);
    if (mesasSeleccionadas.length !== numeros.length) {
      console.warn('[DB] Algunas mesas no existen.');
      return null;
    }

    const estadosPermitidos = ['libre', 'ocupada', 'esperando'];
    if (!mesasSeleccionadas.every(m => estadosPermitidos.includes(m.estado))) {
      console.warn('[DB] Solo se pueden fusionar mesas libres, ocupadas o esperando.');
      return null;
    }

    let todasOriginales = [];
    mesasSeleccionadas.forEach(m => {
      if (m.esVirtual && m.mesasFusionadas) {
        todasOriginales.push(...m.mesasFusionadas);
      } else {
        todasOriginales.push(m.numero);
      }
    });
    todasOriginales = [...new Set(todasOriginales)].sort((a,b) => a-b);

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
      if (m.esVirtual) {
        const idx = this.mesas.findIndex(mesa => mesa.numero === m.numero);
        if (idx >= 0) this.mesas.splice(idx, 1);
      }
    });

    const numeroVirtual = todasOriginales.join('+');
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
      total: totalConsolidado
    };

    this.mesas.push(mesaVirtual);
    this.saveMesas();
    EventBus.emit('mesas:guardadas', this.mesas);
    return mesaVirtual;
  };

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