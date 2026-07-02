┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                    │
│ FECHA:     2026-07-02 00:15 UTC                          │
│ TIPO:      DOCUMENTO OFICIAL                             │
│ REFERENCIA: Registro de versiones del sistema            │
└──────────────────────────────────────────────────────────┘

# 📋 Registro de Versiones – La Taberna

**Fecha de generación:** 2026-07-02

---

## Documentación

| Archivo | Versión | Última actualización |
|---------|:-------:|----------------------|
| docs/EVENTOS.md | 3.0 | 2026-07-01 |
| docs/INTEGRACION.md | 2.0 | 2026-07-02 |
| docs/API-GUIA.md | 3.0 | 2026-07-02 |
| docs/PROPIEDAD.md | 1.0.0 | 2026-07-01 |

---

## Raíz

| Archivo | Versión | Última actualización |
|---------|:-------:|----------------------|
| index.html | — | 2026-06-30 |

---

## js/ — Núcleo y librerías

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/app.js | 1.2.3 | 2026-07-01 | E |
| js/auth.js | 1.0.9 | 2026-07-01 | A |
| js/bootstrap.js | 1.0.5 | 2026-07-01 | E |
| js/db-appwrite.js | 1.0.5 | 2026-07-01 | A |
| js/db-core.js | 1.0.6 | 2026-07-01 | A |
| js/db-fusion.js | 1.0.5 | 2026-07-01 | A |
| js/db-inventario.js | 1.0.4 | 2026-07-01 | A |
| js/db-shim.js | 1.0.3 | 2026-07-01 | A |
| js/db.js | 1.0.9 | 2026-07-01 | A |
| js/roles.js | 1.0.2 | 2026-07-01 | A |
| js/utils.js | 1.1.0 | 2026-07-01 | Compartido |
| js/lib/store.js | 2.0.2 | 2026-07-01 | E |
| js/lib/eventBus.js | 1.2.0 | 2026-07-01 | E |
| js/lib/command-bus.js | 1.1.2 | 2026-07-01 | E |
| js/lib/deps.js | 1.1.2 | 2026-07-01 | E |
| js/lib/logger.js | 1.0.2 | 2026-07-01 | E |

---

## js/comandos/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/comandos/agregar-mesa.js | 1.0.3 | 2026-07-01 | A |
| js/comandos/completar-subcomanda.js | 1.0.3 | 2026-07-01 | A |
| js/comandos/crear-pedido-mesa.js | 1.0.2 | 2026-07-01 | A |
| js/comandos/enviar-comanda.js | 1.0.2 | 2026-07-01 | A |
| js/comandos/liberar-mesa.js | 1.0.2 | 2026-07-01 | A |
| js/comandos/marcar-agotado.js | 1.0.0 | 2026-07-01 | A |

---

## js/dominio/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/dominio/cantidad.js | 1.1.2 | 2026-07-01 | A |
| js/dominio/delivery.js | 1.1.3 | 2026-07-01 | A |
| js/dominio/dinero.js | 1.1.3 | 2026-07-01 | A |
| js/dominio/direccion.js | 1.1.2 | 2026-07-01 | A |
| js/dominio/ingrediente.js | 1.1.2 | 2026-07-01 | A |
| js/dominio/pedido.js | 1.1.5 | 2026-07-01 | A |
| js/dominio/resultado.js | 1.1.2 | 2026-07-01 | A |

---

## js/managers/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/managers/pedido-manager.js | 1.0.3 | 2026-07-01 | B3 |
| js/managers/turno-manager.js | 1.0.4 | 2026-07-01 | B3 |

---

## js/repositorios/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/repositorios/pedido-repository.js | 1.0.7 | 2026-07-01 | A |

---

## js/servicios/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/servicios/delivery-service.js | 1.0.1 | 2026-07-01 | D |
| js/servicios/inventario-service.js | 1.0.1 | 2026-07-01 | D |
| js/servicios/pedido-service.js | 1.0.4 | 2026-07-01 | B3 |

---

