> **Addendum de vigencia — 2026-11-14:** los flujos Capa 3 siguen siendo diseño, no integración operativa certificada. TEC-033 habilita temporalmente update/remove individual de ciertos ledgers solo en una rama de QA; no cambia la autoridad de Wix CMS, no habilita writers y no autoriza que SharePoint/Power Automate borre o corrija datos de Capa 1. La migración de `CajaActual` permanece pendiente; Capa 3 no calcula ni altera sus saldos.

## Addendum de vigencia — 2026-11-14

**Rama de trabajo:** `chore/temporary-append-only-mutation-window`. Este addendum describe exclusivamente el estado documental y de código de esta rama; no implica merge en `main`, despliegue Wix, publicación ni mutación CMS live.

### Ventana temporal de mutabilidad para QA (TEC-033)

La rama habilita temporalmente update/remove individual sobre los registros de las colecciones que el proyecto protegía como append-only: `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`, `HistoricoCierresZ`, `PaquetesGestoria` y `ControlOperativo` únicamente cuando `controlType=WEBHOOK_EVENT`.

La habilitación está centralizada en `APPEND_ONLY_MUTATION_WINDOW` de `src/backend/internalConfig.js` (`ENABLED=true`, `TEMPORARY=true`, `RESTORE_BEFORE_PRODUCTION=true`). Los hooks de `src/backend/data.js` y las allowlists de `src/backend/dataAccessPolicy.js` están alineados con esa bandera. La validación de esquema de inserción y los controles de tipo/identidad permanecen activos. Las operaciones bulk de inserción, actualización y borrado continúan bloqueadas; la excepción se limita a operaciones individuales autorizadas por la política backend.

**Límite de seguridad:** la excepción es de código en una rama de trabajo, no una dispensa legal ni una autorización para alterar datos reales. No se han cambiado permisos CMS, colecciones, registros, automatizaciones ni configuración Wix. Tampoco se ha eliminado ningún registro sintético en esta intervención. La edición desde Content Manager/Wix UI no se considera validada por esta bandera. Antes de borrar un elemento, debe acreditarse que es sintético mediante marcadores y trazabilidad inequívocos; si existe duda sobre su origen, se conserva.

