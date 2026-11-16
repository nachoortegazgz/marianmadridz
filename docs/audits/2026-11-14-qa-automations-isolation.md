# Auditoría read-only — aislamiento de automatizaciones Wix en QA

**Fecha:** 2026-11-14 (Europe/Madrid)  
**Site ID:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**URL:** https://www.marianmadrid.es/  
**Tipo:** lectura de solo lectura; sin cambios en Wix.

## Método y alcance

Se consultó el endpoint oficial Wix Automations V2 POST /automations-service/v2/automations/query, con paginación por cursor (límite 100), usando el contexto del único sitio QA. La documentación oficial indica que Query devuelve automatizaciones creadas por aplicaciones instaladas en el sitio, incluidas las preinstaladas y sus overrides; no incluye borradores no publicados del builder.

Fuente: https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations

Resultado:
- Automatizaciones devueltas: **150**.
- ACTIVE: **10**.
- INACTIVE: **140**.
- Archivadas: **0**.
- Las 10 activas tienen origin PREINSTALLED.

## Automatizaciones activas detectadas

| Automation ID | Nombre | Trigger | Acción observable |
|---|---|---|---|
| 0fd88c94-2045-4657-858b-59213757b948 | Notify customer when you save their card details | wix_cashier-customers_card_saved | Email transaccional |
| 15795b10-74b6-45e6-94f2-085b61dd7fa4 | Notify owner on a new voicemail | virtual_numbers-new_voicemail | Email a colaborador |
| 23274141-65ce-4a6c-8993-d6ba0a42fa7a | Notify clients when their saved card was charged | wix_bookings-saved_card_charged | Email al cliente |
| 2759512d-223f-4e4f-beb5-5c34de98991c | Send an email to proceed with a task | agent_maker-custom_agent_notification | Email a destinatario dinámico |
| 4c9c0ba3-1e14-49ff-8643-6db7d04f6a01 | Aria Assistant send wix notification | aria_assistant-aria_assistant_need_to_send_a_notification | Notificación de plataforma |
| 73fb819b-e337-44fa-98de-6c6030b97209 | Send email confirmation to site members | wix_sitemembers_app-member_email_confirmation_required | Email de confirmación |
| 9bfadabf-a4c6-4bf9-8e46-8561ff2fc9c6 | Send subscription confirmation email | wix_form_platform-subscription_confirmation_request | Email de confirmación |
| d8c5ba95-49a9-46fe-9aa7-1f7d7962a439 | Aria Assistant send an email | aria_assistant-aria_assistant_need_to_send_an_email | Email dinámico |
| e5473136-1e31-44ca-af8d-dc24e4b78d6b | cms items limit warning email | wix_cms-cms_items_limit_approaching | Email de aviso |
| f5d070ab-4cda-408a-acbd-d7331793ee8e | Send site members a reset password email | wix_sitemembers_app-member_reset_password | Email de restablecimiento |

## Bloqueo de modificación

Las diez automatizaciones activas tienen al menos una restricción explícita:
- settings.disableStatusChange=true: **7**.
- settings.readonly=true: **5**.
- Ambas simultáneamente: **2**.
- Bloqueadas por al menos una regla: **10/10**.

La documentación Wix establece que readonly o disableStatusChange obligan a detener la desactivación por API. No se intentó modificar settings, sortear restricciones, desinstalar apps ni cambiar estados.

Fuentes:
- https://dev.wix.com/docs/api-reference/business-management/automations/skills/automations-activation-status
- https://dev.wix.com/docs/api-reference/business-management/automations/skills/automations-validation-and-persistence

## Evaluación

- ACTIVE significa que una automatización es elegible para nuevos eventos; no demuestra que haya ejecutado acciones anteriormente.
- La existencia de diez automatizaciones activas con acciones de email/notificación contradice la declaración operativa de que todas las comunicaciones permanecen desactivadas.
- No se ha demostrado que los triggers estén neutralizados por otra capa, que las acciones no puedan entregar mensajes ni que haya aislamiento de red/proveedor.
- Los flujos que puedan emitir eventos de Bookings, miembros, pagos guardados, formularios, tareas o notificaciones quedan BLOCKED_EXTERNAL_SIDE_EFFECTS.
- Se permiten pruebas offline/mock y auditorías estrictamente read-only. No ejecutar checkout, pagos, reservas que creen/actualicen estado, altas de miembros, resets de contraseña, envíos de formularios ni eventos que coincidan con los triggers anteriores.

## Resolución requerida

1. Solicitar a Wix o al proveedor propietario una forma soportada de desactivar o aislar estas automatizaciones preinstaladas para QA, sin alterar sus locks ni desinstalar apps a ciegas.
2. Obtener evidencia de que las diez quedan INACTIVE o de que existe aislamiento QA equivalente que impide todos los efectos externos.
3. Repetir la consulta read-only y comparar los mismos IDs/overrides antes de habilitar Runtime/E2E.
4. Hasta entonces, mantener el sitio en modo QA offline/mock. No usar el estado Wix Published como prueba de aislamiento.

## Resultado

**BLOCKED_ENVIRONMENT**

La consulta es verificable y read-only. No se modificó ninguna automatización, app, trigger, acción, contacto, reserva, pedido, pago, CMS ni configuración del sitio.


## Addendum de revalidación — 2026-11-14

Se repitió la consulta paginada Wix Automations V2 en el Site ID QA. Resultado: 150 automatizaciones; 10 ACTIVE y 140 INACTIVE; paginación completa. El estado operativo se leyó desde configuration.status. Las 10 activas siguen siendo PREINSTALLED y cada una conserva al menos uno de los locks settings.readonly o settings.disableStatusChange.

