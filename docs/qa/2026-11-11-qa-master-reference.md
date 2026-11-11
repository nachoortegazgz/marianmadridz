# Referencia maestra QA y estado de aislamiento — Marian Madrid

**Fecha de revisión:** 2026-11-11  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline documental:** merge de PR #294 · `3aed055c9622da71505f5f9927b35f6516e6b906`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · https://www.marianmadrid.es/  
**Estado de esta referencia:** documento consultivo vigente; no equivale a certificación E2E ni autoriza operaciones reales.

## 1. Decisión ejecutiva

**El sitio Wix está actualmente Published. No está acreditado como entorno QA aislado.** La consulta live de contexto Wix devuelve Published, Wix Editor, Velo habilitado, zona horaria `Europe/Madrid`, moneda EUR, Bookings instalado, Stores Catalog V3, Invoices V1, Members Area, Gift Cards, Blog y Forms & Payments.

Por tanto, el dominio público no puede utilizarse para pruebas que creen reservas, pedidos, pagos, reembolsos, contactos o comunicaciones hasta que exista aislamiento demostrable. El hecho de que el repositorio se utilice para QA no convierte automáticamente el sitio Wix publicado en QA.

**Recomendación preferente:** mantener `www.marianmadrid.es` intacto y crear un sitio Wix QA separado, sin dominio público ni audiencia de clientes, con configuración y credenciales independientes. No copiar datos personales ni ledgers de producción. Si se pretende convertir el sitio actual en QA, primero debe autorizarse expresamente su despublicación y aceptarse el impacto sobre clientes y operativa. Esta referencia no realiza ninguna de esas acciones.

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

### 4.1 Última auditoría disponible de Wix Automations

La auditoría de aislamiento fechada 2026-11-11 registró:
- 149 automatizaciones inventariadas: 94 activas y 55 inactivas al inicio.
- Se intentó pausar 76 automatizaciones objetivo: 75 de email y 1 de WhatsApp.
- 67 cambios se confirmaron por lectura posterior: 66 email y 1 WhatsApp pasaron a `INACTIVE`.
- Cuatro automatizaciones WhatsApp quedaron inactivas (tres ya lo estaban y una se pausó).
- Nueve automatizaciones de email permanecieron activas porque Wix las marcó `readonly` y/o `disableStatusChange`.
- No se identificaron automatizaciones SMS activas en ese inventario.
- No se envió ningún email, WhatsApp ni SMS.

**Límite temporal:** no se ha vuelto a leer la configuración completa de Automations después de la consulta live actual que devuelve el sitio Published. Los recuentos anteriores son el último estado auditado, no una garantía del estado actual. Antes de cualquier E2E hay que repetir inventario, leer destinatarios y triggers, y comprobar los estados actuales.

### 4.2 Restricciones

- La allowlist `emailRecipientPolicy.js` protege únicamente el despacho backend Resend; no intercepta Wix Automations nativas.
- Nueve automatizaciones email no quedaron aisladas en la última auditoría. No ejecutar triggers que puedan alcanzarlas.
- Las cuatro automatizaciones WhatsApp estaban inactivas en la última auditoría; no se ha acreditado una integración soportada para cambiar el destinatario al móvil sintético.
- El móvil QA `666724634` no se configuró y no recibió mensajes.
- No se identificaron automatizaciones SMS activas en la última auditoría; volver a verificar antes de probar.
- No sustituir WhatsApp por Wix Inbox, email o SMS y declarar que se ha probado WhatsApp: son canales distintos.
- No activar automatizaciones para pruebas hasta acreditar aislamiento de todos los destinatarios, incluidos destinatarios dinámicos, SITE_OWNER, usuarios/roles Wix y destinatarios CUSTOM.

### 4.3 Política QA de comunicaciones

Para pruebas automáticas: usar un sink/mock que no entregue mensajes. Direcciones reservadas bajo `.example.test` para fixtures; no utilizar direcciones de clientes. Para pruebas manuales de entrega, solo usar un buzón de pruebas controlado y autorizado, tras neutralizar todos los triggers nativos que puedan enviar a terceros. No usar una dirección real como si fuera un sink.

No se autoriza por este documento ningún envío real. Mantener desactivado el despacho a gestoría y cualquier transporte externo no aislado.

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
1. Crear sitio Wix QA separado, sin dominio de clientes.
2. Configurar Bookings, Stores V3, Members y Payments con IDs/credenciales de test independientes.
3. Revisar las automatizaciones heredadas y desactivarlas o redirigirlas solo mediante mecanismos soportados y verificables.
4. Sembrar datos sintéticos mínimos; no clonar CMS ni ledgers productivos.
5. Configurar sinks de email/SMS y mocks de WhatsApp; no activar canales reales.
6. Confirmar que ningún secreto de producción está disponible en QA.

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
| P0 | Estado actual de Automations no releído tras la última consulta de sitio | Requiere auditoría live de solo lectura antes de pruebas |
| P0 | Sandbox de pagos no acreditado | Solo mock offline |
| P0 | CMS productivo y ledgers append-only | No insertar ni modificar datos de negocio para QA |
| P1 | WhatsApp QA no configurado; acción nativa no soportada para reconfigurar destinatario | Solo mock hasta integración oficial |
| P1 | Cliente sintético no creado en un entorno aislado | Fixtures offline únicamente |
| P1 | Capa 3 no implantada en runtime | No realizar exportaciones reales |

## 10. Estado de validación de esta referencia

- **Verificado:** consulta live Wix actual informa Published y enumera apps/versiones indicadas.
- **Verificado históricamente:** auditoría de Automations del 2026-11-11 confirma 67 pausas, cuatro WhatsApp inactivas y nueve emails activos bloqueados por Wix.
- **Verificado en tests offline:** escenario mock de evento Wix Payments descrito en `QA-SIMULATION-2026-11.md`.
- **Declarado:** Nacho Pitt como identidad sintética QA.
- **No verificado:** estado actual de Automations tras la consulta Published; aislamiento de destinatarios; sandbox PSP; envío real de email/WhatsApp; creación de contacto en un sitio QA separado; runtime E2E.
- **No ejecutado en esta actualización:** escrituras Wix, creación de sitio, publicación/despublicación, cambio de automatizaciones, reserva, pedido, pago, refund, email, SMS, WhatsApp, SharePoint o despliegue.

## 11. Documentos de referencia

- `ESTADO_ACTUAL_PROYECTO.md`: índice operativo y decisiones recientes.
- `docs/PROJECT-STATUS.md`: estado técnico por dominio y deuda.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: arquitectura, contratos y modelos; leer con este addendum.
- `NECESIDADES WEB MARIAN.txt`: requisitos de negocio; la columna de estado no sustituye evidencia.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: diseño propuesto de Capa 3; no es prueba de implantación.
- `DIRECTRICES_DESARROLLO_CODIGO.txt`: reglas de ingeniería y QA.
- `docs/audits/2026-11-11-wix-automation-recipient-isolation.md`: inventario y cambios de aislamiento de notificaciones.
- `docs/qa/QA-SIMULATION-2026-11.md`: fixtures y cobertura mock.

**Regla final:** hasta que exista un sitio Wix QA independiente o una autorización expresa y un plan seguro para cambiar el estado del sitio publicado, las pruebas de negocio se limitan a mocks offline y lecturas que no disparen efectos externos.
