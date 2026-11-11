> **Reauditoría live — 2026-11-11:** después de confirmar que el sitio está **Published**, se volvió a consultar Wix Automations V2 y las acciones email en modo solo lectura. Estado actual: 149 automatizaciones no archivadas, 27 ACTIVE y 122 INACTIVE; nueve automatizaciones email siguen activas (10 acciones: ocho dirigidas al contacto que dispara el trigger y dos al propietario); cuatro automatizaciones WhatsApp y ocho SMS están inactivas. Dos notificaciones internas de Bookings siguen activas. No se ejecutaron triggers ni se enviaron mensajes. Ver [referencia maestra QA](../qa/2026-11-11-qa-master-reference.md).

---

# Auditoría de aislamiento de notificaciones Wix — 2026-11-11

## Alcance y autorización

Se auditó la configuración de Wix Automations del sitio `www.marianmadrid.es` y, tras la autorización expresa del propietario, se intentó pausar las automatizaciones activas de email y WhatsApp cuya audiencia no estaba verificada contra la allowlist QA.

Allowlist de correo declarada para el despacho backend QA:
- Cualquier dirección del dominio exacto `@marianmadrid.es`.
- Un buzón de pruebas privado controlado; la dirección concreta no se almacena en documentación versionada.

Esta allowlist de código **no gobierna las automatizaciones nativas Wix**. No se envió ningún email, WhatsApp ni SMS durante esta intervención.

## Inventario y cambios verificados

- Inventario inicial: 149 automatizaciones; 94 activas y 55 inactivas.
- 75 automatizaciones activas contenían acciones nativas de email; se inspeccionaron 85 acciones de email y se pudieron leer sus destinatarios tipados sin fallos.
- Las audiencias incluían destinatario dinámico del contacto que dispara el trigger, destinatarios CUSTOM, SITE_OWNER y roles/usuarios Wix. No todos los buzones/miembros se pudieron demostrar dentro de la allowlist autorizada.
- Se intentó desactivar por estado las 76 automatizaciones activas objetivo (75 email y 1 WhatsApp), leyendo su configuración completa y conservando el resto del objeto.
- **67 cambios se verificaron mediante lectura posterior:** 66 automatizaciones de email y 1 de WhatsApp pasaron a `INACTIVE`.
- **9 automatizaciones de email permanecen activas** porque Wix marcó sus configuraciones como `readonly` y/o `disableStatusChange`; seis tienen `disableStatusChange=true`, cuatro `readonly=true` y una reúne ambas restricciones.
- Las cuatro automatizaciones WhatsApp quedaron inactivas: tres ya estaban inactivas y una se pausó en esta intervención.
- SMS: no se identificaron automatizaciones activas en el inventario inicial.

## Automatizaciones de email que Wix no permitió pausar

| ID | Nombre | Restricción |
|---|---|---|
| `0fd88c94-2045-4657-858b-59213757b948` | Notify customer when you save their card details | `disableStatusChange=true` |
| `15795b10-74b6-45e6-94f2-085b61dd7fa4` | Notify owner on a new voicemail | `readonly=true` |
| `23274141-65ce-4a6c-8993-d6ba0a42fa7a` | Notify clients when their saved card was charged | `readonly=true` |
| `2759512d-223f-4e4f-beb5-5c34de98991c` | Send an email to proceed with a task | `disableStatusChange=true` |
| `73fb819b-e337-44fa-98de-6c6030b97209` | Send email confirmation to site members | `disableStatusChange=true` |
| `9bfadabf-a4c6-4bf9-8e46-8561ff2fc9c6` | Send subscription confirmation email | `disableStatusChange=true` |
| `d8c5ba95-49a9-46fe-9aa7-1f7d7962a439` | Aria Assistant send an email | `readonly=true` |
| `e5473136-1e31-44ca-af8d-dc24e4b78d6b` | cms items limit warning email | `readonly=true` y `disableStatusChange=true` |
| `f5d070ab-4cda-408a-acbd-d7331793ee8e` | Send site members a reset password email | `disableStatusChange=true` |

La configuración nativa de esos nueve flujos sigue fuera del control de la allowlist Resend. No se debe afirmar que el aislamiento de notificaciones de email está completo.

## WhatsApp y móvil sintético

El propietario indicó un móvil sintético como destino QA; el número concreto no se almacena en documentación versionada. La acción Wix existente `whatsapp-send-message` no dispone de una receta pública soportada para reconfigurar por API su destinatario estático; la guía oficial de configuración de acciones la identifica como no soportada/deprecated para nuevas configuraciones públicas. No se inventó un esquema ni se sustituyó por Wix Inbox, que no equivale a WhatsApp.

Decisión: mantener inactivas las automatizaciones WhatsApp existentes hasta disponer de una integración/acción oficial soportada y poder configurar el número sintético de forma verificable. El número no se configuró y no recibió mensajes.

## Evidencia y límites

- Operaciones ejecutadas: lectura de configuración, actualización de estado cuando Wix lo permitió y lectura posterior de estado.
- Se preservó la configuración completa de cada automatización y solo se cambió `configuration.status`.
- Wix generó IDs override para algunas automatizaciones preinstaladas; se considera comportamiento de la API de overrides.
- No se verificó la cancelación de ejecuciones que ya estuvieran en curso.
- No se cambió el contenido de acciones, triggers, audiencias ni plantillas.
- No se enviaron mensajes ni se crearon contactos.
- El guard `emailRecipientPolicy.js` protege el despacho backend Resend; no intercepta los envíos ejecutados por Wix Automations nativas.

## Decisión operativa

1. Mantener inactivas las cuatro automatizaciones WhatsApp.
2. Mantener inactivas las 66 automatizaciones de email que se pudieron pausar.
3. No activar envíos QA hasta aislar los nueve flujos nativos de email que Wix bloqueó como readonly/disableStatusChange y verificar SITE_OWNER, WIX_USER y destinatarios por rol.
4. No habilitar `ACCOUNTANT_SEND_ENABLED` ni ejecutar pruebas de despacho externo en producción.
5. Investigar únicamente integraciones WhatsApp oficialmente soportadas; no reutilizar acciones deprecated ni simular WhatsApp mediante otro canal.

## Estado

- **Verificado:** 67 cambios de estado confirmados por lectura posterior; cuatro automatizaciones WhatsApp inactivas; nueve flujos email siguen activos y bloqueados por Wix.
- **Verificado:** cero mensajes enviados durante la auditoría inicial y la reauditoría live posterior.
- **Verificado en reauditoría live:** 149 automatizaciones; 27 ACTIVE, 122 INACTIVE; nueve flujos email activos con diez acciones (ocho TRIGGER_CONTACT/dinámicas y dos SITE_OWNER); cuatro flujos WhatsApp y ocho SMS inactivos; dos notificaciones internas de Bookings activas.
- **Pendiente:** aislar los nueve flujos nativos email sin interrumpir comunicaciones críticas; integración WhatsApp soportada; semántica de ejecuciones en curso.
