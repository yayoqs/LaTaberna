# Protocolo de Comunicación entre Células – La Taberna

---

## Propósito

Estandarizar los mensajes que cada Célula envía al Coordinador de Integración.  
Toda comunicación con otras células pasa exclusivamente por el Coordinador. No se permite el contacto directo entre células para decisiones técnicas.

---

## Formato de Mensaje

Cada comunicado debe respetar este encabezado y estructura.

---

┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Célula [A/B/C/D] — [Nombre del equipo]        │
│ FECHA:     [AAAA-MM-DD HH:MM UTC]                        │
│ TIPO:      [REPORTE / SOLICITUD / BLOQUEO / CONSULTA]    │
│ REFERENCIA: ID o nombre de la tarea (ej: Tarea 1, 3.2)   │
└──────────────────────────────────────────────────────────┘

---

### 1. RESUMEN

Una frase que resuma el comunicado.

### 2. DETALLE

Explicación clara de lo que hicimos, necesitamos o consultamos.
Si se trata de cambios en archivos, se listan con ruta exacta.

### 3. ARCHIVOS (solo para REPORTE o SOLICITUD)

a) Modificados y entregados:
   · js/core/auth.js
   · docs/EVENTOS.md

b) Solicitados (si aplica):
   · js/app.js (necesitamos versión actual para revisar X)

### 4. IMPACTO EN OTRAS CÉLULAS

   · Célula C: ahora puede usar Auth.registrarCliente(...).
   · Célula D: debe dejar de emitir evento:creado/actualizado.
   · Ninguna célula debe modificar db-appwrite.js sin autorización.

### 5. ACCIÓN REQUERIDA DEL COORDINADOR

   · Dar luz verde a Células C y D.
   · Revisar PR de Célula D si incluye eventos obsoletos.
   · [Opcional] Enviar archivo X a Célula B.

### 6. PRÓXIMOS PASOS (desde nuestra perspectiva)

   · Ejecutaremos test de flujo real con Appwrite.
   · Quedamos a la espera de nuevas tareas o ajustes.

---

## Tipos de Comunicado

| Tipo | Cuándo se usa |
|------|---------------|
| REPORTE | Cuando una célula completa una tarea, entrega archivos y notifica impacto. |
| SOLICITUD | Cuando necesita archivos, permisos o que el Coordinador la conecte con otra célula. |
| BLOQUEO | Cuando detecta un PR o acción de otra célula que rompe los contratos o tests del núcleo. |
| CONSULTA | Dudas técnicas o de arquitectura que requieren decisión del Coordinador. |

---

## Reglas Fundamentales

1. No hay comunicación técnica directa entre células. Todo mensaje se envía al Coordinador, quien filtra y deriva.
2. Los PRs que modifiquen archivos de otra célula sin autorización serán rechazados automáticamente.
3. Cada comunicado debe ser autónomo y completo. No se asume contexto de mensajes anteriores.
4. Las solicitudes de nuevos atributos, eventos o métodos deben llegar a Core (Célula A) vía Coordinador.
5. Ante cualquier duda, se consulta al Coordinador antes de implementar.

---

## Ejemplo de REPORTE

---

┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Célula A — Core                               │
│ FECHA:     2026-06-17 01:30 UTC                          │
│ TIPO:      REPORTE                                       │
│ REFERENCIA: Tareas 1, 3.1, 3.2, 3.3                      │
└──────────────────────────────────────────────────────────┘

### 1. RESUMEN

Completadas las 4 tareas del brief. Core listo para desbloquear Células C y D.

### 2. DETALLE

   · 3.1: Agregadas precargas_cliente y eventos_en_vivo a COLECCIONES en db-appwrite.js.
   · 3.2: Eliminadas referencias a DB.sincronizarTodo() en app.js.
   · 3.3: Eliminados evento:creado y evento:actualizado del catálogo. Evento canónico: eventos_en_vivo:actualizada.
   · Tarea 1: Implementado Auth.registrarCliente(nombre, password). Emite cliente:cuenta_creada.
   · Tests de integración actualizados (17/17 pasan).

### 3. ARCHIVOS

a) Modificados y entregados:
   · js/core/db-appwrite.js
   · js/app.js
   · js/core/auth.js
   · docs/EVENTOS.md
   · tests/core/test-integracion.html

### 4. IMPACTO EN OTRAS CÉLULAS

   · Célula C: ya puede usar Auth.registrarCliente(nombre, password).
   · Célula D: debe suscribirse solo a eventos_en_vivo:actualizada.

### 5. ACCIÓN REQUERIDA DEL COORDINADOR

   · Notificar a Células C y D que pueden iniciar.
   · Vetar cualquier PR que reintroduzca evento:creado/actualizado.

### 6. PRÓXIMOS PASOS

   · Ejecutaremos test de flujo real con Appwrite para validar las nuevas colecciones.
   · Quedamos a la espera de nuevas tareas.

---

## Ejemplo de SOLICITUD

---

┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Célula A — Core                               │
│ FECHA:     2026-06-16 15:00 UTC                          │
│ TIPO:      SOLICITUD                                     │
│ REFERENCIA: Brief inicial                                │
└──────────────────────────────────────────────────────────┘

### 1. RESUMEN

Requerimos los archivos faltantes para completar las tareas inmediatas.

### 2. DETALLE

Para resolver 3.1 y 3.2 necesitamos:
   · js/core/db-appwrite.js
   · js/core/db.js
   · js/app.js
Solicitamos que el Coordinador nos los proporcione o gestione con la célula que los tenga.

### 3. ARCHIVOS

b) Solicitados:
   · js/core/db-appwrite.js
   · js/core/db.js
   · js/app.js

### 4. IMPACTO EN OTRAS CÉLULAS

   · Ninguno por ahora; estamos bloqueados hasta recibir los archivos.

### 5. ACCIÓN REQUERIDA DEL COORDINADOR

   · Enviar los archivos o pedirlos a quien corresponda.

### 6. PRÓXIMOS PASOS

   · Al recibirlos, completaremos las tareas y reportaremos.

---

## Mantenimiento de este documento

- Responsable: Coordinador de Integración.
- Última modificación: 2026-06-17.
- Versión: 1.0.