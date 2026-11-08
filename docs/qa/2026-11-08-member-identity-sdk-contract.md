# Corrección del contrato de identidad de miembros Wix — 2026-11-08

## Alcance

Capa 1 y Capa 2. Corrección del acceso backend a la identidad del miembro actual. No modifica datos CMS, reservas, pagos, pedidos, ledgers, permisos ni configuración del sitio.

## Diagnóstico verificado

Los módulos backend importaban `currentMember` desde `@wix/members` y llamaban `currentMember.getMember()`. Esa combinación no coincide con el contrato oficial del paquete instalado `@wix/members`.

La documentación oficial vigente identifica:

- Paquete backend: `@wix/members`.
- Namespace: `members`.
- Método: `members.getCurrentMember()`.
- Respuesta: objeto del miembro actual, con `_id` y `contactId` como identificadores distintos.
- Identidad requerida: visitor o member authentication.

Documentación oficial consultada:

- [Get My Member — SDK `@wix/members`](https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member?apiView=SDK)
- [Current Member — frontend `@wix/site-members`](https://dev.wix.com/docs/sdk/frontend-modules/members/current-member/get-member)
- [Setup de Current Member — paquete `@wix/site-members`](https://dev.wix.com/docs/sdk/frontend-modules/members/current-member/setup)

La API frontend `currentMember.getMember()` pertenece a `@wix/site-members`; no debe importarse desde `@wix/members` en backend.

## Cambios

Se sustituyó la importación/llamada en:

- `src/backend/reservas.web.js`
- `src/backend/citasManager.web.js`
- `src/backend/security.js`
- `src/backend/security.web.js`
- `src/backend/horario.web.js`

El loader offline dejó de exportar el namespace incorrecto `currentMember` y conserva un único mock `members.getCurrentMember()` que devuelve directamente el objeto miembro, de acuerdo con el contrato documentado.

Se añadió `members.sdk.contract.test.mjs` y se incluyó en el gate Layer 1. La prueba impide que estos módulos vuelvan a importar el namespace frontend desde `@wix/members` y comprueba que el mock refleja la respuesta directa.

## Identidad y autorización

- `member._id` se conserva como `memberId`.
- `member.contactId` se conserva como `contactId`.
- No se presupone que ambos identificadores sean iguales.
- Los métodos de backend mantienen su tratamiento fail-closed cuando no hay miembro autenticado o no se puede resolver la identidad.
- No se incorpora autorización basada únicamente en email.

## Validación

Pendiente de CI en el PR:

- Layer 1.
- Layer 2.
- Regresión offline completa.
- Contratos SDK y lint.

No se ha ejecutado una prueba autenticada en Wix Preview/producción con un miembro real. La corrección del contrato del SDK y las pruebas offline no sustituyen esa validación de runtime.

## Despliegue

La PR no publica en Wix. Publicación únicamente después de CI verde, revisión del diff y autorización expresa.


## Corrección adicional — identidad de la cuenta administradora

La comprobación `_isMarianManagerIdentity()` no debe comparar emails. El objeto normalizado por `backend/staff.js` no publica un campo `email`; sí expone el `contactId` de la identidad Wix conectada. La autorización compara ahora el `contactId` del miembro autenticado con el `contactId` del recurso Marian conectado en Bookings Staff, y falla cerrada si falta cualquiera de ellos.

Prueba añadida:
- ContactId coincidente: acceso de administradora permitido.
- ContactId distinto: acceso denegado.