La lectura completa de la guía oficial Wix **Automations Activation Status** confirma la regla operativa: antes de desactivar, consultar el objeto completo y detener la operación si settings.disableStatusChange o settings.readonly es true. La guía no autoriza sortear estos bloqueos. Por tanto, no se ejecutó PATCH ni se alteró el estado.

Evidencia CI y documentación integrada:
- PR #381: merge 1c4f9c3322f323bc32012c8c042eb2c47aaaed44; workflow 43627893841 completed/success.
- PR #380: merge e2150647e6203b5c964a0d414c5b0a5295a374fe; Secret scanning y Backend offline quality gates completed/success.

**Conclusión sin cambios:** las automatizaciones continúan activas y bloqueadas por el propietario de la app. Runtime/E2E que pueda dispararlas sigue BLOCKED_EXTERNAL_SIDE_EFFECTS. Continuar únicamente con offline/mock y lecturas read-only hasta que Wix/proveedor habilite un procedimiento soportado o aporte aislamiento equivalente verificable.

## Revalidación en vivo — 2026-11-16 (Europe/Madrid)

**Método:** consulta oficial Wix Automations V2 filtrada por `configuration.status = ACTIVE`, seguida de `Get Automation` individual para cada ID devuelto. Lectura estrictamente read-only; no se modificaron estados ni configuraciones.

**Resultado verificado:** 8 automatizaciones ACTIVE, con 8/8 estados confirmados mediante Get Automation:
- 7 automatizaciones PREINSTALLED, todas con `settings.disableStatusChange=true`; 2 de ellas también tienen `settings.readonly=true`. Coinciden con siete IDs del inventario histórico de comunicaciones.
- 1 automatización adicional de origen APPLICATION:
  - ID: `961f911d-8386-4e20-843e-cdf4595c24e8`
  - Nombre: `Creación de TPV física personalizada`
  - Estado: ACTIVE; revision `3`; `readonly=false`; `disableStatusChange=false`.
  - Trigger: `wix_automations-scheduled_trigger`, diario a las 01:45 (cron `45 1 * * *`), inicio configurado `2026-11-15T01:45:00+01:00`.
  - Acción: `agent_maker-delegate_to_llm` / “Delegate to AI Custom Agent”, app `c5abc3eb-299c-4e3e-8aff-3c674d2ede83`, con `taskId=d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`.
  - El esquema de acción permite delegar una tarea de negocio a un agente IA. El contenido/instrucciones de la tarea referenciada no se expone en la configuración de Automation ni se ha podido verificar mediante la API pública consultada.

**Evaluación:** la cifra actual es 8 ACTIVE, no 7. El inventario previo de 10 ACTIVE (14 nov) y la cifra 7 del SSOT quedan como observaciones históricas de fechas distintas. La automatización adicional no está protegida por los locks de las siete preinstaladas y su ejecución programada puede delegar una tarea a un agente IA. No se puede afirmar qué hace ni si escribe datos o contacta terceros sin leer el contenido de la tarea y sus integraciones.

**Decisión de seguridad:** no se cambió ni desactivó automáticamente la automatización porque se desconoce el alcance de la tarea y podría ser un proceso deliberado del propietario. Hasta verificar el task ID, sus instrucciones e integraciones, clasificarla como `BLOCKED_UNKNOWN_AUTOMATION_SIDE_EFFECTS`; no ejecutar pruebas que puedan solaparse con su horario ni dar por aisladas las comunicaciones/acciones externas.

**Acción necesaria:** inspeccionar en Wix Agent Maker la tarea `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`, revisar instrucciones, permisos e integraciones conectadas, y decidir si se mantiene o se pausa la automatización. Repetir Get Automation después de cualquier cambio.


## Addendum de estado actualizado — 2026-11-16 23:09 Europe/Madrid

**Revalidación de estado:** la consulta filtrada por `configuration.status=ACTIVE` devuelve ahora 7 IDs y Get Automation confirma 7/7 ACTIVE. Todas son PREINSTALLED con `disableStatusChange=true`; dos tienen además `readonly=true`. La automatización personalizada de TPV, ID `961f911d-8386-4e20-843e-cdf4595c24e8`, fue consultada por Get Automation y está `INACTIVE`, revisión 4. Esta observación posterior supersede el addendum anterior que la encontró ACTIVE (revisión 3). No se ha ejecutado PATCH ni se ha cambiado su estado en esta sesión.

La tarea IA vinculada (`d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`) sigue sin contenido recuperable por la API pública documentada consultada. Se inspeccionaron List Tools Providers y List App Skills para el sitio: ambos devolvieron listas vacías; no se encontró un canal de inspección de Agent Maker por App Tools. No se confunden este ID con CMS Background Tasks ni con CRM Tasks, que son recursos distintos. Mientras la automatización esté INACTIVE, su trigger programado no es elegible para nuevas ejecuciones; no se ha ejecutado ni probado la tarea.

Las siete automatizaciones activas restantes son: tarjeta guardada (email transaccional), notificación de Agent Maker (email), notificación de Aria (notificación de plataforma), confirmación de miembro (email), confirmación de suscripción (email), aviso de límite de elementos CMS (email) y reset de contraseña (email). Los escenarios que puedan activar esos eventos siguen bloqueados. En particular, no iniciar altas de miembros, suscripciones, operaciones de tarjeta, reset de contraseñas ni cargas masivas CMS.

**Estado actual:** 7 ACTIVE / 1 custom TPV INACTIVE entre los ocho IDs que se revalidaron previamente. Esta frase no representa un recuento exhaustivo de todas las automatizaciones del sitio; el último método utilizado fue consulta filtrada de ACTIVE y Get individual.
