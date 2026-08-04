/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/biblioteca.js
   Versión: 1.1.1
   Propósito: Panel inferior de biblioteca de productos (bottom sheet).
              v1.1.1: migra a nombres en español del Store.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { renderBiblioteca, abrirBiblioteca, cerrarBiblioteca } from './renderer.js';
import { getCategoriaFiltro, setCategoriaFiltro, getTerminoBusqueda, setTerminoBusqueda } from './estado.js';

let _onProductoAgregado = null;

export function inicializar(onProductoAgregado) {
  _onProductoAgregado = onProductoAgregado;

  const sheetList = document.getElementById('menuSheetList');
  if (sheetList) {
    sheetList.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });

    sheetList.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        card.dataset.touchStartX = e.touches[0].clientX;
        card.dataset.touchStartY = e.touches[0].clientY;
      }
    });

    sheetList.addEventListener('touchmove', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        const dx = Math.abs(e.touches[0].clientX - (parseFloat(card.dataset.touchStartX) || 0));
        const dy = Math.abs(e.touches[0].clientY - (parseFloat(card.dataset.touchStartY) || 0));
        if (dx > 10 || dy > 10) {
          card.style.opacity = '0.5';
        }
      }
    });

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
    });
  }

  const canvas = document.getElementById('menuCanvas');
  if (canvas) {
    canvas.addEventListener('dragover', (e) => e.preventDefault());
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
    });
  }
}

export function refrescar() {
  const state = Store.obtenerEstado();  // ✅ español
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
      costo: receta ? calcularCostoReceta(receta, state.ingredientes || []) : 0,
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
    costo: receta ? calcularCostoReceta(receta, state.ingredientes || []) : 0,
    imagen: producto.imagen || ''
  };
}

function calcularCostoReceta(receta, ingredientes) {
  if (!receta || !receta.ingredientes) return 0;
  return receta.ingredientes.reduce((total, ing) => {
    const ingData = ingredientes.find(i => i.id === ing.ingredienteId);
    const costo = ingData ? ing.cantidad * (ingData.valor_unitario || 0) : 0;
    return total + costo;
  }, 0);
}