> **ACLARACIÓN DE ESTADO — 2026-11-16:** El estado `Published` citado en apartados históricos de este documento está supersedido. GetSiteContext confirma actualmente `Draft`; no hay Preview generado ni runtime validado. La referencia vigente de implementación y estado es [TPV-CURRENT-SITE-IMPLEMENTATION-2026-11-16.md](TPV-CURRENT-SITE-IMPLEMENTATION-2026-11-16.md). La presencia de `#htmlTPV.txt` en GitHub no demuestra que el contenido esté instalado en el HTML Component del Editor: esa comprobación sigue pendiente en Wix Local Editor/Editor.

---

# TPV — integración con Wix nativo

## Alcance y página actual

- Sitio: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor: Wix Classic Editor (Wix devuelve `Editor`); Velo habilitado.
- Estado del sitio: `Draft`, confirmado por GetSiteContext el 2026-11-16 23:09 Europe/Madrid. Las referencias `Published` de versiones anteriores son históricas y no describen el estado actual.
- Página estática TPV: ID `yl5th`, título `TPV`, ruta `/blank`.
- Page code versionado: `src/pages/TPV.yl5th.js`.
- HTML Component versionado: `#htmlTPV`.
- Moneda EUR; zona horaria Europe/Madrid.
- Studio Two queda fuera de alcance.

El repositorio `nachoortegazgz/marianmadridz` contiene `wix.config.json` con el Site ID exacto `188bed94-177c-4bc9-a9f0-35080d874f3e`, `uiVersion: 15941`, los scripts `wix dev`/`wix` y la estructura Velo `src/pages`, `src/backend` y `src/public`. Esto acredita que el repositorio está configurado para el Git Integration de este sitio. Wix documenta soporte explícito para Wix Editor (Classic) y Studio. El merge de PR #399 a `main` debe sincronizar el código con el Editor; esta sincronización aún no se ha verificado mediante read-back en el panel de GitHub Integration.

## Arquitectura y fuentes de verdad

| Capacidad | Fuente de verdad | Papel de la TPV en QA |
|---|---|---|
| Servicios | Wix Bookings | Lectura de catálogo; sin escritores de reservas |
| Productos y variantes | Wix Stores Catalog V3 | Lectura de catálogo; sin cambios de stock ni pedidos |
| Clientes | Wix CRM Contacts V5 | Búsqueda/selección por ID nativo de Contact; el campo legado del widget `customerIdentityId` conserva el nombre por compatibilidad, pero su valor es `Contact._id` |
| Profesionales | Wix Bookings Staff + `MapaStaff` | Resolución/autorización por `resourceId`; el mapeo CMS debe corresponder con el recurso nativo de Bookings |
| Reservas | Wix Bookings | Consulta y vinculación deshabilitadas en QA |
| Pagos, pedidos y transacciones | Wix eCommerce / proveedor | Simulación sintética; sin checkout, autorización, captura, pedido ni reembolso real |
| Tarjetas regalo | Wix Gift Cards | Consulta de saldo real, emisión, canje y reembolso deshabilitados en QA |
| Facturación | Wix Invoices V1 + módulo fiscal | Sin emisión fiscal; factura/abono/rectificativa bloqueados |
| Caja y ledgers | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, ledgers fiscal/contable | Eventos sintéticos en `MovimientosCaja` y proyección de sesión en `CajaActual`; sin escritores fiscales/contables |

Wix Bookings y Stores permanecen como SSOT de los catálogos que se leen. El CMS propio conserva exclusivamente el estado transaccional sintético de TPV. No se copian contactos, miembros, reservas, tarjetas regalo, pedidos ni pagos reales.

### Identidades nativas y compatibilidad de contratos — 2026-11-23

