# Mapa de Propiedad de Archivos — La Taberna

**Versión 1.4.1** — Actualizado el 2026-10-08

---

## Cambios en v1.4.1 respecto a v1.4.0

- Título y línea final corregidos a v1.4.1.
- Confirmado que `js/dominio/receta.js` no existe. Eliminada
  la línea del listado de Célula A y la sección de
  verificación pendiente.
- Agregada sección "Coordinación de Integración" con
  `test-integracion-unificado.html`.
- Ajustados los conteos por célula para coincidir con el
  listado real.
- Anotado que cuando Célula C entregue su bloque v1.5.0, se
  sumarán `js/modulos/cliente/modal-opciones.js`,
  `js/modulos/cliente/alergias-cliente.js` y
  `css/cliente-modal-opciones.css` a Célula C.

## Cambios en v1.4.0 respecto a v1.3.1

- A.40: `js/dominio/alergenos.js` (nuevo) pasa a Célula A.
- A.42: `js/repositorios/variante-repository.js` (nuevo) pasa
  a Célula A.
- A.49: `js/repositorios/receta-repository.js` pasa a
  Célula A.
- Se formaliza `js/repositorios/inventario-repository.js` y
  `js/repositorios/proveedor-repository.js` como Célula A.
- Se reemplazan los tests obsoletos por los tres oficiales
  vigentes.
- Se formaliza `js/lib/logger.js` en Célula A.

---

## Célula A — Core (33 archivos)

### Núcleo de base de datos y sincronización

  · js/db-appwrite.js
  · js/db.js
  · js/db-core.js
  · js/db-inventario.js
  · js/db-fusion.js
  · js/db-shim.js

### Autenticación y roles

  · js/auth.js
  · js/roles.js

### Dominio

  · js/dominio/alergenos.js
  · js/dominio/cantidad.js
  · js/dominio/delivery.js
  · js/dominio/dinero.js
  · js/dominio/direccion.js
  · js/dominio/ingrediente.js
  · js/dominio/pedido.js
  · js/dominio/resultado.js

### Comandos

  · js/comandos/agregar-mesa.js
  · js/comandos/cerrar-turno.js
  · js/comandos/completar-subcomanda.js
  · js/comandos/crear-pedido-mesa.js
  · js/comandos/enviar-comanda.js
  · js/comandos/liberar-mesa.js
  · js/comandos/marcar-agotado.js

### Repositorios

  · js/repositorios/inventario-repository.js
  · js/repositorios/pedido-repository.js
  · js/repositorios/proveedor-repository.js
  · js/repositorios/receta-repository.js
  · js/repositorios/variante-repository.js

### Configuración y utilidades núcleo

  · js/config-appwrite.js
  · js/lib/logger.js

### Funciones serverless

  · funciones/registrar-usuario/index.js
  · funciones/asignar-rol/index.js

### Tests oficiales

  · test-A-unificado.html
  · Test-A-Seguridad.html
  · test-A-exploracion.html

### Documentación canónica

  · docs/COLECCIONES.md
  · docs/EVENTOS.md
  · docs/FUNCIONES-SERVERLESS.md
  · docs/EstadoAppwrite.md
  · docs/ARQUITECTURA-VARIANTES.md
  · docs/GUIA-APPWRITE-CONSOLE-IV.md

Total: 33 archivos.

---

## Célula B1 — Mesero (22 archivos)

  · js/ui/mesas.js
  · js/ui/mesas/constantes.js
  · js/ui/mesas/notificaciones.js
  · js/ui/mesas/estado-comandas.js
  · js/ui/mesas/renderer.js
  · js/ui/mesas/fusion.js
  · js/ui/mesas/ciclo-vida.js
  · js/ui/mesas/acciones-mesa.js
  · js/ui/mesas/bandeja-atencion.js
  · js/ui/pedido-ui.js
  · js/ui/comanda.js
  · js/ui/carta.js
  · js/ui/mesa-detalles.js
  · js/ui/cuenta.js
  · js/ui/pedido/modal-opciones.js
  · js/modulos/interno/precarga-control.js
  · js/modulos/interno/guia-mesero.js
  · js/modulos/interno/avisos-mesero.js
  · css/mesas.css
  · css/mesa-detalles.css
  · css/pedido.css
  · css/modal-opciones.css

Total: 22 archivos.

---

## Célula B2 — Cocina y Barra (6 archivos)

  · js/ui/kds.js
  · js/ui/recetas.js
  · css/kds.css
  · css/recetas.css
  · test-B2-kds.html
  · test-B2-recetas.html

Total: 6 archivos.

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

Total: 10 archivos.

---

## Célula B4 — Animador (2 archivos)

  · js/modulos/admin/eventos-en-vivo.js
  · css/eventos-en-vivo.css

