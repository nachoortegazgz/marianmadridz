# Reconciliación GitHub – Wix Editor – CMS

**Fecha de lectura:** 23-11-2026  
**Repositorio:** nachoortegazgz/marianmadridz  
**Rama observada:** main  
**Commit observado:** 26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9  
**Sitio:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Modo de auditoría:** solo lectura. No se han ejecutado escrituras, pruebas funcionales con efectos, cambios de configuración ni publicaciones.

## 1. Resultado ejecutivo

La revisión confirma que GitHub y el sitio Wix son accesibles y que el Site ID de wix.config.json coincide con el sitio consultado. No existe evidencia suficiente para afirmar que el código de main sea el código instalado en el Wix Editor o ejecutado por el Runtime.

El estado devuelto por Wix Site Context es Draft. El release continúa NO-GO.

Se han detectado diferencias entre snapshots CMS anteriores y el estado actual, así como dos divergencias funcionales entre Bookings V2 y las proyecciones/configuración personalizada:

- Los seis registros de CitasF2 corresponden a bookings nativos CANCELED, pero la proyección conserva cinco CONFIRMED y uno PENDING.
- De los 94 servicios nativos Bookings V2, 16 presentan discrepancia en la opción de pago online y 8 en la opción presencial frente a ServiciosCatalogo.

## 2. GitHub

- Repositorio público: https://github.com/nachoortegazgz/marianmadridz
- Rama por defecto: main.
- Commit observado: 26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9.
- El último commit observado actualiza exclusivamente documentación de estado.
- La consulta de estados combinados para ese SHA no devolvió estados asociados. Esto no equivale a un fallo de CI ni acredita CI verde en ese SHA.
- PROJECT-STATUS documenta CI SUCCESS para PR #545 y #546 y sus respectivos commits/merges. Esos resultados no se trasladan automáticamente a cualquier SHA posterior.
- La issue #210 sigue abierta. Su última evidencia documentada indica main sin protección efectiva. No se ha podido repetir en esta revisión una lectura directa de branch protection.

El conector GitHub permite leer archivos por ruta, commits, issues y ramas, pero en esta sesión no ha proporcionado un árbol completo del repositorio ni búsqueda global de código. Por ello, este documento no certifica un inventario exhaustivo de todos los archivos ni todos sus consumidores.

## 3. Wix Site Context

Lectura directa de Wix:

| Propiedad | Resultado |
|---|---|
| Site ID | 188bed94-177c-4bc9-a9f0-35080d874f3e |
| Estado | Draft |
| Editor | Wix Editor clásico |
| Velo | Habilitado |
| Plan | Premium |
| Idioma / región | es / ES |
| Moneda | EUR |
| Zona horaria | Europe/Madrid |
| Dominio personalizado | Configurado |

Aplicaciones observadas: Wix Bookings, Wix Forms & Payments, Wix Gift Cards, Wix Payments, Wix Invoices V1, Wix Stores Catalog V3, Wix Members Area, Wix Blog y Promote SEO.

El contexto del sitio no expone el SHA del código Velo instalado. La coincidencia del Site ID en wix.config.json solo confirma la vinculación declarada del proyecto, no la sincronización del código.

### Workflow de Preview

El workflow .github/workflows/wix-tpv-preview.yml es manual, tiene create_preview=false por defecto, se limita a main y ejecuta un smoke de navegador de solo lectura. No contiene un paso wix publish.

Sin embargo, la búsqueda de documentación oficial de Wix CLI realizada para esta auditoría solo ha permitido confirmar la semántica general del comando Preview para proyectos Headless: carga un build output y no publica el sitio. No se ha acreditado que el comando concreto wix preview --source remote sea el mecanismo soportado para sincronizar o probar código Velo de un sitio Wix Editor clásico. Debe verificarse su compatibilidad y origen exacto antes de utilizar el workflow como evidencia Git-Wix.

## 4. Inventario CMS live

