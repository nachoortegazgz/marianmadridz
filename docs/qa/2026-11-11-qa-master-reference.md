> **Addendum de vigencia — 2026-11-14:** esta referencia conserva el estado histórico del Site ID productivo `188bed94-177c-4bc9-a9f0-35080d874f3e`. Por decisión posterior del propietario, el destino QA es `50b39f33-e753-4331-ab35-b2ed43dc97f7`; producción no debe utilizarse para pruebas. El conector Wix de la sesión no pudo resolver el Site ID QA, por lo que el aislamiento runtime y E2E siguen pendientes. Para la decisión y plan actuales, prevalecen [PLAN_ACCION_QA.md](../../PLAN_ACCION_QA.md), [PROJECT_BASELINE.md](../../PROJECT_BASELINE.md) y [ESTADO_ACTUAL_PROYECTO.md](../../ESTADO_ACTUAL_PROYECTO.md).

---

# Referencia maestra QA y estado de aislamiento — Marian Madrid

**Fecha de revisión:** 2026-11-11  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline main:** merge de PR #295 · `b799412a1722b2dfacd1b21a198ebcb68fc03af2`
**PR #296:** abierta en Draft; contiene la reauditoría live y las correcciones documentales posteriores, aún no integradas.  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · https://www.marianmadrid.es/  
**Estado de esta referencia:** documento consultivo vigente; no equivale a certificación E2E ni autoriza operaciones reales.

## 1. Decisión ejecutiva

**El sitio Wix está actualmente Published. No está acreditado como entorno QA aislado.** La consulta live de contexto Wix devuelve Published, Wix Editor, Velo habilitado, zona horaria `Europe/Madrid`, moneda EUR, Bookings instalado, Stores Catalog V3, Invoices V1, Members Area, Gift Cards, Blog y Forms & Payments.

Por tanto, el dominio público no puede utilizarse para pruebas que creen reservas, pedidos, pagos, reembolsos, contactos o comunicaciones hasta que exista aislamiento demostrable. El hecho de que el repositorio se utilice para QA no convierte automáticamente el sitio Wix publicado en QA.

**Recomendación preferente:** mantener `www.marianmadrid.es` intacto y crear un sitio Wix QA separado, sin dominio público ni audiencia de clientes, con configuración y credenciales independientes. La búsqueda de sitios Wix por nombre “Marian” devolvió un único sitio: el Published actual; no existe otro QA separado identificado. La duplicación oficial no copia contactos/miembros, pedidos/facturas, campañas ni triggered emails, secretos Velo ni configuración de apps de terceros; la copia queda sin dominio ni capacidades Premium y algunas apps Premium aparecen sin activar. **La documentación consultada no confirma si la duplicación copia los registros de colecciones CMS personalizadas.** Dado que existen ledgers append-only que no pueden borrarse, no duplicar el sitio hasta que Wix confirme ese comportamiento o se opte por crear un sitio QA vacío y reconstruir solo esquema/código/datos sintéticos. Tampoco está documentado que todas las definiciones/estados de Automations se omitan: habrá que reconsultarlas antes de permitir cualquier trigger. No copiar datos personales ni ledgers de producción. Si se pretende convertir el sitio actual en QA, primero debe autorizarse expresamente su despublicación y aceptarse el impacto sobre clientes y operativa. Esta referencia no realiza ninguna de esas acciones.

## 2. Autoridad documental y cómo resolver contradicciones

Orden de autoridad para cualquier prueba o cambio:

1. Documentación oficial vigente de Wix y de cada integración, usando la versión exacta instalada.
2. Configuración live de Wix consultada en la fecha de la prueba.
3. Código del repositorio en el SHA exacto revisado y sus contratos.
4. Pruebas automatizadas ejecutadas y evidencia CI del mismo SHA.
5. Pruebas Wix Runtime/E2E ejecutadas en el entorno aislado correspondiente.
6. Dossiers y requisitos de negocio, interpretados según su estado: decisión aprobada, requisito, propuesta o histórico.

