# Tablero de Integración – La Taberna

---

## 🟢 Célula A (Core Backend)

- Estado: Desarrollo activo
- Responsable: Equipo Core
- Último hito completado: Habilitar vista pública 'inicio' en app.js
- Próximo hito: --
- Bloqueos: Ninguno
- Último reporte: 2026-06-18 — Vista pública 'inicio' habilitada

---

## 🟢 Célula B (Frontend Interno)

- Estado: Desarrollo activo
- Responsable: Equipo Frontend Interno
- Último hito completado: Recepción de precargas (Tarea 4.1)
- Próximo hito: Mejora del KDS (Tarea 4.2)
- Bloqueos: Ninguno
- Último reporte: 2026-06-18 — PR de precarga-control.js aprobado y mergeado

---

## 🟢 Célula C (Frontend Cliente)

- Estado: En desarrollo
- Responsable: Equipo Frontend Cliente
- Último hito completado: PantallaInicio maquetada y lógica lista
- Próximo hito: Integrar PantallaInicio con vista pública 'inicio'
- Bloqueos: Ninguno (vista pública habilitada por Célula A)
- Último reporte: 2026-06-18 — Solicitud de vista pública tramitada y resuelta

---

## 🟢 Célula D (Administración)

- Estado: Desarrollo activo
- Responsable: Equipo Administración
- Último hito completado: Panel del animador para eventos en vivo (Tarea 4.1)
- Próximo hito: Mejora de vistas existentes (config.js, despensa.js, recetas.js, reparto.js, perfil.js)
- Bloqueos: Ninguno
- Último reporte: 2026-06-17 — PR de eventos-en-vivo.js aprobado y mergeado

---

## 🟢 Contratos entre células (resumen)

| Contrato | Emisor | Consumidor | Estado |
|----------|--------|------------|--------|
| `cliente:precarga_enviada` | Célula C | Célula B | Definido y vigente |
| `cliente:cuenta_creada` | Célula A (Core) | Célula C | Implementado |
| `eventos_en_vivo:actualizada` | Realtime (Core) | Células C y D | Automático y vigente |
| `Auth.registrarCliente` | Célula A | Célula C | Implementado |
| `App.showView('inicio')` | Célula A | Célula C | Habilitado como vista pública |
| `precarga:revisar` | Célula B | Célula B (comando interno) | Implementado |
| `mesa:badge_click` | Mesas (Célula B) | PrecargaControl (Célula B) | Implementado |
| `precarga:revisada` | Célula B | Célula C (opcional) | Documentado |

---

## 📋 Reglas de oro (recordatorio)

1. Ningún módulo accede directamente a DB. Usar DBAppwrite, Store (lectura) y EventBus/CommandBus.
2. Eventos nuevos deben documentarse en docs/EVENTOS.md antes del PR.
3. No modificar db-appwrite.js sin coordinación con la Célula A y el Coordinador.
4. Los tests de core/ no deben romperse.
5. Prohibido el acoplamiento entre módulos de distintas células.
6. Toda comunicación técnica entre células pasa por el Coordinador.
7. Los PRs que modifiquen archivos de otra célula sin autorización serán rechazados.

---

Última actualización: 2026-06-18