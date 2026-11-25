# PROJECT-CANON — marianmadridz

Revisión: 2026-11-25 · Base de código TPV: `PR #612 merge 239fd8207d228bde56e9908055166980a87d4989` · flujo único documental integrado en main

## 1. IDENTIDAD

| Cliente | Negocio | Stack | Repo | Sitio Wix ID | Entorno actual | Última revisión |
|---|---|---|---|---|---|---|
| Marian Madrid | Peluquería, Zaragoza | Wix Editor clásico, Velo, Wix JavaScript SDK | [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz) | `188bed94-177c-4bc9-a9f0-35080d874f3e` | Published; Site Context read-back 2026-11-25 | 2026-11-25 |

Evidencia histórica: [PROJECT-STATUS archivado](archive/2026-11/PROJECT-STATUS.md) y [directriz anterior](archive/2026-11/PROJECT-OWNER-DIRECTIVE-2026-11-20.md). La clasificación histórica de datos no gobierna el flujo TPV vigente.

## 2. OBJETIVOS

### 2.1 Negocio

- Publicar catálogo de servicios y permitir reservas online mediante Wix Bookings.
- Gestionar servicios duales con dos bookings nativos independientes F1/F2, mismo resourceId y gap de exposición no reservado; F2 usa OFFLINE, importe 0 y noFee.
- Gestionar ventas presenciales, cobros por medio de pago, caja física, movimientos y cierres X/Z mediante TPV; el terminal bancario presencial aún carece de contrato integrado.
- Vender productos online y presencialmente con Wix Stores como autoridad de inventario.
- Registrar facturación y jornada laboral conforme a los requisitos legales aplicables.

### 2.2 Código

- Implementar el mínimo código necesario; no duplicar capacidades nativas de Wix.
- Mantener simplicidad, fiabilidad, trazabilidad, idempotencia y concurrencia verificables.
- Validar funcionalidad real en Wix Editor/Preview/Runtime; CI offline no acredita Runtime.
- Aplicar backend/WebMethods para reglas, validación y autorización; frontend solo presenta y orquesta.
- Seguir documentación oficial vigente de Wix, Wix Apps y normativa española; SDK primero cuando exista API soportada.

### 2.3 Fuera de alcance MVP

- Captura bancaria presencial propia: proveedor, contrato y credenciales no están contratados/verificados.
- Inventario paralelo en CMS: Wix Stores Catalog V3 es la autoridad nativa del stock.
- Emisión/remisión fiscal real: falta configuración legal validada y aceptación fiscal/runtime.
- SharePoint como sistema transaccional: solo repositorio de evidencia; Wix CMS es SSOT.
- Operación comercial TPV: release NO-GO hasta completar writer, gates fiscales, pagos, inventario, precio final y aceptación Runtime; el sitio principal está Published.

## 3. STACK Y VERSIONES

Versiones instaladas según [package.json](../package.json). “Versión oficial” indica la versión que muestra la documentación consultada a 2026-11-25; no implica que esté instalada.