Total: 2 archivos.

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

Total: 12 archivos.

> Cuando Célula C entregue su bloque v1.5.0, se sumarán:
> `js/modulos/cliente/modal-opciones.js`,
> `js/modulos/cliente/alergias-cliente.js` y
> `css/cliente-modal-opciones.css`.

---

## Célula D — Administración (48 archivos)

  · js/ui/despensa.js (fachada)
  · js/ui/despensa/estado.js
  · js/ui/despensa/renderer.js
  · js/ui/despensa/modal-insumo.js
  · js/ui/despensa/modal-proveedor.js
  · js/ui/despensa/exportacion.js
  · js/ui/despensa/acciones.js
  · js/ui/despensa/ciclo-vida.js
  · js/ui/config.js
  · js/ui/perfil.js
  · js/ui/perfil/renderer.js
  · js/ui/perfil/ciclo-vida.js
  · js/ui/perfil/edicion.js
  · js/ui/perfil/estado.js
  · js/ui/perfil/vitrina.js
  · js/ui/perfil/admin-roles.js
  · js/ui/eventos.js
  · js/ui/reparto.js (fachada)
  · js/ui/reparto/acciones.js
  · js/ui/reparto/constantes.js
  · js/ui/reparto/modal-editar.js
  · js/ui/reparto/modal-nuevo.js
  · js/ui/reparto/tabla.js
  · js/ui/reparto/ciclo-vida.js
  · js/ui/carta-editor.js (fachada — Diseñador de Cartas)
  · js/ui/carta-editor/acciones.js
  · js/ui/carta-editor/barra-lateral.js
  · js/ui/carta-editor/biblioteca.js
  · js/ui/carta-editor/ciclo-vida.js
  · js/ui/carta-editor/estado.js
  · js/ui/carta-editor/modal-propiedades.js
  · js/ui/carta-editor/renderer.js
  · js/ui/carta-editor/asignacion/ciclo-vida.js
  · js/ui/carta-editor/asignacion/estado.js
  · js/ui/carta-editor/asignacion/renderer.js
  · js/ui/carta-editor/asignacion/validaciones.js
  · js/ui/carta-editor/variantes/ciclo-vida.js
  · js/ui/carta-editor/variantes/estado.js
  · js/ui/carta-editor/variantes/renderer.js
  · js/ui/carta-editor/variantes/validaciones.js
  · js/servicios/delivery-service.js
  · js/servicios/inventario-service.js
  · css/despensa.css
  · css/reparto.css
  · css/perfil.css
  · css/config.css
  · css/carta-editor.css

Total: 48 archivos.

---

## Célula E — Infraestructura (15 archivos)

  · index.html
  · js/app.js
  · js/bootstrap.js
  · js/lib/store.js
  · js/lib/eventBus.js
  · js/lib/command-bus.js
  · js/lib/deps.js
  · css/vars.css
  · css/base.css
  · css/layout.css
  · css/responsive.css
  · css/extra.css
  · css/modals.css
  · js/appwrite.min.js
  · js/utils.js — Uso permitido para todas las células.

Total: 15 archivos.

> Nota: `js/lib/logger.js` estaba implícito en Célula E. En
> v1.4.0 se formaliza como propiedad de Célula A.
> Nota: `js/lib/deps.js` permanece en Célula E. Es
> infraestructura de inyección de dependencias, no lógica de
> negocio.

---

## Coordinación de Integración (1 archivo)

  · test-integracion-unificado.html

Total: 1 archivo.

> Este test es propiedad de Coordinación, no de ninguna célula.
> Cualquier modificación debe coordinarse con el Coordinador de
> Integración.

---

## Notas generales

### Archivos huérfanos resueltos

Durante el ciclo de variantes quedaron archivos sin dueño claro
en el mapa:

- `js/repositorios/inventario-repository.js` — pasa a Célula A.
  Ya operaba como Core en la práctica.
- `js/repositorios/proveedor-repository.js` — pasa a Célula A.
- `js/repositorios/receta-repository.js` — pasa a Célula A
  (estaba asignado implícitamente a D). Ver A.49.

### Tests oficiales vigentes

Los tres tests oficiales son:

- `test-A-unificado.html` — batería completa de Core.
- `Test-A-Seguridad.html` — aislamiento entre espacios.
- `test-A-exploracion.html` — diagnóstico visual y login.

Los tests `test-A-db.html`, `test-A-pedido.html` y
`test-A-auth.html` ya no existen como archivos separados.
Fueron integrados en `test-A-unificado.html`.

### Cambios de propiedad

Cualquier traspaso temporal de propiedad de un archivo (por
ejemplo, para una tarea puntual) se comunica por escrito a
Coordinación y se refleja en el próximo update de este
documento.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 1.4.1 — 2026-10-08*