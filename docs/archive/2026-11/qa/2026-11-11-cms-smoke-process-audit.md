# QA — Smoke CMS y seguridad de DatosFiscales (2026-11-11)

## Estado

- Sitio: `marianmadrid.es`
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Repositorio: `nachoortegazgz/marianmadridz`
- Baseline `main`: `2085dfdec371649b9e7d759d75c8a93135fc5d8f`
- Tipo de prueba ejecutada: smoke de lectura CMS con `consistentRead=true`, límite 1 por colección y recuento total.
- Resultado: **34/34 consultas CMS completadas sin error** (14 colecciones NATIVE de negocio/control y 20 colecciones WIX_APP).
- No equivale a certificación E2E ni valida las interacciones del frontend, webhooks o integraciones externas.

## Corrección aplicada — P0: permisos de DatosFiscales

Estado anterior leído:
- `itemRead=ANYONE`
- `itemInsert=SITE_MEMBER`
- `itemUpdate=SITE_MEMBER`
- `itemRemove=SITE_MEMBER`
- `specialPermissions=[]`

Riesgo: exposición pública de NIF/datos fiscales y capacidad de mutación por miembros autenticados ordinarios.

Corrección aplicada mediante Wix Data Permissions API:
- `itemRead=PRIVILEGED`
- `itemInsert=PRIVILEGED`
- `itemUpdate=PRIVILEGED`
- `itemRemove=PRIVILEGED`
- `specialPermissions=[]`

Read-after-write: verificado. `src/backend/dataAccess.js` utiliza operaciones elevadas (`auth.elevate`) para lectura/escritura CMS de backend. La corrección no modifica el código del sitio ni sus ledgers.

## Fixture fiscal QA

Se creó un único registro de tercero, no de emisor:
- ID: `b2d5c33d-41a4-4f1e-8d92-9c4b7e6a2f10`
- `recordType=TERCERO`
- `thirdPartyType=PROVEEDOR`
- `taxId=ESX0000000X` (valor sintético de formato, no validado en VIES ni apto para facturación)
- `legalName=PLACEHOLDER QA - PROVEEDOR NO REAL`
- `label=QA_ONLY - NO USAR EN OPERACIONES REALES`
- `address=PLACEHOLDER - SIN DOMICILIO REAL`

Read-after-write: 1 registro localizado y campos críticos verificados. No se creó `CONFIG_SISTEMA`: el código `fiscalAggregator.web.js` utiliza su `taxId` como NIF del emisor. Un NIF placeholder ahí contaminaría documentos fiscales. La configuración de emisor queda pendiente de NIF y razón social auténticos facilitados por la titular/gestoría.

## Smoke de colecciones — recuentos observados

### NATIVE

| Colección | Recuento |
|---|---:|
| DatosFiscales | 0 antes del fixture; 1 después |
| CajaActual | 1 |
| MovimientosCaja | 5 |
| CitasF2 | 0 |
| LibroAsientosContablesDetalle | 1 |
| HistoricoCierresZ | 0 |
| ServiciosCatalogo | 95 |
| ComplementosCatalogo | 36 |
| MapaStaff | 3 |
| RegistrosHorariosStaff | 2 |
| ControlOperativo | 0 antes del log; 1 después |
| InventarioStockVenta | 1 |
| MovimientosInventario | 1 |
| PaquetesGestoria | 0 |

### WIX_APP

| Colección | Recuento |
|---|---:|
| Bookings/Services | 94 |
| Bookings/Staff | 3 |
| Bookings/Schedule | 94 |
| Stores/Products | 24 |
| Stores/Variants | 30 |
| Stores/Collections | 15 |
| Stores/InventoryItems | 24 |
| Stores/Orders | 1 |
| Members/PublicData | 9 |
| Members/PrivateMembersData | 13 |
| Members/FullData | 13 |
| Members/Badges | 1 |
| Forms/subscribers03 | 2 |
| Blog/Posts | 2 |
| Blog/Categories | 0 |
| Blog/Tags | 0 |
| Locations/Locations | Consulta correcta; recuento total no devuelto |
| Marketing/Coupons | 3 |
| CampaignManager/campaigns | 1 |
| CampaignManager/userConfig | 1 |

Los recuentos son una fotografía del CMS durante esta ejecución, no una afirmación de que todos los procesos de negocio hayan completado sus flujos.

## Matriz de cobertura por proceso (12 procesos)

