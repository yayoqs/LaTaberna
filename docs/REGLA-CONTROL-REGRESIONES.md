# REGLA-CONTROL-REGRESIONES.md — Control de Regresiones del Ecosistema

**Versión:** 1.0.0
**Fecha:** 21 de septiembre de 2026
**Propósito:** Definir el protocolo de control de regresiones aplicable a
todas las células del ecosistema Elisekai. Establece cómo se preserva
la funcionalidad al editar archivos, cómo se detectan pérdidas de
código y cómo se documenta cada entrega.
**Mantenedor:** Coordinador de Integración.

---

## 1. Origen

Durante la validación del reporte de Fase 1 de Célula A se detectó
una regresión no solicitada en `js/db.js`: al reescribir el archivo se
eliminó por error el bloque completo de idempotencia en `cerrarPedido`.
El código se había marcado como "redundante" durante una edición y se
removió sin autorización.

El Coordinador de Integración detectó la regresión por comparación con
la versión anterior. Sin esa revisión, el error habría llegado a
producción y habría permitido doble cierre de pedidos por doble clic.

Esta regla formaliza el protocolo para que el error no vuelva a
ocurrir y se aplica a toda entrega de código, sin excepción.

---

## 2. Reglas

### Regla 1 — Un hallazgo, un cambio acotado

Ninguna edición a un archivo debe tocar código que no esté
directamente relacionado con el hallazgo o tarea asignada.

Si al editar se detecta un bloque que parece redundante, obsoleto o
fuera de alcance, **se consulta antes de tocarlo**. Nunca se elimina
por iniciativa propia.

### Regla 2 — Diff obligatorio antes de entregar

Antes de enviar un archivo modificado, se compara explícitamente
contra la versión anterior (vN-1). Se verifica:

  · ¿Se eliminó alguna función pública?
  · ¿Se eliminó algún parámetro de alguna firma?
  · ¿Se eliminó alguna constante, mapa o cache compartido?
  · ¿Se eliminó alguna emisión de evento?
  · ¿Se eliminó alguna importación usada en otro archivo?
  · ¿Se eliminó algún caso de un switch o reducer?
  · ¿Se eliminó algún campo del schema o del contrato?

Si la respuesta a cualquiera es "sí", se justifica explícitamente en
el changelog del encabezado. Si no hay justificación, el cambio se
revierte antes de entregar.

### Regla 3 — Changelog detallado en el encabezado

Cada versión del archivo incluye una línea por cada cambio:

  · Añadido: X.
  · Modificado: Y.
  · Eliminado: Z (con justificación).

No basta con "mejoras varias" ni "correcciones menores". El changelog
debe permitir a un lector externo reconstruir qué cambió y por qué.

### Regla 4 — Test mínimo por hallazgo

Cada hallazgo resuelto debe tener al menos una prueba que lo valide.

Si el hallazgo no es trivialmente testeable o la célula aún no cuenta
con test unificado, se documenta explícitamente por qué y qué
verificación manual se realizó.

Esta regla se aplica con criterio: no todo cambio requiere un test
automatizado, pero todo cambio requiere una verificación explícita y
documentada.

### Regla 5 — Correr el test unificado antes de entregar

No basta con que el cambio funcione en aislamiento. El test unificado
de la célula debe pasar al 100%. Si el resultado baja, se investiga y
se corrige antes de reportar.

Si la célula aún no tiene test unificado, se abre tarea para crearlo.
Mientras no exista, se documenta la verificación manual realizada y se
anota como deuda técnica.

### Regla 6 — Registro de cambios por versión en docs

`EstadoAppwrite.md` y `FUNCIONES-SERVERLESS.md` incluyen la lista de
versiones entregadas. Cualquier retroceso se puede detectar comparando
versiones documentadas con versiones en el bundle.

El mapeo de versiones se genera periódicamente y se conserva para
auditoría histórica.

---

## 3. Aplicación

Toda célula aplica esta regla en cada entrega:

  · Los encabezados incluyen el changelog detallado con agregados,
    modificados y eliminados.
  · Los archivos entregados se comparan contra la versión previa antes
    de enviarse al Coordinador.
  · Los hallazgos se acompañan de la verificación que los valida.
  · Los tests unificados se corren antes de reportar.

El Coordinador de Integración valida cada entrega contra estas reglas.
Una entrega que no las cumple se devuelve con observaciones antes de
avanzar.

---

## 4. Lecciones aprendidas específicas

Estas lecciones provienen de regresiones y bugs silenciosos detectados
durante iteraciones reales del ecosistema. Se incorporan como casos
concretos que ilustran cómo aplicar las reglas.

### 4.1 Imports dinámicos: el nombre debe coincidir con el export real

Cuando se usa `import()` dinámico, un nombre desalineado no explota:
queda `undefined` hasta que se invoca. Bug silencioso.

  Ejemplo real: `varianteRepo` vs `crearVarianteRepo`. El import
  parecía correcto, la aplicación arrancaba, pero al invocar el
  método el error recién aparecía.

  Verificación: al agregar un import dinámico, escribir un test que
  invoque el módulo importado inmediatamente tras el `import()`.

