# Plan de acción QA — Marian Madrid

**Fecha:** 2026-11-14  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama documental:** `docs/qa-operating-model-2026-11-14`  
**Entorno QA objetivo declarado:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Producción conocida:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`

## 1. Decisión operativa

Por instrucción expresa del propietario, el sitio `50b39f33-e753-4331-ab35-b2ed43dc97f7` queda designado como **entorno QA objetivo del proyecto**. Se trabajará con datos sintéticos y simulación de proveedores. El sitio de producción `188bed94-177c-4bc9-a9-f0-35080d874f3e` queda fuera del alcance de pruebas y no se utilizará como sustituto si QA no está disponible.

**Distinción de estado:** la designación del propietario y el inventario CMS del sitio QA constan en el repositorio. En la comprobación de acceso Wix más reciente disponible para esta sesión, el conector solo resolvió el sitio de producción y no pudo resolver el ID QA. Por tanto, la identidad/configuración QA está **declarada/documentada**, pero el acceso runtime y el aislamiento efectivo siguen **pendientes de verificación**. No se declara certificado el banco de pruebas hasta superar los gates de este plan.

La falta de acceso a QA no detiene el trabajo offline: se mantienen fixtures sintéticos, mocks, pruebas unitarias, contratos, regresión y revisión documental. No se redirigen esas pruebas a producción.

## 2. Invariantes de seguridad

1. **Allowlist de sitio:** solo el Site ID QA anterior puede ser destino de pruebas Wix. Cualquier otro ID, ausencia de contexto o discrepancia bloquea la operación.
2. **Fail-closed:** configuración ausente, desconocida o contradictoria significa denegar; nunca inferir TEST por el dominio, nombre del sitio o una constante del frontend.
3. **Separación de datos:** las colecciones propias de QA se usan únicamente tras comprobar su existencia, esquema, permisos y writers. Las colecciones WIX_APP se gobiernan por sus APIs y contratos nativos; no se escriben directamente para simular procesos.
4. **Datos sintéticos:** no importar, copiar ni reutilizar contactos, miembros, reservas, pedidos, pagos, datos fiscales o credenciales reales. Usar identificadores sintéticos y emails bajo dominios reservados como `.example.test`; no efectuar llamadas telefónicas ni entregas de correo.
5. **Pasarela simulada:** el adaptador de pago de QA es local/offline y determinista. No invoca Wix Payments, PSP, bancos, Bizum ni endpoints de cobro/refund. Respuestas de simulación como `TEST_PAYMENT_CONFIRMED` son estados internos y no acreditan liquidación real.
6. **Sin efectos externos:** no emitir facturas, tickets a clientes, emails, SMS, WhatsApp, campañas, mensajes de Bookings, exportaciones a gestoría, SharePoint, Power Automate, AEAT o Veri*Factu. Los destinos externos se sustituyen por sinks/mocks sin entrega.
7. **No tocar producción:** ninguna prueba crea o modifica reservas, pedidos, stock, caja, asientos, cierres, clientes o automatizaciones del Site ID de producción.
8. **Trazabilidad:** cada ejecución tiene `testRunId`, `scenarioId`, `traceId`, commit SHA, resultado, artefactos y fecha/hora Europe/Madrid. Los registros de evidencia no incluyen PII ni secretos.
9. **Integridad:** los ledgers append-only permanecen inmutables también en QA. Las correcciones económicas se representan mediante nuevos movimientos rectificativos trazables; nunca se editan ni borran movimientos, asientos, cierres o registros laborales. La limpieza de pruebas solo podrá afectar a estado efímero no ledger y tras comprobar entorno, IDs y alcance. Los bypasses globales de mutabilidad han sido retirados del código. No reintroducirlos ni crear flags para forzar una prueba; toda purga debe ajustarse a la allowlist y condiciones server-side.
10. **Sin publicación:** esta rama documental no autoriza Preview, Publish, release ni despliegue.

## 3. Modelo de datos de prueba

El inventario del sitio QA del corte 2026-11-14 declara 23 colecciones (15 NATIVE y 8 WIX_APP), con 524 campos físicos NATIVE y 140 registros. Fuente: `docs/audits/2026-11-14-current-site-cms-normalization.md`. Este inventario no se extrapola al sitio de producción.

Colecciones de dominio que deben verificarse y, cuando corresponda, aislarse en QA:

- `CajaActual`
- `MovimientosCaja`
- `LibroAsientosContablesDetalle`
- `HistoricoCierresZ`
- `RegistroIntegracion`
- `ControlOperativo`
- `CitasF2`
- `ServiciosCatalogo`
- `ComplementosCatalogo`
- `MapaStaff`

Colecciones Wix Apps, como Bookings, Stores/eCommerce, Members y Catalog V3, se consultan y operan mediante sus APIs oficiales; no se simulan escribiendo directamente en sus colecciones administradas.

Los nombres `*Test` propuestos en requisitos iniciales no se consideran creados ni existentes. No se inventan colecciones, IDs, campos ni índices. Antes de crear duplicados se debe decidir si el aislamiento por sitio QA es suficiente y comprobar contratos y consumidores.

## 4. Contrato de simulación TPV y pagos

Medios canónicos declarados por negocio:

- `EFECTIVO`
- `TARJETAS`
- `BIZUM`
- `OTROS`
- `OTROS_PENDIENTE`

Reglas:
- Un medio desconocido nunca se convierte en efectivo. Se rechaza o queda explícitamente pendiente.
- `OTROS_PENDIENTE` no se contabiliza como cobro liquidado hasta que exista clasificación y conciliación aprobada.
- No se genera movimiento de caja si la validación económica falla.
- `MovimientosCaja` es la fuente histórica del movimiento; `CajaActual` es proyección/resumen y no se actualiza por separado.
- Asientos y cierres solo se prueban con los writers de simulación/mocks. Los writers fiscales/contables reales permanecen cerrados.
- Anulaciones y devoluciones se modelan como movimientos inversos sintéticos vinculados al movimiento original; nunca como borrado de la venta.
- Las claves de deduplicación deben cubrir `sourceItemId`, `transactionId`, `paymentId`, `traceId` e `idempotencyKey`, con alcance y unicidad definidos por contrato.
- El contrato actual documentado indica que `paymentMethod` en `MovimientosCaja` es singular y que pagos mixtos no están implementados/aceptados hasta definir desglose y reconciliación. El escenario mixto debe permanecer `BLOCKED_CONTRACT` hasta aprobar el modelo de datos; no improvisar arrays/campos.

Validaciones aritméticas con precisión decimal definida por contrato:
```text
subtotalLinea = cantidad × pvpUnitario
sumaSubtotales = totalOperacion
netoTotal + impuestosTotales = totalOperacion
sumaMediosLiquidados = totalOperacion
```

No utilizar aritmética binaria de punto flotante sin estrategia de precisión/redondeo documentada. Los impuestos se validan por línea y por total, con reglas fiscales aprobadas; los mocks no certifican cumplimiento fiscal.

## 5. Escenarios mínimos

| ID | Escenario | Resultado esperado |
|---|---|---|
| QA-PAY-001 | Venta sintética 50 EUR, efectivo | Un movimiento sintético; proyección consistente |
| QA-PAY-002 | Venta sintética 75 EUR, tarjeta simulada | Estado mock confirmado; cero llamadas PSP |
| QA-PAY-003 | Venta sintética 35 EUR, Bizum simulado | Estado mock; cero llamadas Bizum/banco |
| QA-PAY-004 | Venta mixta 40/35/25 EUR | Bloqueado hasta aprobar contrato de pago mixto |
| QA-PAY-005 | Medio desconocido | Rechazo o pendiente explícito; nunca EFECTIVO |
| QA-PAY-006 | Pago duplicado/reintento | Un único movimiento y una única proyección |
| QA-PAY-007 | Dos solicitudes concurrentes con la misma clave | Una sola operación aceptada; sin doble saldo |
| QA-PAY-008 | Devolución total/parcial | Movimiento inverso vinculado; venta original conservada |
| QA-CASH-001 | Apertura sintética con 300 EUR | Solo fixture/mock; no escribir CMS live hasta gate runtime |
| QA-CASH-002 | Cierre sin arqueo | Rechazado |
| QA-ACC-001 | Asiento sin movimiento fuente | Rechazado |
| QA-EXT-001 | Email/gestoría/AEAT/SharePoint | Sink mock; cero entregas o llamadas externas |
| QA-ENV-001 | Site ID distinto, config ausente o entorno desconocido | Bloqueo fail-closed |
| QA-DATA-001 | Intento de escritura a colección productiva/WIX_APP | Bloqueo y evidencia sin PII |

Los importes de los escenarios son fixtures de negocio, no transacciones ni resultados observados.

## 6. Fases y gates

### H0 — Identidad y aislamiento QA
- Resolver el Site ID QA en la cuenta Wix y verificar Editor, Velo, plan/apps y estado.
- Confirmar que el dominio público y el tráfico de clientes no apuntan al entorno de prueba.
- Auditar automatizaciones, notificaciones Bookings, Payments, Stores, Invoices, Gift Cards, webhooks, secretos y conexiones externas.
- Demostrar que ningún trigger o acción puede contactar clientes, cobrar, emitir documentos o escribir fuera de QA.
- Gate: inventario firmado de configuración y pruebas negativas. Hasta entonces solo QA offline.

### H1 — Baseline y contratos
- Fijar SHA Git, versión del Editor, configuración Wix y corte CMS.
- Comparar módulos, imports/exports, schemas, permisos, índices y consumidores.
- No mezclar snapshots: la auditoría CMS del QA 50b registra CajaActual revisión 1 con netAmount y staffResourceId; la auditoría live de producción 188b describe otro esquema. Resolver cualquier discrepancia contra el sitio QA real antes de tocar contratos.
- Confirmar contratos de caja, movimientos, pagos, impuestos, idempotencia, reversiones y cierres.
- Resolver la divergencia de pago mixto antes de habilitar el caso.
- Gate: matriz requisito → módulo → contrato → prueba.

### H2 — Seguridad y simuladores
- Centralizar entorno, Site ID allowlist y colección allowlist en backend.
- Mantener frontend sin lógica de negocio ni selector de entorno.
- Implementar/usar adaptador de pago mock sin red ni credenciales.
- Sustituir email, SMS, gestoría y servicios fiscales por sinks offline.
- Probar denegación ante entorno/ID desconocido y ante cualquier salida externa.
- Gate: tests negativos P0 y revisión de seguridad.

### H3 — Pruebas automatizadas e iteración
- Ejecutar unitarias, contratos, Layer 1, Layer 2, regresión completa, lint y secret scanning.
- Añadir escenarios de idempotencia, concurrencia, reintentos, compensación y movimientos inversos.
- Corregir por cambios mínimos; repetir suite afectada y regresión completa en el mismo SHA.
- Registrar defectos, evidencia, severidad, causa raíz, corrección y resultado de re-test.
- Gate: CI verde y diff revisado.

### H4 — Wix Runtime / E2E QA
- Solo cuando H0 esté acreditado y el conector resuelva el Site ID QA.
- Ejecutar primero Preview/Local Editor sin publicar, con cuentas y datos sintéticos.
- Probar Bookings, Stores, checkout de prueba si Wix/PSP proporciona sandbox real, webhooks, reservas, cancelaciones, devoluciones, TPV y cierres.
- El adaptador mock no sustituye una prueba de sandbox del proveedor; etiquetar por separado MOCK, SANDBOX y RUNTIME.
- Gate: evidencias reproducibles y cero efectos externos.

### H5 — Certificación del banco de pruebas
- Verificar que todos los registros son sintéticos y están marcados con `isSynthetic=true`, `testRunId`, `sourceEnvironment=TEST` y `realPayment=false` donde el contrato del dominio lo permita.
- Demostrar separación de datos, permisos y salidas externas.
- Ejecutar limpieza/reinicio únicamente en colecciones QA allowlisted; conservar logs de ejecución y no tocar producción.
- Emitir informe de aceptación con limitaciones y pruebas no cubiertas.

## 7. Registro de ejecución

Cada ejecución se documenta en `docs/qa/` con:
- fecha/hora UTC y Europe/Madrid;
- commit SHA y workflow/run URL;
- `testRunId`, `scenarioId`, `traceId`;
- tipo: `UNIT`, `MOCK`, `SANDBOX`, `WIX_RUNTIME`, `E2E`;
- precondiciones y fixtures sintéticos;
- pasos, resultado esperado/obtenido;
- logs/artefactos sin PII ni secretos;
- defecto asociado, severidad, causa raíz;
- cambio correctivo, SHA y re-test;
- limitaciones y responsable de aceptación.

Estados permitidos: `NOT_RUN`, `PASS`, `FAIL`, `BLOCKED_ENVIRONMENT`, `BLOCKED_CONTRACT`, `MOCK_ONLY`. Nunca marcar PASS runtime basándose en mocks.

## 8. Estado de ejecución — 2026-11-14

- Decisión de usar Site ID QA 50b39f33-e753-4331-ab35-b2ed43dc97f7: **declarada por el propietario** y respaldada por inventario CMS de 23 colecciones (15 NATIVE, 8 WIX_APP).
- Acceso actual Wix: **no resuelto** por GetSiteContext/ListWixSites en la conexión disponible; solo se resuelve el sitio de producción 188bed94-177c-4bc9-a9f0-35080d874f3e.
- Estado QA despublicado y pasarela desconectada: **declarado por el propietario; pendiente de verificación directa**. El contexto de producción continúa devolviendo Published. No confundir ambos sitios.
- Producción 188bed94-177c-4bc9-a9-f0-35080d874f3e: **fuera del alcance de pruebas**; no usar como fallback.
- PSP mock: **implementado como doble offline/in-memory**, requiere environment TEST, testSiteId sintético coincidente y testRunId; 7 pruebas. No está conectado a Wix Payments ni acredita sandbox del proveedor.
- Email sink: **implementado offline/in-memory**, 4 pruebas; solo acepta destinatarios example.test y clientes con marcadores sintéticos coincidentes.
- Datos sintéticos: **fixture creado** con tres clientes example.test y Gestoría de Pruebas, TEST-NIF-NO-VALIDO, sin teléfono operativo y destino real desactivado.
- CMS mutation safety: **bypasses globales retirados**; hooks de ledgers incondicionalmente append-only; bulk update deshabilitado; bulk remove limitado a purgas ControlOperativo condicionadas por tipo/estado/fecha.
- CI run #43606822535: **PASS** — Layer 1: 23 suites/299 tests; Layer 2: 19 suites/252 tests; regresión completa: 69 suites/633 tests; Wix SDK contracts y ESLint PASS.
- Secret scanning run #43606822521: **PASS**.
- Wix Runtime/E2E: **BLOCKED_ENVIRONMENT**; no se ejecutó Preview, escrituras CMS, pagos, emails, SMS, integraciones externas ni publicación.
- Siguiente gate: recuperar acceso verificable al QA 50b y auditar su configuración de pagos/automatizaciones/permisos antes de habilitar pruebas runtime.

## 9. Referencias

- [Base maestra](PROJECT_BASELINE.md)
- [Estado actual](ESTADO_ACTUAL_PROYECTO.md)
- [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.md)
- [Estándar consolidado](docs/engineering/DEVELOPMENT-STANDARDS.md)
- [Fixtures y cobertura mock](docs/qa/QA-SIMULATION-2026-11.md)
- [Inventario CMS QA](docs/audits/2026-11-14-current-site-cms-normalization.md)
- [Referencia maestra QA histórica](docs/qa/2026-11-11-qa-master-reference.md)
