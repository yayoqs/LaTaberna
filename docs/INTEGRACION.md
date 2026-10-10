# Tablero de Integración — La Taberna

**Versión:** 3.0.0
**Fecha:** 9 de octubre de 2026
**Propósito:** Estado consolidado de cada célula, contratos
vigentes y puntos de integración. Se actualiza al cierre de cada
iteración.

---

## Estado por célula

| Célula | Estado | Último hito |
|--------|:------:|-------------|
| A — Core | ✅ | A.74 movimientos, A.71 fix CORS, A.65 rama jugador |
| B1 — Mesero | ✅ | Paquete 4 variantes, B1.9 revisadoPor, B1.10 CommandBus |
| B2 — Cocina y Barra | ✅ | Paquete 5 badges de variantes en KDS |
| B3 — Caja | ✅ | Paquete 7 tickets con opciones |
| B4 — Animador | ✅ | Panel eventos en vivo operativo |
| C — Cliente | ✅ | Paquete 6 variantes en menú digital |
| D — Administración | ✅ | Paquete 5 race autoguardado, Paquete 3 asignación |
| E — Infraestructura | ✅ | Slice movimientos, CommandBus E.x14 |

---

## Contratos vigentes

| Documento | Versión | Responsable |
|-----------|---------|-------------|
| `docs/API-GUIA.md` | 6.2.0 | Coordinación |
| `docs/EVENTOS.md` | 1.8.0 | Célula A |
| `docs/COLECCIONES.md` | 4.9.0 | Célula A |
| `docs/PROPIEDAD.md` | 1.4.1 | Coordinación |
| `docs/ARQUITECTURA-VARIANTES.md` | 1.3.0 | Coordinación |
| `docs/ARQUITECTURA-CARTAS.md` | 1.0.0 | Coordinación |
| `docs/EstadoAppwrite.md` | 2.9.0 | Célula A |
| `docs/FUNCIONES-SERVERLESS.md` | 1.3.0 | Célula A |
| `docs/REGLA-CONTROL-REGRESIONES.md` | 1.0.0 | Coordinación |

---

## Puntos de conexión canónicos

- **Store** — estado centralizado de solo lectura.
  `Store.obtenerEstado()`, `Store.despachar()`,
  `Store.suscribir()`.
- **EventBus** — comunicación entre módulos.
  `EventBus.on()` devuelve función de limpieza.
- **CommandBus** — operaciones con lógica de negocio.
  `CommandBus.registrar()` y `CommandBus.ejecutar()`. El wrapper
  inspecciona `data.exito` del handler y propaga el fallo.
- **DBAppwrite** — acceso a Appwrite. Métodos públicos:
  `listar`, `crear`, `actualizar`, `eliminar`,
  `incrementarCampo`, `decrementarCampo`, `crearTransaccion`,
  `confirmarTransaccion`, `cancelarTransaccion`,
  `crearPrecargaCliente`, `invocarAsignarRol`.
- **DB** — orquestador de datos locales y remotos.
- **Auth** — autenticación y roles. Métodos clave:
  `iniciarSesion`, `cerrarSesion`, `registrarUsuario`,
  `obtenerJWT`, `obtenerRolesEfectivos`, `tienePermiso`,
  `vincularCuentaStaff`.
- **DBInventario** — gestión de insumos, recetas, movimientos.
  Métodos clave: `ajustarStock`, `consumirInsumosDeProducto`,
  `obtenerMovimientos`, `obtenerCostoUnitario`.

---

## Acceso a vistas por rol

| Vista | Roles con acceso |
|-------|------------------|
| inicio | público |
| bienvenida | jugador, master, owner, admin, mesero, caja, chef, cocinaAyudante, barman, barraAyudante, repartidor, artista |
| menu-digital | jugador, master, owner, admin, mesero |
| eventos-cliente | jugador, master, owner, admin, artista |
| mesas | master, owner, admin, mesero |
| cocina | master, owner, admin, chef, cocinaAyudante, barman, barraAyudante |
| caja | master, owner, admin, caja |
| despensa | master, owner, admin, chef |
| recetas | master, owner, admin, chef, cocinaAyudante, barman, barraAyudante |
| reparto | master, owner, admin, repartidor |
| menu | master, owner, admin, mesero, jugador |
| eventos | master, owner, admin, artista |
| eventos-en-vivo | master, owner, admin, artista |
| perfil | todos los roles autenticados |
| config | master, owner, admin |
| carta-editor | master, owner, admin |

---

## Contratos entre células (activos)

