/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/fusion.js
   Versión: 1.0.4
   Propósito: Modo fusión (toggle, selección, confirmar).
              v1.0.4: usa await con DB.fusionarMesas async.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { DB } from '../../db.js';
import { mostrarToast, mostrarEntrada } from '../../utils.js';
import { isModoSeleccion, setModoSeleccion, getMesasSeleccionadas, limpiarSeleccion, renderGrid } from './renderer.js';

export function toggleModoFusion() {
  setModoSeleccion(!isModoSeleccion());
  limpiarSeleccion();
  renderGrid();

  const btnFusionar = document.getElementById('btnFusionar');
  const btnConfirmar = document.getElementById('btnConfirmarFusion');

  if (isModoSeleccion()) {
    if (btnFusionar) btnFusionar.style.display = 'none';
    if (btnConfirmar) btnConfirmar.style.display = 'inline-block';
  } else {
    if (btnFusionar) {
      btnFusionar.style.display = 'inline-block';
      btnFusionar.innerHTML = '<i class="fas fa-object-group"></i> Fusionar Mesas';
    }
    if (btnConfirmar) btnConfirmar.style.display = 'none';
  }
}

export function toggleSeleccionMesa(num, isChecked) {
  const seleccionadas = getMesasSeleccionadas();
  if (isChecked) seleccionadas.add(num);
  else seleccionadas.delete(num);
}

export async function fusionarMesasSeleccionadas() {
  const seleccionadas = getMesasSeleccionadas();
  if (seleccionadas.size < 2) {
    mostrarToast('warning', 'Selecciona al menos dos mesas para fusionar.');
    return;
  }

  const numeros = Array.from(seleccionadas).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numA - numB;
  });

  const mozo = document.getElementById('mozoActivo')?.value || 'Mozo';
  const nombrePersonalizado = await mostrarEntrada(
    'Fusionar Mesas',
    'Nombre para la mesa fusionada (opcional):\nFormato automático: 1+2',
    { placeholder: 'Ej: DJ, VIP' }
  );
  const nombreFinal = nombrePersonalizado || '';

  const mesaVirtual = await DB.fusionarMesas(numeros, mozo, nombreFinal);

  if (mesaVirtual) {
    mostrarToast('success', `Mesas fusionadas: ${mesaVirtual.numero}`);
    toggleModoFusion();
    EventBus.emit('mesa:seleccionada', mesaVirtual.numero);
  } else {
    mostrarToast('error', 'No se pudo fusionar. Verifica que el nombre no esté en uso.');
  }
}