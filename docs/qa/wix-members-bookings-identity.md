# QA — Integración de identidad Wix Members con reservas

## Alcance

Auditoría de Capa 1 y Capa 2 para la asociación de reservas Bookings con el miembro autenticado. No incluye M365, SharePoint ni Power Automate.

## Contrato oficial verificado

- Backend: `@wix/members` exporta `members.getCurrentMember()`.
- La operación devuelve directamente el objeto Member actual (o ausencia de miembro para contexto anónimo); el objeto incluye `_id` y `contactId`.
- Frontend: `currentMember.getMember()` pertenece a `@wix/site-members`, no debe importarse desde `@wix/members` en backend.
- Un miembro Wix y su contacto CRM son identidades distintas; se conserva `memberId` para la identidad de miembro y `contactId` para la vinculación CRM/Bookings.

Fuentes oficiales:
- https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member?apiView=SDK
- https://dev.wix.com/docs/sdk/frontend-modules/members/current-member/get-member
- https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/create-booking?apiView=SDK

## Hallazgo corregido

Los módulos backend `security.js`, `security.web.js`, `horario.web.js`, `reservas.web.js` y `citasManager.web.js` importaban `currentMember.getMember()` desde `@wix/members`. El harness offline exportaba artificialmente ese método y envolvía el resultado en `{ member }`, ocultando la discrepancia con el SDK backend oficial.

La corrección usa `members.getCurrentMember()` y consume el Member directamente. El harness deja de exportar `currentMember`, de modo que un import incorrecto vuelve a fallar durante las pruebas.

## Asociación de reserva

- La saga envía `contactDetails.contactId` a Bookings Writer V2 cuando la sesión tiene un contactId válido.
- La proyección interna `CitasF2.contactDetails` conserva tanto `memberId` como `contactId`.
- La propiedad de las operaciones internas se valida con el `memberId` autenticado.
- No se introduce `memberId` arbitrario desde el payload del navegador.

## Cambios de esta intervención

1. Sustituir el acceso backend al miembro por `members.getCurrentMember()`.
2. Corregir la comprobación de identidad de Marian para comparar el `contactId` canónico con la identidad conectada de Bookings; el objeto normalizado de `staff.js` no expone un campo `email`.
3. Alinear el loader offline con la respuesta directa del SDK.
4. Añadir pruebas del contrato backend, identidad manager coincidente/no coincidente y regresión de flujos de identidad.

## Validación

La validación offline y CI se registrará en la PR correspondiente. No equivale a prueba de sesión real en Wix publicado.

## Pendiente de QA en Wix

- Crear reserva simple con miembro QA autenticado y verificar que aparece en Mis reservas.
- Crear reserva dual con miembro QA y verificar las dos reservas nativas y la pareja interna.
- Crear reserva anónima y verificar que no se asigna a un miembro incorrecto.
- Verificar que Mis compras muestra los pedidos de checkout de reservas.
- Verificar comportamiento de cancelación/reprogramación de My Bookings para parejas duales antes de habilitar autoservicio sin restricciones.
