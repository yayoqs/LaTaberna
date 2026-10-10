# Estado General del Sistema — La Taberna

**Versión:** 3.0.0
**Fecha:** 9 de octubre de 2026
**Estado:** Estable. Fase 1 de variantes cerrada end-to-end.
Sistema de movimientos de inventario operativo.

---

## Resumen ejecutivo

La Taberna cerró la Fase 1 de variantes (Fase 1 del subsistema
de variantes, no confundir con la numeración de fases de
estabilización). El flujo cliente → mesero → KDS → caja funciona
con variantes en todas las capas. Los movimientos de inventario
migraron de localStorage a la colección canónica
`laTaberna_Movimientos` con slice en el Store y persistencia
remota.

El bug crítico de CORS en `js/db.js` (que rompía la sincronización
de labels al alta de staff) fue corregido. Todas las invocaciones
de funciones serverless desde el frontend pasan por SDK oficial.

---

## Estado por célula

| Célula | Estado | Responsabilidad |
|--------|:------:|-----------------|
| A — Core | ✅ Estable | Auth, DB, colecciones, comandos, repositorios, dominio, roles, funciones serverless |
| B1 — Mesero | ✅ Estable | Mesas, pedido, comanda, avisos, bandeja, fusión, modal de opciones |
| B2 — Cocina y Barra | ✅ Estable | KDS con badges de variantes, recetario unificado |
| B3 — Caja | ✅ Estable | Cobro, caja, tickets con opciones, turnos |
| B4 — Animador | ✅ Operativa | Eventos en vivo. Rol `artista` pendiente de UI de asignación |
| C — Cliente | ✅ Estable | Registro, login, menú digital con variantes, avisos, precargas |
| D — Administración | ✅ Estable | Personal, despensa, reparto, menú, perfil, configuración, editor de cartas, editor de variantes |
| E — Infraestructura | ✅ Estable | app.js, bootstrap, Store, EventBus, CommandBus, CSS base |

---

## Subsistemas clave

### Autenticación

- Autenticación exclusivamente online con Appwrite Account.
- Sin credenciales locales. Email derivado: `<usuario>@elisekai.com`.
- Registro vía función serverless `registrar-usuario` v1.5.2.
- Vinculación de staff vía `asignar-rol` v1.9.1.
- **JWT cacheado** en `Auth.obtenerJWT()` con renovación al 80% del TTL (12 min de 15).
- **Invocación de funciones serverless desde frontend vía SDK
  oficial** (`Appwrite.Functions.createExecution`). Nunca `fetch`
  directo al dominio `*.appwrite.run` (bloqueo por CORS del
  header `x-appwrite-user-jwt` en el preflight OPTIONS).

### Roles del ecosistema

Orden de prioridad:

    master, owner, admin, chef, cocinaAyudante, barman,
    barraAyudante, mesero, caja, repartidor, artista, jugador

- `jugador` es el rol base global. En LaTaberna actúa como
  cliente cuando no pertenece a un Team.
- `owner` es el dueño del espacio (antes `gerente`, deprecado).
- Roles múltiples por usuario. `rolPrincipal` define la vista
  inicial.
- Labels de Appwrite son la fuente de permisos.

### Multi-espacio

- Datos de negocio aislados por `espacioId`.
- Teams de Appwrite para apps operativas (`lataberna`,
  `elretail`). Espacios personales (MiRefugio) sin Team.
- Row Security activado en todas las tablas `laTaberna_*`.
  Permisos de tabla solo `label:master`. Permisos de fila
  generados por `asignar-rol` (acción `crear`) o `DBAppwrite.crear`.

### Realtime

- Realtime activo para todas las colecciones en
  `DBAppwrite.COLECCIONES`.
- Canales `tablesdb` con filtro por `espacioId`.
- `desconectarRealtime()` y `reconfigurarRealtime()` operativos.

### Sistema de variantes

