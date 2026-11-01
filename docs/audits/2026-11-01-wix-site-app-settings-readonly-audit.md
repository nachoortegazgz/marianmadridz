# Auditoría de ajustes del sitio y paneles Wix — solo lectura

- **Fecha/hora:** 2026-11-01 14:02 Europe/Madrid
- **Sitio:** Marian Madrid Peluquería y Estética
- **Dominio:** https://www.marianmadrid.es
- **Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`
- **Repositorio:** `nachoortegazgz/marianmadridz`
- **Rama auditada:** `main` · `f3c5424b232a176efb324d7f7eeeec953c24ca3f`
- **Método:** Wix APIs oficiales de lectura y contraste con módulos/documentación del repositorio.
- **Seguridad:** no se ejecutaron escrituras, cambios de configuración, reservas, cobros, reembolsos, publicaciones ni cambios de permisos.

## 1. Resumen ejecutivo

La configuración general del sitio (idioma, moneda, zona horaria, ubicación y horario comercial) coincide con los identificadores canónicos del proyecto. La configuración de Bookings, Checkout, Forms, Automations, Stores, Invoices y SEO contiene, sin embargo, varios puntos que deben resolverse antes de certificar una operación integrada.

| Prioridad | Hallazgo | Riesgo de integración |
|---|---|---|
| P0 | Bookings permite reservar con 14 días de antelación, mientras el calendario/backend se ha ampliado a 15 días | El día 15 puede mostrarse como disponible y ser rechazado por Wix |
| P0 | Política nativa permite cancelar hasta 12 h antes, pero el texto al cliente anuncia 24 h | Regla efectiva y condiciones comunicadas no coinciden |
| P0 | Casilla de aceptación de políticas del checkout aparece marcada por defecto | Requiere revisión legal/UX; no modificar sin validar el flujo contractual |
| P1 | Los 94 servicios tienen asignados los tres profesionales | Confirmar que cada profesional puede prestar todos los servicios |
| P1 | Hay formularios nativos de caja y fichaje habilitados; no se ve en sus esquemas un destino de backend | Riesgo de formularios sin uso o de escrituras paralelas que eviten RBAC/ledgers |
| P1 | Existen automatizaciones nativas de Bookings activas, incluidas dos notificaciones de personal con el mismo trigger | Posibles notificaciones duplicadas; mapear antes de desactivar |
| P1 | El checkout está en modo real (`testMode=DISABLED`) | No hacer pruebas de pago sobre el sitio productivo |
| P1 | El texto legal conserva enlaces a la plataforma ODR europea, cerrada desde 20-07-2025 | Actualizar textos y enlaces tras revisión legal |
| P2 | El inventario de App IDs del dossier no refleja Blog y Promote SEO; Events no queda reconciliado | Mantener inventario vivo de apps y sus IDs |
| P2 | La API de instalación devuelve 103 instancias con estado `UNKNOWN` | `enabled=true` no demuestra salud ni configuración funcional |

## 2. Ajustes generales del sitio

Lectura de Site Properties: HTTP 200, versión de propiedades 195.

| Ajuste | Valor observado | Evaluación |
|---|---|---|
| Idioma / país | es / ES | Coherente |
| Moneda | EUR | Coherente |
| Zona horaria | Europe/Madrid | Coherente con SDK_CONFIG.TZ |
| Ubicación | Calle Maurice Ravel 35, Local, 50012 Zaragoza | Coherente con LOCATION_ID |
| Email / teléfono | hola@marianmadrid.es / +34 876 538 870 | Coherente con el dossier |
| Horario comercial | L-V 09:00–20:00; sábado 08:30–14:30; domingo sin periodo de apertura | Confirmar contra horarios individuales de cada profesional |
| Horarios especiales | cierres configurados en fechas señaladas entre 2026 y 2030 | Revisar cada año antes de publicar calendario |
| Consent policy | essential=true; functional=true; analytics=true; advertising=true; dataToThirdParty=false | No prueba el comportamiento del banner ni el bloqueo previo de scripts |
| Track clicks analytics | false | Confirmar si se desea medir clics con Wix Analytics |

**Pendiente de panel:** comprobar en el gestor de consentimiento que el banner presenta opciones equivalentes de aceptar/rechazar/configurar y que analítica/publicidad no se cargan antes del consentimiento exigible. La respuesta de Site Properties no acredita ese comportamiento.

## 3. Wix Bookings — servicios, profesionales y política

### 3.1 Catálogo nativo

Consulta Services V2 con paginación completa (94 registros):

| Indicador | Resultado |
|---|---:|
| Servicios totales | 94 |
| Tipo APPOINTMENT | 94 |
| Visibles | 70 |
| Ocultos | 24 |
| Servicios F2 ocultos | 24 |
| Online booking habilitado | 94 |
| Servicios visibles con pago online | 70 |
| Servicios F2 con pago online | 0 |
| Servicios con pago presencial | 94 |
| Servicios sin profesional asignado | 0 |

Los 24 F2 están ocultos, tienen tarifa nativa `NO_FEE`, pago online desactivado y pago presencial habilitado. Es coherente con el diseño de dos fases: el cobro debe recaer en F1 y F2 no debe originar un segundo cobro. La visibilidad oculta no equivale a deshabilitar el servicio en la API; el backend debe resolverlo por GUID y por la relación canónica del CMS.

**Discrepancia ya identificada en la auditoría Bookings del 31-10:** 16 de los 24 registros F2 de `ServiciosCatalogo` tienen `onlinePayment=true`, mientras Bookings nativo tiene `payment.options.online=false`. No se ha demostrado impacto en el checkout F1 actual, pero el metadato CMS debe reconciliarse de forma controlada en QA antes de cerrar el contrato de catálogo.

### 3.2 Profesionales e identificadores

La consulta Staff Members V2 devuelve tres profesionales de servicio:

| Profesional | staffMemberId | resourceId | eventsScheduleId |
|---|---|---|---|
| Marian | `0114748d-2806-3928-9b97-ff0d09853759` | `e556070a-6d6a-402e-8422-11133033ea76` | `06af20d4-1ec3-49fa-9075-f0691dfa7fd4` |
| Andrea | `bf177b1a-483a-4c03-9960-8da0aa0b8b41` | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `a494b829-8161-4b84-b78d-6ffed45b4abe` |
| Alba | `c5563137-1124-4366-abe0-1afe56418968` | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `94b8980d-63f4-43b1-ba86-41075e0eb63c` |

La auditoría de Bookings del 31-10 cruzó estos identificadores con `MapaStaff` y confirmó coincidencia en los tres registros. Mantener la distinción:
- `staffMemberId`: identidad del profesional en Bookings.
- `resourceId`: recurso que debe viajar con el slot y la reserva.
- `scheduleId`: calendario de eventos asociado al recurso.

**Hallazgo de asignación:** los 94 servicios tienen asignados los tres `staffMemberIds`. Es una configuración amplia; confirmar que Marian, Andrea y Alba están habilitadas para todas las familias de servicios. No cambiar asignaciones hasta disponer de la matriz de competencias aprobada.

### 3.3 Política de reservas por defecto

Política `288a6d74-b054-4289-b10a-e2d826fc9a6e`, revisión 20:

| Regla | Valor efectivo | Texto/expectativa detectada |
|---|---:|---|
| Antelación mínima | 20.160 min = 14 días | Calendario/backend actual: 15 días |
| Antelación mínima para reservar | 480 min = 8 h | No contrastada con copy del sitio |
| Cancelación | 720 min = 12 h | Copy de política/checkout: 24 h |
| Reprogramación | 1.440 min = 24 h | Coincide con el texto de 24 h |
| Lista de espera | Desactivada | No se ha confirmado que sea necesaria |
| Participantes máximos | 1 | Coherente con citas individuales |
| Política de recursos | Desactivada; autoasignación false | Revisar conjuntamente con asignación de staff y slots |
| Reserva después del inicio | Desactivada | Conserva bloqueo de citas iniciadas |
| Cargo automático por cancelación | Desactivado | No asumir que Wix retiene o cobra una fianza automáticamente |
| Guardar tarjeta | Desactivado | No se debe presuponer cargo posterior automático |

La descripción libre de la política menciona gestión de fases, aviso de 24 h y posible pérdida de depósito/cargo. La regla nativa de cancelación está en 12 h y la política de cargo automático está desactivada. El copy no debe prometer una retención/cobro que la configuración no ejecuta.

### 3.4 Acción recomendada

1. Elegir una sola ventana de reserva: 14 días o 15 días. Recomendación técnica: alinear la política nativa con 15 días solo si esa es la decisión comercial aprobada y el endpoint/UX ha sido validado.
2. Elegir una sola regla de cancelación. Si el negocio mantiene 24 h, configurar 1.440 min en la política y comprobar la UX de Bookings; si mantiene 12 h, corregir el texto legal y las comunicaciones.
3. Confirmar asignación de servicios por profesional y horarios individuales en el panel Bookings.
4. Mantener F2 ocultos y sin pago online; no usar Multi-Service Booking. La saga propia sigue siendo la autoridad del flujo dual.

## 4. Wix Checkout / eCommerce

Consulta Checkout Settings: HTTP 200.

| Ajuste | Valor observado |
|---|---|
| Modo de prueba | `DISABLED` (checkout real) |
| Política de términos | Visible |
| Política de privacidad | Visible |
| Política de devoluciones | Visible |
| Contacto | Visible |
| Política personalizada legal/fiscal | Visible |
| Checkbox de aceptación de políticas | Visible y `checkedByDefault=true` |
| Checkbox de suscripción | Visible y `checkedByDefault=false` |
| Canje de tarjetas regalo | Habilitado |
| MIT | Habilitado |
| Captura diferida | Deshabilitada |
| Captura antes de caducidad | Habilitada |
| Recomendaciones de compra | Deshabilitadas |
| Campos de facturación | `All_FIELDS` |

### Riesgos y acciones

- El checkout está en modo real. Las pruebas de pago deben realizarse en un sitio QA aislado o con un modo de prueba habilitado de forma controlada y revertido; no ejecutar tarjetas de prueba en producción.
- La aceptación de términos aparece marcada por defecto. Revisión legal/UX prioritaria; no cambiar sin validar el comportamiento del checkout y los requisitos aplicables.
- Los textos visibles contienen importes de IVA, depósitos, condiciones de cancelación, desistimiento y datos identificativos. Deben mantenerse sincronizados con Bookings, el proceso real de cobro y la fiscalidad aprobada.
- Los textos de política de devoluciones y condiciones incluyen enlaces a la plataforma ODR europea. La Comisión confirma que la plataforma dejó de funcionar el 20-07-2025; retirar el enlace y revisar el texto de resolución alternativa de litigios con asesoría legal. Fuente: https://consumer-redress.ec.europa.eu/site-relocation_en y Reglamento (UE) 2024/3228.
- No se ha verificado desde esta API qué proveedor de pago está conectado ni su estado de onboarding. El listado de tipos de pago disponibles en España/EUR no equivale a los métodos habilitados en la cuenta del comercio.

## 5. Forms — formularios nativos encontrados

Query Forms: 4 formularios habilitados. Los esquemas muestran campos y targets, pero no devuelven una acción de envío o destino de colección que permita demostrar su integración con los módulos Velo.

| Formulario | Campos principales | Riesgo/acción |
|---|---|---|
| FORM MOVIMIENTO CAJA MANUAL | entrada_salida, cantidad, razon, staff_id, fecha_y_hora | Verificar si está publicado; cualquier movimiento debe pasar por el backend y RBAC, no por escritura directa a ledger |
| FORM CONTROL X | hora_registro, conteo_metalico, conteo_tarjetas, anotaciones, staff_id | Verificar destino y que no sustituya el cierre/control X del backend |
| FORMULARIO DE CONTACTO BÁSICO | first_name, email, phone, message, file upload | Confirmar destino CRM, consentimiento y automatización de respuesta |
| FORM REGISTRO HORARIO | tipo_fichaje, fecha_y_hora, nota, staff_id | No permitir que un formulario nativo escriba directamente en el ledger laboral append-only |

**Regla de integración:** los formularios administrativos no deben escribir directamente en `MovimientosCaja`, `CajaActual`, `HistoricoCierresZ` ni `RegistrosHorariosStaff`. El backend debe autenticar, autorizar, validar, registrar trazabilidad e imponer invariantes. La existencia de un formulario no prueba que esté publicado ni conectado.

## 6. Wix Automations — coexistencia con backend

La API de Automations devuelve automatizaciones preinstaladas y creadas por apps. La consulta general devolvió una primera página de 100 resultados con `hasNext=true`; por tanto, los recuentos siguientes se limitan a la primera página cuando así se indica.

- Primera página: 27 reglas con trigger de Bookings; 19 activas y 8 inactivas.
- Se encontraron dos reglas activas llamadas “Notify me when someone books one of my services”, ambas con trigger `wix_bookings-sessions_booked`.
- Hay automatizaciones activas para confirmación al cliente, cancelación, solicitud pendiente, cita confirmada/declinada y cambios de cita.
- Consulta separada `origin=APPLICATION`: 32 reglas; 11 activas y 21 inactivas. Las cinco automatizaciones propias del proyecto dedicadas a análisis/pruebas/checklist de reservas o CMS están inactivas.
- No se detectaron automatizaciones propias activas para crear reservas o escribir ledgers. La comunicación de reserva depende en buena parte de automatizaciones nativas de Bookings.

**Acción:** elaborar una matriz “evento Bookings → notificación Wix → acción backend → destinatario” y comprobar duplicidades antes de activar notificaciones propias. No desactivar automatizaciones preinstaladas a ciegas: algunas pueden cubrir avisos de cancelación, confirmación o cambios que el backend no envía.

El código revisado en `bookingSaga.js` y `events.js` no contiene un emisor propio de email/SMS/WhatsApp; el backend crea/sincroniza reservas y la capa de Automations nativa gestiona notificaciones. La prueba de correo real sigue pendiente.

## 7. Stores, Invoices y SEO

| App/área | Estado observado | Integración |
|---|---|---|
| Stores | `V1_CATALOG` | Coherente con `storesCatalog.js`; no migrar a V3 sin ADR y QA |
| Invoices | App habilitada; settings revision 1, nextNumber 1 | El backend documentado no consume Wix Invoices API. Mantener separado del ledger fiscal propio hasta ADR; el dato nextNumber no demuestra que no existan facturas emitidas |
| SEO | Tags globales devuelven description, keywords, og:image y verificaciones Google/Bing | No se devuelve directiva global `noindex`/ `none`; esto no acredita indexación de Google ni restricciones individuales por página |
| Blog | App habilitada | Confirmar si su contenido y automatizaciones se usan operativamente |

La tabla de App IDs del dossier debe ampliarse con Blog (`14bcded7-0066-7c35-14d7-466cb3f09103`) y Promote SEO (`1480c568-5cbd-9392-5604-1148f5faffa0`). El App ID de Events documentado en §22.2 no apareció en la lista de instancias instalada; una automatización de Events utiliza otro ID de trigger. Reconciliar el identificador en el panel antes de cambiar §22.2.

## 8. Apps instaladas y pagos

- Get Installed Apps devolvió 103 instancias; todas las devueltas tenían `enabled=true` y `status=UNKNOWN`.
- Se pudieron asociar por App ID con el inventario del dossier ocho apps: Bookings, Stores, Members, Forms & Payments, Invoices, Gift Cards, Blog y Promote SEO.
- Las otras 95 instancias no deben tratarse automáticamente como apps de terceros o defectuosas: la API devuelve instancias técnicas cuyo nombre no está incluido en esta respuesta. Requieren inventario visual desde el panel.
- List Site Payment Method Types devolvió 187 tipos disponibles para ES/EUR. Este endpoint informa de tipos disponibles/localizados; no demuestra que estén conectados o habilitados en la cuenta.
- **Pendiente exclusivamente de panel:** Wix Dashboard → Aceptar pagos / métodos de pago: proveedor conectado, onboarding completado, métodos activados, divisa y modo de operación. No se encontró en las APIs de lectura consultadas un endpoint de cuenta que permita certificar desde aquí ese estado.

## 9. Matriz de integración entre panel y backend

| Sistema Wix | Autoridad / función | Módulo del proyecto | Regla de convivencia |
|---|---|---|---|
| Bookings | Servicios, slots, staff y reservas nativas | `bookingSaga.js`, `reservas.web.js`, `events.js`, `citasManager.web.js` | No duplicar slots ni reservas en CMS; respetar `serviceId`, `resourceId`, `scheduleId` |
| ServiciosCatalogo | Metadatos del negocio y vínculo F1/F2 | `bookingSaga.js` + validación de catálogo | Reconciliar 16/24 metadatos F2; F1 cobra, F2 oculto y sin pago online |
| MapaStaff | Mapeo identidad/recurso/rol | `internalConfig.js`, `staff.js` y RBAC | No confundir `staffMemberId` con `resourceId` |
| Wix Automations | Emails/avisos nativos | Eventos nativos Bookings | No crear notificación paralela sin matriz de eventos |
| Checkout/eCommerce | Checkout, pago y pedido | Cart V2 / `citasManager.web.js` / webhook payment | Solo evento de pago confirma pago; no sustituye estado de booking |
| Forms | Captura de datos | WebMethods backend de caja, control X y fichaje | Prohibida escritura directa de formularios a ledgers |
| Stores | Catálogo y stock | `storesCatalog.js`, mapper, inventario | V1 activo; mantener adapter; V3 solo tras ADR |
| Invoices | Facturación nativa Wix | Ledger fiscal propio | No emitir por dos motores en paralelo |
| Members | Identidad y sesión | `MapaStaff` + RBAC | No autorizar por email; usar identidad Member validada |
| Promote SEO / Blog | SEO y contenidos | Sitio público / CMS contenido | No mezclar con procesos operativos/fiscales |

## 10. Plan de corrección y validación

### P0 — antes de probar reservas/pagos reales
1. Decidir 14 vs 15 días y alinear política Bookings, calendario y backend.
2. Decidir 12 h vs 24 h de cancelación y alinear configuración nativa, política visible, checkout y automatizaciones.
3. Revisar checkbox de términos marcado por defecto con asesoría legal.
4. Sustituir enlaces ODR obsoletos y revisar textos legales afectados.

### P1 — antes de certificar el ecosistema
5. Validar matriz de servicios por profesional y horarios individuales.
6. Auditar publicación, permisos y destino de los cuatro formularios nativos.
7. Revisar automatizaciones activas y eliminar duplicidades solo después de confirmar destinatarios/acciones.
8. Comprobar consentimiento/cookie banner y scripts antes de consentimiento.
9. Verificar proveedor de pagos y onboarding manualmente en el panel.
10. Realizar QA completo en un sitio de pruebas aislado; no cambiar `testMode` ni ejecutar pagos de prueba en producción.

### P2 — higiene documental y apps
11. Actualizar App IDs de Blog y Promote SEO; resolver Events.
12. Identificar las instancias de apps no mapeadas y documentar solo las que tengan función real.
13. Mantener Stores Catalog V1 e Invoices V1 en sus límites actuales hasta decisión ADR.

## 11. Límites de esta auditoría

No se pudo certificar mediante las APIs consultadas: estado del proveedor de pagos/onboarding, banner y bloqueo real de cookies, horarios individuales efectivos, configuración de recordatorios en el panel, destinatarios finales de cada automation, publicación real de cada formulario, permisos de usuarios dentro de cada app ni SEO por página. Estos puntos quedan como revisión manual en los paneles Wix correspondientes.

No se han ejecutado cambios. Las acciones P0/P1 son recomendaciones, no modificaciones realizadas.

## 12. Fuentes oficiales

- [Get Site Properties](https://dev.wix.com/docs/api-reference/business-management/site-properties/properties/get-site-properties)
- [Get Installed Apps](https://dev.wix.com/docs/api-reference/business-management/app-installation/app-installation/get-installed-apps)
- [Bookings Services V2 — Query Services](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services)
- [Bookings Staff Members V2 — Query Staff Members](https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members-v-2)
- [Bookings Policies — Query Booking Policies](https://dev.wix.com/docs/api-reference/business-solutions/bookings/policies/booking-policies/query-booking-policies)
- [eCommerce — Get Checkout Settings](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/checkout/checkout-settings/get-checkout-settings)
- [Invoices — Get Invoices Settings](https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices/invoices-settings/get-invoices-settings)
- [Automations V2 — Query Automations](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations)
- [Forms V4 — Query Forms](https://dev.wix.com/docs/api-reference/crm/forms/form-schemas/query-forms)
- [SEO — Get Site SEO Tags](https://dev.wix.com/docs/api-reference/business-management/seo/site-seo-tags-v1/get-site-seo-tags)
- [Stores — Get Catalog Version](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/get-catalog-version)
- [Payments — List Site Payment Method Types](https://dev.wix.com/docs/api-reference/business-management/payments/site-payment-method-types/list-site-payment-method-types)
- [Comisión Europea — cierre de la plataforma ODR](https://consumer-redress.ec.europa.eu/site-relocation_en)
- [Reglamento (UE) 2024/3228](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R3228)
