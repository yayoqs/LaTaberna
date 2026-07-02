/* ================================================================
   LaTaberna - PubPOS — TEST INTEGRADO
   Archivo: test-B-precarga.modulo.js
   Versión: 1.0.0
   Propósito: Test integrado del flujo de precargas.
              Se ejecuta dentro de la aplicación real.
   ================================================================ */

import { Mesas } from '../js/ui/mesas.js';
import { Comanda } from '../js/ui/comanda.js';
import { PrecargaControl } from '../js/modulos/interno/precarga-control.js';
import { Store } from '../js/lib/store.js';
import { EventBus } from '../js/lib/eventBus.js';
import { DB } from '../js/db.js';

export async function ejecutarTestPrecarga() {
  const resultados = [];
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) {
      passed++;
      resultados.push({ tipo: 'pass', msg });
    } else {
      failed++;
      resultados.push({ tipo: 'fail', msg });
    }
  }

  const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

  // ── Preparar entorno ──────────────────────────────
  // Guardar estado original para restaurar después
  const mesasOriginales = DB.mesas ? [...DB.mesas] : [];
  const comandasOriginales = DB.comandas ? [...DB.comandas] : [];

  // Asegurar que hay al menos dos mesas libres
  if (!DB.mesas) DB.mesas = [];
  if (DB.mesas.length < 2) {
    DB.mesas.push({ numero: 1, estado: 'libre', zona: 'salon', items: [], mozo: '', comensales: 1, pedidoId: null, esVirtual: false, permite_prepedidos: false });
    DB.mesas.push({ numero: 2, estado: 'libre', zona: 'salon', items: [], mozo: '', comensales: 1, pedidoId: null, esVirtual: false, permite_prepedidos: false });
  } else {
    // Asegurar que las dos primeras mesas estén libres
    DB.mesas[0].estado = 'libre';
    DB.mesas[0].items = [];
    DB.mesas[0].permite_prepedidos = false;
    if (DB.mesas[1]) {
      DB.mesas[1].estado = 'libre';
      DB.mesas[1].items = [];
      DB.mesas[1].permite_prepedidos = false;
    }
  }

  // Mock mínimo de showToast si no existe
  if (typeof window.showToast !== 'function') {
    window.showToast = () => {};
  }

  // Refrescar el Store
  Store.dispatch({ type: 'MESAS_INICIALIZAR', payload: DB.mesas });

  // Asegurar que la vista de mesas esté renderizada
  Mesas.render();
  await esperar(100);

  // ── Suite 1: Insignia al recibir precarga ─────────
  const mesa1 = DB.mesas[0];
  mesa1.estado = 'ocupada';
  mesa1.pedidoId = 'ped_test';
  mesa1.mozo = 'Carlos';
  mesa1.comensales = 2;
  mesa1.personas = ['General'];
  mesa1.personaActiva = 'General';
  mesa1.items = [];
  Comanda.setMesaActiva(mesa1);

  const mesaActiva = Comanda.getMesaActiva();
  assert(mesaActiva !== null && mesaActiva.numero === mesa1.numero, 'Comanda tiene mesa activa ' + mesa1.numero);

  const precargaPrueba = {
    id: 'prec_001',
    mesa: mesa1.numero,
    items: [
      { prodId: 'prod_a', nombre: 'Hamburguesa', precio: 1500, categoria: 'platos', destino: 'cocina', qty: 2, obs: 'sin cebolla' },
      { prodId: 'prod_b', nombre: 'Cerveza', precio: 800, categoria: 'bebidas', destino: 'barra', qty: 1, obs: '' }
    ],
    clienteId: 'juan',
    observaciones: '',
    timestamp: Date.now()
  };

  EventBus.emit('cliente:precarga_enviada', precargaPrueba);
  await esperar(100);

  let badgeEl = document.querySelector('.precarga-badge');
  assert(!!badgeEl, 'Aparece una insignia en la mesa ' + mesa1.numero);
  if (badgeEl) {
    assert(badgeEl.textContent.includes('2'), 'La insignia muestra la cantidad de ítems (2)');
  }

  const precargasGuardadas = PrecargaControl._precargas;
  assert(precargasGuardadas.has('prec_001'), 'Precarga almacenada en PrecargaControl');

  // ── Suite 2: Clic en insignia carga ítems ─────────
  badgeEl = document.querySelector('.precarga-badge');
  if (badgeEl) {
    badgeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await esperar(100);
  } else {
    assert(false, 'No se encontró la insignia para hacer clic');
  }

  const itemsComanda = mesa1.items;
  assert(itemsComanda.length === 2, 'Se agregaron 2 líneas de ítems (se encontraron ' + itemsComanda.length + ')');

  const totalUnidades = itemsComanda.reduce((acc, it) => acc + it.qty, 0);
  assert(totalUnidades === 3, 'Total de unidades = 3 (2 hamburguesas + 1 cerveza), real: ' + totalUnidades);

  const hamburguesa = itemsComanda.find(it => it.prodId === 'prod_a');
  assert(hamburguesa && hamburguesa.qty === 2, 'Hamburguesa tiene qty=2');

  let badgeDespues = document.querySelector('.precarga-badge');
  assert(!badgeDespues, 'La insignia desapareció después de cargar');

  assert(!PrecargaControl._precargas.has('prec_001'), 'Precarga removida del almacenamiento local');

  // ── Suite 3: Observaciones múltiples ───────────────
  const mesa3 = DB.mesas[1];
  mesa3.estado = 'ocupada';
  mesa3.pedidoId = 'ped_test_3';
  mesa3.mozo = 'Carlos';
  mesa3.comensales = 2;
  mesa3.personas = ['General'];
  mesa3.personaActiva = 'General';
  mesa3.items = [];
  Comanda.setMesaActiva(mesa3);

  const precargaObsMultiples = {
    id: 'prec_003',
    mesa: mesa3.numero,
    items: [
      { prodId: 'prod_x', nombre: 'Pizza', precio: 2000, categoria: 'platos', destino: 'cocina', qty: 1, obs: 'sin queso' },
      { prodId: 'prod_y', nombre: 'Ensalada', precio: 900, categoria: 'entradas', destino: 'cocina', qty: 1, obs: 'sin tomate' }
    ],
    clienteId: 'ana',
    observaciones: '',
    timestamp: Date.now()
  };

  EventBus.emit('cliente:precarga_enviada', precargaObsMultiples);
  await esperar(100);

  badgeEl = document.querySelector('.precarga-badge');
  if (badgeEl) {
    badgeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await esperar(100);
  }

  const pizza = mesa3.items.find(it => it.prodId === 'prod_x');
  const ensalada = mesa3.items.find(it => it.prodId === 'prod_y');

  assert(pizza && pizza.obs === 'sin queso', 'Pizza tiene obs "sin queso"');
  assert(ensalada && ensalada.obs === 'sin tomate', 'Ensalada tiene obs "sin tomate"');

  Mesas.clearBadge(mesa3.numero);
  PrecargaControl._precargas.clear();
  mesa3.items = [];

  // ── Suite 4: Precarga sin mesa activa no carga ─────
  Comanda.setMesaActiva(null);

  const precarga2 = {
    id: 'prec_002',
    mesa: mesa3.numero,
    items: [{ prodId: 'prod_c', nombre: 'Pizza', precio: 2000, categoria: 'platos', destino: 'cocina', qty: 1, obs: '' }],
    clienteId: 'maria',
    observaciones: '',
    timestamp: Date.now()
  };
  EventBus.emit('cliente:precarga_enviada', precarga2);
  await esperar(100);

  const badge2 = document.querySelector('.precarga-badge');
  assert(!!badge2, 'Insignia aparece para mesa ' + mesa3.numero + ' aunque no esté activa');

  let toastLlamado = false;
  const showToastOriginal = window.showToast;
  window.showToast = function(tipo, msg) {
    if (tipo === 'warning' && msg.indexOf('Abrí la mesa') !== -1) {
      toastLlamado = true;
    }
  };

  badge2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await esperar(100);

  assert(toastLlamado, 'Muestra advertencia "Abrí la mesa"');
  window.showToast = showToastOriginal;

  const mesa2 = DB.mesas[1];
  assert(mesa2.items.length === 0, 'Los ítems no se cargaron (mesa2 tiene ' + mesa2.items.length + ' ítems)');

  Mesas.clearBadge(mesa3.numero);

  // ── Restaurar estado original ──────────────────────
  DB.mesas = mesasOriginales;
  DB.comandas = comandasOriginales;
  Mesas.render();

  // ── Resultado ──────────────────────────────────────
  return {
    passed,
    failed,
    total: passed + failed,
    resultados,
    exito: failed === 0
  };
}