Documentado en `docs/ARQUITECTURA-VARIANTES.md` v1.3.0.

Resumen:

- Colección `laTaberna_Variantes` con opciones de borrado lógico.
- Campo `variantes_ids` (array de strings JSON) en productos.
- Tres niveles de impacto por opción: registro, insumos,
  preparación.
- KDS muestra badges por tipo de impacto.
- Cliente y mesero seleccionan variantes con reglas
  `requiere`/`excluye`.
- Caja imprime opciones en el ticket.
- Fase 2 pendiente: `multiplicar`/`sustituir`, overrides por
  producto, transacciones atómicas, reapertura formal.

### Movimientos de inventario

- Colección canónica `laTaberna_Movimientos` (11 columnas, 4 índices,
  Row Security activo).
- Slice `movimientos` en Store con 3 acciones:
  `MOVIMIENTOS_INICIALIZAR`, `MOVIMIENTO_REGISTRADO`,
  `MOVIMIENTOS_LIMPIAR`.
- Evento `movimientos:actualizados` tras cada registro.
- `ajustarStock` corregido: registra delta efectivo, persiste
  en Appwrite antes de tocar memoria, emite eventos.
- Hallazgo 5.2 corregido: `consumirInsumosDeProducto` despacha
  `INSUMO_GUARDADO` al Store tras cada decremento.
- Retención: 30 días online, resto archivado.

---

## Colecciones de la base EkyzD

**Base de datos:** `EkyzD` (ID: `6a0275cb0022ebf7d30d`).
Documento canónico: `docs/COLECCIONES.md` v4.9.0.

### Tablas de negocio (16)

    laTaberna_Productos
    laTaberna_Pedidos
    laTaberna_Mesas
    laTaberna_Comandas
    laTaberna_Insumos
    laTaberna_Recetas
    laTaberna_Staff
    laTaberna_Configuracion
    laTaberna_Eventos_en_vivo
    laTaberna_Cartas         (antes laTaberna_Menus)
    laTaberna_Proveedores
    laTaberna_Entradas
    laTaberna_Comensales
    laTaberna_Avisos
    laTaberna_Variantes
    laTaberna_Movimientos

### Tablas globales (4)

    global_Perfiles
    global_Puntos
    global_Eventos
    global_Espacios

### Tablas auxiliares (1)

    global_Limites (uso exclusivo de funciones serverless)

---

## Funciones serverless

| Nombre | Versión | URL |
|--------|---------|-----|
| `registrar-usuario` | 1.5.2 | `https://6a81573b000d2f0660d5.tor.appwrite.run` |
| `asignar-rol` | 1.9.1 | `https://6a6b3c8a003b634646cc.tor.appwrite.run` |

Ambas:

- Validan `Origin` y `X-Appwrite-Project`.
- Rate limiting persistente en `global_Limites`.
- `asignar-rol` exige JWT (`x-appwrite-user-jwt`), valida
  jerarquía de roles, y soporta acción `crear` para creación
  segura de filas de negocio.
- `asignar-rol` incluye rama restringida para `jugador` sin Team:
  solo puede crear precargas en `pedidos` con
  `origen: 'cliente'`, `estado: 'precarga'`, y `espacioId`
  correspondiente a un espacio `lataberna` activo.

---

## Cumplimiento de reglas de arquitectura

| Regla | Estado |
|-------|:------:|
| 1. Cero variables globales | ✅ |
| 2. Cero onclick en HTML | ✅ |
| 3. Importaciones explícitas | ✅ |
| 4. Exportaciones con nombre | ✅ |
| 5. Ciclo de vida activar/limpiar | ✅ |
| 6. AbortController para DOM | ✅ |
| 7. Código en español | ✅ |
| 8. CSS encapsulado por vista | ✅ |
| 9. Manejo de errores centralizado | ✅ |
| 10. Comunicación por contratos | ✅ |
| 11. UI lee del Store | ✅ |
| 12. Prohibido window.confirm/prompt | ✅ |
| 13. Contenedores estáticos | ✅ |
| 14. Fachada con submódulos | ✅ |
| 15. Cero overrides de configuración por localStorage | ✅ |
| 16. Dinero sin floats | ✅ |
| 17. Escritura segura en colecciones de negocio | ✅ |

