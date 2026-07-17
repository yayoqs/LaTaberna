┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-07-08 02:00 UTC                        │
│ TIPO:      DOCUMENTO DE ARQUITECTURA                    │
│ REFERENCIA: Nuevo módulo de Menú y jerarquía de Recetas │
└──────────────────────────────────────────────────────────┘

# 🍽️ Arquitectura del Módulo de Menú y Jerarquía de Recetas

## 1. Visión General

El sistema reflejará el flujo real de un restaurante:

1.  **Despensa**: Ingredientes comprados a proveedores (materia prima).
2.  **Cocina/Barra (Recetas)**: Transforma la materia prima en preparaciones y productos finales.
3.  **Administración (Menú)**: Selecciona qué productos finales se ofrecen hoy, pudiendo armar menús temáticos o promocionales.
4.  **Mesero / Cliente**: Consultan el menú activo para tomar pedidos.

---

## 2. Jerarquía de Recetas (Tres Niveles)

Cada receta tendrá un nuevo atributo `nivel`:

| Nivel | Nombre | Ejemplo | ¿Se vende? | ¿Consume stock? | ¿Genera stock? |
|:------|:-------|:--------|:----------:|:---------------:|:--------------:|
| `insumo` | Insumo de Cocina | Cebolla en Pluma | No | Sí (Despensa) | **Sí** |
| `preparacion` | Preparación | Salsa Caramelizada | No | Sí (Despensa + Cocina) | **Sí** |
| `producto_final` | Producto Final | Sándwich de la Casa | **Sí** | Sí | No |

-   **Insumo y Preparación**: Son recetas internas de cocina. Al ejecutarlas, descuentan ingredientes de Despensa (o de otras preparaciones) y generan un nuevo ítem de stock en el recetario.
-   **Producto Final**: Es lo que ve el cliente. Se crea en Recetas pero solo está disponible para la venta si se incluye en un **Menú** activo.

---

## 3. El Módulo de Menú (Nuevo)

### 3.1 Propósito
Permitir a Administración seleccionar un conjunto de `productos_finales` del recetario para crear menús reutilizables (menú del día, menú de fin de semana, menú de San Valentín, etc.). Solo uno estará **activo** a la vez.

### 3.2 Propiedad
-   **Dueño**: Célula D (Administración)
-   **Archivos**: `js/ui/menu/` (nueva carpeta, siguiendo el patrón de fachada con submódulos)

### 3.3 Estructura de Datos
Se creará una nueva colección `menus` en Appwrite y en el Store:

```javascript
// Colección 'menus'
{
  id: 'menu_dia',
  nombre: 'Carta del Día',
  activo: true,
  productos: ['prod_1', 'prod_2', 'prod_3'],
  creadoPor: 'admin',
  creadoEn: '2026-07-08T...',
  actualizadoEn: '2026-07-08T...'
}