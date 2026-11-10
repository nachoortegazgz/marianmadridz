# Registro de decisiones de negocio y arquitectura — Marian Madrid

**Fecha de consolidación:** 2026-11-10  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Estado:** decisiones y límites documentados; no equivale a despliegue ni validación E2E.

Este registro centraliza las decisiones explícitas del propietario y las decisiones técnicas adoptadas para materializarlas. Las decisiones de negocio aprobadas por el propietario se distinguen de las recomendaciones técnicas derivadas y de los asuntos sujetos a revisión legal.

## 1. Decisiones de negocio

| ID | Decisión | Autoridad | Estado / criterio |
|---|---|---|---|
| BUS-001 | Exigir depósito solo cuando el precio del servicio sea estrictamente superior a 100 EUR. A 100 EUR exactos no se exige. | Propietario, 2026-11-10 | Aprobado |
| BUS-002 | El depósito es fijo: 15 EUR. No es porcentaje. | Propietario, 2026-11-10 | Aprobado |
| BUS-003 | Los 15 EUR se descuentan del precio total; no son una tarifa adicional. Comercialmente se llama señal, pero al cobrarse a cuenta del servicio debe tratarse fiscalmente como anticipo. El saldo se liquida en el salón. | Propietario + Ley IVA/RD facturación | Aprobado como política; factura/IVA/ledger de anticipo bloquean activación |
| BUS-004 | Ventana ordinaria de cancelación/reprogramación gratuita: al menos 24 horas. Si el negocio cancela, devolución íntegra. | Política operativa recomendada, basada en patrones de centros comparables y la política Wix existente de 1440 minutos | Adoptada para diseño; configuración real pendiente |
| BUS-005 | No retener automáticamente el depósito por cancelación tardía o inasistencia hasta redactar condiciones claras y obtener revisión jurídica de proporcionalidad. | Decisión prudencial de cumplimiento | Bloqueo preventivo; no activa retenciones |
| BUS-006 | No activar automatizaciones que contacten clientes (email, SMS, WhatsApp, campañas o mensajes automáticos). | Propietario, instrucción expresa | Prohibición operativa temporal |
| BUS-007 | Durante la auditoría/QA no realizar cargos reales, reservas de clientes, cambios de stock, escrituras CMS de producción ni publicación del sitio. | Alcance de autorización del propietario y controles del proyecto | Restricción activa |
| BUS-008 | En cancelaciones antes de envío/consumo, restock nativo completo en Wix si el producto sigue físicamente disponible. En reembolsos posteriores, restock solo de las unidades efectivamente devueltas y vendibles; nunca restock automático por el mero hecho de reembolsar. | Buenas prácticas de comercio minorista y opciones nativas explícitas de Wix. | Adoptada; SOP de staff y QA pendientes |

### Base comparativa y jurídica de BUS-001…BUS-005

