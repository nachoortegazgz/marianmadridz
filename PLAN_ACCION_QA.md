## Actualización de ejecución — 2026-11-15: mutabilidad QA aún no implementada

La decisión QA-2026-11-15-TEMP-MUTABILITY supersede la regla append-only durante el desarrollo exclusivamente en el sitio QA. La revisión de código de `main` confirma que la autorización todavía no está implementada en la capa de acceso: `src/backend/dataAccessPolicy.js` rechaza update/remove de las colecciones declaradas append-only y `bulkUpdate` permanece fail-closed. El estado correcto es **autorizado por decisión, no habilitado técnicamente**.

### Trabajo técnico bloqueante
1. Confirmar mediante API Wix/Velo oficial cómo verificar en backend el Site ID efectivo del runtime. No aceptar un Site ID enviado por frontend ni inferirlo del dominio.
2. Implementar la excepción únicamente para ADMIN, el Site ID QA exacto y colecciones propias explícitamente revisadas; mantener cerrados los endpoints genéricos y no abrir permisos ANYONE.
3. Excluir siempre `ControlOperativo/WEBHOOK_EVENT`, `WEBHOOK_CLAIM`, claves de deduplicación/idempotencia, colecciones `WIX_APP` y cualquier colección no revisada.
4. Incorporar pruebas negativas de sitio distinto, usuario no ADMIN, colección fuera de allowlist, ID no sintético y concurrencia; backup/export y auditoría antes de cada operación destructiva.
5. Mantener deshabilitados los writers comerciales/fiscales/laborales y todos los efectos externos. No ejecutar runtime E2E que pueda activar las ocho automatizaciones Wix ACTIVE (siete preinstaladas bloqueadas y una app-origin programada que delega una tarea a IA de alcance no verificado).
6. Reintroducir append-only, rectificaciones trazables y bloqueo update/remove antes de cualquier transición a actividad real.

**No se han cambiado permisos CMS ni registros Wix, no se ha desplegado código y no se ha validado persistencia runtime.**

---

> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nacho.pitt@example.test`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](docs/qa/QA-ENVIRONMENT-SSOT.md).

---

# Plan de acción QA — Marian Madrid

**Fecha:** 2026-11-14  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama documental:** `docs/qa-operating-model-2026-11-14`  
**Entorno QA único:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`  

## 1. Decisión operativa

Por instrucción expresa del propietario, el sitio `188bed94-177c-4bc9-a9f0-35080d874f3e` es el **único entorno QA oficial** del proyecto. Fue creado para pruebas previas al despliegue real; nunca ha tenido actividad real y no la tiene actualmente. Todos los datos son sintéticos, el cliente de prueba canónico es Nacho Pitt (`nacho.pitt@example.test`) y la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado.

**Estado del entorno:** Wix identifica el sitio como Published y con dominio personalizado. Este es un metadato técnico de publicación; no cambia su clasificación funcional como QA ni contradice la declaración del propietario de que nunca ha existido actividad real. La identidad del entorno queda fijada por esta SSOT. Las pruebas que puedan producir efectos externos siguen usando mocks/sinks offline y requieren controles específicos.

## 2. Invariantes de seguridad

