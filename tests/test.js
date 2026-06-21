/* ================================================================
   PubPOS – Tests Unitarios de Dominio
   ================================================================ */
(function() {
  const resultsEl = document.getElementById('results');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) {
      passed++;
      resultsEl.innerHTML += `<div class="test pass">✔ ${msg}</div>`;
    } else {
      failed++;
      resultsEl.innerHTML += `<div class="test fail">✘ ${msg}</div>`;
    }
  }

  // Verificar que todas las dependencias estén disponibles
  const dependencias = [
    { nombre: 'Cantidad', global: window.Cantidad },
    { nombre: 'crearCantidad', global: window.crearCantidad },
    { nombre: 'Dinero', global: window.Dinero },
    { nombre: 'crearDinero', global: window.crearDinero },
    { nombre: 'Resultado', global: window.Resultado },
    { nombre: 'fmtMoney', global: window.fmtMoney }
  ];

  let faltantes = dependencias.filter(d => d.global === undefined).map(d => d.nombre);
  if (faltantes.length > 0) {
    resultsEl.innerHTML += `<div class="error">❌ Faltan dependencias: ${faltantes.join(', ')}. Verifica las rutas en test.html.</div>`;
    return; // no continuar si faltan dependencias
  }

  // ═══════════════════════════════════════════════════════════
  // Cantidad
  // ═══════════════════════════════════════════════════════════
  resultsEl.innerHTML += '<div class="suite"><h2>Cantidad</h2></div>';
  (() => {
    let c = crearCantidad(3);
    assert(c !== null, 'crearCantidad(3) retorna instancia');
    assert(c.valor === 3, 'valor es 3');
    assert(crearCantidad(0) === null, 'crearCantidad(0) falla');
    assert(crearCantidad(-1) === null, 'crearCantidad(-1) falla');
    let c2 = c.sumar(new Cantidad(2));
    assert(c2.valor === 5, '3 + 2 = 5');
    assert(c.valor === 3, 'original sigue 3 (inmutable)');
    assert(c.esMayorQue(new Cantidad(2)) === true, '3 > 2');
    assert(c.esMenorQue(new Cantidad(5)) === true, '3 < 5');
    assert(c.esIgual(new Cantidad(3)) === true, '3 == 3');
  })();

  // ═══════════════════════════════════════════════════════════
  // Dinero
  // ═══════════════════════════════════════════════════════════
  resultsEl.innerHTML += '<div class="suite"><h2>Dinero</h2></div>';
  (() => {
    let d = crearDinero(1500);
    assert(d !== null, 'crearDinero(1500) retorna instancia');
    assert(d.monto === 1500, 'monto es 1500');
    assert(crearDinero(-10) === null, 'crearDinero(-10) falla');
    assert(crearDinero(NaN) === null, 'crearDinero(NaN) falla');

    let d2 = d.sumar(new Dinero(300));
    assert(d2.monto === 1800, '1500 + 300 = 1800');
    assert(d.monto === 1500, 'original sigue 1500 (inmutable)');

    let d3 = d.restar(new Dinero(2000));
    assert(d3.monto === 0, '1500 - 2000 = 0 (nunca negativo)');

    let d4 = d.multiplicar(3);
    assert(d4.monto === 4500, '1500 * 3 = 4500');

    assert(d.esMayorQue(new Dinero(1000)) === true, '1500 > 1000');
    assert(d.esMenorQue(new Dinero(2000)) === true, '1500 < 2000');
    assert(d.esIgual(new Dinero(1500)) === true, '1500 == 1500');
    assert(d.esCero() === false, '1500 no es cero');

    // toString usa fmtMoney de utils.js (formato es-AR)
    assert(d.toString().includes('1.500'), 'formato incluye separador de miles');
  })();

  // ═══════════════════════════════════════════════════════════
  // Resultado
  // ═══════════════════════════════════════════════════════════
  resultsEl.innerHTML += '<div class="suite"><h2>Resultado</h2></div>';
  (() => {
    let ok1 = Resultado.ok({ id: 5 });
    assert(ok1.exito === true, 'ok tiene exito=true');
    assert(ok1.datos.id === 5, 'ok conserva datos');
    assert(ok1.error === null, 'ok no tiene error');

    let fail1 = Resultado.fallo('boom');
    assert(fail1.exito === false, 'fallo tiene exito=false');
    assert(fail1.error === 'boom', 'fallo conserva error');
    assert(fail1.datos === null, 'fallo no tiene datos');

    // encadenar
    let chain = ok1.encadenar(data => Resultado.ok(data.id * 2));
    assert(chain.exito === true, 'encadenar ok retorna ok');
    assert(chain.datos === 10, 'encadenar transforma datos (5*2=10)');

    let chainFail = fail1.encadenar(data => Resultado.ok(99));
    assert(chainFail.exito === false, 'encadenar sobre fallo retorna fallo');
    assert(chainFail.error === 'boom', 'y mantiene el error original');

    // encadenar con excepción
    let chainEx = ok1.encadenar(() => { throw new Error('ups'); });
    assert(chainEx.exito === false, 'encadenar captura excepción');
    assert(chainEx.error === 'ups', 'error es el mensaje de la excepción');
  })();

  // ── Resumen ──────────────────────────────────────────────
  resultsEl.innerHTML += `<div class="summary">${passed} pasaron, ${failed} fallaron</div>`;
  if (failed === 0) {
    resultsEl.innerHTML += '<div class="test pass">✔ Todos los tests de dominio pasaron.</div>';
  }
})();