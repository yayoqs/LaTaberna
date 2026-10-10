/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/biblioteca.js
   Versión: 2.0.1
   Propósito: Panel inferior de biblioteca de productos (bottom sheet).
   v2.0.1: parsea ingredientes de receta si viene como string JSON.
           Detectado en el cierre de D.13/D.14: el test despachaba
           recetas crudas al Store y calcularCostoReceta recibía un
           string en lugar de un array, lanzando TypeError dentro
           del listener del Store. Defensa contra datos sucios
           alineada a §5.2 del brief.
   v2.0.0: rename Menus → Cartas. Listeners atados al
           AbortSignal del ciclo de vida (fix H1).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { renderBiblioteca, abrirBiblioteca, cerrarBiblioteca } from './renderer.js';
import {
  getCategoriaFiltro,
  getTerminoBusqueda
} from './estado.js';

let _onProductoAgregado = null;

export function inicializar(signal, onProductoAgregado) {
  _onProductoAgregado = onProductoAgregado;

  const sheetList = document.getElementById('menuSheetList');
  if (sheetList) {
    sheetList.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.dataset.id);
    }, { signal });

    sheetList.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        card.dataset.touchStartX = e.touches[0].clientX;
        card.dataset.touchStartY = e.touches[0].clientY;
      }
    }, { signal });

    sheetList.addEventListener('touchmove', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        const dx = Math.abs(e.touches[0].clientX - (parseFloat(card.dataset.touchStartX) || 0));
        const dy = Math.abs(e.touches[0].clientY - (parseFloat(card.dataset.touchStartY) || 0));
        if (dx > 10 || dy > 10) {
          card.style.opacity = '0.5';
        }
      }
    }, { signal });

    sheetList.addEventListener('touchend', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        card.style.opacity = '1';
        const id = card.dataset.id;
        if (id) {
          const touch = e.changedTouches[0];
          const canvas = document.getElementById('menuCanvas');
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left - 30;
            const y = touch.clientY - rect.top - 30;
            if (x > 0 && y > 0 && x < rect.width && y < rect.height) {
              const producto = obtenerProductoPorId(id);
              if (producto && typeof _onProductoAgregado === 'function') {
                _onProductoAgregado(producto, x, y);
              }
            }
          }
        }
      }
    }, { signal });
  }

  const canvas = document.getElementById('menuCanvas');
  if (canvas) {
    canvas.addEventListener('dragover', (e) => e.preventDefault(), { signal });
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;
      const producto = obtenerProductoPorId(id);
      if (!producto) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - 30;
      const y = e.clientY - rect.top - 30;
      if (typeof _onProductoAgregado === 'function') {
        _onProductoAgregado(producto, x, y);
      }
    }, { signal });
  }
}

export function refrescar() {
  const state = Store.obtenerEstado();
  let productos = (state.productos || []).filter(p => p.activo !== false);

  const catFiltro = getCategoriaFiltro();
  if (catFiltro !== 'todas') {
    productos = productos.filter(p => p.categoria === catFiltro);
  }

  const termino = getTerminoBusqueda();
  if (termino) {
    productos = productos.filter(p => p.nombre.toLowerCase().includes(termino.toLowerCase()));
  }

  productos = productos.map(p => {
    const receta = (state.recetas || []).find(r => r.productoId === p.id);
    return {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      costo: receta ? calcularCostoReceta(receta, state.insumos || []) : 0,
      imagen: p.imagen || ''
    };
  });

  renderBiblioteca(productos);
}

export function toggle() {
  const sheet = document.getElementById('menuBottomSheet');
  if (sheet && sheet.classList.contains('active')) {
    cerrarBiblioteca();
  } else {
    abrirBiblioteca();
  }
}

function obtenerProductoPorId(id) {
  const state = Store.obtenerEstado();
  const producto = (state.productos || []).find(p => p.id === id);
  if (!producto) return null;
  const receta = (state.recetas || []).find(r => r.productoId === id);
  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: producto.categoria,
    costo: receta ? calcularCostoReceta(receta, state.insumos || []) : 0,
    imagen: producto.imagen || ''
  };
}

// v2.0.1: los ingredientes pueden venir como array (normalizado) o
// como string JSON (fila cruda de Appwrite sin normalizar). Defensa
// contra ambos casos, alineada a §5.2 del brief y al patrón §13.9.
function _parsearIngredientes(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.trim()) {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function calcularCostoReceta(receta, insumos) {
  if (!receta) return 0;
  const ingredientes = _parsearIngredientes(receta.ingredientes);
  if (ingredientes.length === 0) return 0;

  return ingredientes.reduce((total, ing) => {
    const insumoData = insumos.find(i => i.id === ing.id);
    const costo = insumoData ? ing.cantidad * (insumoData.valor_unitario || 0) : 0;
    return total + costo;
  }, 0);
}