1. **Allowlist de sitio:** solo el Site ID QA anterior puede ser destino de pruebas Wix. Cualquier otro ID, ausencia de contexto o discrepancia bloquea la operación.
2. **Fail-closed:** configuración ausente, desconocida o contradictoria significa denegar; nunca inferir TEST por el dominio, nombre del sitio o una constante del frontend.
3. **Separación de datos:** las colecciones propias de QA se usan únicamente tras comprobar su existencia, esquema, permisos y writers. Las colecciones WIX_APP se gobiernan por sus APIs y contratos nativos; no se escriben directamente para simular procesos.
4. **Datos sintéticos:** no importar, copiar ni reutilizar contactos, miembros, reservas, pedidos, pagos, datos fiscales o credenciales reales. Usar identificadores sintéticos y emails bajo dominios reservados como `.example.test`; no efectuar llamadas telefónicas ni entregas de correo.
5. **Pasarela simulada:** el adaptador de pago de QA es local/offline y determinista. No invoca Wix Payments, PSP, bancos, Bizum ni endpoints de cobro/refund. Respuestas de simulación como `TEST_PAYMENT_CONFIRMED` son estados internos y no acreditan liquidación real.
6. **Sin efectos externos:** no emitir facturas, tickets a clientes, emails, SMS, WhatsApp, campañas, mensajes de Bookings, exportaciones a gestoría, SharePoint, Power Automate, AEAT o Veri*Factu. Los destinos externos se sustituyen por sinks/mocks sin entrega.
7. **Sin efectos externos reales:** ninguna prueba ejecuta cobros, reembolsos, comunicaciones, transmisiones fiscales ni operaciones con terceros; usar mocks/sinks offline.
8. **Trazabilidad:** cada ejecución tiene `testRunId`, `scenarioId`, `traceId`, commit SHA, resultado, artefactos y fecha/hora Europe/Madrid. Los registros de evidencia no incluyen PII ni secretos.
9. **Mutabilidad temporal QA:** por decisión del propietario de 2026-11-15, se suspende temporalmente append-only para permitir corrección de registros sintéticos. Las operaciones update/remove se implementarán solo en backend, con autorización ADMIN, allowlist de colecciones, Site ID QA exacto, backup, auditoría y rollback. No abrir permisos ANYONE/anónimos ni modificar directamente colecciones WIX_APP. La política anterior queda supersedida solo en QA mientras esta ventana esté aprobada.
10. **Sin publicación:** esta rama documental no autoriza Preview, Publish, release ni despliegue.

## 3. Modelo de datos de prueba

El inventario CMS documentado en `docs/audits/2026-11-14-current-site-cms-normalization.md` es un snapshot histórico de una designación anterior. La nueva SSOT identifica el sitio QA, pero no transfiere ni valida automáticamente esos esquemas/recuentos. Repetir lectura de solo lectura sobre el sitio `188bed94-177c-4bc9-a9f0-35080d874f3e` antes de cualquier escritura o migración.

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

### Implementación offline adicional — TPV (2026-11-14)

- Auditoría estática: `docs/audits/2026-11-14-tpv-contract-gap-audit.md`.
- Motor sintético aislado: `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs`; no se importa desde backend runtime.
- Contrato cubierto: líneas cantidad × PVP, base + impuesto, conciliación de total, cinco medios de pago declarados, pagos pendientes no liquidados, idempotencia y precisión de céntimos.
- Suite: `src/backend/tests/qa.tpv-simulation.mock.test.mjs`, incluida en Layer 1.
- El writer fiscal real continúa fail-closed. No se han cambiado enums reales, CMS, CajaActual, cierre Z ni proveedores.
- Estado: código añadido; CI del commit que contiene estos cambios pendiente de resultado en el momento de este corte.

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

### H0 — Identidad y aislamiento QA — BLOCKED_EXTERNAL_SIDE_EFFECTS
- Resolver el Site ID QA en la cuenta Wix y verificar Editor, Velo, plan/apps y estado.
- Confirmar que el dominio público y el tráfico de clientes no apuntan al entorno de prueba.
- Auditar automatizaciones, notificaciones Bookings, Payments, Stores, Invoices, Gift Cards, webhooks, secretos y conexiones externas.
- Demostrar que ningún trigger o acción puede contactar clientes, cobrar, emitir documentos o escribir fuera de QA.
- Gate: inventario firmado de configuración y pruebas negativas. Hasta entonces solo QA offline.

