┌──────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración        │
│ FECHA:     2026-07-02 00:00 UTC              │
│ TIPO:      DOCUMENTO OFICIAL                 │
│ REFERENCIA: Tablero de Integración v2.0      │
└──────────────────────────────────────────────┘

# 📋 Tablero de Integración – La Taberna (v2.0)

**Última actualización:** 2026-07-02

---

## 🟢 Célula A — Core Backend

- **Estado:** Operativa
- **Responsable:** Equipo Core
- **Archivos propios:** 25 (dominio, DB, comandos, repositorios, auth, roles)
- **Último hito completado:** Parche D7 (comando `marcar-agotado.js`), D1 (ciclo de managers roto), P3 (imports de dominio), P4 (código muerto eliminado), unificación de timestamps, fallback `cantidad || qty` en pedido.js v1.1.5
- **Próximo hito:** Migrar renderizado de vistas a `activar()` (a futuro)
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Acuse de recibo del Mapa de Propiedad v1.0.0

---

## 🟢 Célula B1 — Mesero

- **Estado:** Operativa
- **Responsable:** Equipo Mesero
- **Archivos propios:** 17 (mesas, pedido-ui, comanda, carta, mesa-detalles, cuenta, precarga-control, guia-mesero, CSS)
- **Último hito completado:** Desacoplamientos D2, D3, D6 completados. Corrección de cobro.js a v2.0.2. Consulta técnica sobre Store respondida. Unificación de `obtenerColorDesdeNombre` en menu.js v1.0.3
- **Próximo hito:** Prueba integral del flujo completo con `test-E-flujo-completo.html`
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Reporte de implementación de D2, D3, D6

---

## 🟢 Célula B2 — Cocina y Barra

- **Estado:** Operativa
- **Responsable:** Equipo Cocina y Barra
- **Archivos propios:** 5 (kds.js, recetas.js, css/kds.css, tests)
- **Último hito completado:** Integración de kds.js v2.0.2 (botón de pánico con CommandBus). Unificación de `obtenerColorDesdeNombre` en recetas.js v2.0.3
- **Próximo hito:** Actualizar test-B-kds.html para mockear CommandBus
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Confirmación de integración de kds.js v2.0.2

---

## 🟢 Célula B3 — Caja

- **Estado:** Operativa
- **Responsable:** Equipo Caja
- **Archivos propios:** 10 (cobro, caja, tickets, managers, pedido-service, CSS)
- **Último hito completado:** Corrección de cobro.js (desacoplado de Comanda). Eliminación del stub `agregarItemAPedido` en pedido-manager.js v1.0.4. Propiedad de managers formalizada
- **Próximo hito:** Verificación de tests con nuevas versiones del Store
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Decisión sobre stub y reporte de discrepancia de versiones

---

## 🟢 Célula B4 — Animador

- **Estado:** Operativa
- **Responsable:** Equipo Animador
- **Archivos propios:** 2 (eventos-en-vivo.js, css/eventos-en-vivo.css)
- **Último hito completado:** eventos-en-vivo.js v1.2.0 (historial de bolas en bingo). Propiedad transferida desde Célula D
- **Próximo hito:** —
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Declaración de propiedad

---

## 🟢 Célula C — Frontend Cliente

- **Estado:** Operativa
- **Responsable:** Equipo Frontend Cliente
- **Archivos propios:** 12 (principal, pantallas, menú digital, orden, CSS)
- **Último hito completado:** Desacoplamiento D4 (Store cliente). Eliminación de `window.ClienteModulo` (P2). Export de `ClienteModulo` para tests. Unificación de `obtenerColorDesdeNombre` en menu-digital.js v1.1.6
- **Próximo hito:** —
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Mapa de propiedad y export para tests

---

## 🟢 Célula D — Administración

- **Estado:** Operativa
- **Responsable:** Equipo Administración
- **Archivos propios:** 18 (despensa, config, perfil, eventos, reparto, servicios, CSS)
- **Último hito completado:** Desacoplamiento D5 (config:actualizada). Transferencia de eventos-en-vivo.js a B4. Unificación de `obtenerColorDesdeNombre`
- **Próximo hito:** —
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Mapa de propiedad

---

## 🟢 Célula E — Infraestructura

- **Estado:** Operativa
- **Responsable:** Equipo Infraestructura
- **Archivos propios:** 14 (index.html, app.js, bootstrap.js, librerías, CSS globales)
- **Último hito completado:** Parche P1 (export de App). Restauración de reducers COMANDA_ITEM_* en Store v2.0.2. Análisis de doble renderizado (sin cambios inmediatos). Unificación de timestamps en Store
- **Próximo hito:** Validar IDs del DOM en index.html contra el reporte automático de fallas
- **Bloqueos:** Ninguno
- **Último reporte:** 2026-07-01 — Respuesta a consulta de Store y análisis de renderizado

---

## 📋 Contratos entre células (resumen)

| Contrato | Emisor | Consumidores | Estado |
|----------|--------|--------------|--------|
| `turno:solicitar_cierre` | B3 (PedidoManager) | B3 (TurnoManager) | Nuevo, implementado |
| `pago:confirmado` | B3 (Cobro) | B1 (Pedido) | Nuevo, implementado |
| `config:actualizada` | D (Config) | B1 (ciclo-vida) | Nuevo, implementado |
| `producto:agotado` | A (comando) | B2 (KDS), B1 (Carta, Menu) | Nuevo, implementado |
| `precarga:nueva` | B1 (PrecargaControl) | B1 (Mesas) | Nuevo, implementado |
| `precarga:items_listos` | B1 (PrecargaControl) | B1 (Comanda) | Nuevo, implementado |
| `precarga:cargar_en_comanda` | B1 (MesaDetalles) | B1 (PrecargaControl) | Nuevo, implementado |
| `mesa-detalle:abierto` | B1 (MesaDetalles) | B1 (Pedido) | Nuevo, implementado |
| `mesa-detalle:cerrado` | B1 (MesaDetalles) | B1 (Pedido) | Nuevo, implementado |
| `cliente:precarga_enviada` | C (MenuDigital) | B1 (PrecargaControl) | Vigente |
| `cliente:cuenta_creada` | A (Auth) | C (ClienteModulo) | Vigente |
| `eventos_en_vivo:actualizada` | Realtime (Appwrite) | B4, C | Automático y vigente |
| `Auth.registrarCliente` | A (Auth) | C (PantallaInicio) | Vigente |
| `App.showView('inicio')` | E (App) | C (PantallaInicio) | Vigente |
| `Store.dispatch(CLIENTE_*)` | C (PantallaBienvenida) | C (MenuDigital) | Vigente |
| `CommandBus 'producto:marcar_agotado'` | B2 (KDS) | A (DBAppwrite) | Vigente |
| `CommandBus 'precarga:revisar'` | B1 (PrecargaControl) | A (DBAppwrite) | Vigente |

---

## 📋 Reglas de oro (recordatorio)

1. Ningún módulo accede directamente a DB. Usar DBAppwrite, Store (lectura) y EventBus/CommandBus.
2. Eventos nuevos deben documentarse en docs/EVENTOS.md antes del PR.
3. No modificar db-appwrite.js sin coordinación con la Célula A y el Coordinador.
4. Los tests de core/ no deben romperse.
5. Prohibido el acoplamiento entre módulos de distintas células.
6. Toda comunicación técnica entre células pasa por el Coordinador.
7. Los PRs que modifiquen archivos de otra célula sin autorización serán rechazados.
8. Cada archivo tiene una única célula dueña definida en docs/PROPIEDAD.md.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 2.0 — 2026-07-02*