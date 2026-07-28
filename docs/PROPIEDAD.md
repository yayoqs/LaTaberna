 ┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-07-21 02:30 UTC                        │
│ TIPO:      DOCUMENTO OFICIAL                           │
│ REFERENCIA: Mapa de Propiedad de Archivos v1.2.0        │
└──────────────────────────────────────────────────────────┘

# 🗺️ Mapa de Propiedad de Archivos — La Taberna

**Versión 1.2.0** — Actualizado el 2026-07-21

---

## Cambios en v1.2.0 respecto a v1.1.0

| Cambio | Motivo |
|--------|--------|
| `js/ui/recetas.js` confirmado en **B2** | Cocina/Barra es dueña del Recetario |
| `js/ui/despensa.js` y submódulos confirmados en **D** | Modularización completada |
| `js/ui/menu.js` y submódulos agregados a **D** | Nuevo módulo Diseñador de Cartas |
| `js/ui/config.js` actualizado | Eliminada sección de productos |
| `js/componentes/visualizador-menu.js` pendiente en **E** | Componente compartido futuro |
| `js/dominio/receta.js` agregado a **A** | Nuevo dominio para recetas anidadas |
| `js/servicios/inventario-service.js` confirmado en **D** | Servicio de inventario |
| `css/cliente-inicio.css` corregido | Variables movidas de :root a #view-inicio |

---

## Célula A — Core (27 archivos)

  · js/auth.js
  · js/roles.js
  · js/db-appwrite.js
  · js/db.js
  · js/db-core.js
  · js/db-inventario.js
  · js/db-fusion.js
  · js/db-shim.js
  · js/dominio/cantidad.js
  · js/dominio/delivery.js
  · js/dominio/dinero.js
  · js/dominio/direccion.js
  · js/dominio/ingrediente.js
  · js/dominio/pedido.js
  · js/dominio/receta.js (nuevo)
  · js/dominio/resultado.js
  · js/comandos/agregar-mesa.js
  · js/comandos/completar-subcomanda.js
  · js/comandos/crear-pedido-mesa.js
  · js/comandos/enviar-comanda.js
  · js/comandos/liberar-mesa.js
  · js/comandos/marcar-agotado.js
  · js/comandos/cerrar-turno.js
  · js/repositorios/pedido-repository.js
  · test-A-db.html
  · test-A-pedido.html
  · test-A-auth.html

---

## Célula B1 — Mesero (20 archivos)

  · js/ui/mesas.js
  · js/ui/mesas/constantes.js
  · js/ui/mesas/notificaciones.js
  · js/ui/mesas/estado-comandas.js
  · js/ui/mesas/renderer.js
  · js/ui/mesas/fusion.js
  · js/ui/mesas/ciclo-vida.js
  · js/ui/mesas/acciones-mesa.js
  · js/ui/pedido-ui.js
  · js/ui/comanda.js
  · js/ui/carta.js
  · js/ui/mesa-detalles.js
  · js/ui/cuenta.js
  · js/modulos/interno/precarga-control.js
  · js/modulos/interno/guia-mesero.js
  · css/mesas.css
  · css/mesa-detalles.css
  · css/pedido.css

---

## Célula B2 — Cocina y Barra (7 archivos)

  · js/ui/kds.js
  · js/ui/recetas.js
  · css/kds.css
  · css/recetas.css
  · test-B2-kds.html
  · test-B2-recetas.html

---

## Célula B3 — Caja (10 archivos)

  · js/ui/cobro.js
  · js/ui/caja.js
  · js/ui/tickets.js
  · js/managers/pedido-manager.js
  · js/managers/turno-manager.js
  · js/servicios/pedido-service.js
  · css/caja.css
  · css/ticket.css
  · test-B-caja.html
  · test-B-cobro.html

---

## Célula B4 — Animador (2 archivos)

  · js/modulos/admin/eventos-en-vivo.js
  · css/eventos-en-vivo.css

---

## Célula C — Frontend Cliente (12 archivos)

  · js/modulos/cliente/principal.js
  · js/modulos/cliente/pantalla-inicio.js
  · js/modulos/cliente/pantalla-bienvenida.js
  · js/modulos/cliente/menu-digital.js
  · js/modulos/cliente/orden.js
  · js/modulos/cliente/pantalla-eventos.js
  · css/cliente-inicio.css
  · css/cliente-bienvenida.css
  · css/cliente-menu.css
  · css/cliente-orden.css
  · css/cliente-eventos.css
  · css/menu.css

---

## Célula D — Administración (28 archivos)

  · js/ui/despensa.js (fachada)
  · js/ui/despensa/estado.js
  · js/ui/despensa/renderer.js
  · js/ui/despensa/modal-ingrediente.js
  · js/ui/despensa/exportacion.js
  · js/ui/despensa/acciones.js
  · js/ui/despensa/ciclo-vida.js
  · js/ui/config.js
  · js/ui/perfil.js
  · js/ui/eventos.js
  · js/ui/reparto.js (fachada)
  · js/ui/reparto/acciones.js
  · js/ui/reparto/constantes.js
  · js/ui/reparto/modal-editar.js
  · js/ui/reparto/modal-nuevo.js
  · js/ui/reparto/tabla.js
  · js/ui/reparto/ciclo-vida.js
  · js/ui/menu.js (fachada — Diseñador de Cartas)
  · js/ui/menu/acciones.js
  · js/ui/menu/barra-lateral.js
  · js/ui/menu/biblioteca.js
  · js/ui/menu/ciclo-vida.js
  · js/ui/menu/estado.js
  · js/ui/menu/modal-propiedades.js
  · js/ui/menu/renderer.js
  · js/servicios/delivery-service.js
  · js/servicios/inventario-service.js
  · css/despensa.css
  · css/reparto.css
  · css/perfil.css
  · css/config.css
  · css/modals.css

---

## Célula E — Infraestructura (16 archivos)

  · index.html
  · js/app.js
  · js/bootstrap.js
  · js/config-appwrite.js
  · js/lib/store.js
  · js/lib/eventBus.js
  · js/lib/command-bus.js
  · js/lib/deps.js
  · js/lib/logger.js
  · js/componentes/visualizador-menu.js (pendiente)
  · css/vars.css
  · css/base.css
  · css/layout.css
  · css/responsive.css
  · css/extra.css
  · js/appwrite.min.js

---

## Archivos Compartidos

  · js/utils.js — Uso permitido para todas las células.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 1.2.0 — 2026-07-21*