Reglas:
- Un requisito declarado no demuestra implementación.
- Código presente no demuestra runtime correcto.
- CI offline con mocks no demuestra Wix Runtime ni proveedor externo.
- Una consulta REST de lectura no demuestra un flujo E2E.
- Published/Draft es un estado del sitio, no un control de aislamiento de notificaciones.
- Si dos documentos discrepan, esta referencia y la evidencia live más reciente gobiernan el estado; conservar la discrepancia histórica solo cuando sea necesaria para trazabilidad.
- No copiar como vigentes tablas, cantidades de tests, estados de PR o configuraciones con baseline anterior sin volver a verificarlos.

## 3. Baseline Wix y aplicaciones

**Verificado en la consulta live de esta revisión:**
- Estado: **Published**.
- Editor: Wix Editor.
- Velo: habilitado.
- Idioma/región: es-ES.
- Zona horaria: `Europe/Madrid`.
- Moneda: EUR.
- Contacto del sitio: `hola@marianmadrid.es`.
- Wix Bookings instalado.
- Wix Stores **Catalog V3**.
- Wix Invoices **V1**.
- Wix Members Area, Gift Cards, Blog y Forms & Payments instalados.

La instalación de una app no demuestra que una función esté configurada, habilitada, conectada a backend o probada. Para cada integración registrar versión, ID de app, permisos, configuración relevante y fecha de lectura.

## 4. Aislamiento de email, WhatsApp y SMS

### 4.1 Reauditoría live posterior a la confirmación Published

**Verificado mediante lectura oficial read-only de Wix Automations V2 el 2026-11-11:**
- 149 automatizaciones no archivadas: **27 ACTIVE y 122 INACTIVE**.
- 9 automatizaciones email permanecen ACTIVE, con **10 acciones email** en total.
- En las 10 acciones email: **8 están dirigidas al contacto que dispara el trigger** (`TRIGGER_CONTACT` o audiencia dinámica `explicitData_triggerMainContact`) y **2 al propietario del sitio** (`SITE_OWNER`). No se copiaron direcciones de email ni datos de contacto a la evidencia.
- Las nueve automatizaciones email siguen restringidas: seis tienen `disableStatusChange=true`, cuatro `readonly=true` y una reúne ambas restricciones.
- **Cuatro automatizaciones con acción WhatsApp y ocho con acción SMS están INACTIVE**; no se encontró ninguna acción WhatsApp/SMS activa en las 149 automatizaciones consultadas.
- Dos notificaciones internas de Bookings siguen ACTIVE: “Notify me when someone books one of my services” y “Notify me when I need to review a booking request”. Sus acciones son notificaciones de plataforma (`ping_platform-send_a_notification`), no WhatsApp ni email al cliente.
- No se ejecutó ningún trigger ni se envió email, WhatsApp o SMS. Esta reauditoría no modificó configuraciones.

**Consecuencia:** el sitio Published no está aislado para QA. Ocho acciones email pueden dirigirse a clientes reales si se disparan sus triggers. Las dos acciones SITE_OWNER también pueden enviar a un buzón real no validado como sink. No ejecutar eventos que alcancen estos flujos.

Automatizaciones email que permanecen activas:
- Notify customer when you save their card details.
- Notify owner on a new voicemail.
- Notify clients when their saved card was charged.
- Send an email to proceed with a task.
- Send email confirmation to site members.
- Send subscription confirmation email.
- Aria Assistant send an email (dos acciones).
- cms items limit warning email.
- Send site members a reset password email.

### 4.2 Auditoría y cambios históricos

La auditoría de aislamiento inicial del 2026-11-11 registró:
- 149 automatizaciones: 94 activas y 55 inactivas antes de la intervención.
- 75 automatizaciones activas con acciones email y una automatización WhatsApp objetivo.
- 67 cambios confirmados por lectura posterior: 66 email y 1 WhatsApp pasaron a `INACTIVE`.
- Las cuatro automatizaciones WhatsApp quedaron inactivas (tres ya lo estaban y una se pausó).
- Nueve automatizaciones email permanecieron activas por restricciones Wix.
- No se enviaron mensajes durante la intervención.

