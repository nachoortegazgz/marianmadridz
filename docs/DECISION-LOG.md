# Registro de decisiones — Marian Madrid

## Hito técnico — corrección de deployment backend (2026-11-14)

**CERRADO — CI PASS (offline)**

- PR #373 quedó integrada en `main` mediante merge `1b39ebb22c885f50320b7d52f5bc336cc0570ee5`; su CI inicial falló por el export ausente `assertMapaStaffRecord` y una aserción desactualizada de `CASH_REGISTER_STATUS`.
- PR correctiva #374: https://github.com/nachoortegazgz/marianmadridz/pull/374. SHA validado: `d95a69bc2d1292bb2d0ed714f1adf01e864a65aa`.
- CI sobre el HEAD de PR #374 (`da96c1b50f1910a287aea718bc6025d295e30e2b`): Layer 1 **24 suites / 307 tests PASS**; Layer 2 **19 suites / 252 tests PASS**; regresión completa **70 suites / 644 tests PASS**; Cart V2, Order Transactions y Bookings Reader V2 PASS; ESLint PASS; Gitleaks full-history PASS. La validación del merge commit está en ejecución.
- La corrección restaura `assertMapaStaffRecord`, mantiene `thirdPartyId` como TEXT opaco y corrige la regla de `CONFIG_SISTEMA.thirdPartyType = null`.
- PR #374 integrada en `main` mediante merge `1de381ecb6495e17a3eae5b75b43e8493166988a`.
- **Wix Runtime/E2E:** BLOCKED_ENVIRONMENT por falta de contexto QA resoluble. No se usó producción, no se publicó y no se ejecutaron escrituras CMS.
- **Discrepancia documental pendiente:** el diccionario CMS contiene un addendum de consolidación fiscal de MapaStaff (42 campos), mientras que el baseline y el código activo describen el contrato separado MapaStaff/DatosFiscales. No desplegar ni migrar ese contrato hasta reconciliar evidencia live, rama de implementación y retirada de DatosFiscales.


## Vigencia operativa — sitio aislado actual (2026-11-14)

**Sitio único:** 50b39f33-e753-4331-ab35-b2ed43dc97f7. El propietario declara que es un banco de pruebas aislado, sin actividad real. Los registros existentes se consideran sintéticos; no se mantiene una comparación operativa con otro sitio.

**Política de mutabilidad vigente (TEC-038):** los bypasses globales de update/remove y la ventana temporal append-only han sido retirados del código. Los ledgers de caja, contabilidad, fiscalidad, jornada, cierres y eventos webhook permanecen inmutables también en QA. Bulk update está deshabilitado. Bulk remove solo admite purgas de tipos efímeros/terminales en ControlOperativo, con condiciones exactas de tipo, estado y fecha; quedan excluidos WEBHOOK_EVENT, DEDUPE_KEY, LEDGER_IDEMPOTENCY y WEBHOOK_CLAIM. CajaActual solo cambia mediante el flujo backend autorizado y con movimiento fuente; no se borra.

**Vigencia:** TEC-038 ya ha cerrado los bypasses globales en código y restablecido append-only en QA. No reabrirlos mediante flags ni por conveniencia de pruebas. Cualquier cambio futuro de esta garantía exige una nueva decisión explícita, análisis legal/técnico y controles server-side; no se deriva de las antiguas TEC-033/035/036/037.

**Código:** la rama fix/current-site-cms-contract-alignment alinea MapaStaff como mapa de personal y DatosFiscales como maestro fiscal. CI, revisión de diff y pruebas Wix Editor/E2E están pendientes. La sincronización Editor↔Git no está acreditada.

## 1. Decisiones de negocio

| ID | Decisión | Autoridad | Estado / criterio |
|---|---|---|---|
| BUS-001 | Exigir depósito solo cuando el precio del servicio sea estrictamente superior a 100 EUR. A 100 EUR exactos no se exige. | Propietario, 2026-11-10 | Aprobado |
| BUS-002 | El depósito es fijo: 15 EUR. No es porcentaje. | Propietario, 2026-11-10 | Aprobado |
| BUS-003 | Los 15 EUR se descuentan del precio total; no son una tarifa adicional. Comercialmente se llama señal, pero al cobrarse a cuenta del servicio debe tratarse fiscalmente como anticipo. El saldo se liquida en el salón. | Propietario + Ley IVA/RD facturación | Aprobado como política; factura/IVA/ledger de anticipo bloquean activación |
| BUS-004 | Ventana ordinaria de cancelación/reprogramación gratuita: al menos 24 horas. Si el negocio cancela, devolución íntegra. | Política operativa recomendada, basada en patrones de centros comparables y la política Wix existente de 1440 minutos | Adoptada para diseño; configuración real pendiente |
| BUS-005 | No retener automáticamente el depósito por cancelación tardía o inasistencia hasta redactar condiciones claras y obtener revisión jurídica de proporcionalidad. | Decisión prudencial de cumplimiento | Bloqueo preventivo; no activa retenciones |
| BUS-006 | No activar automatizaciones que contacten clientes (email, SMS, WhatsApp, campañas o mensajes automáticos). | Propietario, instrucción expresa | Prohibición operativa temporal |
| BUS-007 | Durante la intervención del sitio aislado no realizar cargos reales, reservas de clientes, cambios de stock, escrituras CMS de producción ni publicación del sitio. | Alcance de autorización del propietario y controles del proyecto | Restricción activa |
| BUS-008 | En cancelaciones antes de envío/consumo, restock nativo completo en Wix si el producto sigue físicamente disponible. En reembolsos posteriores, restock solo de las unidades efectivamente devueltas y vendibles; nunca restock automático por el mero hecho de reembolsar. | Buenas prácticas de comercio minorista y opciones nativas explícitas de Wix. | Adoptada; SOP de staff y pruebas pendientes |

### Base comparativa y jurídica de BUS-001…BUS-005