## js/ui/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/ui/caja.js | 1.1.0 | 2026-07-01 | B3 |
| js/ui/carta.js | 2.0.3 | 2026-07-01 | B1 |
| js/ui/cobro.js | 2.0.2 | 2026-07-01 | B3 |
| js/ui/comanda.js | 2.0.2 | 2026-07-01 | B1 |
| js/ui/config.js | 1.0.5 | 2026-07-01 | D |
| js/ui/cuenta.js | 1.0.1 | 2026-07-01 | B1 |
| js/ui/despensa.js | 1.0.2 | 2026-07-01 | D |
| js/ui/eventos.js | 1.0.2 | 2026-07-01 | D |
| js/ui/kds.js | 2.0.2 | 2026-07-01 | B2 |
| js/ui/menu.js | 1.0.3 | 2026-07-01 | B1 |
| js/ui/mesa-detalles.js | 2.0.6 | 2026-07-01 | B1 |
| js/ui/mesas.js | 2.1.0 | 2026-07-01 | B1 |
| js/ui/pedido-ui.js | 2.0.3 | 2026-07-01 | B1 |
| js/ui/perfil.js | 1.0.2 | 2026-07-01 | D |
| js/ui/recetas.js | 2.0.3 | 2026-07-01 | B2 |
| js/ui/reparto.js | 2.0.1 | 2026-07-01 | D |
| js/ui/tickets.js | 1.0.1 | 2026-07-01 | B3 |

---

## js/ui/mesas/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/ui/mesas/ciclo-vida.js | 1.0.4 | 2026-07-01 | B1 |
| js/ui/mesas/constantes.js | 1.0.1 | 2026-07-01 | B1 |
| js/ui/mesas/estado-comandas.js | 1.0.0 | 2026-07-01 | B1 |
| js/ui/mesas/fusion.js | 1.0.1 | 2026-07-01 | B1 |
| js/ui/mesas/notificaciones.js | 1.0.0 | 2026-07-01 | B1 |
| js/ui/mesas/renderer.js | 1.0.4 | 2026-07-01 | B1 |

---

## js/ui/reparto/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/ui/reparto/acciones.js | 1.0.0 | 2026-07-01 | D |
| js/ui/reparto/constantes.js | 1.0.0 | 2026-07-01 | D |
| js/ui/reparto/modal-editar.js | 1.0.0 | 2026-07-01 | D |
| js/ui/reparto/modal-nuevo.js | 1.0.0 | 2026-07-01 | D |
| js/ui/reparto/tabla.js | 1.0.1 | 2026-07-01 | D |

---

## js/modulos/admin/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/modulos/admin/eventos-en-vivo.js | 1.2.0 | 2026-07-01 | B4 |

---

## js/modulos/cliente/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/modulos/cliente/menu-digital.js | 1.1.6 | 2026-07-01 | C |
| js/modulos/cliente/orden.js | 1.0.1 | 2026-07-01 | C |
| js/modulos/cliente/pantalla-bienvenida.js | 2.1.6 | 2026-07-01 | C |
| js/modulos/cliente/pantalla-eventos.js | 1.0.5 | 2026-07-01 | C |
| js/modulos/cliente/pantalla-inicio.js | 1.0.4 | 2026-07-01 | C |
| js/modulos/cliente/principal.js | 1.7.2 | 2026-07-01 | C |

---

## js/modulos/interno/

| Archivo | Versión | Última actualización | Célula dueña |
|---------|:-------:|----------------------|--------------|
| js/modulos/interno/guia-mesero.js | 2.0.1 | 2026-07-01 | B1 |
| js/modulos/interno/precarga-control.js | 2.1.4 | 2026-07-01 | B1 |

---

## Resumen

- **Total de archivos versionados:** 68
- **Células activas:** 8 (A, B1, B2, B3, B4, C, D, E)
- **Archivos compartidos:** 1 (js/utils.js)
- **Nuevos archivos en esta iteración:** 1 (js/comandos/marcar-agotado.js)
- **Archivos modificados en esta iteración:** 20

---

*Documento mantenido por el Coordinador de Integración.*
*Generado el 2026-07-02*