Lectura oficial Wix Data Collections API, con 42 colecciones devueltas y paginación completa:

| Tipo | Colecciones |
|---|---:|
| NATIVE | 13 |
| WIX_APP | 29 |
| **Total** | **42** |

La documentación histórica de CMS que indica 50 colecciones, 21 NATIVE y 29 WIX_APP no coincide con esta lectura y debe conservarse únicamente como snapshot histórico.

### Colecciones operativas consultadas

| Colección | Revisión | Campos | Registros |
|---|---:|---:|---:|
| CajaActual | 18 | 81 | 1 |
| CitasF2 | 60 | 29 | 6 |
| ComplementosCatalogo | 142 | 18 | 36 |
| ControlOperativo | 93 | 32 | 58 |
| HistoricoCierresZ | 44 | 66 | 0 |
| LibroAsientosContablesDetalle | 9 | 103 | No contado en esta pasada |
| MapaStaff | 135 | 43 | 5 |
| MovimientosCaja | 109 | 113 | 2 |
| PaquetesGestoria | 8 | 17 | No contado en esta pasada |
| RegistroIntegracion | 5 | 21 | No contado en esta pasada |
| RegistrosHorariosStaff | 2 | 47 | 0 |
| ServiciosCatalogo | 203 | 44 | 95 |
| TpvSandboxIdentities | 1 | 14 | 0 |

Las colecciones DatosFiscales, InventarioStockVenta y MovimientosInventario no aparecen en el inventario live de 42 colecciones.

### Caja y movimientos

CajaActual contiene un singleton con estado ABIERTA, apertura 21-11-2026, expectedCash=320, countedCash=0, difference=0 y salesCount=2. La fuente de snapshot devuelta es MOVIMIENTOS_CAJA_RECONCILIADOS.

MovimientosCaja contiene dos registros. Ambos declaran synthetic=true, status=SIMULATED_SUCCESS y reconciliationStatus=RECONCILED:

- Venta de 25 EUR, método CARD, origen TPV_SIMULATED_GATEWAY.
- Venta de 20 EUR, método CASH, origen TPV_FUNCTIONAL_TEST.

El primer registro contiene un campo gatewayResponse. La presencia de ese campo no demuestra que se haya llamado a una pasarela real; tampoco permite certificar por sí sola el aislamiento de efectos externos.

La issue #416 y los snapshots anteriores indicaban cero movimientos y efectivo esperado de 300 EUR. Esos valores históricos no describen la lectura actual. Se mantienen las tres compensaciones de ControlOperativo en PENDING_RECOVERY, attempts=0: una con ORIGINAL_ORDER_LEDGER_MISSING y dos con el mensaje de writer fiscal deshabilitado hasta certificar Runtime. No se ha reintentado ni modificado ninguna compensación.

### MapaStaff

MapaStaff contiene cinco registros: tres STAFF, un TERCERO y una GESTORIA. Se observan tres roles website asignados: un ADMIN y dos ESTILISTA; dos registros no tienen rol website. No se han exportado datos fiscales, nombres legales, emails ni teléfonos.

TpvSandboxIdentities existe, pero actualmente contiene cero registros. El código contempla inicialización/seed; esta auditoría no ha ejecutado ese proceso.

## 5. Conciliación Bookings V2 y CitasF2

Se consultaron los seis bookingId de CitasF2 y se buscaron en Bookings Reader V2 mediante paginación completa. Resultado:

| Estado en CitasF2 | Estado nativo Bookings V2 | Registros |
|---|---|---:|
| CONFIRMED | CANCELED | 5 |
| PENDING | CANCELED | 1 |

Los seis bookings nativos están CANCELED. La proyección CMS no refleja ese estado. La divergencia descrita en la issue #523 queda confirmada en la lectura actual.

No se ha modificado CitasF2 ni se han recreado o confirmado reservas. La corrección debe partir del estado nativo y del análisis de eventos perdidos/claims; no debe alterar el booking nativo para hacer coincidir la proyección.