**Gates que siguen cerrados:** `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y `ALLOW_SIMULATION_RECORDS=false`. La ventana de mutabilidad no habilita writers fiscales, contables, laborales ni pagos. No ejecutar pruebas E2E con efectos externos en el sitio Published.

**Cierre obligatorio antes de integrar o publicar:** establecer `APPEND_ONLY_MUTATION_WINDOW.ENABLED=false`; retirar las allowlists temporales de update/remove; restaurar pruebas que exigen `FISCAL_VIOLATION`; ejecutar CI completo y verificar en Wix Local Editor que los hooks vuelven a bloquear update/remove. No publicar ni desplegar mientras la bandera esté habilitada.

### Corrección del contrato CMS `CajaActual`

La colección `CajaActual` fue recreada en Wix como `NATIVE`, revisión 1, con un índice único activo sobre `singletonKey` y un único elemento `CAJA_PRINCIPAL`. El elemento permanece `cashRegisterStatus=CERRADA`, `isOpen=false`, sin sesión abierta ni saldo inicial de apertura. `MovimientosCaja` no fue modificada.

El esquema live leído tras la creación conserva todavía el contrato anterior: `operationDate:DATE`, `openingAmount:NUMBER`, `voucherAmount:NUMBER` e `isOpen:BOOLEAN`; no constan todavía `operationDateHour`, los cuatro campos de saldo inicial por medio de pago ni `bizumAmount`. Los intentos posteriores de añadir campos/actualizar la colección devolvieron `WDE0025`; por tanto, **la migración correctiva del esquema no está aplicada**. No describir los campos objetivo como existentes en Wix.

Contrato objetivo aprobado para la siguiente migración controlada:
- `operationDateHour:DATETIME`: instante de operación con fecha y hora.
- Saldos de apertura: `openingCashAmount`, `openingCardAmount`, `openingBizumAmount`, `openingOtherAmount` (NUMBER).
- Saldos actuales: `cashAmount`, `cardAmount`, `bizumAmount`, `otherAmount` (NUMBER).
- `cashRegisterStatus` es el único estado de sesión; `isOpen` es redundante.
- Retirada diferida de `operationDate`, `openingAmount`, `voucherAmount` e `isOpen` solo después de migrar todos los consumidores y validar compatibilidad.

Los cuatro importes de apertura se registran al abrir una sesión real; no se deben rellenar con ceros por defecto en una caja cerrada. Los saldos actuales se inicializan desde los importes de apertura y se proyectan aplicando de forma idempotente los movimientos válidos de `MovimientosCaja`. El ledger fuente no se modifica. El código de la rama de alineación de caja todavía requiere completar el contrato de apertura, validación, DTO, conciliación y pruebas; los cambios parciales de nombres no equivalen a migración funcional.

**Secuencia requerida:** (1) resolver el contrato REST Wix para añadir/actualizar campos y obtener readback; (2) revisar consumidores y tipos; (3) completar backend/DTO/validadores/tests; (4) migrar únicamente valores demostrables; (5) retirar campos legacy tras búsqueda completa y CI; (6) validar en Wix QA aislado. No publicar mientras el esquema CMS y el código no compartan el mismo contrato.

---

> **Aviso de vigencia — 2026-11-11:** Este dossier es una especificación de diseño de Capa 3, no evidencia de que SharePoint, Power Automate o las exportaciones estén implantados. Prevalece [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) para el estado actual. No existe evidencia de `exportService.js` ni jobs periódicos de exportación; el despacho Resend a gestoría está bloqueado y el tenant M365/SharePoint no está auditado. Wix CMS sigue siendo SSOT y Capa 3 no puede escribir en Capa 1.

---

# Dossier de flujos end-to-end — Capa 1 → Capa 3

**Proyecto:** Marian Madrid · https://www.marianmadrid.es/  
**Revisión:** 2026-11-10  
**Baseline revisado:** `main` · `c046a975d0ca3d45e83aa2dbab07e278e02edaae`  
**Estado:** arquitectura objetivo; implantación operativa no demostrada.


### Evidencia Wix live de configuración (solo lectura, 2026-11-10)

- Wix eCommerce Orders Settings: `inventoryUpdateTrigger=ON_ORDER_PAID`; `createInvoice=false`.
- Wix Bookings Services V2: 94 servicios (70 `FIXED`, 24 `NO_FEE`, ninguno `VARIED`); siete visibles superan 100 EUR y ninguno tiene depósito habilitado.
- La activación queda pendiente. Wix Help Center indica depósito online y saldo en persona, pero el esquema REST actual de Services V2 declara `inPerson=false` cuando `deposit=true`. Esta discrepancia se considera bloqueo de contrato; no activar ni programar cambios hasta aclararla con Wix y validar la cuenta.

## 1. Propósito y límites

## Decisiones de negocio y flujo de depósitos (2026-11-10)

- Precio de servicio **≤ 100 EUR**: no exigir depósito.
- Precio de servicio **> 100 EUR**: depósito fijo de **15 EUR**.
- El depósito se cobra online y el saldo restante se paga en persona; el depósito forma parte del precio del servicio y no es un recargo.
- Cancelación/reprogramación sin penalización con al menos 24 horas. Si cancela el negocio, devolución íntegra.
- No aplicar retención automática por cancelación tardía o inasistencia hasta disponer de condiciones transparentes y revisión jurídica de proporcionalidad.
- Configurar primero el depósito nativo de Wix Bookings a nivel de servicio. La documentación Wix exige pago online y, si el depósito es inferior al total, habilitar pago presencial; la función no está disponible para todas las cuentas y no se puede combinar con aprobación manual. Los pagos manuales pueden omitir el depósito, por lo que no se habilitará esa alternativa para servicios sujetos a fianza.
- Para servicios de precio variable, verificar cada variante: si una misma configuración nativa obliga a depositar también por variantes de 100 EUR o menos, separar los servicios/variantes de forma nativa o diseñar una solución específica solo tras probar la limitación. No introducir lógica personalizada por anticipado.
- Confirmación de la reserva, importe de anticipo, saldo pendiente, pago, devolución y ledger fiscal deben reconciliarse en QA antes de activar.
- El anticipo de 15 EUR genera devengo de IVA al cobro por el importe percibido (LIVA art. 75.Dos) y obligación de factura por pago anticipado (RD 1619/2012 art. 2.1). No activar hasta que el SIF/Veri*Factu registre correctamente el anticipo y su devolución; issue P0 #209.


Capa 3 proporciona custodia documental y entrega controlada de evidencia a la gestoría. No es una capa transaccional.

- **Capa 1:** Wix Apps + Wix CMS + backend Velo. Autoridad de reservas, pedidos, caja, inventario, jornada y ledgers propios.
- **Capa 3:** SharePoint como repositorio documental; Power Automate como orquestación documental si la licencia y configuración real lo permiten.
- **Dirección del flujo:** Wix/backend → transporte aprobado → Power Automate (si procede) → SharePoint.
- **Prohibición:** Capa 3 no modifica ni gobierna Capa 1. No existen callbacks de SharePoint a CMS.
- **No exportar:** datos de tarjeta, credenciales, secretos, tokens, datos capilares/salud ni PII de clientes sin obligación y base jurídica documentada.

Este documento describe requisitos y diseño. No acredita configuración del tenant, flujos activos, automatización ni cumplimiento legal.

## 2. Estado de implantación verificado

| Componente | Estado |
|---|---|
| Wix CMS como SSOT transaccional | Principio de arquitectura |
| `src/backend/exports/exportService.js` | No existe en `main` |
| Jobs de exportación en `src/backend/jobs.config` | No existen |
| `verifyNightlyZClosing` | Existe; realiza cierre/verificación Z, no exporta CSV a SharePoint |
| Paquetes de gestoría | `fiscalDocuments.web.js` contiene WebMethods y helpers, pero la creación de snapshot devuelve `PACKAGE_SNAPSHOT_IMPLEMENTATION_PENDING` |
| Colección `PaquetesGestoria` | La auditoría de pausa registra respuesta de creación de esquema; no consta segunda lectura independiente de permisos ni documentos |
| Envío Resend a gestoría | Helper presente en `fiscalDocuments.web.js`; bloqueado por `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED=false` |
| Exportaciones periódicas | No implementadas |
| Power Automate PA-01…PA-07 | No auditados en el tenant; no se presume que existan |
| SharePoint: site, bibliotecas, permisos, retención y DLP | No auditados |
| E2E Wix → transporte → Power Automate → SharePoint | No ejecutado |

La presencia de código de envío Resend no significa que el envío esté habilitado ni que exista el pipeline de exportación. El código actual mantiene un bloqueo explícito de seguridad.

## 3. Decisiones pendientes antes de implementar

### 3.1 ADR de transporte

No existe una decisión aprobada para las exportaciones. Deben compararse al menos:

1. Resend → email → conector Outlook de Power Automate → SharePoint.
2. Microsoft Graph / mecanismo Microsoft nativo → SharePoint, con identidad de aplicación, permisos y conexiones adecuados.

La evaluación debe cubrir coste/licencia, DPA, residencia y transferencias, permisos, secretos, límites, trazabilidad, reintentos, idempotencia, auditoría y operación. No añadir Resend ni otro proveedor por inercia. El helper Resend existente para el envío de paquetes permanece deshabilitado y no resuelve esta ADR.

### 3.2 Tenant M365

Antes de configurar flujos hay que verificar en el tenant real:

- Identidad/licencia de Microsoft 365 y disponibilidad de conectores.
- SharePoint site, biblioteca, propietarios y grupos.
- Power Automate: conexiones, propietarios, DLP, historial, límites y permisos.
- Retención, versionado, recuperación y acceso del gestor.
- Cuenta de servicio y procedimiento de continuidad.

No se presupone que Business Standard incluya todos los conectores o capacidades requeridos para el diseño.

### 3.3 Paquetes de gestoría

El código actual no debe habilitar creación ni despacho hasta cerrar:

- Contrato canónico y versionado de snapshot.
- Hash calculado sobre representación determinista.
- Límites de tamaño y paginación; no asumir que un item CMS admite arrays/documentos ilimitados.
- Asignación concurrente de versión e idempotencia.
- Ledger append-only de intentos/entregas y respuesta del proveedor.
- Control de destinatario, autorización, minimización de PII y trazabilidad.

La colección `PaquetesGestoria` no debe confundirse con una función completa: la creación de snapshot está bloqueada y el envío está desactivado.

## 4. Fuentes y clasificación de datos

| Dominio | Fuente de verdad | Evidencia potencial para Capa 3 | Exclusiones / condiciones |
|---|---|---|---|
| Reservas | Wix Bookings V2; proyección propia `CitasF2` | Resumen de actividad/ventas si se aprueba | No exportar notas, datos sensibles ni PII innecesaria |
| Pedidos y checkout | Wix Orders / eCommerce | Identificadores de pedido, importes, impuestos y estado necesarios para conciliación | No tratar un carrito como venta ni un pedido como cobro liquidado |
| Caja y ledger fiscal | `MovimientosCaja` append-only | Movimientos, series, importes, impuestos, hashes y referencias necesarias | Nunca corregir desde SharePoint; no declarar VERI*FACTU conforme mientras la auditoría diga NO APTO |
| Cierre Z | `HistoricoCierresZ` append-only | Resumen diario y referencias a los movimientos | No generar un cierre artificial cuando el ledger no está conciliado |
| Jornada | `RegistrosHorariosStaff` append-only | Registros mínimos exigibles y trazabilidad laboral | Minimizar datos personales; revisar base jurídica y retención |
| Inventario | Wix Stores Catalog V3 y herramientas nativas | No se exportan movimientos de stock personalizados; solo métricas nativas si se aprueban | Wix es la única autoridad. No proyecciones, reservas, deducciones, reposiciones ni ledger de stock paralelo. Históricos CMS legacy preservados sin nuevas escrituras. |
| Contabilidad | `LibroAsientosContablesDetalle` | Asientos y documentación aprobados por el asesor | No automatizar mapeos PGC sin aprobación |
| Gastos y proveedores | Documentación externa + reglas contables aprobadas | Facturas y justificantes aportados manualmente | Separar documento, obligación y pago; no crear movimientos de caja física por pagos bancarios |

La lista es un catálogo de candidatos, no una orden de exportar todos los campos. Cada export necesita finalidad, base jurídica, destinatario, retención y minimización aprobados.

## 5. Contrato común de exportación propuesto

Antes de implementar cada tipo, definir un esquema versionado con, como mínimo:

- `exportId`: identidad determinista del tipo y periodo.
- `exportType`, `periodStart`, `periodEnd`, `generatedAt`.
- `schemaVersion`, `sourceSystem`, `traceId`.
- Conteo de registros y checksum del contenido.
- Estado de generación/entrega y referencia al intento.
- Política de duplicados: un reintento no crea copias ni sobrescribe evidencia; una rectificación crea un nuevo artefacto/versionado.
- Filtros temporales inclusivos/exclusivos, paginación y zona `Europe/Madrid`.

Los formatos CSV/JSON, separadores, codificación, decimales y mapeos deben validarse con la gestoría y el software contable destino. No se afirma compatibilidad con A3, Sage, Contasol u otro producto hasta probar un archivo real sintético.

## 6. Catálogo de flujos propuestos

Los siguientes identificadores son nombres de diseño. **No son flujos ya configurados.**

| ID | Flujo propuesto | Cadencia objetivo | Estado |
|---|---|---|---|
| PA-01 | Cierre Z → repositorio documental | Diario, tras cierre verificado | No implementado |
| PA-02 | Movimientos de caja → repositorio | Diario | No implementado |
| PA-03 | Jornada → repositorio | Semanal | No implementado |
| PA-04 | Ventas/pedidos → repositorio y resumen | Mensual | No implementado |
| PA-05 | Inventario → repositorio y resumen | Mensual | No implementado |
| PA-06 | Facturas/justificantes aportados por Marian | Bajo demanda | No implementado |
| PA-07 | Paquete consolidado para gestoría | Trimestral | No implementado |

Los cuatro primeros flujos de exportación recurrente desde Wix requerirían jobs backend específicos, hoy ausentes. PA-06 y PA-07 son procesos documentales adicionales y no deben contabilizarse como crons Wix.

## 7. Seguridad, integridad y operación

- Autorización y lectura de CMS siempre en backend; permisos mínimos y elevación justificada.
- No incluir secretos, tokens, datos de tarjeta ni PII no necesaria.
- SharePoint es repositorio de evidencia, no autoridad de corrección.
- No sobrescribir un archivo entregado; corregir mediante nuevo artefacto trazable.
- Idempotencia por exportId y control de concurrencia.
- Reintentos limitados con backoff; fallos terminales visibles y auditables.
- Separar generado, entregado, recibido y validado por la gestoría.
- El gestor recibe acceso de solo lectura al área documental aprobada.
- Retención, versionado y eliminación deben configurarse conforme a la política legal/contractual aprobada; no fijar periodos sin validación.

## 8. Plan de implantación y gates

1. **ADR de transporte:** comparar alternativas, coste, seguridad, licencias y aprobar una.
2. **Auditoría M365:** verificar tenant, SharePoint, Power Automate, conexiones y permisos.
3. **Contrato de datos:** definir cada export, campos, filtros, PII, esquema y checksum con asesoría.
4. **Snapshot de gestoría:** completar hash, límites, concurrencia, idempotencia y ledger de despacho; mantener flag desactivado hasta validar.
5. **Implementación backend:** un único módulo de exportación, lectura paginada y jobs específicos; no duplicar lógica de dominio.
6. **Flujos PA:** configurar únicamente los aprobados, con control de duplicados y fallos.
7. **E2E QA:** datos sintéticos, tenant de prueba, archivos de prueba y acceso de solo lectura.
8. **Aprobación operativa:** gestoría valida formatos y Marian valida el circuito.
9. **Activación:** despliegue autorizado, monitorización y runbook de recuperación.

## 9. Criterios de aceptación

Capa 3 solo podrá declararse operativa cuando:

- El transporte y tenant estén aprobados y configurados.
- Cada export tenga contrato versionado, finalidad y minimización de datos.
- Reintentos y concurrencia no dupliquen ni sobrescriban evidencia.
- Los hashes/checksums se validen en generación y recepción.
- Los permisos de SharePoint se prueben con cuentas reales de prueba.
- Los flujos PA estén activos y sus ejecuciones/fallos sean observables.
- El E2E con datos sintéticos se ejecute satisfactoriamente.
- La gestoría confirme que los documentos son utilizables.
- Se demuestre que no hay escritura de Capa 3 hacia Capa 1.

## 10. Referencias y auditorías

- [Estado de implantación Capa 3](docs/audits/2026-11-09-capa3-implementation-state.md)
- [Estado del proyecto y prioridades](docs/PROJECT-STATUS.md)
- [Auditoría de preparación VERI*FACTU](docs/qa/2026-11-09-verifactu-readiness-audit.md)
- [Wix Data API](https://dev.wix.com/docs/api-reference/business-solutions/cms)
- [Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
- [Microsoft Graph documentation](https://learn.microsoft.com/graph/overview)
- [Power Automate documentation](https://learn.microsoft.com/power-automate/)

---
*Revisión documental: 2026-11-09. No se ha accedido al tenant M365 en esta intervención ni se han creado flujos, archivos, correos o datos CMS.*


---

## Addendum — decisiones transversales actualizadas (2026-11-11)

### Autoridad de servicios Bookings

El propietario declara ServiciosCatalogo como SSOT de configuración de servicios sincronizada con Wix Bookings. El campo name se relaciona con Complementos catálogo y contiene los complementos ofrecidos por cada servicio; staffMembers determina el personal elegible. Esta relación aún no está verificada en el esquema/código live ni acredita que exista un proceso de sincronización. Antes de implementarlo, auditar IDs, consumidores, triggers, contratos oficiales Bookings, idempotencia y semántica de retirada. La elegibilidad no garantiza disponibilidad horaria: esta depende además de working hours, eventos/bloqueos y reservas.

### Caja, sesión operativa y ledgers — decisión TEC-032 (2026-11-13)

`MovimientosCaja` conserva cada ticket/movimiento original como ledger append-only. `CajaActual` es una proyección mutable de sesión: estado y responsables de apertura/cierre, resumen de última operación, acumulados de sesión por medio de pago y saldo de efectivo físico por separado. La proyección mantiene referencias a los IDs fuente y no duplica el histórico.

Los cobros presenciales en efectivo, tarjeta y Bizum forman parte de la actividad/acumulados de sesión. Tarjeta y Bizum no alteran el saldo físico del cajón; `cashAmount`/`expectedCash` solo varían por deltas físicos explícitos y validados. Los movimientos ONLINE, transferencias y pagos bancarios permanecen en sus registros correspondientes y no se agregan a la sesión física por inferencia. La última operación presenta actor resuelto en backend, instante exacto, detalle validado, importe, huellas y traceId del movimiento fuente, sin rellenar datos ausentes.

La decisión es documental y su implementación sigue pendiente. El esquema actual no acredita campos de última operación/referencias ni acumulado Bizum; `paymentMethod` es singular y `lineItems` no tiene estructura interna validada. Los pagos mixtos y cantidades de conceptos no se exponen como válidos hasta cerrar esos contratos y sus pruebas. La PR #284 documentaba un filtro inicial de efectivo presencial; no implementa TEC-032. No habilitar flujos de Capa 3 para reconstruir ni corregir estos datos: SharePoint continúa siendo exclusivamente repositorio documental y Capa 3 no escribe en Capa 1.

### Estado de implantación

No se ha demostrado tenant M365 auditado, flujos Power Automate activos ni E2E Wix → transporte → SharePoint. Los planes PA-01…PA-07 siguen siendo nombres de diseño, no automatizaciones activas. Mantener el orden de gates: auditoría tenant/licencias/DLP/permisos, ADR de transporte, contrato de exportación y minimización, implementación, QA sintético, aceptación de gestoría y despliegue autorizado.

La guía transversal vigente es [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md); el estado detallado se mantiene en [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md).


---

# ADDENDUM DE VIGENCIA OPERATIVA — 2026-11-13

Este addendum actualiza la relación entre Capa 1 y Capa 3. El diseño de flujos de este dossier no constituye evidencia de que estén desplegados u operativos.

## Estado de las capas

- **Capa 1:** Wix CMS continúa siendo la única fuente de verdad transaccional.
- **Capa 3:** SharePoint es exclusivamente repositorio documental de evidencia. No gobierna ni modifica Capa 1.
- **Estado de implementación:** SharePoint Online / Power Automate no están acreditados como flujo live. No se ha verificado una cadena end-to-end de export desde Wix, recepción, depósito documental, permisos, retención, idempotencia y evidencia de entrega.
- No habilitar cron/export, Resend, destinatarios de gestoría ni automatizaciones de transferencia por asumir que el diseño del dossier está implementado.
- `ACCOUNTANT_SEND_ENABLED=false`; no enviar documentos, datos fiscales o laborales a gestoría durante QA.
- Los writers fiscales, contables y laborales permanecen deshabilitados. No generar registros reales ni alterar ledgers append-only.

## Estado de Capa 1 relevante para los exports

Lectura CMS live 2026-11-13:
- Producción: 44 colecciones (15 NATIVE, 29 WIX_APP).
- CitasF2: 1 elemento, revisión 42; su proyección mantiene `CONFIRMED / NOT_PAID`. La última lectura nativa Bookings Reader V2 documentada para el mismo bookingId devolvió `CANCELED / NOT_PAID`; divergencia P1 sin reconciliar.
- HistoricoCierresZ: 0; MovimientosCaja: 0; LibroAsientosContablesDetalle: 0; PaquetesGestoria: 0; no hay base de datos live que demuestre paquetes o exports fiscales/contables operativos.
- RegistrosHorariosStaff: 2 elementos sintéticos QA sin HMAC; writer deshabilitado.
- MovimientosInventario e InventarioStockVenta son históricos/legacy; no deben alimentar nuevos exports de inventario sin decisión y contrato explícitos.

## Sitio QA separado

Existe un sitio Wix independiente en estado Draft (Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`). Su CMS devuelve 43 colecciones; faltan cinco colecciones Stores/* frente a producción y hay cuatro colecciones WixForms/* adicionales. No se certifica paridad ni aislamiento externo. Antes de probar exports o integraciones en QA, auditar automatizaciones, email/SMS/WhatsApp, pagos, webhooks, destinatarios, permisos y conexiones M365.

## Checklist de cierre Capa 3

- [ ] Definir contrato de export con campos mínimos, minimización de datos, periodo, formato, hash, traceId e idempotency key.
- [ ] Verificar lectura autorizada desde Wix CMS y excluir colecciones Wix App no necesarias y datos personales no pertinentes.
- [ ] Implementar y probar primero en entorno QA aislado; no ejecutar envíos reales.
- [ ] Probar fallos/reintentos, duplicados, archivos parciales, integridad de contenido, permisos y retención en SharePoint.
- [ ] Demostrar unidireccionalidad Capa 1 → Capa 3 y ausencia de escrituras de retorno.
- [ ] Obtener aprobación del responsable y gestoría antes de activar destinatarios o automatizaciones.
- [ ] Mantener envío a gestoría deshabilitado hasta cierre formal.

La referencia única de prioridades y estado es `ESTADO_ACTUAL_PROYECTO.md`.

La Capa 3 solo podrá consumir una vista/exportación aprobada de los datos ya consolidados en Capa 1. No calculará ni corregirá acumulados, no reconstruirá tickets y no escribirá referencias o saldos en `CajaActual`/`MovimientosCaja`. Los exports deben minimizar datos personales y excluir secretos y datos de tarjeta.

### Estado de integración caja — TEC-032 (2026-11-13)

La rama de alineación añade una lectura de sesión desde `MovimientosCaja` y presenta el DTO en ZONA MARIAN. Capa 1 conserva los tickets originales; Capa 2 proyecta EFECTIVO/TARJETA/BIZUM presenciales solo dentro de una sesión abierta. El efectivo físico se mantiene separado de tarjeta/Bizum. El actor presencial procede de identidad autenticada backend; el frontend solo representa el DTO.

La última operación y los IDs fuente se reconstruyen para la lectura; todavía no existe persistencia de un snapshot/referencia `lastMovementId` en `CajaActual`. La apertura de sesión, el saldo inicial reconciliado, el contrato de conceptos y los pagos mixtos siguen pendientes. Capa 3 no calcula ni modifica acumulados y solo podrá consumir una exportación aprobada. Escritores y despliegue permanecen bloqueados.