### H1 — Baseline y contratos
- Fijar SHA Git, versión del Editor, configuración Wix y corte CMS.
- Comparar módulos, imports/exports, schemas, permisos, índices y consumidores.
- No mezclar cortes históricos con la SSOT actual: los snapshots CMS anteriores no constituyen baseline vigente del sitio QA `188bed94-177c-4bc9-a9f0-35080d874f3e`. Repetir la lectura de esquemas y permisos antes de operar.
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

- Sitio QA único: `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`.
- Finalidad y ausencia de actividad real histórica/actual: declaradas expresamente por el propietario.
- Datos: sintéticos exclusivamente. Cliente sintético: Nacho Pitt (`nacho.pitt@example.test`).
- Pasarela: desconectada, según declaración del propietario.
- Contexto Wix consultado: sitio Published, dominio personalizado, Wix Editor y Velo habilitado; apps de Bookings, Forms & Payments, Gift Cards, Hotels, Invoices V1 y Stores Catalog V3.
- CI offline, mocks y contratos SDK: consultar los resultados asociados al SHA de cada ejecución; no extrapolar un PASS offline a runtime/E2E.
- Runtime/E2E: no ejecutado en esta intervención. Las rutas que puedan activar comunicaciones, cobros, fiscalidad o integraciones externas permanecen limitadas a mocks/offline hasta comprobar el aislamiento específico.
- No existe un segundo sitio QA ni se utiliza un QA externo.

## 9. Referencias

- [Base maestra](PROJECT_BASELINE.md)
- [Estado actual](ESTADO_ACTUAL_PROYECTO.md)
- [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.md)
- [Estándar consolidado](docs/engineering/DEVELOPMENT-STANDARDS.md)
- [Fixtures y cobertura mock](docs/qa/QA-SIMULATION-2026-11.md)
- [Inventario CMS QA](docs/audits/2026-11-14-current-site-cms-normalization.md)
- [Referencia maestra QA histórica](docs/qa/2026-11-11-qa-master-reference.md)


---

## Regla SSOT vigente del propietario — modo desarrollo global

Vigente hasta nueva orden. Aplicar en todo el trabajo QA:

- Modo desarrollo global; solo registros y fixtures sintéticos. Prohibido importar o reutilizar datos reales.
- Ninguna actividad real: reservas/pedidos, cobros/reembolsos, comunicaciones, stock o integraciones externas.
- Veri*Factu, generación/envío fiscal y transmisiones AEAT desactivados.
- Email, SMS, WhatsApp, SharePoint y Power Automate deben usar sinks/mocks offline sin I/O.
- Los ledgers pueden pausarse: la opción inicial es mantener sus writers cerrados. La pausa impide nuevas inserciones; nunca habilita update/remove de registros existentes.
- Los bloqueos de preparación fiscal en escenarios sintéticos se muestran como warnings no bloqueantes. No relajar validación de esquema, hash/trazabilidad, conciliación, autorización, idempotencia ni seguridad.

### Implementación técnica y gate de seguridad

**Estado: pendiente de implementación y validación.** No basta con cambiar flags en `internalConfig.js`: se han identificado rutas de checkout/writers Bookings y handlers de eventos Wix que no quedan cubiertas por el gate `FISCAL_RUNTIME_POLICY` de caja. Antes de desplegar debe existir un kill switch server-side que cubra todos los writers y efectos externos, con tests negativos por ruta. Mantener QA offline/mock mientras no se demuestre el aislamiento del Site ID QA designado. No desplegar ni publicar como parte de esta tarea.


### Identidad vigente del entorno

La identidad y clasificación del único sitio QA se rigen por [SSOT del entorno QA](docs/qa/QA-ENVIRONMENT-SSOT.md). Los addenda anteriores que identificaban otro sitio como QA o clasificaban este sitio como producción quedan supersedidos.


---

## Corte de hitos — 2026-11-14