### 4.3 Restricciones y límites

- La allowlist `emailRecipientPolicy.js` protege únicamente el despacho backend Resend; no intercepta Wix Automations nativas.
- Las nueve automatizaciones email activas no quedaron aisladas. No ejecutar triggers que puedan alcanzarlas.
- Los flujos de email incluyen mensajes transaccionales/críticos (p. ej. confirmación de miembros, contraseña y cobro de tarjeta). No desactivarlos a ciegas: podría romper comunicaciones necesarias para clientes reales.
- WhatsApp y SMS nativos están inactivos en el inventario actual. No reactivarlos para pruebas.
- No se ha acreditado una integración oficialmente soportada que permita redirigir WhatsApp al móvil sintético.
- No sustituir WhatsApp por Wix Inbox, email o SMS y declarar que se ha probado WhatsApp.
- No activar automatizaciones para QA hasta acreditar aislamiento de destinatarios dinámicos, SITE_OWNER, usuarios/roles Wix y destinatarios CUSTOM.

### 4.4 Política QA de comunicaciones

Para pruebas automáticas: usar un sink/mock que no entregue mensajes. Direcciones reservadas bajo `.example.test` para fixtures; no utilizar direcciones reales como si fueran sinks. Para pruebas manuales de entrega, usar solo un buzón controlado y autorizado, después de neutralizar todos los triggers nativos que puedan enviar a terceros.

No se autoriza por esta referencia ningún envío real. Mantener bloqueado el despacho a gestoría y cualquier transporte externo no aislado.

## 5. Cliente sintético y datos de prueba

- Identidad funcional de QA autorizada: **Nacho Pitt**.
- El nombre puede aparecer en fixtures offline.
- Email y teléfono de contacto son datos potencialmente entregables: no incluirlos en Git, logs, capturas públicas ni fixtures de CI.
- Para CI/offline, usar identificadores y direcciones reservadas `.example.test`, sin teléfono enrutable y sin datos personales reales.
- En un sitio QA aislado, crear un único miembro/contacto sintético con datos de destino controlados y sin consentimiento de marketing por defecto.
- No crear ni modificar el contacto en el sitio Published actual.
- No asociar el cliente sintético a datos reales, reservas reales, pagos, documentos fiscales o históricos.

El cliente QA debe poder identificarse inequívocamente como sintético en cada registro y traza; los datos de QA no deben confundirse con actividad económica real.

## 6. Pasarela de pago y agentes externos simulados

### 6.1 Lo que existe como evidencia

La suite offline documenta un escenario Wix eCommerce/Velo `OrderPaymentStatusUpdated` con sobre de evento `metadata.id`, `data.order` y `data.previousPaymentStatus`. Se simula un pedido de 45,50 EUR, precedencia del total autoritativo, un asiento de ledger con `paymentMethod=WIX_PAYMENTS`, actualización de proyección de reserva dual e idempotencia de replay. La persistencia usa `wixDataMock`; no llama a Wix Payments, no cobra y no escribe en el CMS live.

Esta cobertura acredita el contrato mock descrito, no la cuenta de pagos, la pasarela conectada, la aceptación del emisor ni el webhook en runtime.

**Restricción Wix documentada para pruebas de checkout:** el test order nativo solo está disponible para Wix Stores/Wix Restaurants, no para Wix Bookings. Para evitar un cargo, Wix indica usar el método de pago manual. Si se usa otro método de pago, la operación cobra realmente el importe y las comisiones del proveedor. Por tanto, no usar el checkout de `www.marianmadrid.es` como simulador de Payments ni intentar una prueba con el método real. El sandbox del proveedor debe acreditarse por separado; hasta entonces, solo mock offline.

**Contacto de prueba Wix:** el flujo nativo “Generate Test Contact” crea un contacto de prueba, pero Wix indica que los emails generados durante las pruebas se envían a la persona que creó el contacto (máximo cinco contactos por sitio). No es un sink silencioso. Usarlo solo en un sitio QA aislado y con autorización explícita para recibir esos emails.