- El directorio de clientes consulta Wix CRM Contacts V5. No se crea ni consulta una colección de identidades TPV propia.
- El nombre de propiedad `customerIdentityId` se mantiene temporalmente en el puente del widget por compatibilidad; semánticamente contiene el ID nativo de Contact (`Contact._id`). No representa una identidad sintética.
- Los profesionales se resuelven mediante `MapaStaff` y Wix Bookings Staff usando `resourceId`. La verificación read-only realizada encontró tres asociaciones de tres; `staffMemberId` no es el identificador de unión empleado por el código.
- No se ha autorizado ni ejecutado ninguna escritura de reconciliación en CMS.
- Las colecciones retiradas `TpvSandboxIdentities` / `TPV_IDENTITIES` no forman parte del contrato runtime.
- El metadato nuevo de sesión/proyección se escribe en `CajaActual.conceptOperations.tpvRuntime`. `tpvSandbox` se conserva exclusivamente como fallback de lectura para registros históricos. No se migran registros antiguos automáticamente.
- Los nuevos envelopes sintéticos usan `sourceType=SYNTHETIC`, `processingMode=INTERNAL`, `reconciliationStatus=NOT_RECONCILED`, `siteId`, `sessionId`, `schemaVersion` y `ledgerVersion`; pagos/reembolsos nativos, escrituras nativas y efectos fiscales siguen deshabilitados.
- Los identificadores históricos `TPVSANDBOX_*` solo se generan para búsquedas de compatibilidad/idempotencia; no son IDs de nueva inserción. No eliminar ni renombrar sin migración de lectura y pruebas de retry.


## Integración versionada

- `src/pages/TPV.yl5th.js` inicializa `public/tpvPageController.js`.
- El controlador despacha WebMethods de `src/backend/tpv/*.web.js`.
- `tpvCatalogo.web.js` consulta servicios Bookings, productos/variantes Stores V3, Wix CRM Contacts V5 y profesionales nativos mediante `MapaStaff` + Wix Bookings Staff.
- `tpvVentas.web.js` valida el cliente contra Contacts V5 y el profesional mediante `resourceId`; no confía en IDs de identidad suministrados por el navegador como prueba de autorización.
- `tpvGiftCards.web.js` mantiene deshabilitada la integración real de Gift Cards; no debe inferirse una redención real a partir de un movimiento TPV sintético.
- La autorización del operador se resuelve independientemente de la atribución del profesional seleccionado. El actor autenticado y el profesional atribuido no son intercambiables.
- `tpvRepository.js` concentra escrituras sintéticas, idempotencia y locks CAS; los eventos se persisten append-only en `MovimientosCaja` y `CajaActual` conserva la proyección de sesión. `TPV_COLLECTIONS` son discriminadores lógicos internos, no colecciones físicas.
- `TpvSandboxIdentities` / `TPV_IDENTITIES` están retiradas y no forman parte del contrato runtime. No recrear esa colección para satisfacer tests o fixtures antiguos.
- `#htmlTPV.txt` implementa el protocolo `MM_READY/MM_CONTEXT`, `postMessage`, catálogo Bookings/Stores V3, Contacts V5 y personal Bookings enlazado por `resourceId`. El HTML está versionado; su instalación en el HTML Component Wix y runtime siguen pendientes de verificación.

## Política de seguridad