| Proceso | Estado | Evidencia / limitación |
|---|---|---|
| P1 Reservas y citas | PARCIAL | Catálogo, staff y schedules accesibles; `CitasF2=0`. No se crearon/cancelaron reservas. |
| P2 Venta online | PARCIAL | Catálogo, variantes, inventario y pedidos consultables; no se inició checkout ni pago. |
| P3 Caja física | LECTURA OK | `CajaActual=1`, `MovimientosCaja=5`; no se insertaron movimientos. |
| P4 Facturación/fiscalidad | PARCIAL | Fixture tercero QA verificado; falta configuración real del emisor. No se emitieron facturas. |
| P5 Inventario | LECTURA OK | Snapshot y movimientos propios, además de inventario Stores, consultables. |
| P6 Jornada laboral | LECTURA OK | `MapaStaff=3`, `RegistrosHorariosStaff=2`; los writers siguen deshabilitados en `STAFF_CLOCKING_CONFIG`. |
| P7 Clientes/CRM | LECTURA OK | Colecciones Members accesibles; no se modificaron perfiles ni contactos. |
| P8 Gastos/proveedores | PARCIAL | Colección fiscal accesible y fixture QA; no hay proveedor real aportado ni factura de proveedor de prueba. |
| P9 Cierre Z | SOLO LECTURA | `HistoricoCierresZ=0`; no se ejecutó cierre por su efecto fiscal/append-only. |
| P10 Pagos/cobros | PARCIAL | Colección Orders accesible; no se procesaron pagos, devoluciones ni reembolsos. |
| P11 Marketing/fidelización | LECTURA OK | Cupones/campañas/blog accesibles; categorías y tags están vacíos. |
| P12 Comunicaciones/email | PARCIAL | Formularios consultables; Resend, IONOS, M365 y Power Automate no se probaron en esta sesión. |

## Registro operativo

Se insertó y verificó un registro de auditoría en `ControlOperativo`:
- ID: `4b0bcb5e-79d2-4b2c-9d55-4b3a7d8c5e11`
- `controlType=SYSTEM_FLAG`
- `eventType=QA_SMOKE_CMS_READ_AUDIT`
- `status=COMPLETED`
- `traceId=qa-smoke-2026-11-11-datos-fiscales`
- `dedupeKey=QA_SMOKE_CMS_READ_AUDIT_2026_11_11`

Read-after-write: registro localizado; payload, seis hallazgos y recuento de 34 consultas verificados.

## Discrepancias y pendientes

1. El esquema físico de `DatosFiscales` declara `active`, pero `data.js` lo incluye en `DATOS_FISCALES_NON_SCHEMA_FIELDS` y `validation.js` prohíbe su uso. No se ha usado ni eliminado; requiere decisión de contrato y revisión de consumidores.
2. `DatosFiscales` carece de `CONFIG_SISTEMA` con identidad fiscal real. No usar el fixture como emisor.
3. `CitasF2` está vacía; la reconciliación de reservas nativas y sus proyecciones necesita una prueba específica de Bookings Reader V2 y la saga, sin mutar reservas reales.
4. `HistoricoCierresZ` está vacío. La prueba de cierre requiere entorno aislado y fixtures, nunca producción real.
5. Los escritores de fichaje están deshabilitados; no se debe declarar probado el flujo de jornada.
6. `Blog/Categories` y `Blog/Tags` están vacías; no se clasifican como fallo funcional sin requisito de contenido.
7. No se ejecutó `npm test`, ESLint ni CI en esta sesión: no hay checkout local de repo y la integración disponible no expone dispatch de workflow. Tampoco hubo Wix Local Editor, browser E2E ni ejecución publicada de webMethods.

## Integridad y seguridad de las pruebas

- No se modificaron ni borraron `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ`, reservas nativas, pedidos ni pagos.
- No se ejecutaron cierres, fichajes, devoluciones, reembolsos, notificaciones ni envíos externos.
- No se publicaron cambios de código Wix.
- La única mutación de datos funcional fue el fixture tercero QA; la corrección de permisos fue una mutación de configuración CMS; el registro de auditoría se añadió a `ControlOperativo`.

## Criterio de cierre

**Estado: QA parcial, no certificación de producción.** Se corrigió el hallazgo P0 de permisos de `DatosFiscales`, se creó un fixture tercero QA no emisor y se registró la auditoría. La validación funcional E2E de los 12 procesos queda pendiente de entorno de pruebas aislado, ejecución de CI y pruebas interactivas/publicadas con identidades y datos sintéticos controlados.
