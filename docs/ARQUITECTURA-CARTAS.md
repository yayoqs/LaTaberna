# ARQUITECTURA-CARTAS.md — Jerarquía de Recetas y Diseñador de Cartas

**Versión:** 1.0.0
**Fecha:** 9 de octubre de 2026
**Propósito:** Especificación de la jerarquía de recetas y del
diseñador de cartas. Reemplaza al documento histórico
`ARQUITECTURA-MENU.md`, adaptado a la nomenclatura actual
(cartas, no menús) y al sistema de variantes.

---

## 1. Jerarquía de recetas

El sistema refleja el flujo real de un restaurante:

    1. Despensa
       Ingredientes comprados a proveedores (materia prima).
    2. Cocina/Barra (Recetario)
       Transforma la materia prima en preparaciones y productos
       finales.
    3. Administración (Carta)
       Selecciona qué productos finales se ofrecen hoy, pudiendo
       armar cartas temáticas o promocionales.
    4. Mesero / Cliente
       Consultan la carta activa para tomar pedidos.

---

## 2. Niveles de receta

Cada receta tiene un atributo `nivel`:

| Nivel | Nombre | Ejemplo | Vendible | Consume stock | Genera stock |
|-------|--------|---------|:--------:|:-------------:|:------------:|
| `insumo` | Insumo de cocina | Cebolla en pluma | No | Sí | Sí |
| `preparacion` | Preparación | Salsa caramelizada | No | Sí | Sí |
| `producto_final` | Producto final | Sándwich de la casa | **Sí** | Sí | No |

**Insumo y preparación** son recetas internas de cocina. Al
ejecutarlas descuentan ingredientes de Despensa (o de otras
preparaciones) y generan un nuevo ítem de stock en el recetario.

**Producto final** es lo que ve el cliente. Se crea en el
recetario pero solo está disponible para la venta si se incluye
en una carta activa.

---

## 3. Colección `laTaberna_Cartas`

Antes llamada `laTaberna_Menus`. Renombrada el 2026-09-16.

Estructura:

    {
      id: 'carta_dia',
      nombre: 'Carta del Día',
      estado: 'publicado',   // borrador | publicado
      productos: [...],      // JSON con la disposición visual
      fondo: '#1a1a2e',
      tipografia: 'Inter, sans-serif',
      grilla: false,
      creadoPor: 'admin',
      espacioId: 'PubPrueba'
    }

Solo una carta puede estar `publicado` a la vez por espacio.

---

## 4. Módulo `carta-editor`

Ruta: `js/ui/carta-editor/`.

Dueño: Célula D (Administración).

Estructura con patrón de fachada:

    js/ui/carta-editor.js (fachada)
    js/ui/carta-editor/acciones.js
    js/ui/carta-editor/barra-lateral.js
    js/ui/carta-editor/biblioteca.js
    js/ui/carta-editor/ciclo-vida.js
    js/ui/carta-editor/estado.js
    js/ui/carta-editor/modal-propiedades.js
    js/ui/carta-editor/renderer.js
    js/ui/carta-editor/variantes/...
    js/ui/carta-editor/asignacion/...

### 4.1 Modo Lienzo

Posicionamiento visual de fichas flotantes en un canvas. Cada
ficha es un producto del recetario, un título de sección, una
descripción o una imagen decorativa.

### 4.2 Modo Variantes

Tabla de asignación producto × variantes. Se accede con el
switch prominente en el header del editor.

Documentado en `docs/ARQUITECTURA-VARIANTES.md`.

### 4.3 Persistencia

Toda escritura pasa por `js/repositorios/receta-repository.js`
(en Célula A).

### 4.4 Ciclo de vida

El módulo expone `activar()` y `limpiar()`. Los listeners se
vinculan al AbortController del ciclo de vida.

---

## 5. Módulo `variantes/`

Ruta: `js/ui/carta-editor/variantes/`.

Dueño: Célula D.

Submódulos:

    js/ui/carta-editor/variantes/estado.js
    js/ui/carta-editor/variantes/validaciones.js
    js/ui/carta-editor/variantes/renderer.js
    js/ui/carta-editor/variantes/ciclo-vida.js

Funcionalidad: editor de catálogo maestro de variantes.
Documentado en `docs/ARQUITECTURA-VARIANTES.md`.

---

## 6. Módulo `asignacion/`

Ruta: `js/ui/carta-editor/asignacion/`.

Dueño: Célula D.

Submódulos:

    js/ui/carta-editor/asignacion/estado.js
    js/ui/carta-editor/asignacion/validaciones.js
    js/ui/carta-editor/asignacion/renderer.js
    js/ui/carta-editor/asignacion/ciclo-vida.js

Funcionalidad: asignación de variantes a productos del catálogo.
Opera en Modo Variantes del editor.

---

## 7. Relación con el sistema de variantes

El diseñador de cartas es el punto de autoría de:

- Cartas publicables (Modo Lienzo).
- Asignación de variantes a productos (Modo Variantes).
- Editor de catálogo maestro de variantes.

El consumo ocurre en:

- Carta del mesero (`js/ui/carta.js`, Célula B1).
- Menú digital del cliente (`js/modulos/cliente/menu-digital.js`,
  Célula C).

---

## 8. Referencias

- `docs/ARQUITECTURA-VARIANTES.md` — sistema de variantes.
- `docs/COLECCIONES.md` — estructura de la base de datos.
- `docs/PROPIEDAD.md` — mapa de propiedad de archivos.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 1.0.0 — 9 de octubre de 2026*