### 6.2 Diseño de simulación requerido

El agente simulado de pagos debe ser determinista, sin red ni credenciales reales, y devolver respuestas tipadas separadas del evento webhook. Casos mínimos:
- autorización/estado pendiente;
- pago confirmado;
- rechazo/fallo;
- cancelación antes de confirmación;
- reembolso parcial y total, solo cuando el contrato oficial del proveedor lo soporte;
- evento duplicado, tardío, fuera de orden o con importe/moneda discordantes;
- timeout del proveedor y recuperación/reconciliación.

No inventar nombres de estados, campos o respuestas HTTP. Cada fixture debe derivarse del contrato oficial Wix/PSP de la versión utilizada. Los estados no soportados por el contrato actual se etiquetan `NOT_IMPLEMENTED` o `CONTRACT_PENDING`, no como pruebas superadas.

El test debe verificar: importe y moneda autoritativos; identidad del pedido; relación con booking; claim/idempotencia; ausencia de doble asiento; estados de pago y reserva separados; tratamiento de reembolso; errores y reintentos; y que los ledgers append-only nunca se sobrescriben ni eliminan.

### 6.3 Agentes externos

| Agente | Modo QA permitido | Evidencia exigida |
|---|---|---|
| Wix Payments / PSP | Mock offline o sandbox oficial independiente | Contrato oficial, modo test confirmado, IDs de transacción de prueba y ausencia de cargos reales |
| Wix Bookings | Fixture offline; runtime solo en sitio QA separado | IDs sintéticos, reserva nativa y proyección reconciliadas |
| Wix Stores/eCommerce | Mock offline; sandbox si está disponible y separado | Pedido, líneas, total, pago, stock y refund reconciliados |
| Email/Resend | Sink/mock sin entrega; envío manual solo a inbox controlado | Recipient allowlist, plantilla/versionado, traceId y evidencia de no entrega a terceros |
| WhatsApp/SMS | Mock de transporte; no usar acción deprecated ni canal sustitutivo | Integración oficialmente soportada, destino QA verificable y prueba de no envío a terceros |
| CRM/Forms/Members | Fixtures; runtime solo con contacto sintético aislado | Consentimiento, minimización, ownership y routing |
| M365/Power Automate/SharePoint | Mock de export; tenant QA separado | Conexiones, DLP, permisos, idempotencia y archivo de prueba |

## 7. Estado de Capa 3 — M365 / SharePoint

Capa 3 es un diseño documental, no una integración operativa acreditada:
- No existe `src/backend/exports/exportService.js` ni jobs de exportación en `src/backend/jobs.config`.
- `verifyNightlyZClosing` no equivale a exportación a SharePoint.
- Existe un helper Resend en `fiscalDocuments.web.js`; el envío a gestoría está bloqueado por `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED=false`.
- Los snapshots trimestrales de `PaquetesGestoria` tienen implementación de código registrada, pero no equivalen a exportaciones periódicas ni a despacho externo habilitado. El agregador mensual y el transporte siguen pendientes según el estado técnico documentado.
- PA-01…PA-07 son identificadores de diseño, no prueba de flujos creados.
- Tenant M365, bibliotecas, permisos, retención, DLP y E2E Wix→M365 no están acreditados en esta referencia.

SharePoint será exclusivamente repositorio de evidencia. Nunca modificará ni gobernará datos de Capa 1. La decisión de transporte requiere ADR y validación de seguridad/licencia antes de implementarse.

## 8. Secuencia de preparación QA

**Gate 0 — proteger el sitio publicado**
1. No generar eventos de negocio en `www.marianmadrid.es`.
2. Releer automations, notificaciones, destinatarios, checkout, pagos y webhooks.
3. Resolver los nueve flujos email que no pudieron pausarse o demostrar por evidencia que no alcanzan al cliente sintético ni a terceros.
4. Confirmar si existe sandbox oficial de pagos y qué eventos ejecuta.
5. Mantener los writers fiscales, contables, laborales y de caja bloqueados.

