# ⚡ Funciones Serverless de La Taberna

**Versión:** 1.0.0
**Fecha:** 16 de agosto de 2026
**Propósito:** Documentar las funciones desplegadas en Appwrite y sus contratos.

---

## 1. `registrar-usuario`

**URL:** `https://6a81573b000d2f0660d5.tor.appwrite.run`

**Propósito:** Registro seguro de cuentas del ecosistema. Crea el usuario en Appwrite Auth, el perfil global y asigna el label `cliente`.

### Entrada

    {
      "nombreUsuario": "string",
      "password": "string"
    }

### Salida exitosa

    {
      "exito": true,
      "usuarioId": "string"
    }

### Salidas de error

    {
      "exito": false,
      "error": "string"
    }

### Validaciones

- `nombreUsuario`: entre 3 y 30 caracteres, solo letras, números, punto, guion y guion bajo. No puede comenzar con símbolo.
- `password`: entre 8 y 128 caracteres.
- Rate limiting: 5 registros por minuto por IP.

### Scopes de la API key

- `users.write`
- `rows.read`
- `rows.write`

---

## 2. `asignar-rol`

**URL:** `https://6a6b3c8a003b634646cc.tor.appwrite.run`

**Propósito:** Sincronizar los labels de Appwrite Auth para un usuario según `usuarioId`, `espacioId` y `roles`.

### Entrada

    {
      "userId": "string",
      "espacioId": "string",
      "roles": ["string"]
    }

### Salida exitosa

    {
      "success": true
    }

### Salidas de error

    {
      "success": false,
      "error": "string"
    }

### Scopes de la API key

- `users.write`

---

*Documento mantenido por la Célula A (Core).*