| Contrato | Emisor | Consumidores | Estado |
|----------|--------|--------------|--------|
| `pedido:creado` | Comando crearPedidoMesa | Store, Caja | Vigente |
| `pedido:cerrado` | PedidoService / Cobro | App, Store | Vigente |
| `pedido:transaccion_agregada` | PedidoService | Store | Vigente |
| `comanda:enviada` | PedidoRepository | KDS, App | Vigente |
| `comanda:completada` | Comando completarSubcomanda | Store | Vigente |
| `comanda:subcomanda_completada` | Comando completarSubcomanda | KDS | Vigente |
| `mesa:actualizada` | DB / Store / Realtime | Mesas, KDS, Caja, Cliente | Vigente |
| `mesa:liberada` | PedidoRepository | Mesas, Store | Vigente |
| `mesa:badge_click` | Mesas | PrecargaControl | Vigente |
| `cliente:mesa_ingresada` | PantallaBienvenida | Mesas, AvisosMesero | Vigente |
| `cliente:precarga_enviada` | MenuDigital | PrecargaControl | Vigente |
| `cliente:llamar_garzon` | PantallaBienvenida | Mesas, AvisosMesero | Vigente |
| `cliente:comensal_agregado` | PantallaBienvenida | Mesas | Vigente |
| `cliente:producto_con_variantes` | MenuDigital (cliente) | modal-opciones (cliente) | Vigente |
| `cliente:producto_agregado_a_orden` | modal-opciones (cliente) | MenuDigital (cliente) | Vigente |
| `cliente:alergias_actualizadas` | alergias-cliente | MenuDigital (cliente) | Vigente |
| `precarga:nueva` | PrecargaControl | Mesas | Vigente |
| `precarga:items_listos` | PrecargaControl | Comanda | Vigente |
| `precarga:cargar_en_comanda` | MesaDetalles | PrecargaControl | Vigente |
| `precarga:revisada` | PrecargaControl | EventBus | Vigente |
| `producto:seleccionado` | Carta | Comanda | Vigente |
| `producto:con_variantes` | Carta | modal-opciones (mesero) | Vigente |
| `producto:agregado_a_comanda` | modal-opciones (mesero) | Pedido | Vigente |
| `producto:agotado` | Comando marcarAgotado | KDS, Menu, Carta | Vigente |
| `variantes:actualizadas` | variante-repository | Store, vistas | Vigente |
| `movimientos:actualizados` | db-inventario | Despensa | Vigente |
| `inventario:actualizado` | DBInventario | Store, Despensa | Vigente |
| `inventario:stock_bajo` | DBInventario | App | Vigente |
| `inventario:descuento_incompleto` | enviar-comanda | Despensa | Vigente |
| `config:actualizada` | Config | Mesas, App | Vigente |
| `turno:iniciado` | PedidoManager | App, Caja | Vigente |
| `turno:solicitar_cierre` | PedidoManager | TurnoManager | Vigente |
| `turno:cerrado` | TurnoManager | App, Caja | Vigente (una sola emisión) |
| `auth:staff_vinculado` | Auth | Store, D | Vigente |
| `jugador:cuenta_creada` | Auth | ClienteModulo | Vigente |
| `app:cambiarVista` | Auth / EventBus | App | Vigente |
| `app:error` | DB | App | Vigente |

---

## Checklist de validación integral

- [x] Iniciar sesión con todos los roles.
- [x] Alta de staff con cuenta existente y nueva.
- [x] Asignación jerárquica de roles.
- [x] Crear mesa y verificar persistencia en Appwrite.
- [x] Abrir mesa y crear pedido.
- [x] Enviar comanda a cocina.
- [x] Enviar comanda a barra.
- [x] Usuario con roles combinados alternar Cocina/Barra.
- [x] Cliente genera aviso de vinculación.
- [x] Cliente llama al garzón.
- [x] Mesero visualiza avisos en otro dispositivo.
- [x] Cliente envía precarga.
- [x] Mesero revisa precarga.
- [x] Cliente envía precarga con variantes.
- [x] Mesero recibe precarga con opciones.
- [x] Cliente selecciona variante con insumos_delta.
- [x] KDS muestra badges de variantes.
- [x] Caja imprime ticket con opciones.
- [x] Descuento de stock al enviar comanda aplica deltas de variantes.
- [x] Ajuste manual de stock persiste en Appwrite y Store.
- [x] Movimiento aparece en panel de Despensa sin recargar.
- [x] Pedir cuenta y cerrar mesa.
- [x] Fusionar y deshacer fusión.
- [x] Registrar insumo y entrada.
- [x] Crear receta intermedia y ejecutar preparación.
- [x] Configurar local por espacio.
- [x] Validar menú digital.
- [x] Validar vista de reparto.
- [x] Editor de variantes: crear, editar, desactivar.
- [x] Editor de cartas: Modo Lienzo y Modo Variantes.
- [x] Asignación de variantes a productos.

---

## Pendientes de coordinación

1. Cierre de la Fase D del paquete movimientos (ajustes de
   renderer y ciclo-vida en Despensa).
2. Paquete de saneamiento de repositorios (A.51–A.60).
3. Reescritura de documentación histórica (en curso).
4. Prueba integral general con todas las células.
5. Reforma del flujo de dinero con Célula B3.
6. Evaluación de servidor local para operación offline.
7. Definición formal del rol `artista` con B4.
8. Unificación de nomenclatura snake/camel.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 3.0.0 — 9 de octubre de 2026*