| Componente | Versión actual | Estado | Fuente oficial |
|---|---|---|---|
| Wix | Editor clásico; plataforma SaaS sin semver de sitio | RECOMENDADA | [Wix APIs y rutas de desarrollo](https://dev.wix.com/docs/overview/platform-overview/about-wix-apis) |
| Velo | Velo habilitado; APIs versionadas por módulo, no existe versión global V2/V3 | RECOMENDADA con SDK-first | [Versionado por módulo](https://dev.wix.com/docs/velo/articles/api-overview/api-versions) |
| JavaScript SDK | `@wix/sdk 1.21.17` instalado; `@wix/bookings 1.0.1704`, `@wix/data 1.0.527`,  `@wix/ecom 1.0.2539` (docs Cart V2: 1.0.2693), `@wix/stores 1.0.997` | RECOMENDADA; comparar pins con releases oficiales | [Wix SDK](https://dev.wix.com/docs/overview/platform-overview/about-wix-apis) |
| Bookings | API Bookings V2; `@wix/bookings 1.0.1704` instalado; docs oficiales muestran 1.0.1803 | RECOMENDADA; pin pendiente de actualización/evaluación | [Bookings SDK](https://dev.wix.com/docs/api-reference/business-solutions/bookings/resources/resources-v2/introduction?apiView=SDK) |
| Stores Catalog | Catalog V3; `@wix/stores 1.0.997` instalado | RECOMENDADA | [Catalog V3](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/introduction) |
| Payments | Wix Payments para pagos online; no hay proveedor/terminal presencial verificado | DEPRECADA solo la API Transactions/Card Tokens legacy desde 2026-09-30 | [Changelog Wix](https://dev.wix.com/docs/changelog/) · [Payments API](https://dev.wix.com/docs/api-reference/business-management/payments/introduction) |
| Data | Wix Data/CMS; `@wix/data 1.0.527` instalado; documentación consultada muestra 1.0.544 | RECOMENDADA; pin pendiente de actualización/evaluación | [Wix Data](https://dev.wix.com/docs/api-reference/business-solutions/cms/introduction) |
| Automations | Wix Automations nativo; sin paquete npm/versionado en repo | BLOQUEADA por verificación de 7 automatizaciones PREINSTALLED | [Wix Automations](https://support.wix.com/en/article/about-wix-automations) |
| CMS | Wix CMS sobre Wix Data; SSOT transaccional | RECOMENDADA | [CMS API](https://dev.wix.com/docs/api-reference/business-solutions/cms/introduction) |

Nota Payments: la deprecación afecta a métodos/eventos de Transactions y Card Tokens; no equivale a la deprecación del proveedor Wix Payments. Order Transactions registra movimientos asociados a pedidos, pero no captura fondos por sí mismo. Referencia de fecha: [Wix Developer Changelog](https://dev.wix.com/docs/changelog/).

## 4. ARQUITECTURA VINCULANTE

| Patrón no negociable | Dónde aplica | Referencia | Motivo |
|---|---|---|---|
| `resourceId` en dominio/DTO/CMS; mapear a `resource._id` en SDK Bookings y `resource.id` en REST | Reservas y profesionales | [ADR-002](archive/2026-11/adr/ADR-002-bookings-v2-sdk-field-names.md) | Separar contrato de dominio de forma SDK/REST |
| Clave idempotente determinista + fingerprint; replay idéntico devuelve el existente; payload distinto es conflicto | TPV, reservas, webhooks y ledgers | PR [#587](https://github.com/nachoortegazgz/marianmadridz/pull/587) | Evitar duplicados y efectos dobles |
| Lock con compare-and-swap (CAS), expiración y recuperación acotada | Caja, fiscalidad y procesos concurrentes | PR #587; `fiscalLedgerLock.js` | Exclusión mutua verificable sin forzar locks |
| Hooks `beforeInsert` para validar/normalizar el sobre y rechazar datos inválidos | Wix Data/CMS | [Wix beforeInsert](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-insert) · PR #587 | Validación server-side antes de persistir |
| Errores accionables A/B | Operaciones y gates legales | PR [#604](https://github.com/nachoortegazgz/marianmadridz/pull/604), merge `0acb60d` | A: retry/replay acotado y observable; B: remediation humana sin quitar el gate |
| Ledgers append-only; rectificación mediante nuevo registro trazable | Caja, fiscal, contabilidad, jornada, cierres y eventos webhook | TEC-038; PR [#589](https://github.com/nachoortegazgz/marianmadridz/pull/589), [#590](https://github.com/nachoortegazgz/marianmadridz/pull/590) | Preservar evidencia y trazabilidad |
| Wix CMS es SSOT; SharePoint solo evidencia; Capa 3 no gobierna Capa 1 | Todo el ecosistema | [Directriz](archive/2026-11/PROJECT-OWNER-DIRECTIVE-2026-11-20.md), [dossier de flujos](archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md) | Una autoridad transaccional |
| Backend/WebMethods contiene lógica y permisos; frontend no decide negocio ni autorización | Todo el sitio | [README](../README.md), directriz del propietario | Seguridad y separación de responsabilidades |

Decisiones registradas (fecha y origen):

| Fecha | Decisión | Evidencia |
|---|---|---|
| 2026-10-30 | Contrato de identificadores Bookings V2; separación SDK/REST | [ADR-002](archive/2026-11/adr/ADR-002-bookings-v2-sdk-field-names.md) |
| 2026-11-09 | Stores Catalog V3 como catálogo del sitio; inventario nativo | PR #216 merge `7b1d48d`; PR #238 merge `fb853e3`; [ADR](archive/2026-11/adr/ADR-004-stores-catalog-v3-migration.md) |
| 2026-11-23 | Concurrencia, identidad, idempotencia y hooks; fiscal fail-closed; MovimientosCaja append-only | PR #587 `5983ddf`; #589 `b667bae`; #590 `63b55f1` |
| 2026-11-24 | Decisión histórica de retirar el runtime anterior; supersedida por el flujo único | PR #600 `7ffca8c`; PR #601 `46a7e01`; decisión 2026-11-25 en TPV-UNIFIED-FLOW.md |
| 2026-11-24 | Arnés Runtime F1–F6 creado; errores accionables A/B integrados | PR #603 `f42ef7f`; PR #604 `0acb60d` |
| 2026-11-25 | Preparación de venta y contrato previo V1 integrados; decisión de flujo único consolidada | PR #611/#612; commit de documentación `19378e00f6568afaf68df6550d7fbb7844e221ab` está en la historia de main; Runtime pendiente |

## 4.1 TPV — flujo de código único (decisión vinculante 2026-11-25)

[TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) es la autoridad específica del TPV. Se elimina como criterio de diseño cualquier bifurcación funcional por entorno, procedencia de prueba, estado de publicación o test-run. El mismo backend, contrato de dominio y ruta de persistencia deben procesar todas las operaciones. Las pruebas utilizan fixtures/dobles en la suite automatizada y ejercitan la misma lógica; no existe un runtime de negocio paralelo.

Esta decisión sustituye directrices anteriores que ordenaban crear o mantener runtimes separados, añadir marcadores de entorno/procedencia de prueba como condición de negocio o bloquear escrituras por una etiqueta. No autoriza por sí sola la persistencia: el writer sigue bloqueado hasta completar el contrato físico/fiscal de MovimientosCaja, autorización, idempotencia, secuencia, hash, concurrencia, hooks y aceptación Runtime. Los históricos se tratan separadamente sin modificar ledgers inmutables.

## 5. RESTRICCIONES NORMATIVAS

| Norma | Ámbito | Qué exige al código | Estado |
|---|---|---|---|
| RD 1007/2023 y normativa SIF/VERI*FACTU | Facturas y registros de facturación | Hash SHA-256 y encadenamiento; QR/leyenda en factura según modalidad; remisión de registros en VERI*FACTU. La firma electrónica individual NO es obligatoria en VERI*FACTU; sí en NO VERI*FACTU según requisitos aplicables. | Diseño/ADR no equivale a certificación; configuración legal ausente y writers false. [AEAT hash](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/huella-hash.html) · [AEAT firma](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/firma.html) · [AEAT modalidades](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/cuestiones-generales/modalidades-cumplimiento-obligaciones.html) |
| Estatuto de los Trabajadores, art. 34.9 | Registro diario de jornada | Registrar hora concreta de inicio y fin; conservar registros cuatro años y mantenerlos disponibles a trabajadores, representantes e Inspección. | Requisito legal; aceptación Runtime y flujo laboral pendiente. [BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430) |
| Fail-closed fiscal | Configuración y writers fiscales/contables | Sin singleton fiscal legalmente validado, no escribir ni remitir; no inventar datos ni activar flags. | Gate implementado; singleton real ausente; flags permanecen false. PR #589/#604 |
| Inmutabilidad de ledgers | Caja, fiscal, contabilidad, jornada, cierres y eventos webhook | Prohibir update/remove; correcciones mediante asiento/movimiento nuevo y referencia al original. | Política implementada; Runtime pendiente. TEC-038; PR #590 |

## 6. ESTADO ACTUAL (DONE / BLOCKED / PENDING)

| Área | Estado | Evidencia | Dependencia |
|---|---|---|---|
| TPV: preparación autoritativa de venta | DONE en código; persistencia PENDING | PR #611/#612; la arquitectura de flujo único está aprobada; migración de runtime y writer siguen pendientes | Contrato MovimientosCaja + pruebas Runtime |
| Concurrencia/identidad/idempotencia/hooks en código | DONE en código; Runtime PENDING | PR #587 merge `5983ddf` | QA Preview |
| Gate fiscal y append-only | DONE en código; datos legales PENDING | PR #589 `b667bae`; #590 `63b55f1` | Propietario + asesoría fiscal |
| Arnés Runtime F1–F6 | DONE en código; ejecución PENDING | PR #603 merge `f42ef7f`; `tests/runtime/runtime-all.spec.js` | QA Preview |
| Errores accionables A/B | DONE en código; Runtime PENDING | PR #604 merge `0acb60d`; CI 81 suites/750 tests | QA Preview |
| #416 Caja, compensaciones y pedidos POS | BLOCKED P0 | [STATE-NOW histórico](archive/2026-11/PROJECT-STATUS.md); [RELEASE-READINESS](RELEASE-READINESS.md) | Propietario + QA; reconciliación documentada sin mutar registros |
| #415/#209 Configuración fiscal y SIF | BLOCKED P0 | F1 pendiente; PR #589/#604 | Propietario + asesoría fiscal; CONFIG_SISTEMA_FISCAL legalmente verificado |
| #525 Concurrencia CajaActual | BLOCKED P0 Runtime | PR #587; P1 pendiente | QA Preview |
| #434 Discrepancia MovimientosCaja | BLOCKED P0 | PR #590; M4 pendiente | Propietario + administrador Wix; Activity Logs/backups |
| #520 Wix Automations | BLOCKED P0 | Último read-back: 7 PREINSTALLED ACTIVE; app laboral INACTIVE | Propietario + administrador Wix |
| #523/#522 Bookings y canales de pago | PENDING P1 | Revalidación 2026-11-23 | QA + propietario; estado nativo y flags |
| #210 Protección de main | PENDING P1 | Último estado documentado: sin ruleset/checks obligatorios | Administrador del repositorio |
| #435 TPV QA | PENDING P1 | PR #611 y #612 MERGED; preparación Wix read-only + contrato de preescritura V1; CI offline PASS; writer/persistencia/idempotencia/aceptación Runtime pendientes | QA Preview |

Detalle operativo P0/P1: [STATE-NOW.md](STATE-NOW.md) y [RELEASE-READINESS.md](RELEASE-READINESS.md). Estado Wix/CMS y automatizaciones basado en último read-back documentado 2026-11-23; no se presenta como lectura en tiempo real.

## 7. CONTRATOS EXTERNOS PENDIENTES

| Contrato | Falta | PASS | Responsable |
|---|---|---|---|
| A — Pagos presenciales | Proveedor/terminal, contrato y credenciales; no confundir con Wix Payments online | Captura de 0,01 € y reembolso completado en entorno de certificación del proveedor, con identificadores y conciliación | Propietario + proveedor de pagos + QA |
| B — Ubicación de inventario | `locationId` de Wix Locations o confirmación documentada de la ubicación predeterminada | SKU de prueba con stock > 0 leído en la ubicación física real del salón | Propietario + administrador Wix + QA |
| C — Fiscal | Alta de singleton `CONFIG_SISTEMA_FISCAL` con datos legales verificados | Singleton único; writers permanecen false; lectura read-only devuelve taxId válido y campos obligatorios completos | Propietario + asesoría fiscal; QA verifica lectura |

## 8. ÍNDICE DE REFERENCIAS

| Qué buscas | Dónde mirar |
|---|---|
| Contexto, decisiones, stack y restricciones | [PROJECT-CANON.md](PROJECT-CANON.md) |
| P0/P1 y estado vigente | [STATE-NOW.md](STATE-NOW.md) |
| GO/NO-GO y evidencia Runtime | [RELEASE-READINESS.md](RELEASE-READINESS.md) |
| Histórico de documentos | [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md) |
| Contratos CMS y campos | [Diccionario CMS](archive/2026-11/reference/DICCIONARIO_DATOS_CMS.md), [read-back CMS](archive/2026-11/reference/WIX-CMS-SCHEMA-VERIFICATION-2026-11-23.md) |
| Flujos Capa 1 → Capa 3 | [Dossier de flujos](archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md) |
| TPV y aceptación nativa | [Aceptación TPV](archive/2026-11/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md), [revisión 24/11](archive/2026-11/qa/2026-11-24-tpv-diff-review-and-safe-hardening.md) |
| Bookings duales y cancelaciones | [ADR Bookings](archive/2026-11/adr/ADR-002-bookings-v2-sdk-field-names.md), [revalidación](archive/2026-11/audits/2026-11-23-bookings-revalidation.md) |
| Veri*Factu | [ADR Veri*Factu](archive/2026-11/architecture/ADR-VERIFACTU-REMISSION.md), [AEAT SIF](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html) |
| Evidencia detallada de pruebas Runtime | [Checklist archivada](archive/2026-11/RUNTIME-EVIDENCE-CHECKLIST.md), [arnés](../tests/runtime/runtime-all.spec.js) |


## 9. ACTUALIZACIÓN VINCULANTE — 2026-11-25 (PR #611 + PR #612)

Esta sección fija el estado actual de integración y prevalece sobre los registros de estado históricos anteriores.

- PR [#611](https://github.com/nachoortegazgz/marianmadridz/pull/611) está **MERGED** en `main`; merge commit `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf`.
- PR [#612](https://github.com/nachoortegazgz/marianmadridz/pull/612) está **MERGED** en `main`; merge commit `239fd8207d228bde56e9908055166980a87d4989`. Su árbol `632c85edbd765a291abe7b411fe08af75da5e571` coincide con el commit sometido a CI.
- Se integró preparación de venta TPV de solo lectura: backend resuelve catálogo Stores Catalog V3/Bookings, profesional autorizado y fiscalidad mediante `taxSettings.getTaxSettings` + `taxCalculation.calculateTax`. El frontend presenta importes devueltos por backend; no es autoridad de precios/impuestos.
- PR #611 CI offline PASS sobre commit de código `b3ed704fa6a7a37ddba4975e4c1136c681b4630f`: run `45555933654`; Gitleaks run `45555933681` PASS.
- PR #612 CI offline PASS sobre árbol `632c85edbd765a291abe7b411fe08af75da5e571`: run `45592833890`; Gitleaks run `45592834040` PASS. Wix Preview/Runtime no ejecutado.
- Evidencia Wix read-only 2026-11-25: 24 productos, 70 servicios de precio fijo EUR, 30 registros de inventario en ubicación virtual online y 0 en ubicación física; `taxIncludedInItemPrices=false`.
- PR #612 integra `tpvWriteV1Contract.js`: una tasa impositiva verificable, un único medio físico (EFECTIVO/TARJETA) y conciliación exacta del importe aplicado con el total Wix. `registrarVenta()` recalcula catálogo/impuestos en backend.
- `saleReady=false`, `paymentVerified=false`, `persisted=false`. El contrato V1 no habilita persistencia. No se crean pedidos, Draft Orders, movimientos, pagos ni devoluciones. El guard de repository y el hook `MovimientosCaja_beforeInsert` siguen cerrados.
- No crear `TransaccionesTPV`: `MovimientosCaja` sigue siendo el ledger físico canónico. No inicializar ni transferir inventario sin recuento físico.
- Precio final al consumidor no verificado; la venta continúa bloqueada por el requisito de precio completo con impuestos incluidos (RDL 1/2007, arts. 20.1.c y 60.2.c).
- La consulta de `MapaStaff` por `recordType=CONFIG_SISTEMA` devolvió 0 registros; `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`.

Fuente operativa única: [STATE-NOW.md](STATE-NOW.md) y [RELEASE-READINESS.md](RELEASE-READINESS.md). Si hay discrepancia con cualquier tabla histórica de este canon, prevalecen esos dos documentos y el código del commit indicado.