## 6. Conciliación de catálogo y opciones de pago

Wix Bookings Services V2 devuelve 94 servicios. ServiciosCatalogo contiene 95 registros: 94 SERVICE y un PRICING_PLAN. Los 94 serviceId de la colección personalizada tienen correspondencia en el conjunto nativo consultado.

La comparación de opciones de pago confirma:

| Comparación | Discrepancias |
|---|---:|
| ServiciosCatalogo.onlinePayment=true y Bookings.payment.options.online=false | 16 |
| ServiciosCatalogo.inPersonPayment=false y Bookings.payment.options.inPerson=true | 8 |
| Visibilidad clientHidden frente a Bookings.hidden | 0 |

La issue #522 queda confirmada. Bookings V2 debe considerarse autoridad para las opciones de pago que acepta el servicio nativo. ServiciosCatalogo puede mantener metadatos propios del negocio, pero sus flags de pago no deben contradecir la configuración nativa.

## 7. Automatizaciones Wix

La consulta oficial Automations V2 devuelve 159 automatizaciones, con paginación completa.

- 7 están ACTIVE; las siete son PREINSTALLED.
- Las siete tienen disableStatusChange=true.
- La automatización APPLICATION «Configuración de control laboral», ID 6e80b403-4903-4c5a-bfb7-d3b40ed014be, existe, pero actualmente está INACTIVE, revisión 5.
- No se han probado, ejecutado ni modificado automatizaciones.
- No se ha inspeccionado el historial completo de ejecuciones ni el contenido sensible de las acciones.

La issue #520 documenta ocho ACTIVE, incluyendo la automatización APPLICATION. Esa evidencia está parcialmente obsoleta. Permanecen siete automatizaciones PREINSTALLED activas y no se puede presumir que sus efectos de email/notificación sean inocuos para E2E.

## 8. Límites de esta reconciliación

Verificado directamente:
- Site Context, estado Draft y aplicaciones instaladas.
- Rama main y commit observado.
- Inventario CMS y esquemas de colecciones seleccionadas.
- Recuentos y estados no personales de caja, movimientos, compensaciones y staff.
- Estados nativos de los seis bookings y discrepancias de pago de los 94 servicios.
- Estados y orígenes de automatizaciones.

No verificado:
- SHA de código instalado en Wix Editor.
- Código efectivamente ejecutado en Preview/Runtime.
- Historial de ejecución de automatizaciones.
- Aislamiento real de pagos, comunicaciones y terceros.
- Concurrencia Runtime de CajaActual.
- Integridad fiscal/legal del SIF.
- E2E de reservas, checkout, devoluciones o TPV.
- Árbol completo del repositorio y grafo exhaustivo de consumidores.

**Resultado:** baseline Git/Wix/CMS parcialmente reconciliada. Integridad y aceptación Runtime pendientes. Release NO-GO.

## 9. Fuentes

- [PROJECT-STATUS](../PROJECT-STATUS.md)
- [MASTER-EXECUTION-PLAN](../MASTER-EXECUTION-PLAN.md)
- [QA Environment SSOT](../qa/QA-ENVIRONMENT-SSOT.md)
- [Backlog 2026-11-23](../qa/BACKLOG-RECONCILIATION-2026-11-23.md)
- [Issue #416 — compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416)
- [Issue #415 — maestro fiscal](https://github.com/nachoortegazgz/marianmadridz/issues/415)
- [Issue #520 — automatizaciones](https://github.com/nachoortegazgz/marianmadridz/issues/520)
- [Issue #522 — flags de pago Bookings](https://github.com/nachoortegazgz/marianmadridz/issues/522)
- [Issue #523 — CitasF2 y cancelaciones](https://github.com/nachoortegazgz/marianmadridz/issues/523)
- [Wix Data Collections API](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Wix Data Items API](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Bookings Reader V2 — Query Extended Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Bookings Services V2 — Query Services](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services)
- [Automations V2 — Query Automations](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations)
