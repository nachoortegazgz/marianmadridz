# Base maestra de arquitectura — Marian Madrid

**Revisión:** 19-11-2026 · **Plataforma:** Wix Editor Classic + Velo  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Repositorio:** `nachoortegazgz/marianmadridz`

Fija arquitectura, autoridad de datos y límites entre sistemas. Estado: [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md). Tareas: [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md).

## 1. Autoridad de datos

| Dominio | Sistema autoritativo | Regla |
|---|---|---|
| Datos propios | Wix CMS | Fuente transaccional; backend gobierna escrituras |
| Reservas, disponibilidad y recursos | Wix Bookings | APIs oficiales; proyecciones propias no gobiernan Bookings |
| Catálogo, variantes e inventario comercial | Wix Stores Catalog V3 | Sin ledger paralelo de stock |
| Identidad y permisos | Wix Members/APIs Wix + backend | MapaStaff correlaciona identidades; no es RBAC |
| Evidencia documental | SharePoint (cuando se implante) | Repositorio, no fuente transaccional |
| Automatización documental | Power Automate (si se aprueba) | Flujo unidireccional desde Capa 1 |

El propietario define negocio y autorizaciones. Documentación oficial vigente define contratos técnicos. Código, CMS y pruebas acreditan implementación, no autorización.

## 2. Capas

- **Capa 1 — transaccional:** Wix Apps, Wix CMS propio y backend Velo.
- **Capa 2 — aplicación e integración:** WebMethods, validaciones, adaptadores, webhooks, jobs, conciliación y exportadores.
- **Capa 3 — documental:** SharePoint custodia evidencias; Power Automate puede transportar entregas aprobadas. No modifica ni gobierna Capa 1.

Dirección permitida: Capa 1/backend → Capa 2 → Capa 3. No implementar callbacks desde Capa 3 hacia CMS para corregir transacciones.

## 3. Integridad

- Ledgers de caja, fiscalidad, contabilidad, jornada, cierres y eventos inmutables son append-only.
- Corregir mediante nuevos registros rectificativos vinculados al original; no update/remove de hechos económicos, fiscales o laborales.
- `MovimientosCaja` es fuente histórica; `CajaActual` es proyección derivada.
- Intento pendiente, fallido o cancelado no es cobro.
- Pedido, reserva, transacción de pago y liquidación bancaria son conceptos distintos.
- Resultado incierto de compensación exige reconciliación antes de reintentar.
- No inferir movimientos económicos desde totales de pedido o estados incompletos.
- Wix Apps se operan mediante contratos/API oficiales, no por escritura directa en colecciones administradas.

## 4. Aplicación

- Frontend: presentación y captura de entradas; sin reglas, secretos ni autorización.
- Backend Velo y archivos `.web.js`: reglas y WebMethods con autorización por operación.
- `internalConfig.js`: constantes canónicas y configuración no secreta.
- `validation.js`: validaciones compartidas.
- Secretos en Wix Secrets Manager o almacén aprobado; nunca frontend, logs o fixtures.
- Webhooks/jobs: idempotencia, deduplicación, concurrencia, reintentos limitados y recuperación auditable.
- Contratos externos: validar documentación oficial y versión real del SDK antes de implementar.

## 5. TPV física y caja

La TPV web es interfaz operativa conectada al backend Wix; no es el adquirente bancario ni la autoridad del inventario.

- PC Windows ejecuta navegador e interfaz.
- Backend Wix registra ventas y movimientos según contratos aprobados.
- Terminal bancario procesa tarjeta con su adquirente.
- Impresora térmica emite ticket y puede accionar el cajón si existe compatibilidad.
- El navegador no garantiza acceso a USB, serie o LAN. Un puente local requiere evaluación de seguridad y mantenimiento.
- Confirmación manual, respuesta técnica del terminal y liquidación bancaria son evidencias distintas.
- Detalle de dispositivos: [HARDWARE_TPV.md](HARDWARE_TPV.md).

Reglas económicas:
- Importes en céntimos enteros.
- `CASH`: efectivo recibido menos cambio; solo el neto aumenta efectivo físico.
- `CARD`: no incrementa efectivo físico.
- Mixto: componentes con medio, importe, estado, referencia e idempotencia; suma exacta igual al total.
- No liquidar intentos pendientes/fallidos/cancelados.
- Reembolsos y anulaciones referencian el hecho original.
- X es snapshot no cerrante; Z es cierre inmutable con arqueo, desglose, diferencias, actor, fecha y fuentes.
- X/Z no sustituyen factura ni SIF/VERI*FACTU.

## 6. QA y release

- Confirmar identidad y estado del sitio antes de operaciones sensibles; backend valida Site ID, identidad y permisos.
- Usar datos sintéticos y sinks offline para pagos, comunicaciones, fiscalidad y exportaciones mientras los gates estén cerrados.
- Declaración QA no demuestra neutralización de automatizaciones ni integraciones externas.
- CI offline solo acredita pruebas ejecutadas en ese SHA.
- Publicar requiere autorización expresa, Site ID y SHA exactos, gates aprobados, diff revisado, rollback y verificación posterior.