---

## Deuda técnica vigente

1. **Reescritura pendiente de documentación histórica:**
   `INTEGRACION.md` reescrito a v3.0.0 en esta iteración.
   `ARQUITECTURA-MENU.md` reescrito como
   `ARQUITECTURA-CARTAS.md`.

2. **Saneamiento de repositorios (paquete agendado):**
   - `guardarProducto` no persiste `categoria`, `precio`,
     `descripcion` ni `imagen`.
   - `guardarProducto` marca `guardadoRemoto = true` sin
     verificar el retorno de `DBAppwrite.actualizar`.
   - `guardarVariante` no verifica el retorno de Appwrite.
   - `db-fusion.js` no verifica el retorno en `fusionarMesas` y
     `liberarMesasFusionadas`.

3. **Duplicaciones de código:**
   - `_validarId`, `_validarString`, `_validarNumero`,
     `_validarBooleano`, `_parsearArray` entre `db-core.js` y
     `db-inventario.js`.
   - `_normalizarIngredientes` entre `db-inventario.js` y
     `js/ui/despensa/renderer.js`.
   - `_parsearRoles` entre `db-appwrite.js` y
     `js/ui/perfil/admin-roles.js`.

4. **4 guías de Appwrite Console IV desactualizadas:**
   `auth`, `databases`, `functions`, `realtime`.

5. **`publicarMenu` emite `EventBus.emit('menus:actualizados')`
   sin listener conocido.** Código muerto probable.

6. **Contrato "repo despacha al Store" en variantes.** Migración
   a "vista despacha, repo solo persiste" pendiente en Paquete 5b.

7. **Nomenclatura snake/camel convive.** Unificación pendiente
   como fase transversal.

8. **Agregado `Receta` como objeto de dominio.** Propuesta
   diferida a Fase 2.

9. **Reportes B3 por opción.** Desglose de ventas por variante
   pendiente para Fase 3.

10. **Rol `artista`.** Definición formal en UI de asignación
    pendiente con B4.

---

## Próximos pasos

1. Cierre de la Fase D del paquete movimientos (ajustes de
   renderer y ciclo-vida en Despensa).
2. Paquete de saneamiento de repositorios.
3. Reescritura de documentación histórica.
4. Prueba integral general entre células.
5. Reforma del flujo de dinero con Célula B3.
6. Evaluación de servidor local para operación offline.

---

## Documentos de referencia vigentes

| Documento | Versión | Responsable |
|-----------|---------|-------------|
| `docs/COLECCIONES.md` | 4.9.0 | Célula A |
| `docs/EstadoAppwrite.md` | 2.9.0 | Célula A |
| `docs/EVENTOS.md` | 1.8.0 | Célula A |
| `docs/FUNCIONES-SERVERLESS.md` | 1.3.0 | Célula A |
| `docs/GUIA-APPWRITE-CONSOLE-IV.md` | 1.3.2 | Célula A |
| `docs/API-GUIA.md` | 6.2.0 | Coordinación |
| `docs/PROPIEDAD.md` | 1.4.1 | Coordinación |
| `docs/ARQUITECTURA-VARIANTES.md` | 1.3.0 | Coordinación |
| `docs/ARQUITECTURA-CARTAS.md` | 1.0.0 | Coordinación |
| `docs/INTEGRACION.md` | 3.0.0 | Coordinación |
| `docs/ESTADO.md` | 3.0.0 | Coordinación |
| `docs/REGLA-CONTROL-REGRESIONES.md` | 1.0.0 | Coordinación |

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 3.0.0 — 9 de octubre de 2026*