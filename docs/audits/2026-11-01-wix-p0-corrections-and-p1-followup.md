# Correcciones P0 de Wix y seguimiento P1 — 2026-11-01

- Sitio: https://www.marianmadrid.es
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Repositorio: `nachoortegazgz/marianmadridz`
- Ejecución: APIs REST oficiales Wix, sobre el sitio de producción.
- Alcance: cambios limitados a política predeterminada de Bookings y Checkout Settings.
- No se han creado/cancelado reservas, cobrado, reembolsado, publicado páginas, cambiado permisos ni modificado el modo de pagos.

## 1. P0 — cambios aplicados

### 1.1 Ventana de reserva

Política predeterminada `288a6d74-b054-4289-b10a-e2d826fc9a6e`:

| Campo | Antes | Después |
|---|---:|---:|
| `limitEarlyBookingPolicy.earliestBookingInMinutes` | 20.160 (14 días) | 21.600 (15 días) |
| Revisión | 20 | 21 |

Se mantuvo `limitEarlyBookingPolicy.enabled=true`. La decisión alinea Wix Bookings con el límite de 15 días ya definido en `SLOT_SEARCH.DIAS_LIMITE` del backend.

### 1.2 Cancelación

En la misma política:

| Campo | Antes | Después |
|---|---:|---:|
| `cancellationPolicy.latestCancellationInMinutes` | 720 (12 h) | 1.440 (24 h) |

Se conservaron `cancellationPolicy.enabled=true` y `limitLatestCancellation=true`. La actualización quedó confirmada por Wix en revisión 21.

### 1.3 Aceptación de políticas en Checkout

Se actualizó `checkoutFields.policyAgreementCheckbox`:

- `visible=true` (se mantiene).
- `checkedByDefault=false` (antes `true`).

La API confirmó el nuevo valor. El cambio no altera la casilla independiente de suscripción comercial.

### 1.4 Enlaces ODR obsoletos

Se eliminaron únicamente las referencias a `https://ec.europa.eu/consumers/odr` y los párrafos dedicados a esa plataforma, ya cerrada, en:

- `checkoutPolicies.returnPolicy`
- `checkoutPolicies.contactUs`
- `checkoutPolicies.customPolicy`

Se conservaron el resto de textos y las vías de contacto/reclamación que ya figuraban. No se añadió una vía alternativa ni se reescribieron cláusulas legales. Los textos completos siguen requiriendo revisión jurídica y fiscal antes de considerarlos validados.

## 2. Verificaciones P1 realizadas en modo lectura

### 2.1 Servicios y profesionales

La auditoría anterior encontró 94 servicios de tipo `APPOINTMENT`, todos con los tres profesionales asignados. La lectura de datos no acredita que cada profesional esté cualificado para cada tratamiento ni que los horarios individuales sean correctos.

**Pendiente de validación por el negocio:** matriz servicio × profesional, competencias, ausencias y horarios. No se cambiaron asignaciones.

### 2.2 Formularios

Se listaron los cuatro esquemas Wix Forms; todos aparecen con `enabled=true` y `submissionAccess=OWNER_AND_COLLABORATORS`.

| Formulario | ID | Post-submission observado |
|---|---|---|
| FORM CONTROL X | `499db319-0cec-4f1d-ab76-23291cb721cf` | Upsert de contacto sin mapeos |
| FORM MOVIMIENTO CAJA MANUAL | `2c28c8bb-c5c7-4821-8adf-ee993524956f` | Sin trigger post-submission |
| FORM REGISTRO HORARIO | `ec10efc3-8030-4962-9205-5741b537b6d7` | Upsert de contacto sin mapeos |
| FORMULARIO DE CONTACTO BÁSICO | `a5257139-a11a-4cf5-81c3-7307c961cfad` | Upsert de contacto con email, teléfono y nombre |

La consulta de automatizaciones con trigger `wix_form_app-form_submitted` devolvió cero reglas. La API de esquemas no demuestra si los formularios están insertados en páginas publicadas ni si existe un receptor externo no visible en esos esquemas.

**Acción pendiente:** revisar visualmente publicación/embebido, ubicación, submit settings, permisos y destino real. No deshabilitar los formularios internos sin confirmar su uso. En ningún caso deben escribir directamente en ledgers; las operaciones de caja/fichaje deben pasar por WebMethods backend con autenticación, RBAC, validación e idempotencia.

### 2.3 Automatizaciones de Bookings

La consulta por `wix_bookings-sessions_booked` devolvió cinco reglas. La aparente duplicidad de las dos reglas activas con nombre “Notify me when someone books one of my services” **no es una duplicidad demostrada del mismo canal**:

- Una ejecuta notificaciones internas a colaboradores mediante `ping_platform-send_a_notification`.
- La otra ejecuta correo transaccional mediante `triggered-emails`, dirigido a `staff_member_email`, `business_email` y roles de colaboradores.

También se observó activa la confirmación por email al cliente. No se desactivó ninguna regla. La distinción de canales debe mantenerse en el inventario para evitar retirar avisos operativos útiles.

### 2.4 Pagos, cookies y QA

- Checkout continúa en modo real (`testMode=DISABLED` según auditoría previa). No se ejecutaron pagos.
- La API consultada no certifica proveedor conectado ni onboarding de pagos. Revisión manual requerida en Dashboard → Aceptar pagos.
- `consentPolicy` no demuestra el bloqueo efectivo de scripts. Revisar el banner y la carga de analítica/publicidad antes del consentimiento desde el sitio publicado.
- No se ejecutó QA E2E ni prueba de checkout: requiere sitio QA aislado, cuentas y datos ficticios.

## 3. P2 — pendientes documentales

- Reconciliar los App IDs de Blog, Promote SEO y Events con el inventario del dossier.
- Identificar las 95 instancias de apps/servicios no mapeadas sin clasificarlas automáticamente como fallos.
- Mantener Stores Catalog V1 e Invoices V1; no migrar ni unificar motores sin ADR.

## 4. Fuentes oficiales

- [Get Booking Policy](https://dev.wix.com/docs/api-reference/business-solutions/bookings/policies/booking-policies/get-booking-policy)
- [Update Booking Policy](https://dev.wix.com/docs/api-reference/business-solutions/bookings/policies/booking-policies/update-booking-policy)
- [Get Checkout Settings](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/checkout/checkout-settings/get-checkout-settings)
- [Update Checkout Settings](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/checkout/checkout-settings/update-checkout-settings)
- [List Forms](https://dev.wix.com/docs/api-reference/crm/forms/form-schemas/list-forms)
- [Query Automations](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations)
- [Comisión Europea: cierre de la plataforma ODR](https://consumer-redress.ec.europa.eu/site-relocation_en)
- [Reglamento (UE) 2024/3228](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R3228)

## 5. Estado

- P0.1 ventana 15 días: **APLICADO**
- P0.2 cancelación 24 h: **APLICADO**
- P0.3 checkbox no preseleccionado: **APLICADO**
- P0.4 enlaces ODR retirados: **APLICADO**
- P1 matriz de competencias/horarios: **PENDIENTE DE VALIDACIÓN DEL NEGOCIO**
- P1 formularios publicados/destino: **PENDIENTE DE REVISIÓN VISUAL Y FUNCIONAL**
- P1 proveedor de pagos y consentimiento: **PENDIENTE DE PANEL**
- P1 QA E2E aislado: **PENDIENTE**