**Gate 1 — entorno independiente**
1. Preferir un sitio Wix QA vacío, sin dominio ni plan de pago, y reconstruir únicamente páginas/esquemas necesarios, código y fixtures sintéticos.
2. Usar Wix Duplicate Site (`POST /site-actions/v1/sites/duplicate`, permiso/API key de nivel cuenta) solo después de confirmación oficial de que no copia registros CMS personalizados; no asumirlo.
3. Si se crea una copia, confirmar qué apps se han copiado y activar solo las necesarias; algunas apps Premium aparecen desactivadas.
4. Reconsultar el inventario de Automations y sus acciones/destinatarios en la copia. No inferir que los triggers se han deshabilitado solo porque no se copian triggered emails.
5. Confirmar mediante lectura posterior que no existen contactos/miembros, pedidos/facturas, campañas/triggered emails, secretos Velo, settings de apps de terceros ni datos CMS de producción.
6. Configurar Bookings, Stores V3 y Members con datos sintéticos. No asumir Payments disponible ni conectado en la copia.
7. Usar mocks/sinks para email y SMS y mock de transporte para WhatsApp; no activar canales reales.
8. Confirmar que ningún secreto de producción está disponible en QA.

**CMS Sandbox (alcance limitado):** Wix permite un sandbox de colecciones separado de Live, accesible desde el Editor; está desactivado por defecto y no afecta Live salvo que se sincronice. Sirve para contenido/preview CMS, no es un entorno aislado de Bookings, pagos, automatizaciones ni canales externos. No sincronizar Sandbox con Live durante QA.

**Gate 2 — pruebas offline**
1. Ejecutar `npm ci`, `npm run lint`, `npm test`, `npm run test:layer1` y `npm run test:layer2`.
2. Ejecutar suites de claims/idempotencia, reserva simple/dual, compensación, checkout, pagos, reembolsos, inventario y permisos.
3. Guardar SHA, workflow, resumen, fixtures y resultados. CI verde no implica runtime.

**Gate 3 — pruebas Wix Runtime aisladas**
1. Reserva simple/dual con cliente sintético.
2. Fallo de F2 y compensación/reconciliación.
3. Checkout con PSP sandbox confirmado; no live mode.
4. Repetición y desorden de webhooks.
5. Email al sink; WhatsApp solo con integración soportada y destino aislado.
6. Cancelación/reprogramación y refund sandbox.
7. Verificar que no hay ledger real, caja, fichaje, factura fiscal ni notificación a terceros.

**Gate 4 — cierre**
1. Conciliar todos los sistemas y eventos por traceId.
2. Confirmar cero efectos fuera del entorno QA.
3. Limpiar solo datos sintéticos mutables; no borrar ni alterar ledgers append-only.
4. Documentar fallos, cobertura y limitaciones.
5. Repetir regresión y revisión de diff antes de cualquier PR/merge/despliegue.

## 9. Bloqueos actuales y decisión

| Prioridad | Bloqueo | Estado |
|---|---|---|
| P0 | Sitio Wix publicado, no aislado | Bloquea E2E que genere eventos |
| P0 | Nueve automatizaciones email no pausables en última auditoría | Bloquea triggers con posible envío |
| P0 | Nueve automatizaciones email siguen activas y ocho pueden dirigirse al contacto que dispara el trigger | Bloquea cualquier evento que alcance esos flujos en el sitio Published |
| P0 | Sandbox de pagos no acreditado; Wix test order no es un sandbox PSP | Solo mock offline; test order manual solo para Stores/Restaurants, nunca para Bookings ni con un método de pago real |
| P0 | CMS productivo y ledgers append-only | No insertar ni modificar datos de negocio para QA |
| P1 | WhatsApp QA no configurado; acción nativa no soportada para reconfigurar destinatario | Solo mock hasta integración oficial |
| P1 | Cliente sintético no creado en un entorno aislado | Fixtures offline únicamente |
| P1 | Capa 3 no implantada en runtime | No realizar exportaciones reales |

## 10. Estado de validación de esta referencia