- Centros de estética/servicios consultados publican señales fijas de 15 EUR o 20 EUR que se descuentan del precio y reglas de cancelación de 24 horas. Son ejemplos individuales de prácticas comerciales, no una muestra estadística ni una norma jurídica: [Adara Essence](https://adaraessenceestetica.com/wp-content/uploads/2025/06/Carta-NUEVA-CAST.pdf), [Beassence](https://www.beassence.es/politicas), [Espai Gassó](https://www.espaigasso.com/politica-reservas-cancelaciones-y-devol).
- El texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios exige que las condiciones no creen desequilibrio importante ni impongan indemnizaciones desproporcionadas; el art. 62 también limita cargas onerosas/desproporcionadas en la terminación contractual. Por ello no se aprueba una cláusula de pérdida automática del depósito sin revisión: [BOE — RDL 1/2007, arts. 62 y 82](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
- El Código Civil regula cláusulas penales y libertad de pactos dentro de los límites legales: [BOE — Código Civil, arts. 1152–1155 y 1255](https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763). La política final debe ser revisada por asesoría jurídica; este registro no es dictamen legal.
- Al ser un pago a cuenta del servicio, el IVA se devenga al cobrar el anticipo por el importe efectivamente recibido (LIVA art. 75.Dos) y debe emitirse factura por pagos anticipados (RD 1619/2012 art. 2.1): [LIVA](https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740), [Reglamento de facturación](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).

## 2. Decisiones técnicas

| ID | Decisión | Justificación / consecuencia | Estado |
|---|---|---|---|
| TEC-001 | Wix Bookings nativo es la primera opción para depósitos. No crear writer/checkout propio mientras la capacidad nativa cubra el caso. | Wix Services V2 documenta depósitos por servicio. Sin embargo, el esquema REST actual declara `inPerson=false` con `deposit=true`, mientras Wix Help indica depósito online y saldo en persona. | Preferencia adoptada; discrepancia contractual bloquea configuración |
| TEC-002 | Configurar depósito nativo desde el panel Wix como «depósito online y resto en persona»; no ofrecer pago manual alternativo ni aprobación manual. Mantener `fullUpfrontPaymentAllowed=false`. | Wix Help (25-03-2026) describe expresamente depósito online + resto presencial; API Services V2 exige `deposit=true`, `online=true`, `inPerson=false`. Interpretación: `inPerson=false` deshabilita el pago íntegro en persona, no el saldo de la modalidad depósito. Esta semántica debe confirmarse en Wix Editor. | Configuración objetivo definida; función y comportamiento de la cuenta pendientes de pruebas |
| TEC-003 | No combinar depósitos con aprobación manual de reservas. | Wix documenta incompatibilidad entre depósitos y aprobación manual. | Regla de configuración |
| TEC-004 | Clasificar precios y variantes antes de configurar depósitos. Si un servicio variable contiene variantes a ambos lados del umbral y Wix no permite condición por variante, separar la oferta nativamente. | Lectura live: 94 servicios, 70 FIXED, 24 NO_FEE, 0 VARIED; 7 visibles >100 EUR; 0 depósitos activos. | Clasificación completada; 7 servicios elegibles fijos |
| TEC-005 | Wix Stores Catalog V3 y las herramientas nativas Wix son la única autoridad operativa del stock comercial. | El checkout nativo valida disponibilidad y deduce inventario cuando el seguimiento está activado. | Aprobada |
| TEC-006 | No crear proyecciones CMS, reservas, deducciones, reposiciones, movimientos ni ajustes personalizados de stock. | Evitar doble autoridad, concurrencia y desincronización. | Aprobada; retirada de código pendiente |
| TEC-007 | Retirar módulo, WebMethods, proyecciones y UI custom; conservar solo protección append-only de históricos. | Dependencias de webhooks, panel y tests localizadas; webhooks desacoplados, UI retirada y módulo/test eliminados en rama de refactorización. | Implementado en rama; CI y pruebas Wix Editor pendientes |
| TEC-008 | Los históricos `MovimientosInventario` existentes se preservan sin edición, borrado ni purga. No se insertan nuevos movimientos personalizados de stock. | La decisión de usar stock nativo no autoriza destruir evidencia histórica. | Aprobada |
| TEC-009 | El ledger fiscal/contable registra hechos económicos y rectificaciones trazables; no gobierna cantidades de stock. | Mantener separación entre economía/fiscalidad e inventario. | Aprobada |
| TEC-010 | La recuperación fiscal de pedidos pagados se limita a pedidos exclusivamente Bookings con payload fiscal original; pedidos Store/mixtos o legacy sin payload quedan en conciliación manual. | Evita reconstruir hechos fiscales incompletos o acoplar stock a ledger. Implementado en PR #235. | Fusionado; CI offline aprobada, runtime Wix pendiente |
| TEC-011 | No fusionar/publicar cambios críticos solo con CI offline; exigir pruebas positivas de integración/runtime, revisión de diff y rollback. | CI no certifica Velo runtime, webhooks reales ni Wix publicado. | Gate permanente |
| TEC-012 | Los cambios documentales se consolidan en ADR/registro central; PR #236 se mantiene draft hasta revisión del diff. | Trazabilidad y control de cambios. | PR abierto, 10 commits ahead / 0 behind, sin cambios ejecutables |
| TEC-013 | La configuración nativa de pedidos queda como autoridad del inventario; estado live `ON_ORDER_PAID`. | Wix Orders Settings GET, 2026-11-10, HTTP 200; sin mutaciones. | Verificado live; no se ha cambiado |
| TEC-014 | No activar depósitos hasta resolver discrepancia `inPerson` entre esquema REST Services V2 y Wix Help Center. | Esquema REST: `inPerson=false` con depósito; Wix Help: depósito online y resto en persona. | Bloqueo documentado; sin cambios en servicios |
| TEC-015 | La auditoría de Bookings detecta 7 servicios visibles >100 EUR y ningún depósito activo. | Query Services V2: 94 resultados, 70 FIXED, 24 NO_FEE, 0 VARIED, 0 depósitos. | Verificado live, solo lectura |
| TEC-016 | Los webhooks de pedido/pago/cancelación/reembolso no deben invocar writers de stock; cron marca todos los pedidos con referencias de catálogo completas sin distinguir Bookings/Stores/mixtos. | Wix Orders Settings `ON_ORDER_PAID`; Wix gestiona el stock y el cron solo conserva idempotencia. | Implementado en rama; CI offline verde en run 43102321871: 62 suites, 579 tests, 0 fallos; contratos SDK y ESLint verdes. Runtime Wix pendiente |
| TEC-017 | No borrar ni mutar `MovimientosInventario` existente; conservar hooks `beforeUpdate`/`beforeRemove` append-only. | El histórico puede contener evidencia de pruebas/operativa que debe preservarse. | Aprobado y conservado |
| TEC-019 | Usar `WIX_CATALOG_OWNER` como autoridad en marcador `ORDER_CREATED` para pedidos Bookings/Stores/mixtos. | `WIX_STORES_NATIVE` sería semánticamente incorrecto para pedidos Bookings. | Corrección en PR #241; CI run 42722015208 verde |
| TEC-020 | El restock se ejecuta exclusivamente por las opciones nativas Wix: `restockAllItems=true` al cancelar antes de fulfillment; `sideEffects.restock.lineItems` por línea/cantidad al reembolsar devoluciones reales. | Wix Cancel Order y Refund Payments exponen esos side effects explícitos; no hay writer custom. | Adoptada; verificación operativa pendiente |
| TEC-021 | No activar depósitos Bookings hasta que el SIF/Veri*Factu registre el anticipo, devengo de IVA, factura, aplicación del saldo y rectificación de devoluciones sin duplicidades. | LIVA art. 75.Dos y RD 1619/2012 art. 2.1; issue P0 #209. | BLOQUEO P0 fiscal |
| TEC-022 | En los 7 servicios elegibles, no ofrecer pago mediante planes/paquetes salvo que Wix demuestre que el anticipo obligatorio también se cobra en ese flujo. | Query Services V2: todos con `pricingPlanIds=[]`; `Pack Novia Completo` conserva `pricingPlan=true` pero sin IDs vinculados. | Pendiente de configuración nativa y validación; no hay planes actualmente vinculados |
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
- [prueba de retirada de inventario personalizado](qa/2026-11-10-native-inventory-retirement.md)
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
- **Pendiente:** confirmar en el sitio aislado el flujo nativo depósito online + saldo presencial y disponibilidad de la función; resolver el bloqueo P0 de factura/IVA/ledger del anticipo (issue #209); solo después configurar los 7 servicios y probar pago/saldo/refund/ledger E2E.
- **No autorizado:** activar comunicaciones a clientes, cobros reales, cambios de datos o stock en producción y publicación.

---
*Actualizado 2026-11-10. Toda decisión futura que altere importes, umbrales, tratamiento de cancelaciones, autoridad de datos o contratos debe añadirse aquí y al ADR afectado.*


## 5. Decisiones y aclaraciones posteriores — 2026-11-11

Las siguientes decisiones/contratos se incorporan después de la consolidación inicial. Se distingue la instrucción de negocio de la implementación y de su validación.

| ID | Decisión / contrato | Autoridad | Estado |
|---|---|---|---|
| BUS-009 | El saldo físico de CajaActual refleja únicamente flujos que atraviesan físicamente el cajón: cobros en efectivo en el local, entradas/salidas de efectivo, pagos locales a proveedores en efectivo, retiradas, devoluciones en efectivo y ajustes justificados. El resumen de sesión puede mostrar operaciones presenciales no monetarias sin alterar ese saldo físico. | Propietario, 2026-11-11; aclaración 2026-11-13 | Vigente con alcance delimitado por TEC-032 |
| TEC-024 | Separar tres conceptos: MovimientosCaja conserva su contrato de registro fiscal de operaciones; CajaActual es una proyección mutable de la sesión operativa y del saldo físico del cajón; LibroAsientosContablesDetalle consolida los hechos económicos. Una operación puede generar registros en las capas correspondientes sin que estas se confundan. | Arquitectura / aclaración del propietario; ampliada por TEC-032 | Vigente, ampliada |
| TEC-025 | Tarjeta, Bizum, online, transferencias y pagos desde banco no alteran el saldo de efectivo físico. La exclusión absoluta de esos medios del resumen de CajaActual queda supersedida por TEC-032: los cobros presenciales con tarjeta y Bizum se reflejan en acumulados y última operación, sin modificar el efectivo físico. | Propietario, 2026-11-11 | Parcialmente vigente; alcance de proyección supersedido por TEC-032 |
| TEC-026 | La proyección física no debe deducirse solo de paymentMethod si el contrato no expresa también el canal y el efecto físico. La dirección IN/OUT/NONE debe derivarse en backend de tipos/contexto confiables; el frontend no puede decidirla. | Recomendación técnica | Pendiente de contrato completo y esquema |
| TEC-027 | ServiciosCatalogo es la SSOT declarada para la configuración de servicios sincronizada con Wix Bookings. name está vinculado a Complementos catálogo para los complementos del servicio; staffMembers define el personal elegible para el servicio. La disponibilidad horaria real continúa dependiendo de horarios, bloqueos y reservas nativas de Bookings. | Propietario, 2026-11-11 | Requisito de negocio declarado; implementación y sincronización pendientes de auditoría |
| TEC-028 | La proyección de una reserva nativa debe ser idempotente y preservarse el estado más avanzado frente a eventos tardíos. | Implementación PR #280/#281 | Integrado en esas PR; CI offline verde; runtime Wix pendiente |
| TEC-032 | `MovimientosCaja` conserva cada ticket/movimiento original como ledger append-only. `CajaActual` es una proyección mutable de sesión: mantiene el resumen de la última operación, acumulados de la sesión por medio de pago y el saldo de efectivo físico por separado. La última operación incluye actor resuelto en backend, instante exacto, conceptos/unidades cuando estén validados, importes, huella y trazabilidad, y referencias a los `_id` de los movimientos fuente. Los cobros PRESENCIAL con TARJETA o BIZUM actualizan resumen/acumulados de sesión, pero no `cashAmount` ni el saldo físico; solo los movimientos con efecto físico explícito actualizan ese saldo. Los movimientos ONLINE y los pagos bancarios no se incorporan a la sesión física salvo decisión posterior. No se duplica ni reescribe el ticket fuente. | Propietario, 2026-11-13; recomendación técnica aceptada | Decisión aprobada; contrato CMS/backend y pruebas pendientes |

### Caja física — alcance exacto de la implementación actual

La PR #284 (fix(caja): project only explicit physical cash movements) implementa una primera restricción: _updateCajaActual() solo proyecta paymentMethod=EFECTIVO y channelType=PRESENCIAL. Los movimientos no físicos no alteran saldo, contadores ni appliedMovementIds; netAmount deriva de cashAmount; registerManualTransaction() valida y persiste el channelType canónico cuando el consumidor lo proporciona.

**Límite importante:** esta PR no implementa todavía el clasificador completo IN/OUT/NONE. Los tipos APORTACION, RETIRO y PAGO_PROVEEDOR no forman parte del enum actual; AJUSTE no determina por sí solo la dirección. No añadirlos sin contrato fiscal/contable, validación, esquema CMS y pruebas. Tampoco se automatizan asientos PGC sin mapeos aprobados.

La PR #284 está abierta como draft, sin merge ni despliegue Wix. Su CI final documentada (run 42973918957, commit 9523abd151566cc84665992d4cb581168be1d3ae) pasó 53 suites y 530 tests, contratos Wix SDK, Bookings Reader V2 y ESLint. No se ejecutó Wix Local Editor ni E2E visual publicado.

### Reservas — incidente de proyección

El 2026-11-11 se creó una única reserva sintética nativa autorizada (213a10f1-9d4e-44ed-b682-a459bd7ed88d) para el 2026-11-12 a las 09:00 Europe/Madrid, servicio Corte Clásico y recurso Alba Staff. Wix devolvió estado CONFIRMED, pago OFFLINE, sin pedido/cargo. Dos lecturas posteriores no encontraron proyección correspondiente en CitasF2 ni marcador WEBHOOK_EVENT en ControlOperativo.

La causa permanece **no determinada**: posible divergencia entre código publicado y repositorio, evento no entregado o fallo del handler/persistencia. No hay acceso verificable a logs runtime ni al SHA exacto publicado. No cancelar, reparar, hacer backfill ni crear otra reserva de prueba hasta aislar el fallo. Se preserva la anotación histórica de prueba a8a8bde9-44d6-4fea-b04c-3bf89c1ff84c y la reserva sintética.

### Estado de ServiciosCatalogo

El propietario declara que ServiciosCatalogo gobierna la configuración de servicios en Wix Bookings, incluyendo complementos relacionados con Complementos catálogo y personal elegible mediante staffMembers. A fecha de esta actualización esto es un **contrato declarado**, no una sincronización técnicamente verificada. Antes de modificarlo deben revisarse esquemas live, IDs, todos los consumidores/escritores, contratos oficiales Bookings, triggers, estrategia de reconciliación e idempotencia. Retirar un staff de un servicio no implica eliminar su perfil, horario general ni reservas históricas.

### Otras verificaciones y límites recientes

- DatosFiscales: permisos efectivos configurados como PRIVILEGED en lectura/escritura/borrado y verificados mediante read-after-write. Persiste discrepancia entre esquema CMS (active) y validadores/contratos del código; no corregir por inferencia.
- Caja singleton: estado SIMULACION, apertura marcada en 300 EUR atribuida a Marian; no es una apertura real ni debe tratarse como saldo físico conciliado. Los registros sintéticos y los ledgers históricos se preservan.
- Wix Bookings: staff Marian, Andrea y Alba contrastados con sus perfiles, recursos y schedules; esto no acredita disponibilidad en cualquier franja.
- Capa 3: sigue siendo arquitectura objetivo; no se ha demostrado tenant M365 auditado, flujos Power Automate activos ni E2E hacia SharePoint.
- El contrato AEAT/hash interno no certifica Veri*Factu. La remisión sigue bloqueada hasta completar el SIF, series, facturación, XML/XSD, transporte, respuestas y revisión legal.

---
*Esta sección registra decisiones y estado a 2026-11-11. No equivale a autorización de despliegue ni a validación en producción.*

## 6. Decisión técnica — paginación de Bookings Staff Members (2026-11-11)

| ID | Decisión | Justificación / consecuencia | Estado |
|---|---|---|---|
| TEC-030 | Si `queryStaffMembers` conserva `pagingMetadata.cursors.next` al alcanzar el límite defensivo de 20 páginas, la consulta debe fallar con `STAFF_PAGINATION_LIMIT_EXCEEDED`; nunca se devuelve el subconjunto como si fuera completo. Los resolvers mantienen el comportamiento fail-closed y registran el código del error. | El límite de 2.000 perfiles es una protección de coste/tiempo, no una prueba de que existan menos perfiles. Un cursor pendiente demuestra que el resultado está truncado. Se conserva el límite y se hace explícita la truncación. | Implementado en rama; CI pendiente |

**Decisión de alcance:** no se elimina el límite ni se amplía por conjetura. Tampoco se cambia el contrato público (`null`/`[]`) ni la autorización. Los errores de consulta siguen denegando la resolución de identidad; el log interno añade `errorCode` para diferenciar un fallo técnico de un directorio realmente vacío. La prueba sintética verifica que ni `findStaffByResourceId()` ni `listStaff()` devuelven la fila parcial cuando queda un cursor después de la página 20.

**Reversión:** revertir el commit de esta tanda restaura el comportamiento previo sin tocar datos CMS ni configuración Wix.


## 7. Decisión técnica — contrato CMS Date and Time (2026-11-11)

| ID | Decisión | Justificación / consecuencia | Estado |
|---|---|---|---|
| TEC-031 | Los campos CMS `DATETIME` se normalizan en el hook de escritura a objetos JavaScript `Date`, conservando el instante recibido. Los campos CMS `DATE` continúan siendo cadenas `YYYY-MM-DD`; no se convierten a `Date`. | Evita persistir cadenas ISO en campos Date and Time y evita desplazar horas por conversiones regionales. Se aplica a los hooks existentes de `CajaActual`, `MovimientosCaja`, `ControlOperativo`, `HistoricoCierresZ`, `PaquetesGestoria` y todos los campos DateTime de `CitasF2`; `RegistrosHorariosStaff.recordedAt` ya estaba normalizado. | Implementado en rama; CI pendiente |

**Evidencia de auditoría live:** 44 colecciones CMS inventariadas, 15 `NATIVE`. `CajaActual.openedAt` está informado; los vacíos de `closedAt`/`lastMovementAt` se observaron en una caja `SIMULACION` y no se rellenan. Cuatro movimientos `SMOKE_TEST`, un asiento contable `SMOKE_TEST` y dos fichajes sintéticos sin firma se conservan sin modificación. Los valores ausentes en registros append-only no se reconstruyen ni se sobrescriben.

**Contrato de representación:** Wix documenta Date and Time en el formato JSON `{"$date":"YYYY-MM-DDTHH:mm:ss.sssZ"}`. En código Velo el límite de escritura utiliza `Date`; la respuesta REST puede serializarlo como ISO 8601. La normalización no altera el instante y no aplica `Europe/Madrid` como conversión adicional. Los campos `DATE` (`fechaOperacion`, `fechaExpedicionFactura`, `operationDate`) permanecen en su contrato de fecha sin hora.

**Separación del writer fiscal:** `eventLog.js` mantiene la estructura de fecha local requerida dentro de `payloadFiscal`, pero escribe `recordTimestamp` y `generationTimestamp` del documento CMS como objetos `Date`. No se reutiliza un objeto de componentes de fecha como valor de un campo CMS Date and Time.

**Reversión:** revertir los cambios de hooks y pruebas de esta rama restaura el contrato previo sin modificar datos CMS. No hay despliegue ni limpieza de datos asociada.


## 8. Reconciliación del informe de bugs — 2026-11-12

La auditoría estática recibida se ha contrastado con `main` en `9f3b4366aacc720f6712ab47ac828af94fc63cff`, el estado Wix live consultado y los contratos oficiales vigentes. No se han tratado las hipótesis como hechos ni se han realizado escrituras Wix/CMS.

| Bug | Resultado de reauditoría | Decisión |
|---|---|---|
| 01 — `FISCAL_RUNTIME_POLICY` cerrado | Flag deliberado y documentado como fail-closed; el informe confunde bloqueo de seguridad con defecto. | Mantener cerrado hasta certificación runtime y gates fiscales. |
| 02 — Proyección Bookings → `CitasF2` | Código de handlers `BOOKING_CREATED` y `BOOKING_CONFIRMED` y proyector idempotente existen en main. Incidente de reserva sintética sin marcador sigue sin causa runtime demostrada. | Mantener como incidente abierto; revisar entrega/event logs y SHA publicado solo en entorno aislado. No crear otra reserva de prueba. |
| 03 — `CajaActual` SIMULACION | Estado sintético documentado; el guard evita mezclarlo con operación real. | No resetear ni borrar saldo sin inventario, conciliación y autorización específica. |
| 04 — writers de jornada deshabilitados | Flag deliberado hasta idempotencia, serialización por empleado/día y transiciones concurrentes. El flag por sí solo no demuestra incumplimiento legal si existe otro sistema de registro válido. | Mantener fail-closed; certificar el sistema completo y revisar alternativa laboral vigente. |
| 05 — remitente Resend `.com` | Confirmado en `internalConfig.js`; el informe no aporta evidencia verificable de que `noreply@marianmadrid.es` esté verificado en Resend. | Corregir solo después de lectura del dominio/identidad verificada en Resend. No cambiar remitente por inferencia. |
| 06 — envío a gestoría deshabilitado | Flag deliberado, dependiente de entrega persistente e idempotente. | Mantener deshabilitado hasta pruebas aisladas de despacho y reconciliación. |
| 07 — proyección de efectivo físico parcial | Confirmado como alcance parcial. BUS-009 define qué debe reflejar CajaActual; TEC-026 deja pendiente clasificador confiable IN/OUT/NONE. PR #284 es parcial y no está integrada según la documentación del repositorio. | No añadir tipos ni mutar saldos hasta cerrar enums, validación, esquema, mapping contable y pruebas. |
| 08 — sincronización ServiciosCatalogo/Bookings | TEC-027 registra SSOT declarada por el propietario; sincronización técnica pendiente de auditoría. | No cambiar la autoridad ni inventar sincronización. Auditar contratos y mecanismo de reconciliación antes de implementar. |
| 09 — automatizaciones email nativas | Reauditoría de PR #296 documenta nueve automatizaciones email activas con diez acciones; el backend Resend no las controla. | Mantener bloqueado E2E de reservas sobre Published; no desactivar automatizaciones ni clonar sitio sin autorización/decisión de entorno. |
| 10 — `CHECKOUT_MS` | Defecto confirmado: consumidor lee una clave inexistente y cae a literal local. | Corregido y fusionado mediante PR #300: timeout 20.000 ms centralizado en `SDK_CONFIG.TIMEOUTS.CHECKOUT_MS`, fallback local retirado y test añadido. |
| 11 — `CORRECTION_REASON.NUMERO_SERIE` | Export zombie: no hay consumidor ejecutable; `events.js` documenta expresamente que el motivo vigente es `OTRAS`. | Corregido y fusionado mediante PR #300: se elimina la clave sin consumidor y se añade test negativo. |
| 12 — reconstrucción fiscal de pedidos sin `taxInfo` | El código exige información fiscal de pedido y línea; la alternativa sugerida de reconstruir IVA desde catálogo no está acreditada y puede alterar el tratamiento fiscal de anticipos/depósitos. | Mantener revisión manual/fail-closed hasta disponer de payload real, contrato fiscal aprobado y prueba aislada. |
| 13 — aliases históricos de fecha | El cierre consulta campo canónico y alias histórico, deduplica por `_id` y ordena por secuencia. El alias puede proteger registros históricos. | No retirar sin auditoría de todos los registros históricos y plan de migración trazable. |
| 14 — `.contains()` | Falso en el HEAD auditado: `getMovimientoByBooking` usa `hasSome` para arrays y `eq` para compatibilidad exacta; no contiene la tercera query descrita. | Sin cambio. |
| 15 — `LEDGER_IDEMPOTENCY` sin purga | La exclusión de la purga corta es intencional: es claim durable, tiene writer activo y se excluye expresamente de la limpieza de 24 h. | No añadir a purga de 90 días ni reutilizar `IDEMPOTENCY`; sería una regresión de idempotencia. |
| 16 — lecturas fuertes DAL | Falso: DAL traduce `consistencyMode: "strong"` a `consistentRead: true`, el contrato documentado por Wix Data. | Sin cambio; se conserva la traducción y su política. |
| 17 — `previousRecordHash` | No es bug: el payload de la cadena interna usa la huella anterior como entrada del movimiento actual; el comentario de código separa explícitamente este contrato del hash AEAT. | Sin cambio de semántica fiscal. |
| 18 — PR #296 | PR #296 continúa Draft y pendiente de revisión; no debe fusionarse automáticamente. PR #299 sí está integrada en main (merge commit actual). | Mantener #296 separada hasta revisión documental y CI de su HEAD. |
| 19 — `DUAL_CACHE` | No hay writer activo para snapshots nuevos, pero existe cron de limpieza defensiva de registros expirados y datos legacy potenciales. No se ha probado cero filas live. | Mantener cleanup hasta consulta live read-only y análisis histórico; no retirar solo por ausencia de writer. |
| 20 — Node.js Wix CLI | Requisito oficial Wix CLI for Sites: Node.js 24.22.1 o superior. El workflow ya usa 24.22.1 y README lo declara. No se ha comprobado la versión del equipo local en esta auditoría. | Contrato de CI/documentación correcto; comprobar entorno local antes de ejecutar CLI. |

### Cambios de código aplicados en PR #300 y fusionados en `main`

- `SDK_CONFIG.TIMEOUTS.CHECKOUT_MS = 20000` pasa a ser la única fuente de timeout de checkout; se elimina el literal fallback de `bookingCore.js`.
- Se retira `CORRECTION_REASON.NUMERO_SERIE`, sin consumidores funcionales; `OTRAS` permanece como valor utilizado por `events.js`.
- Se añaden pruebas de regresión para ambos contratos.

### Estado operativo y límites

- Wix live: Published; Wix Editor clásico, Velo habilitado, Stores Catalog V3, Invoices V1, zona `Europe/Madrid`, moneda EUR (lectura de contexto 2026-11-12).
- PR #299 ya está integrada en main; por tanto, la anotación histórica de que seguía Draft ha quedado superada.
- Las automatizaciones email nativas activas impiden considerar aisladas las pruebas runtime de reservas en el sitio publicado.
- No se han creado reservas/pedidos/pagos, enviado comunicaciones, ejecutado automatizaciones, modificado CMS ni cambiado configuración Wix.
- PR #300 se fusionó en `main` mediante `c508c69dc9788c8b93b8fc4cbc0c89b2554e6fff`.
- CI sobre el HEAD validado de PR `a8f04705872a120f31fb9dc25c984a7148830eb5`: suite offline completa, contratos SDK Wix, ESLint y Gitleaks finalizaron con `success` (runs `43123426512` y `43123426492`). No se encontraron runs asociados directamente al merge commit.
- No se declara Wix Runtime/Preview/E2E ni publicación; la fusión GitHub no implica despliegue Wix.


## 9. Reauditoría de correcciones pendientes — 2026-11-12

**HEAD auditado:** `ea65ad1f54bdf1389ee7c598fc726dc223c44a22`.

- La CI de ese HEAD ejecutó **62 suites / 584 tests / 0 fallos**; contratos SDK Wix, ESLint y Gitleaks también finalizaron correctamente (runs `43124945971` y `43124945757`).
- PR #289 ya integra los claims de webhooks y el borrado CMS condicionado. #159, #164 y #237 tienen sus correcciones de código integradas; sus pendientes son runtime/consumidores externos, no defectos offline reproducidos.
- #162 sigue sin reconciliador específico del journal dual; mantener la reparación fail-closed hasta disponer de comparación exacta Bookings Reader V2 + proyección CMS y reclamación CAS segura.
- #173 sigue sin pipeline Capa 3 verificable; no implementar Resend/SharePoint/Power Automate sin credenciales, destinos, propietarios y contratos externos comprobados.
- #209 mantiene bloqueo P0 fiscal. #223 mantiene el despacho a gestoría deshabilitado; snapshot trimestral está implementado, pero mensualidad y evidencia durable de despacho siguen pendientes.
- #224 mantiene los escritores de jornada/caja deshabilitados. #261 requiere revisión y validación de permisos CMS antes de modificar configuración live.
- #188 y #211 requieren runtime del sitio aislado aislado; no se ejecutan reservas, pagos, reembolsos ni comunicaciones en producción.
- #210: la API de GitHub confirma `main.protected=false`, protección deshabilitada y ningún ruleset. La conexión disponible es de lectura para rulesets/protección; esta configuración debe aplicarla un administrador del repositorio. No se ha cambiado.
- #290, #291 y #237 no deben interpretarse como correcciones pendientes de código: sus issues permanecen abiertas exclusivamente por los gates runtime descritos en sus respectivos registros.

**Decisión:** no introducir cambios adicionales de lógica en esta reauditoría. No hay fallo offline reproducido y los pendientes requieren evidencia runtime, autorización de configuración, contratos externos o definición fiscal/operativa. Mantener las protecciones fail-closed.

### CajaActual — interpretación vigente tras TEC-032 (2026-11-13)

La decisión TEC-032 amplía el alcance de la proyección sin convertirla en ledger ni confundir cobros con efectivo físico:

- `MovimientosCaja` es la fuente histórica de cada ticket/movimiento. Cada registro es append-only; las rectificaciones se incorporan como nuevos registros trazables.
- `CajaActual` mantiene el estado actual de la sesión, el resumen de la última operación y acumulados de sesión por medio de pago. Debe conservar referencias a los `_id` de los movimientos fuente, no copias históricas de todos los tickets.
- El último resumen debe poder presentar operador autenticado resuelto en backend, fecha/hora exacta, tipo y descripción de operación, conceptos/unidades validados, importes, desglose de pago, `hash`, `previousRecordHash`, `sequenceNumber`, `recordTimestamp`, `digitalSignature` y `traceId`, siempre que existan en el movimiento fuente. No se fabrican valores ausentes.
- Los cobros presenciales con `TARJETA` y `BIZUM` actualizan la actividad y los acumulados de sesión, pero nunca el saldo físico de efectivo. `cashAmount`/`expectedCash` solo cambian por movimientos con efecto físico explícito y validado.
- Los movimientos `ONLINE`, transferencias y pagos desde banco quedan en sus ledgers correspondientes; no se incorporan a la sesión física por inferencia.
- `paymentMethod` es actualmente singular en `MovimientosCaja`. No se inventa un contrato para pagos mixtos: antes de aceptarlos debe definirse cómo se representa el desglose y cómo se reconcilia exactamente con el total y con los movimientos fuente.

Esta decisión es contractual/documental. No acredita que el backend o el esquema CMS ya estén adaptados. La implementación requiere auditoría de consumidores, contrato de proyección, migración compatible, idempotencia y pruebas de regresión/concurrencia.

### TEC-032 — progreso de alineación backend/frontend (2026-11-13)

**Implementado en esta rama, pendiente de CI y revisión:**
- `registerManualTransaction` exige canal explícito para operaciones manuales; solo infiere `ONLINE` para `VENTA_ONLINE` o `WIX_PAYMENTS`. En `PRESENCIAL`, `staffResourceId` y la clave de rate limit se derivan de `getMyStaffContext()`; el `resourceId` del navegador se ignora.
- `_updateCajaActual()` proyecta `EFECTIVO`, `TARJETA` y `BIZUM` presenciales en una sesión ya abierta. El efectivo modifica `cashAmount`; tarjeta y Bizum actualizan `cardAmount` y `voucherAmount`. `netAmount` continúa representando exclusivamente efectivo físico.
- La proyección no crea ni abre un singleton automáticamente. Caja inexistente, cerrada, simulada o sin `openedAt` devuelve proyección pendiente y encola reconciliación; no altera el saldo.
- `getCashierState()` calcula importes y número de movimientos por medio de pago desde `MovimientosCaja` dentro de la ventana de sesión, y entrega la última operación con ID fuente, actor resuelto, instante, importes, hash anterior/hash, secuencia, firma y traceId. El HTML de ZONA MARIAN presenta esos datos y separa el efectivo físico de los cobros de sesión.
- El cierre Z manual persiste `closedBy` en `CajaActual` a partir del contexto autenticado del backend. No se admite un actor enviado por el frontend.

**Pendiente / no implementado:** `CajaActual` aún no persiste un campo dedicado `lastMovementId` ni un snapshot completo de última operación; el detalle y la referencia se reconstruyen en el DTO de lectura desde el ledger. Los contadores por método también se calculan desde `MovimientosCaja`. No existe todavía WebMethod seguro de apertura que establezca `openedBy/openedAt` ni un procedimiento de saldo inicial reconciliado. `lineItems` sigue sin contrato interno; conceptos/unidades no se exponen. Pagos mixtos siguen bloqueados. No se ha migrado el esquema CMS.

**Gates intactos:** `LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`; la caja `SIMULACION` permanece bloqueada. Esta rama no escribe CMS live ni publica Wix.

Para los movimientos presenciales manuales nuevos, backend asigna `recordSource=MANUAL_PRESENCIAL_AUTHENTICATED` y resuelve `staffResourceId` desde la identidad autenticada. La UI solo marca el operador como verificado cuando el origen contiene esa marca backend; los registros históricos se identifican como autoría no verificada.


### TEC-033 — [HISTÓRICA / SUPERSEDIDA POR TEC-038] ventana temporal de mutación de ledgers append-only (2026-11-14)

**Decisión temporal solicitada:** abrir en la rama de desarrollo una ventana global que permite operaciones individuales de actualización y borrado sobre los registros que el proyecto protegía como append-only. El alcance de código incluye:
- `MovimientosCaja`
- `LibroAsientosContablesDetalle`
- `RegistrosHorariosStaff`
- `MovimientosInventario`
- `HistoricoCierresZ`
- `PaquetesGestoria`
- `ControlOperativo` cuando `controlType=WEBHOOK_EVENT`

**Implementación:** `APPEND_ONLY_MUTATION_WINDOW.ENABLED=true` en `src/backend/internalConfig.js`; hooks Velo en `src/backend/data.js` y allowlists de `src/backend/dataAccessPolicy.js` alineados. Las validaciones de esquema de inserción siguen activas. Las operaciones masivas siguen bloqueadas; la excepción no autoriza bulk update/remove. Los tipos mutables de `ControlOperativo` conservan sus restricciones de contrato y el campo `controlType` no puede cambiar.

**Límite de la ventana TEC-033:** la excepción de hooks/políticas existe solo en código de la rama draft; no se ha aplicado al runtime Wix ni a permisos CMS. Los permisos de colección y las autorizaciones backend siguen siendo capas independientes; la edición desde CMS UI no queda garantizada por esta bandera.

**Cambios CMS live independientes, ejecutados el 2026-11-14 bajo autorización expresa:** se creó `CajaActual` como NATIVE revisión 3 con 25 campos de negocio y permisos ADMIN; se insertó un único `CAJA_PRINCIPAL` cerrado, con saldos actuales a cero y saldos iniciales null; se dejó ACTIVE el índice único de `singletonKey` y se sustituyó el índice compuesto obsoleto por `cashRegisterStatus_operationDateHour` (ACTIVE en readback final). Se eliminaron por ID dos registros de `RegistrosHorariosStaff` que acreditaban `meta.synthetic=true`, `doNotImportToProduction=true`, `QA_STAFF_ONLY` y notas de empleado ficticio; readback posterior: cero filas. No se tocaron movimientos de caja, asientos, cierres Z, paquetes ni registros de ControlOperativo. No se cambiaron permisos, automatizaciones ni publicación. Esta limpieza puntual no autoriza otros borrados sin identificación y revisión equivalentes.

**Reversión obligatoria:** antes de cualquier despliegue productivo, establecer `APPEND_ONLY_MUTATION_WINDOW.ENABLED=false`, retirar las entradas de actualización/borrado de ledgers de `DATA_ACCESS_WRITE_POLICY`, restaurar los bloqueos de hooks y tests, ejecutar CI completo y verificar en Wix Local Editor que update/remove vuelven a bloquearse. No desplegar mientras `RESTORE_BEFORE_PRODUCTION=true` y `ENABLED=true`.

**Advertencia de cumplimiento:** esta excepción de desarrollo no modifica ni suspende obligaciones legales de integridad, trazabilidad y conservación de registros fiscales, contables o laborales. No usarla para alterar o eliminar registros reales sujetos a conservación.


### TEC-034 — alineación de maestros DatosFiscales y MapaStaff (2026-11-14)

**CMS live, verificado por Wix Data API:**
- `DatosFiscales` revisión 19: añadidos `commercialName`, `postalCode`, `province`, `schemaVersion` y `traceId`; `fechaInicioVerifactu` cambia a tipo `DATE` tras verificar ausencia de valores previos.
- `MapaStaff` revisión 24: añadido `traceId`; los tres registros mantienen sus IDs y roles, se normaliza `staffName` y se vacía `thirdPartyId` donde no existía vínculo fiscal GUID explícito.
- La fila existente de DatosFiscales sigue siendo un placeholder QA TERCERO/PROVEEDOR. No se transforma en emisor. No se crea CONFIG_SISTEMA hasta disponer de taxId, legalName y taxRegime oficiales y sincronizar/publicar el guard de backend que evita inferir identidad legal.
- No se borraron campos heredados ni colecciones. MapaStaff conserva temporalmente staffMemberId/scheduleId/active porque events.js los consume en el fallback de proyección; active queda sujeto a ADR. La relación CMS ServiciosCatalogo_staffMembers permanece.
- Las tres filas MapaStaff son únicas por memberId y resourceId en el snapshot, pero no existe aún garantía de unicidad frente a escrituras concurrentes; queda pendiente un mecanismo de escritura validado.
- Los campos heredados de DatosFiscales que siguen consumidos por eventLog (tipoUsoPosibleMultiOT e indicadorMultiplesOT) no se eliminan en esta intervención.

**Código en main:** hooks y validator permiten CONFIG_SISTEMA incompleto en los campos fiscales no verificados, fijan el ID singleton CONFIG_SISTEMA_FISCAL y exigen schemaVersion/traceId. eventLog persiste schemaVersion/traceId en nuevos terceros y deja de inferir legalName desde el nombre comercial. Sin sincronización/publicación Wix en esta intervención.

**Límites:** los datos fiscales no verificados permanecen vacíos; Veri*Factu sigue desactivado; escritores fiscales/contables siguen fail-closed. Las colecciones numeradas 12–16 no se borran porque el esquema no aporta sus IDs/nombres y no hay correspondencia inequívoca con el inventario live.

### TEC-035 — [HISTÓRICA / SUPERSEDIDA EN SUS PERMISOS DE QA POR TEC-038] consolidación fiscal en MapaStaff y gestoría (2026-11-14)

**Decisión del propietario:** todos los datos históricos y registros existentes en el sitio son sintéticos de pruebas; el sitio no tiene actividad real. Se autoriza mantener temporalmente abierta la ventana de mutabilidad append-only hasta nueva instrucción expresa del propietario. Esta autorización se limita al entorno de QA declarado; no habilita datos reales ni despliegue productivo.

**CMS live verificado tras la mutación:**
- `MapaStaff` revisión 36, 42 campos y 5 registros: tres `STAFF`, un `TERCERO` QA sintético y un `GESTORIA`.
- El registro `TERCERO` procedente de `DatosFiscales` conserva su ID original. No se creó `CONFIG_SISTEMA`.
- Nuevo registro `GESTORIA`: los datos de contacto concretos se omiten de esta documentación por minimización de datos. El fixture sintético vigente es `Gestoría de Pruebas`, `gestoria.pruebas@example.test`, sin teléfono operativo y con destino real desactivado; ver `src/backend/tests/fixtures/qaSyntheticParties.mjs`. No tiene `memberId`, `staffMemberId`, `resourceId` ni roles.
- `MapaStaff` queda con lectura `PRIVILEGED` y escritura `CMS_EDITOR`. El backend consulta mediante la capa `@wix/data` elevada. Esto evita exponer públicamente datos de contacto/fiscales.
- `DatosFiscales` sigue presente con su fila placeholder sintética. No se elimina hasta publicar el backend migrado, verificar runtime y confirmar que no quedan consumidores activos.

**Código en rama** `feat/consolidate-fiscal-master-mapastaff-v2`: constantes canónicas, validación por `recordType`, hooks CMS, upsert de terceros, lectura de configuración fiscal, destinatarios de gestoría y filtro de proyección Bookings actualizados a `MapaStaff`. Los lectores de eventos filtran `recordType=STAFF`. El DTO de destinatarios añade teléfono y dirección; no se encontró un consumidor frontend directo de `listAccountantRecipients`, por lo que no se ha inventado una UI nueva.

**Pendiente:** ejecutar CI completo; revisar diff; completar documentación del esquema live; desplegar backend en Wix de forma controlada; verificar hooks y WebMethods; después retirar `DatosFiscales` y confirmar su ausencia en inventario. No se ha publicado código Wix ni se ha borrado la colección antigua en esta intervención.---

## Addendum de autoridad y fase QA — 2026-11-14

### Jerarquía de autoridad y SSOT

La autorización inicial de esta ventana se limitaba a update/remove individuales en un subconjunto de colecciones. Queda sustituida por TEC-037, que define la mutabilidad temporal vigente del único sitio aislado, incluidas las operaciones masivas con IDs explícitos. No usar APPEND_ONLY_MUTATION_WINDOW como política vigente.

### TEC-034 [HISTÓRICA / SUPERADA] — snapshot previo de esquema CMS (2026-11-14)

Este registro conserva una lectura anterior del CMS. Sus revisiones, campos y tipos no describen el esquema vigente. La lectura actual del único sitio objeto de trabajo está en docs/audits/2026-11-14-current-site-cms-normalization.md y DICCIONARIO_DATOS_CMS.md. En particular, DatosFiscales no declara schemaVersion ni traceId y fechaInicioVerifactu es TEXT; MapaStaff tiene 18 campos y no contiene campos fiscales.

### TEC-035 [HISTÓRICA / SUPERADA] — propuesta anterior de maestro mixto (2026-11-14)

La propuesta anterior agrupaba STAFF, TERCERO y GESTORIA en MapaStaff. Queda descartada por el esquema físico actual: MapaStaff se limita a identidades de personal y DatosFiscales es el maestro fiscal/de terceros. No usar este modelo ni desplegar la rama antigua feat/consolidate-fiscal-master-mapastaff-v2.

### TEC-036 [HISTÓRICA / SUPERADA] — autoridad SSOT y mutabilidad temporal (2026-11-14)

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.
### TEC-036 — [HISTÓRICA / SUPERSEDIDA EN SU PAUSA APPEND-ONLY POR TEC-038] autoridad SSOT del usuario y pausa de append-only durante QA (2026-11-14)

### TEC-037 — mutabilidad temporal del sitio aislado (2026-11-14)

**HISTÓRICO — supersedido por TEC-038:** la autorización temporal descrita en esta decisión dejó de estar vigente. Los bypasses globales fueron retirados; no se permite reabrir append-only mediante flags. Las purgas efímeras se rigen por TEC-038.

**Implementación en main:** ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true; update/remove individual y masivo para las colecciones CMS propias incluidas en ISOLATED_SITE_MUTABLE_COLLECTIONS. Las operaciones masivas requieren IDs explícitos y límite de 1.000 elementos. Las colecciones WIX_APP quedan excluidas. Se mantienen validaciones, autenticación/autorización, permisos CMS, allowlist de inserciones y gates de writers/efectos externos.

**Límite:** la mutabilidad no habilita writers fiscales, contables o laborales, pagos, reembolsos, comunicaciones ni automatizaciones externas. La política no se restaura automáticamente; solo el propietario puede ordenar su restauración antes de cualquier actividad real.

### TEC-038 — separación de maestros CMS y alineación de contratos (2026-11-14)

### TEC-037 — [HISTÓRICA / SUPERSEDIDA POR TEC-038] habilitación amplia de mutaciones durante QA (2026-11-14)

**Keyfields:** _id es la identidad CMS. Los identificadores nativos Wix/Bookings/Members permanecen como campos separados cuando representan entidades diferentes. En ComplementosCatalogo, addonId queda como espejo físico temporal de _id; el DTO addOnId se conserva por contrato de transporte Bookings. gestorName es el nombre canónico de gestoría; gestorNombre queda retirado del contrato de código.

**Implementación histórica integrada en main:** QA_RECORD_MUTATIONS_ENABLED=true; update/remove individual y bulk update/remove para las colecciones CMS propias incluidas en QA_MUTABLE_COLLECTIONS, incluida DatosFiscales legacy. Esta implementación fue posteriormente retirada por TEC-038 y no debe restaurarse. Las operaciones masivas requieren IDs explícitos y límite de 1.000 elementos. Se permite editar/eliminar registros antes protegidos como append-only, singleton y proyecciones con hooks de bloqueo. Se mantienen validaciones, autenticación/autorización, permisos CMS, allowlist de inserciones y gates de writers/efectos externos. Las colecciones WIX_APP no se incluyen. items.bulkUpdate() es Developer Preview de Wix y queda restringido a esta fase QA.

**Estado:** PR #346 fusionado en main mediante b68e4e048ce5fc1c022fc6ffc2643d5983972107. CI PASS: Layer 1 23 suites/296 pruebas; Layer 2 18 suites/246 pruebas; regresión completa 68 suites/627 pruebas; contratos SDK, ESLint y Gitleaks PASS. La ampliación aún no se ha publicado en Wix. La excepción permanece temporal y no se restaura hasta instrucción expresa del usuario.


---

## DECISIÓN QA-2026-11-14 — uso del sitio 50b como QA y ejecución sintética

**Decisión expresa del propietario:** designar `50b39f33-e753-4331-ab35-b2ed43dc97f7` como sitio QA del proyecto. Usar exclusivamente datos sintéticos, simulación offline de pasarela de pagos, pruebas automatizadas, registro de evidencias, corrección e iteración. El sitio productivo `188bed94-177c-4bc9-a9f0-35080d874f3e` no se utilizará para QA ni como fallback.

**Restricciones de ejecución:** no usar clientes/gestoría reales; no enviar emails/SMS/WhatsApp; no realizar cobros, reembolsos, facturas, tickets a clientes, movimientos de stock ni llamadas AEAT/Veri*Factu/SharePoint/Power Automate. Los mocks deben ser locales/offline y sin llamadas de red. Los datos sintéticos deben identificarse con `isSynthetic`, `testRunId`, `sourceEnvironment=TEST` y `realPayment=false` cuando el contrato de la entidad admita esos campos; no añadir campos CMS sin revisar esquema y consumidores.

**Estado de acceso:** la conexión Wix disponible en la sesión no resolvió el Site ID QA; solo identificó producción. Esta discrepancia se registra como `BLOCKED_ENVIRONMENT` para pruebas runtime. No invalida ni detiene la ejecución de pruebas offline/mock y CI.

**Contrato de pagos mixtos:** los documentos de implementación existentes indican que el campo `paymentMethod` es singular y que el modelo de pagos mixtos no está definido. El caso mixto permanece `BLOCKED_CONTRACT` hasta definir y probar el esquema y la reconciliación. No inferir un contrato a partir de la suma de importes.

**Implementación inicial de esta decisión:** documental. La ejecución posterior añade mocks y fixtures sintéticos, retira los bypasses globales y endurece la política de purgas en TEC-038 y QA-SEC-20261114-001. No se han modificado CMS, configuración Wix, automatizaciones, permisos, secretos ni publicación en esta intervención. Ver [PLAN_ACCION_QA.md](../PLAN_ACCION_QA.md).


---

## TEC-038 — cierre fail-closed de la ventana global de mutabilidad QA (2026-11-14)

**Motivo:** la revisión de código de src/backend/internalConfig.js, dataAccessPolicy.js y data.js detectó que ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true habilitaba update/remove de colecciones propias y desprotegía hooks sin comprobar en esa decisión el Site ID real del runtime. La documentación afirmaba que el alcance era un sitio aislado, pero el código no acreditaba ese vínculo.

**Decisión técnica de seguridad:** cerrar la ventana global hasta implementar y verificar una barrera server-side ligada al Site ID QA autorizado. Se retiran del código los bypasses globales ISOLATED_SITE_RECORD_MUTATIONS_ENABLED y APPEND_ONLY_MUTATION_WINDOW; no queda una bandera que permita reabrirlos. Los ledgers de caja, contabilidad, fiscalidad, jornada y cierres permanecen append-only también durante pruebas. Las purgas masivas se restringen a ControlOperativo mediante condiciones exactas de tipo/estado/fecha; WEBHOOK_EVENT, DEDUPE_KEY y LEDGER_IDEMPOTENCY no son purgables. Las correcciones se registran mediante nuevos movimientos/asientos rectificativos trazables. La proyección CajaActual solo puede cambiar a través de su flujo backend autorizado y con movimiento fuente; no se permite borrarla.

**Alcance:** este cambio afecta al código versionado de la rama de trabajo y a sus pruebas. No modifica ni publica el runtime Wix. El contexto Wix de producción continúa indicando Published; el Site ID QA 50b39f33-e753-4331-ab35-b2ed43dc97f7 no se resuelve en la conexión actual. Por tanto, Wix Runtime/E2E sigue bloqueado y no se realizan mutaciones Wix.

**Verificación pendiente:** ejecutar CI completo sobre el nuevo SHA; revisar todos los consumidores del flag; validar los hooks en Wix Local Editor cuando QA sea accesible. Esta decisión supersede la autorización TEC-037 en cuanto a la habilitación técnica global: TEC-037 se conserva como antecedente histórico, no como permiso operativo actual.