- Centros de estética/servicios consultados publican señales fijas de 15 EUR o 20 EUR que se descuentan del precio y reglas de cancelación de 24 horas. Son ejemplos individuales de prácticas comerciales, no una muestra estadística ni una norma jurídica: [Adara Essence](https://adaraessenceestetica.com/wp-content/uploads/2025/06/Carta-NUEVA-CAST.pdf), [Beassence](https://www.beassence.es/politicas), [Espai Gassó](https://www.espaigasso.com/politica-reservas-cancelaciones-y-devol).
- El texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios exige que las condiciones no creen desequilibrio importante ni impongan indemnizaciones desproporcionadas; el art. 62 también limita cargas onerosas/desproporcionadas en la terminación contractual. Por ello no se aprueba una cláusula de pérdida automática del depósito sin revisión: [BOE — RDL 1/2007, arts. 62 y 82](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
- El Código Civil regula cláusulas penales y libertad de pactos dentro de los límites legales: [BOE — Código Civil, arts. 1152–1155 y 1255](https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763). La política final debe ser revisada por asesoría jurídica; este registro no es dictamen legal.
- Al ser un pago a cuenta del servicio, el IVA se devenga al cobrar el anticipo por el importe efectivamente recibido (LIVA art. 75.Dos) y debe emitirse factura por pagos anticipados (RD 1619/2012 art. 2.1): [LIVA](https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740), [Reglamento de facturación](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).

## 2. Decisiones técnicas

| ID | Decisión | Justificación / consecuencia | Estado |
|---|---|---|---|
| TEC-001 | Wix Bookings nativo es la primera opción para depósitos. No crear writer/checkout propio mientras la capacidad nativa cubra el caso. | Wix Services V2 documenta depósitos por servicio. Sin embargo, el esquema REST actual declara `inPerson=false` con `deposit=true`, mientras Wix Help indica depósito online y saldo en persona. | Preferencia adoptada; discrepancia contractual bloquea configuración |
| TEC-002 | Configurar depósito nativo desde el panel Wix como «depósito online y resto en persona»; no ofrecer pago manual alternativo ni aprobación manual. Mantener `fullUpfrontPaymentAllowed=false`. | Wix Help (25-03-2026) describe expresamente depósito online + resto presencial; API Services V2 exige `deposit=true`, `online=true`, `inPerson=false`. Interpretación: `inPerson=false` deshabilita el pago íntegro en persona, no el saldo de la modalidad depósito. Esta semántica debe confirmarse en QA. | Configuración objetivo definida; función y comportamiento de la cuenta pendientes de QA |
| TEC-003 | No combinar depósitos con aprobación manual de reservas. | Wix documenta incompatibilidad entre depósitos y aprobación manual. | Regla de configuración |
| TEC-004 | Clasificar precios y variantes antes de configurar depósitos. Si un servicio variable contiene variantes a ambos lados del umbral y Wix no permite condición por variante, separar la oferta nativamente. | Lectura live: 94 servicios, 70 FIXED, 24 NO_FEE, 0 VARIED; 7 visibles >100 EUR; 0 depósitos activos. | Clasificación completada; 7 servicios elegibles fijos |
| TEC-005 | Wix Stores Catalog V3 y las herramientas nativas Wix son la única autoridad operativa del stock comercial. | El checkout nativo valida disponibilidad y deduce inventario cuando el seguimiento está activado. | Aprobada |
| TEC-006 | No crear proyecciones CMS, reservas, deducciones, reposiciones, movimientos ni ajustes personalizados de stock. | Evitar doble autoridad, concurrencia y desincronización. | Aprobada; retirada de código pendiente |
| TEC-007 | Retirar módulo, WebMethods, proyecciones y UI custom; conservar solo protección append-only de históricos. | Dependencias de webhooks, panel y tests localizadas; webhooks desacoplados, UI retirada y módulo/test eliminados en rama de refactorización. | Implementado en rama; CI y QA Wix pendientes |
| TEC-008 | Los históricos `MovimientosInventario` existentes se preservan sin edición, borrado ni purga. No se insertan nuevos movimientos personalizados de stock. | La decisión de usar stock nativo no autoriza destruir evidencia histórica. | Aprobada |
| TEC-009 | El ledger fiscal/contable registra hechos económicos y rectificaciones trazables; no gobierna cantidades de stock. | Mantener separación entre economía/fiscalidad e inventario. | Aprobada |
| TEC-010 | La recuperación fiscal de pedidos pagados se limita a pedidos exclusivamente Bookings con payload fiscal original; pedidos Store/mixtos o legacy sin payload quedan en conciliación manual. | Evita reconstruir hechos fiscales incompletos o acoplar stock a ledger. Implementado en PR #235. | Fusionado; CI offline aprobada, runtime Wix pendiente |
| TEC-011 | No fusionar/publicar cambios críticos solo con CI offline; exigir pruebas positivas de integración/runtime, revisión de diff y rollback. | CI no certifica Velo runtime, webhooks reales ni Wix publicado. | Gate permanente |
| TEC-012 | Los cambios documentales se consolidan en ADR/registro central; PR #236 se mantiene draft hasta revisión del diff. | Trazabilidad y control de cambios. | PR abierto, 10 commits ahead / 0 behind, sin cambios ejecutables |
| TEC-013 | La configuración nativa de pedidos queda como autoridad del inventario; estado live `ON_ORDER_PAID`. | Wix Orders Settings GET, 2026-11-10, HTTP 200; sin mutaciones. | Verificado live; no se ha cambiado |
| TEC-014 | No activar depósitos hasta resolver discrepancia `inPerson` entre esquema REST Services V2 y Wix Help Center. | Esquema REST: `inPerson=false` con depósito; Wix Help: depósito online y resto en persona. | Bloqueo documentado; sin cambios en servicios |
| TEC-015 | La auditoría de Bookings detecta 7 servicios visibles >100 EUR y ningún depósito activo. | Query Services V2: 94 resultados, 70 FIXED, 24 NO_FEE, 0 VARIED, 0 depósitos. | Verificado live, solo lectura |
| TEC-016 | Los webhooks de pedido/pago/cancelación/reembolso no deben invocar writers de stock; cron marca todos los pedidos con referencias de catálogo completas sin distinguir Bookings/Stores/mixtos. | Wix Orders Settings `ON_ORDER_PAID`; Wix gestiona el stock y el cron solo conserva idempotencia. | Implementado en rama; CI pendiente |
| TEC-017 | No borrar ni mutar `MovimientosInventario` existente; conservar hooks `beforeUpdate`/`beforeRemove` append-only. | El histórico puede contener evidencia QA/operativa que debe preservarse. | Aprobado y conservado |
| TEC-019 | Usar `WIX_CATALOG_OWNER` como autoridad en marcador `ORDER_CREATED` para pedidos Bookings/Stores/mixtos. | `WIX_STORES_NATIVE` sería semánticamente incorrecto para pedidos Bookings. | Corrección en PR #241; CI run 42722015208 verde |
| TEC-020 | El restock se ejecuta exclusivamente por las opciones nativas Wix: `restockAllItems=true` al cancelar antes de fulfillment; `sideEffects.restock.lineItems` por línea/cantidad al reembolsar devoluciones reales. | Wix Cancel Order y Refund Payments exponen esos side effects explícitos; no hay writer custom. | Adoptada; verificación operativa pendiente |
| TEC-021 | No activar depósitos Bookings hasta que el SIF/Veri*Factu registre el anticipo, devengo de IVA, factura, aplicación del saldo y rectificación de devoluciones sin duplicidades. | LIVA art. 75.Dos y RD 1619/2012 art. 2.1; issue P0 #209. | BLOQUEO P0 fiscal |
| TEC-022 | En los 7 servicios elegibles, no ofrecer pago mediante planes/paquetes salvo que Wix demuestre que el anticipo obligatorio también se cobra en ese flujo. | Query Services V2: todos con `pricingPlanIds=[]`; `Pack Novia Completo` conserva `pricingPlan=true` pero sin IDs vinculados. | Pendiente de QA/configuración nativa; no hay planes actualmente vinculados |
| TEC-023 | Adoptar Wix Get Paid Invoices / Invoices V2 como objetivo futuro; no forzar la migración ni sustituir el servicio V1 hasta que Wix habilite la API nueva en el sitio y se superen los gates fiscales/operativos. | GetSiteContext: aplicación V1. `POST /invoices/v4/invoices/query`: HTTP 428 `INVOICES_API_UNAVAILABLE`. `GET /invoices/v4/invoices-settings`: HTTP 200. Wix documenta rollout gradual automático; SDK JavaScript: SDK universal Wix / REST oficial; no se confirma paquete npm independiente. Rutas REST `/invoices/v4`. | Objetivo aprobado; migración no disponible. Mantener V1 actual sin cambios. Veri*Factu y anticipos siguen bloqueados P0. |
| TEC-018 | La retirada del módulo custom está fusionada; runtime Wix y E2E nativo siguen siendo gates de despliegue. | PR #238 fusionado; run 42721311048 en commit 94974c: 50 suites, 488 tests, 0 fallos; SDK contracts y ESLint verdes. | CI offline verde (PR #238 y corrección PR #241); runtime Wix pendiente |

### Fuentes técnicas oficiales Wix

- [Bookings Services V2 — pagos y depósitos](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/about-service-payments)
- [Wix Bookings — cobrar depósito online y saldo en persona](https://support.wix.com/es/article/wix-bookings-seleccionar-c%C3%B3mo-cobrar-los-servicios-de-reservas)
- [Wix Bookings — disponibilidad de depósitos porcentuales](https://support.wix.com/es/article/solicitud-de-wix-bookings-dep%C3%B3sitos-basados-en-porcentajes)
- [Stores Catalog V3 — gestión nativa de inventario](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/about-inventory-management)
- [Stores — flujo de compra y deducción automática](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/online-store-product-purchase-flow)

## 3. Evidencia de decisiones y artefactos

- [ADR de depósitos e inventario nativo](adr/2026-11-10-deposit-and-native-inventory.md)
- [QA de retirada de inventario personalizado](qa/2026-11-10-native-inventory-retirement.md)
- [Necesidades web y criterios de aceptación](../NECESIDADES%20WEB%20MARIAN.txt)
- [Dossier técnico consolidado](../DOSSIER%20TÉCNICO%20CONSOLIDADO.md)
- [Flujos end-to-end Capa 1 → Capa 3](../DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md)
- [Estado del proyecto](PROJECT-STATUS.md)
- [PR #235 — recuperación fiscal idempotente de pedidos pagados](https://github.com/nachoortegazgz/marianmadridz/pull/235)
- [PR #236 — documentación de depósitos e inventario nativo](https://github.com/nachoortegazgz/marianmadridz/pull/236)

## 4. Estados de validación

- **Verificado:** Wix Stores deduce stock nativamente según el disparador configurado; en este sitio es `ON_ORDER_PAID`. Wix Bookings documenta capacidad nativa de depósitos, pero su esquema REST y Wix Help presentan una discrepancia sobre el método presencial.
- **Verificado en lectura:** el sitio usa Stores Catalog V3 y tiene 30 inventory items con tracking en una ubicación; no se ha probado E2E.
- **Verificado en rama de refactorización:** no hay módulo `inventario.web.js`, WebMethods ni panel custom; webhooks no realizan reservas, proyecciones ni movimientos de stock.
- **Pendiente:** confirmar en QA el flujo nativo depósito online + saldo presencial y disponibilidad de la función; resolver el bloqueo P0 de factura/IVA/ledger del anticipo (issue #209); solo después configurar los 7 servicios y probar pago/saldo/refund/ledger E2E.
- **No autorizado:** activar comunicaciones a clientes, cobros reales, cambios de datos o stock en producción y publicación.

---
*Actualizado 2026-11-10. Toda decisión futura que altere importes, umbrales, tratamiento de cancelaciones, autoridad de datos o contratos debe añadirse aquí y al ADR afectado.*