- **Verificado:** consulta live Wix actual informa Published y enumera apps/versiones indicadas.
- **Verificado históricamente:** auditoría de Automations del 2026-11-11 confirma 67 pausas, cuatro WhatsApp inactivas y nueve emails activos bloqueados por Wix.
- **Verificado en tests offline:** escenario mock de evento Wix Payments descrito en `QA-SIMULATION-2026-11.md`.
- **Declarado:** Nacho Pitt como identidad sintética QA.
- **No verificado:** sandbox PSP; configuración y automatizaciones de una futura copia QA; envío real de email/WhatsApp; creación de contacto en un sitio QA separado; runtime E2E.
- **No ejecutado en esta actualización:** duplicación de sitio, escrituras CMS, publicación/despublicación, cambio de automatizaciones, reserva, pedido, pago, refund, email, SMS, WhatsApp, SharePoint o despliegue.

## 11. Documentos de referencia

- `ESTADO_ACTUAL_PROYECTO.md`: índice operativo y decisiones recientes.
- `docs/PROJECT-STATUS.md`: estado técnico por dominio y deuda.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: arquitectura, contratos y modelos; leer con este addendum.
- `NECESIDADES WEB MARIAN.txt`: requisitos de negocio; la columna de estado no sustituye evidencia.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: diseño propuesto de Capa 3; no es prueba de implantación.
- `DIRECTRICES_DESARROLLO_CODIGO.txt`: reglas de ingeniería y QA.
- `docs/audits/2026-11-11-wix-automation-recipient-isolation.md`: inventario y cambios de aislamiento de notificaciones.
- `docs/qa/QA-SIMULATION-2026-11.md`: fixtures y cobertura mock.

Documentación oficial Wix consultada:
- [Duplicate Site API](https://dev.wix.com/docs/api-reference/account-level/sites/site-actions/duplicate-site).
- [Duplicating Your Site](https://support.wix.com/en/article/duplicating-your-site-1472847).
- [CMS Sandbox and Live Collections](https://support.wix.com/en/article/cms-about-sandbox-and-live-collections-and-syncing).
- [Creating a Wix Test Contact](https://support.wix.com/en/article/wix-contacts-creating-a-test-contact).
- [Previewing the Checkout Process](https://support.wix.com/en/article/previewing-the-checkout-process-2).
- [Query Automations](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations) y [Get Automation Email Action](https://dev.wix.com/docs/api-reference/business-management/marketing/emails/automation-email-action/get-automation-email-action).

**Regla final:** hasta que exista un sitio Wix QA independiente o una autorización expresa y un plan seguro para cambiar el estado del sitio publicado, las pruebas de negocio se limitan a mocks offline y lecturas que no disparen efectos externos.

## 12. Corrección de QA offline — paginación de personal (2026-11-11)

**Cambio en rama:** `fix/staff-pagination-fail-closed-2026-11-11`.

- `src/backend/staff.js`: si la página 20 conserva un cursor `next`, lanza `STAFF_PAGINATION_LIMIT_EXCEEDED` en vez de aceptar una lista truncada. Los resolvers públicos mantienen `null`/`[]` y el cierre seguro; los logs registran también `errorCode`.
- `src/backend/tests/staff.identity.contract.test.mjs`: `STAFF-SDK-04` simula 20 páginas con cursor pendiente y demuestra que la fila encontrada en la primera página no se devuelve como resultado completo ni por búsqueda de recurso ni por listado global.
- `docs/DECISION-LOG.md`: decisión TEC-030, justificación y reversión.

**Estado:** CI GitHub Actions verde en el commit `6c0510a30b80b76f2f79cc6573082a0df4c825e2`: `npm test` ejecutó 62 suites y 579 tests (0 fallos); contratos Wix eCommerce Cart V2, Order Transactions y Bookings Reader V2 correctos; ESLint correcto; Gitleaks full-history correcto. No se ejecutó localmente por falta de conectividad de red. Runtime Wix sigue pendiente. No se ha modificado Wix, CMS, automatizaciones ni datos de negocio.
