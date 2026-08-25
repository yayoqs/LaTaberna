# Fabric.js - Archivos de Estudio

Esta carpeta contiene archivos clave del repositorio de Fabric.js para aprendizaje.

## Estructura

- **1-Canvas.ts** - Clase Canvas principal (eventos, renderizado)
- **2-FabricObject.ts** - Clase base para todos los objetos/formas
- **3-index.ts** - Punto de entrada del core

## Orden de Lectura Recomendado

1. **3-index.ts** - Entender la estructura del proyecto
2. **2-FabricObject.ts** - Qué es un objeto en Fabric
3. **1-Canvas.ts** - Cómo funciona el event handling

## Para tu Proyecto

Te recomendaría enfocarte en:
- **Cómo se estructuran los objetos** (propiedades, métodos)
- **Event handling**: mouse, touch, drag & drop
- **Transformaciones**: rotate, scale, move
- **Rendering**: cómo se dibuja en canvas
- **Selection**: cómo se seleccionan objetos

## Conceptos Clave

### Canvas
El Canvas es el contenedor principal que maneja:
- Eventos de mouse/touch/pointer
- Selección de objetos
- Transformaciones (drag, rotate, scale)
- Renderizado

### FabricObject
Es la clase base para todos los objetos que se pueden dibujar:
- Rectangles
- Circles
- Paths
- Text
- Images
- Groups

### Event System
Fabric usa un sistema de eventos personalizado:
- Eventos de canvas: `mouse:down`, `mouse:move`, `mouse:up`
- Eventos de objeto: `selected`, `modified`, `moving`
- Eventos de drag: `dragstart`, `dragover`, `drop`