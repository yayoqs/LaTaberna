Archivo 3: docs/EVENTOS.md (extracto de los nuevos eventos)

```markdown
## Nuevos eventos (Frontend Interno – Recepción de precargas)

### cliente:precarga_enviada
- **Emisor:** Célula C (Frontend Cliente)
- **Consumidor:** Frontend Interno (`PrecargaControl`)
- **Payload:**
  ```json
  {
    "id": "string (ID en precargas_cliente)",
    "mesa": 5,
    "items": [
      {
        "prodId": "prod_123",
        "nombre": "Hamburguesa",
        "precio": 1500,
        "categoria": "platos",
        "destino": "cocina",
        "qty": 2,
        "obs": "sin cebolla"
      }
    ],
    "clienteId": "nombre_usuario",
    "observaciones": "opcional",
    "timestamp": 1717000000000
  }
```

· Contrato: Los ítems usan prodId y qty para consistencia con Comanda.agregarItem. El campo id es el identificador de la precarga en Appwrite.

mesa:badge_click

· Emisor: Mesas.onPrecargaClick (cuando el garzón hace clic en la insignia)
· Consumidor: PrecargaControl
· Payload:
  ```json
  {
    "mesa": 5,
    "precargaId": "string (ID de la precarga)"
  }
  ```

precarga:revisada

· Emisor: PrecargaControl (después de ejecutar precarga:revisar)
· Consumidor: Célula C (opcional, para feedback al cliente)
· Payload:
  ```json
  {
    "precargaId": "string",
    "revisadoPor": "nombre_garzon",
    "timestamp": 1717000000000
  }
  ```

Nuevo comando

precarga:revisar

· Control registrado por: PrecargaControl
· Payload:
  ```json
  {
    "precargaId": "string",
    "revisadoPor": "nombre_garzon"
  }
  ```
· Acción: Actualiza precargas_cliente/{id} con { estado: 'revisado', revisadoPor }.

```

---

### ✅ Validación previa al PR

- Ejecuté mentalmente el flujo y no hay interferencia con los comandos existentes.
- No se modifican `comanda.js` ni `pedido-ui.js`.
- Los tests de core (`tests/core/test-integracion.html`) no deberían verse afectados porque solo agrego listeners y un comando nuevo.
- El nuevo módulo sigue la convención ES6 con `window.PrecargaControl`.
- Los identificadores están en español.
- El CSS del badge (`.precarga-badge`) quedará pendiente para que lo ajustes tú o podemos incluirlo en `css/mesas.css` como una clase simple; avísame si prefieres que lo agregue en este PR.