- Todos los WebMethods exigen miembro autenticado y validación de rol en backend.
- Reembolsos sintéticos y Ticket Z requieren ADMIN.
- La interfaz no es una barrera de seguridad: cada WebMethod vuelve a comprobar permisos.
- No se llama a Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- `CajaActual` se actualiza únicamente como proyección backend de la sesión sintética. No se escribe en `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Las escrituras de eventos QA se limitan a `MovimientosCaja` con marcadores `TPV_QA_SYNTHETIC` y `SIMULATED_TPV_*`; `CajaActual` recibe exclusivamente la proyección backend. No existen colecciones físicas `TPV_QA_*`.
- El identificador de auditoría persistido es `QA_ACTOR`, nunca el ID real del miembro.

## Limpieza legacy

Se retiraron tras comprobar consumidores:
- `src/pages/tpv.js`
- `src/pages/tpvCaja.web.js`
- `src/backend/tpvCaja.web.js`
- `src/backend/tpvVentas.web.js`
- `src/backend/tpvCatalogo.web.js`
- `src/backend/tpvCierres.web.js`
- `src/backend/tpvDevoluciones.web.js`
- `src/backend/tpvMovimientos.web.js`
- `src/backend/tpvPagos.web.js`
- `src/backend/tpvPermisos.web.js`
- `src/backend/tpvAuditoria.web.js`
- `src/backend/tpvUtils.web.js`
- `src/public/tpv/tpv-page.js`

Los diez módulos `src/backend/tpv*.web.js` de la raíz eran stubs antiguos sin consumidores activos. Los dos escritores antiguos insertaban directamente en `MovimientosCaja`/`CajaActual`; los demás exponían contratos incompletos y/o duplicados sin las políticas QA actuales. La implementación canónica está en `src/backend/tpv/` y no debe coexistir con esos aliases legacy.

**Integración UI desarrollada el 2026-11-19:** el HTML implementa el contrato del widget y las acciones persistentes QA mediante el controlador. La venta guardada es una venta sintética de pruebas, no un cobro real. La CI offline del HEAD `d8a8c8f61517a44f89f0db8e0159bc159c2d2782` terminó correctamente: Layer 1 28 suites / 331 tests; Layer 2 19 suites / 258 tests; total 74 suites / 673 tests, 0 fallos; SDK contracts, ESLint y secret scanning correctos. Runtime Wix, instalación en `#htmlTPV`, Preview y Publish siguen pendientes.

## Bloqueos antes de activar operaciones reales

1. Releer permisos CMS e item permissions de `CajaActual`, `MovimientosCaja` y `ControlOperativo`; la última auditoría histórica encontró permisos más amplios de los esperados.
2. Resolver y verificar las automatizaciones Wix preinstaladas ACTIVE que pueden enviar notificaciones; Runtime/E2E permanece bloqueado mientras no se acredite aislamiento.
3. Diseñar y aprobar contratos de pago presencial, pedidos, inventario y devoluciones nativas.
4. Definir la emisión fiscal con Wix Invoices V1 y cumplimiento fiscal español.
5. Probar en Preview con ADMIN, GESTION, ESTILISTA, miembro sin rol y visitante.
6. Confirmar en Wix Dashboard que no hay proveedor de pagos conectado antes de cualquier prueba que pueda producir efectos financieros.
7. Configurar el secreto `CLI_API_KEY` con el permiso indicado y ejecutar el workflow de Preview; revisar la URL y probar solo lecturas. No ejecutar `wix publish` hasta cerrar los bloqueos runtime.

## Estado de despliegue

PR #397, PR #398 y PR #399 figuran fusionadas en GitHub. PR #399 aplica la frontera sintética. CI sobre su HEAD: 74 suites / 670 pruebas offline, 0 fallos; SDK contracts, ESLint y secret scanning correctos.

El código TPV está versionado en el repositorio conectado y el commit de PR #399 está en `main`, por lo que Wix debe reflejarlo en el Editor. No se ha ejecutado `wix preview` ni `wix publish`. La versión publicada del sitio no se considera actualizada: el Editor puede estar sincronizado sin que producción lo esté.

La vía oficial aplicable es [Git Integration & Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites), cuyo setup incluye Wix Editor (Classic) y conexión desde el Code sidebar. El repositorio contiene la configuración de sitio correspondiente. Para crear Preview, Wix requiere Node.js v24.22.1 o superior, Wix CLI y un API key con permiso `Wix CLI for Sites - Git Integration`. Se añadió `.github/workflows/wix-tpv-preview.yml`; el workflow actual exige el secreto `CLI_API_KEY` y falla de forma explícita si falta. La disponibilidad del secreto no puede consultarse desde la integración GitHub. El workflow nunca ejecuta `wix publish`. Wix advierte que Preview utiliza las HTTP functions live; las pruebas deben limitarse a carga y lecturas, sin acciones que escriban datos.

