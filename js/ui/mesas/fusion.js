/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/fusion.js
   Versión: 1.0.2
   Propósito: Modo fusión (toggle, selección, confirmar).
              Migración de prompt a mostrarEntrada.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { DB } from '../../db.js';
import { showToast, mostrarEntrada } from '../../utils.js';
import { isModoSeleccion, setModoSeleccion, getMesasSeleccionadas, limpiarSeleccion } from './renderer.js';
import { renderGrid } from './renderer.js';

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
  if (isChecked) {
    seleccionadas.add(num);
  } else {
    seleccionadas.delete(num);
  }
}

export async function fusionarMesasSeleccionadas() {
  const seleccionadas = getMesasSeleccionadas();
  if (seleccionadas.size < 2) {
    showToast('warning', 'Selecciona al menos dos mesas para fusionar.');
    return;
  }
  const numeros = Array.from(seleccionadas).sort((a, b) => {
    const numA = typeof a === 'number' ? a : parseInt(a);
    const numB = typeof b === 'number' ? b : parseInt(b);
    return numA - numB;
  });
  const mozo = document.getElementById('mozoActivo')?.value || 'Mozo';
  const nombrePersonalizado = await mostrarEntrada(
    'Fusionar Mesas',
    'Nombre para la mesa fusionada (opcional):\nFormato automático: 1+2',
    { placeholder: 'Ej: DJ, VIP' }
  );
  // Si el usuario cancela, nombrePersonalizado será null/undefined, se usará '' para el automático
  const nombreFinal = nombrePersonalizado || '';

  const mesaVirtual = DB.fusionarMesas(numeros, mozo, nombreFinal);
  if (mesaVirtual) {
    showToast('success', `Mesas fusionadas: ${mesaVirtual.numero}`);
    toggleModoFusion();
    EventBus.emit('mesa:seleccionada', mesaVirtual.numero);
  } else {
    showToast('error', 'No se pudo fusionar. Verifica que el nombre no esté en uso.');
  }
}