# Estado General del Sistema — La Taberna

**Fecha:** 2026-08-25
**Estado:** Estable, alineado al modelo multi-espacio y al esquema de roles jerárquico.

---

## Resumen ejecutivo

La Taberna cerró la fase de estabilización integral posterior a la
migración de colecciones y al nuevo modelo de autenticación. Todas
las células reportaron sus frentes cerrados y sus pruebas
automatizadas pasando.

El sistema quedó operativo para avanzar hacia la prueba integral
general y, posteriormente, hacia la reforma del flujo de dinero en
Caja.

---

## Estado por célula

| Célula | Estado | Responsabilidad | Observaciones |
|--------|:------:|-----------------|---------------|
| A — Core | ✅ Estable | Auth, DB, colecciones, comandos, repositorios, dominio, roles | `COLECCIONES.md` vigente. API de Auth sin credenciales locales. |
| B1 — Mesero | ✅ Estable | Mesas, pedido, comanda, avisos, bandeja, fusión | OT-5 cerrada. Avisos persistentes integrados. |
| B2 — Cocina y Barra | ✅ Estable | KDS, recetas | KDS adaptado a roles múltiples. Filtro Cocina/Barra/Todas operativo. |
| B3 — Caja | ✅ Estable | Cobro, caja, tickets, turnos | Sin deuda crítica. Próxima etapa: flujo de dinero. |
| B4 — Animador | ✅ Operativa | Eventos en vivo | Rol artista pendiente de definición formal en asignación. |
| C — Cliente | ✅ Estable | Registro, login, menú digital, avisos, precargas | Avisos persistentes implementados. Precargas unificadas en Pedidos. |
| D — Administración | ✅ Estable | Personal, despensa, reparto, menú, perfil, configuración | UI alineada a roles jerárquicos. Contraseña temporal visible. |
| E — Infraestructura | ✅ Estable | app.js, bootstrap, Store, EventBus, CommandBus, CSS base | Store migrado a insumos. app.js basado en permisos. |

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
| 12. Prohibido window.confirm y window.prompt | ✅ |
| 13. Contenedores estáticos | ✅ |
| 14. Patrón de fachada | ✅ |

---

## Modelo de datos

- Base de datos: `EkyzD`.
- Documento canónico: `docs/COLECCIONES.md v3.4.1`.
- Colecciones activas: 18.

Principales colecciones:

- `laTaberna_Productos`
- `laTaberna_Pedidos`
- `laTaberna_Mesas`
- `laTaberna_Comandas`
- `laTaberna_Insumos`
- `laTaberna_Recetas`
- `laTaberna_Staff`
- `laTaberna_Configuracion`
- `laTaberna_Eventos_en_vivo`
- `laTaberna_Menus`
- `laTaberna_Proveedores`
- `laTaberna_Entradas`
- `laTaberna_Comensales`
- `laTaberna_Avisos`
- `global_Perfiles`
- `global_Puntos`
- `global_Eventos`
- `global_Espacios`

Colecciones obsoletas eliminadas:

- `laTaberna_Pedidos_delivery`
- `laTaberna_Precargas_cliente`

---

## Autenticación y roles

- Autenticación exclusivamente online mediante Appwrite Account.
- Sin credenciales hardcodeadas ni contraseñas en frontend.
- Registro mediante función serverless `registrar-usuario`.
- Roles jerárquicos:

  `master`, `admin`, `gerente`, `chef`, `cocinaAyudante`,
  `barman`, `barraAyudante`, `mesero`, `caja`, `repartidor`,
  `artista`, `cliente`.

- Roles múltiples por usuario.
- `rolPrincipal` define la vista inicial.
- Labels de Appwrite son la fuente de permisos.

---

## Persistencia y tiempo real

- Escrituras mediante `DBAppwrite`.
- Realtime activo para todas las colecciones.
- Los avisos de cliente se persisten en `laTaberna_Avisos`.
- Las precargas se persisten en `laTaberna_Pedidos`.
- La configuración se guarda filtrada por `espacioId`.

---

## Deuda técnica vigente

1. Aliases temporales en Store para compatibilidad con acciones
   antiguas de insumos/ingredientes.
2. Parámetro `forzarError` en `db-appwrite.js` sin uso documentado.
3. Posible consolidación final de lógica de administración de roles
   si vuelve a duplicarse.
4. Rol `artista` pendiente de definición formal en UI de asignación.
5. Sin servidor local para operación offline. Se evaluará como
   proyecto de infraestructura futuro.

---

## Próximos pasos

1. Validación visual y funcional con roles reales.
2. Prueba integral general entre células.
3. Inicio de reforma del flujo de dinero con Célula B3.
4. Evaluación de servidor local para continuidad operativa.