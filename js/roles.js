/* ================================================================
   PubPOS — MÓDULO: roles.js (v2 – nuevos roles despensa, eventos, reparto)
   ================================================================ */

const Roles = {
  lista: ['master', 'admin', 'cocina', 'barra', 'caja', 'mesero', 'despensa', 'eventos', 'reparto', 'cliente'],

  permisos: {
    master: {
      verMesas: true, verCocina: true, verCaja: true, verConfig: true,
      tomarPedido: true, modificarPedidoEnviado: true, eliminarItemEnviado: true,
      cerrarMesa: true, accederCaja: true, accederCocina: true, cambiarEstadoComanda: true,
      editarProductos: true, editarUsuarios: true, editarPrecios: true,
      verRecetasCocina: true, verRecetasBarra: true,
      editarInventarioCocina: true, editarInventarioBarra: true
    },
    admin: {
      verMesas: true, verCocina: true, verCaja: true, verConfig: true,
      tomarPedido: true, modificarPedidoEnviado: true, eliminarItemEnviado: true,
      cerrarMesa: true, accederCaja: true, accederCocina: true, cambiarEstadoComanda: true,
      editarProductos: true, editarUsuarios: false, editarPrecios: true,
      verRecetasCocina: true, verRecetasBarra: true,
      editarInventarioCocina: true, editarInventarioBarra: true
    },
    cocina: {
      verMesas: false, verCocina: true, verCaja: false, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: true, cambiarEstadoComanda: true,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: true, verRecetasBarra: false,
      editarInventarioCocina: true, editarInventarioBarra: false
    },
    barra: {
      verMesas: false, verCocina: true, verCaja: false, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: true, cambiarEstadoComanda: true,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: false, verRecetasBarra: true,
      editarInventarioCocina: false, editarInventarioBarra: true
    },
    caja: {
      verMesas: false, verCocina: false, verCaja: true, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: true, accederCaja: true, accederCocina: false, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: true,
      verRecetasCocina: false, verRecetasBarra: false,
      editarInventarioCocina: false, editarInventarioBarra: false
    },
    mesero: {
      verMesas: true, verCocina: false, verCaja: false, verConfig: false,
      tomarPedido: true, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: false, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: false, verRecetasBarra: false,
      editarInventarioCocina: false, editarInventarioBarra: false
    },
    despensa: {
      verMesas: false, verCocina: false, verCaja: false, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: false, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: true, verRecetasBarra: true,
      editarInventarioCocina: true, editarInventarioBarra: true   // gestión completa de inventario
    },
    eventos: {
      verMesas: true, verCocina: true, verCaja: false, verConfig: false,
      tomarPedido: true, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: true, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: true, verRecetasBarra: true,   // puede ver recetas para coordinar
      editarInventarioCocina: false, editarInventarioBarra: false
    },
    reparto: {
      verMesas: false, verCocina: false, verCaja: false, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: false, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: false, verRecetasBarra: false,
      editarInventarioCocina: false, editarInventarioBarra: false
      // aquí luego podremos agregar permisos de delivery
    },
    cliente: {
      verMesas: false, verCocina: false, verCaja: false, verConfig: false,
      tomarPedido: false, modificarPedidoEnviado: false, eliminarItemEnviado: false,
      cerrarMesa: false, accederCaja: false, accederCocina: false, cambiarEstadoComanda: false,
      editarProductos: false, editarUsuarios: false, editarPrecios: false,
      verRecetasCocina: false, verRecetasBarra: false,
      editarInventarioCocina: false, editarInventarioBarra: false
    }
  },

  getPermisos(rol) {
    return this.permisos[rol] || this.permisos.cliente;
  }
};

window.Roles = Roles;