### 4.2 Los módulos ES no permiten `return` top-level

Si el arranque de un módulo puede abortar en varios puntos, envolver
todo en `async function main()` e invocar al final.

  Ejemplo real: un módulo que hacía `if (!condicion) return;` en el
  scope global fallaba con error de sintaxis estricta en módulos ES.
  El error solo aparece al cargar el archivo, no al construir.

  Verificación: al escribir módulos nuevos, envolver la lógica de
  arranque en una función y llamar explícitamente.

### 4.3 Los campos que un handler valida deben venir del consumidor

Si un handler exige un campo (`destino`, `categoria`, etc.), el
consumidor que lo alimenta debe propagarlo. La ausencia no explota en
el consumidor: explota en el handler, con un error que el usuario ve
recién al ejecutar la operación.

  Ejemplo real: el modal de opciones no copiaba `categoria` ni
  `destino` del producto al item. El handler `enviarComanda` los
  exigía y abortaba. El mesero no veía el error hasta intentar enviar.

  Verificación: por cada campo que un handler valide, agregar una
  prueba con el payload mínimo requerido desde el consumidor real.

### 4.4 Los tests temporales con watchdog pagan su peso en oro

Los tests específicos que se escriben para diagnosticar una misión
detectan bugs que el test unificado no puede ver (porque el unificado
prueba caminos ya conocidos).

  Ejemplo real: el test temporal del Paquete 4 de B1 detectó tres bugs
  que el unificado v15 no podía ver: import dinámico desalineado,
  campos faltantes en el item, y contaminación de test entre corridas.

  Verificación: cuando se aborde un paquete con cambios estructurales,
  escribir un test temporal específico. Usarlo durante el desarrollo.
  Al cerrar el paquete, evaluar si absorber sus aserciones al
  unificado y eliminar el temporal.

### 4.5 Los logs de éxito solo se emiten tras verificar el retorno real

Un logueo de éxito que ocurre antes de verificar la respuesta de una
operación es una mentira silenciosa. La operación puede haber fallado
y el log dice que salió bien.

  Ejemplo real: `fusionarMesas` logueaba "persistida en Appwrite"
  antes de verificar el retorno de `DBAppwrite.crear`. Si `crear`
  devolvía `null` (rowId ocupado, error de red, permisos), el log
  mentía.

  Ejemplo real 2: `guardarMenu` mostraba toast de éxito y actualizaba
  el Store aunque el write en Appwrite hubiera fallado por tipo
  inválido (`row_invalid_structure`).

  Verificación: por cada operación de escritura, verificar el retorno
  y loguear en consecuencia. Si el retorno indica fallo, no loguear
  éxito.

### 4.6 La autoactivación en scope de módulo oculta efectos colaterales

Un módulo que llama a `activar()` en el scope del archivo (al
importarse) hace que cualquier consumidor active efectos que quizás
no quiere. Viola la regla de ciclo de vida explícito.

  Verificación: todos los módulos con estado deben exponer
  `activar()` y `limpiar()` sin side effects en scope. La activación
  debe ser explícita desde quien consume el módulo.

### 4.7 Los campos opcionales no reciben default en la inserción

Appwrite aplica defaults declarativos a filas existentes cuando se
agrega la columna, no a inserciones nuevas. Un campo opcional sin
especificar queda `null`, no el default.

  Verificación: la capa que crea la fila debe enviar explícitamente
  los valores que necesita. La normalización al leer convierte `null`
  al default funcional del dominio.

### 4.8 Los tests que contaminan entre corridas producen falsos negativos

Un test que deja residuos entre corridas puede fallar en la siguiente
porque el estado inicial no es el esperado.

  Verificación: cada test usa un sufijo único por corrida
  (`Date.now() + random`), limpia sus propios residuos al final, y
  limpia residuos previos al arrancar (por si la corrida anterior
  falló).

---

## 5. Registro de eventos de regresión detectados

| Fecha       | Archivo | Tipo | Detectado por | Estado |
|-------------|---------|------|----------------|--------|
| 2026-09-12  | js/db.js | Pérdida de bloque de idempotencia | Coordinador | Cerrado |
| 2026-09-17  | js/ui/carta-editor/ciclo-vida.js | Pérdida de archivo tras rename | Célula D | Cerrado |
| 2026-09-19  | js/ui/pedido/modal-opciones.js | Campos faltantes en el item | Célula B1 | Cerrado |

Se actualiza con cada nueva regresión detectada y resuelta.

---

## 6. Mantenimiento

- Responsable: Coordinador de Integración.
- Última modificación: 2026-09-21.
- Versión: 1.0.0.

Este documento se anexa al manifiesto de reglas del ecosistema cuando
sea publicado. Hasta entonces, es de aplicación obligatoria para todas
las células.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 1.0.0 — 21 de septiembre de 2026*