- **Hito de fixtures offline:** CERRADO. PR #379 integrada en main (27348a20bfb913fde43761d4c92dd46526a5e470); CI 70 suites / 644 tests PASS, SDK contracts, ESLint y Secret scanning PASS.
- **H0 / H4 Wix Runtime:** BLOQUEADO. Lectura oficial Wix Automations V2: 150 automatizaciones, 7 activas y 143 inactivas. Las siete activas son preinstaladas y todas tienen readonly o disableStatusChange; no se pueden desactivar mediante API sin vulnerar locks.
- **Decisión:** continuar solo offline/mock y read-only. No ejecutar flujos que disparen reservas, miembros, pagos guardados, formularios, tareas o notificaciones. Solicitar a Wix/proveedor neutralización soportada; repetir inventario y demostrar aislamiento antes de Runtime/E2E.
- Evidencia: docs/audits/2026-11-14-qa-automations-isolation.md y docs/milestones/2026-11-14-qa-offline-fixtures-complete-runtime-isolation-blocked.md.


## Tarea P0 preproducción — restauración de garantías de integridad

Antes de cualquier despliegue o actividad real:
- [ ] Restaurar append-only e inmutabilidad en todos los ledgers afectados.
- [ ] Sustituir correcciones directas por nuevos registros rectificativos trazables.
- [ ] Restaurar permisos mínimos y bloqueos de update/remove en CMS y backend.
- [ ] Revalidar autorización server-side, idempotencia, hash, cadena de integridad y auditoría.
- [ ] Ejecutar pruebas negativas de acceso no autorizado y de mutación/borrado.
- [ ] Confirmar backup, recuperación y revisión de datos QA antes de cerrar la ventana temporal.
- [ ] Bloquear release/publicación real mientras quede cualquier control pendiente.

La tarea se considera abierta hasta que exista evidencia CI y validación en el entorno correspondiente. La decisión documental no equivale a implementación.


## Hito técnico — alineación CMS contable y laboral (2026-11-15)

- PR #388 integrada en `main` (squash `beeb3ed0e28533cdaf10aa5858e36f4bc713480c`).
- Esquemas live releídos: `LibroAsientosContablesDetalle` revisión 7, 103 campos; `RegistrosHorariosStaff` revisión 1, 47 campos.
- Contratos corregidos: `fechaOperacion` y `workDate` como DATE `YYYY-MM-DD`; `recordedAt`/`recordedTime` como DATETIME; `cashMovementId` dentro de `desgloseDetallado` OBJECT.
- CI run 1310: 70 suites / 644 tests PASS; Layer 1 307 PASS; Layer 2 252 PASS; SDK contracts, ESLint y Secret scanning PASS.
- Estado: código alineado e integrado, pero writers contable/laboral siguen deshabilitados. No hay validación de persistencia runtime ni escrituras Wix. La ejecución de E2E sigue bloqueada por automatizaciones activas con acciones potenciales de notificación.

## Revalidación de automatizaciones Wix — 2026-11-16

- Wix Automations V2 filtrado por `configuration.status=ACTIVE`: 8 IDs; Get Automation individual confirma 8/8 ACTIVE.
- Siete automatizaciones PREINSTALLED mantienen `disableStatusChange=true`; dos además `readonly=true`.
- Se descubre una octava automatización app-origin: `Creación de TPV física personalizada`, ID `961f911d-8386-4e20-843e-cdf4595c24e8`, activa, trigger programado diario a 01:45, acción `Delegate to AI Custom Agent`, task ID `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`.
- El esquema de acción confirma delegación de una tarea de negocio a agente IA; las instrucciones y las integraciones de la tarea no se han podido leer. No se ha modificado ni desactivado por desconocerse su finalidad.
- Estado: `BLOCKED_UNKNOWN_AUTOMATION_SIDE_EFFECTS`. No habilitar Runtime/E2E hasta revisar task e integraciones en Agent Maker y volver a consultar el estado.
- Evidencia detallada: `docs/audits/2026-11-14-qa-automations-isolation.md`, addendum 2026-11-16.
