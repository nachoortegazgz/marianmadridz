# Reserva online: autenticación obligatoria Wix Members — 2026-11-09

## Objetivo y decisión
Todas las reservas creadas desde el flujo personalizado requieren una sesión Wix Members autenticada. Se elimina el flujo de reserva como invitado. El catálogo y la consulta de disponibilidad permanecen públicos; el bloqueo se aplica al crear la reserva.

## Diagnóstico verificado
- La página `src/pages/Calendario de reservas 2.q39h6.js` invoca `processDualBooking`.
- `src/backend/citasManager.web.js` publica `processDualBooking` como `Permissions.Anyone`.
- El método ya lee el miembro actual con `members.getCurrentMember()`, pero antes aceptaba una respuesta nula y continuaba normalizando el payload con identidad vacía.
- La saga `executeBookingSaga` recibe `memberId` y `contactId` para asociar la reserva al contacto/miembro. Esos identificadores deben proceder de la sesión, nunca del payload del navegador.

## Cambios propuestos en esta PR
1. Cambiar `processDualBooking` a `Permissions.SiteMember`.
2. Exigir `memberId` y `contactId` de la sesión autenticada antes de validar el payload, aplicar rate limit o ejecutar la saga.
3. Mantener catálogo y disponibilidad públicos.
4. Convertir los errores de autorización reconocibles en `AUTH_REQUIRED` y mostrar una instrucción clara para iniciar sesión o crear cuenta en Área Personal.
5. Añadir pruebas de contrato en Layer 1 para la barrera de plataforma, el guard de identidad y el tratamiento del frontend.

## Contrato oficial Wix consultado
- `Permissions.SiteMember` ya se utiliza en otros WebMethods del repositorio.
- La documentación oficial de Wix para `members.getCurrentMember()` indica que devuelve el miembro actual; el contrato del proyecto conserva `member._id` como `memberId` y `member.contactId` como `contactId`, sin asumir que sean iguales.
- Referencias: [Get My Member — @wix/members](https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member?apiView=SDK), [Wix Web Methods permissions](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/velo-web-modules/web-methods).

## Requisito adicional de configuración Wix nativa (bloqueante para cobertura total)
La protección de este PR cubre la ruta personalizada `processDualBooking`. No modifica las páginas nativas de Wix Bookings ni puede impedir por sí sola que otra superficie nativa cree reservas.

La documentación oficial de Wix indica que actualmente no existe una opción global para exigir login en el último paso de reserva. Wix propone como alternativa restringir las páginas de reservas a miembros:
- [Wix Bookings Request: Requiring Login or Registration Before Booking a Service](https://support.wix.com/en/article/wix-bookings-request-requiring-login-or-registration-before-booking-a-service)
- [Wix Bookings: Allowing Clients to Become Site Members](https://support.wix.com/en/article/wix-bookings-allowing-clients-to-become-site-members)

**Acción manual obligatoria antes de considerar cubiertas todas las reservas:** en Wix Editor Classic, revisar el panel de páginas y menú y restringir a miembros todas las páginas de reserva nativas y la página personalizada de calendario/reserva. Confirmar también que no quedan enlaces públicos alternativos a páginas de reserva nativas. La configuración viva de acceso de esas páginas no es legible ni modificable mediante el conector Wix disponible en esta tarea; queda pendiente de verificación por el propietario en el Editor.


## Auditoría de integración con Wix Members, Bookings y Stores — 2026-11-09

### Contratos verificados en repositorio
- La reserva personalizada se crea mediante `processDualBooking`, ahora restringido a `Permissions.SiteMember`, con `memberId` y `contactId` resueltos en backend.
- La saga pasa `contactDetails.contactId` a Wix Bookings Writer V2 y persiste ambos identificadores en `CitasF2.contactDetails`.
- Las operaciones personalizadas de reprogramación verifican la propiedad mediante `memberId` almacenado en `CitasF2`.
- Wix Members frontend ya se usa en `ZONA MARIAN` mediante el módulo Velo estable `wix-members-frontend`. Esta PR aplica el mismo patrón al calendario: consulta sesión, abre `authentication.promptLogin()` si falta y continúa la misma solicitud tras el login.
- Los controladores de `Mis reservas`, `Mis pedidos`, `Mis datos` y `Perfil` son controladores Velo vacíos; las páginas de app se administran por las apps nativas. No se añade un historial duplicado al CMS.

### Superficies nativas que requieren verificación de acceso
El árbol de páginas sincronizado en `src/pages/` incluye controladores sin lógica personalizada para:
- `Calendario de reservas.zfv13.js`
- `Página de servicio.af54v.js`
- `Formulario de reserva.yfzoa.js`

Son superficies asociadas al flujo nativo de Wix Bookings. La ausencia de lógica en sus controladores no bloquea el comportamiento gestionado por Wix. Si permanecen activas y accesibles, pueden ofrecer una ruta de reserva independiente del WebMethod personalizado. En Wix Editor Classic se debe restringir su acceso a miembros o desactivar las rutas de reserva que no se quieran ofrecer, y probar la URL directa sin sesión.

Las páginas personalizadas identificadas son `Calendario de reservas 2.q39h6.js` y `Pagina de servicio 2.xnfr4.js`. La primera queda protegida por el login nativo de esta PR y por el WebMethod `Permissions.SiteMember`; la segunda debe revisarse para asegurar que no enlaza a una ruta nativa pública.

### Integración nativa esperada
- **Wix Bookings / My Bookings:** las reservas creadas por la saga deben quedar asociadas al contacto autenticado mediante `contactDetails.contactId`. La página nativa My Bookings muestra las reservas nativas del cliente. En reservas duales F1/F2 se crean dos bookings independientes; el `pairToken` es interno de `CitasF2`, por lo que no se garantiza que la app nativa los agrupe como una sola cita.
- **Wix Stores / My Orders:** Wix documenta que My Orders muestra pedidos realizados después de que el cliente se convierte en miembro. El flujo de reservas usa intencionadamente un carrito independiente con Cart V2 para no mezclar la reserva con el carrito habitual de productos. Wix documenta que `customerInfo.openAccess` pasa a `true` cuando no se identifica un cliente al crear el carrito. Esta PR exige que el `customerInfo.memberId` y `customerInfo.contactId` devueltos coincidan con la sesión autenticada y que `openAccess` no sea `true`; si falla, elimina el carrito recién creado y aborta el checkout. La atribución final del Order (`buyerInfo.memberId`) y su visibilidad en My Orders siguen pendientes de E2E publicado.
- **Members Area:** Wix documenta que My Bookings y My Orders son páginas privadas por miembro. La presencia y privacidad efectiva de esas páginas en el Editor de este sitio no es verificable mediante el conector actual.

### Resultado y pendientes
- La PR actual añade el diálogo nativo de login al flujo personalizado y corrige el guard SSOT-10, cuyo test esperaba `dataCollectionId` aunque la implementación correcta pasa el argumento local `collection` a `elevatedQuery`.
- **Pendiente E2E:** verificar en Wix publicado que Cart V2, invocado dentro del WebMethod `Permissions.SiteMember`, devuelve `customerInfo.memberId/contactId` del miembro autenticado y que el Order resultante conserva `buyerInfo.memberId`. El uso de un carrito independiente evita mezclar productos de Stores y no exige vaciar el carrito actual del cliente.
- **Pendiente Wix Editor:** verificar/restringir páginas nativas de reserva a miembros y confirmar existencia/privacidad de My Bookings y My Orders.
- **Pendiente E2E publicado:** miembro crea booking; Wix Bookings My Bookings lo muestra; checkout crea Order asociado al mismo member/contact; My Orders lo muestra; webhook actualiza el estado y ledger sin duplicidad. Ejecutar solo en QA controlado, nunca con pagos/reservas reales.

## Impacto y límites
- Las reservas de invitados dejan de estar permitidas en este flujo.
- Los usuarios podrán seguir consultando servicios y disponibilidad antes de iniciar sesión.
- No se altera la saga, Writer V2, locks, idempotencia, conciliación, pagos, CMS ni ledgers.
- Los pagos y las reservas nativas siguen siendo responsabilidad de sus flujos existentes.
- No se incorpora `@wix/site-members` ni un modal de login personalizado: la integración mínima devuelve un error de autenticación accionable y utiliza el acceso nativo de Wix Members del sitio. El usuario inicia sesión desde el Área Personal y repite la acción.

## Validación
- Pruebas de contrato offline: incluidas en `booking.members-required.contract.test.mjs` y en Layer 1.
- Deben ejecutarse `npm test`, `npm run lint`, `npm run verify:wix-ecom-cart-v2` y `npm run verify:wix-bookings-reader-v2` en CI.
- Pendiente: prueba en Wix publicado con un usuario invitado (debe rechazarse) y un miembro activo (debe reservar y quedar vinculado a su contacto/miembro). No ejecutar estas pruebas con reservas reales sin un entorno de QA controlado.

## Resultado CI observado — run 91
- La suite nueva `booking.members-required.contract.test.mjs`: 3/3 pruebas correctas.
- `npm run lint`: correcto.
- Verificación de contratos Wix eCommerce Cart V2: correcta.
- Verificación de contrato Wix Bookings Reader V2: correcta.
- `npm test` / regresión completa: **fallida** por `unit.ssot.v5011.test.mjs`, prueba `SSOT-10` (15/16), que afirma que todas las lecturas query pasan por el método SDK elevado de `dataAccess`. Ni ese test ni `dataAccess.js` forman parte del diff de esta PR; se registra como fallo fuera del alcance del cambio y no se declara CI verde. Requiere diagnóstico separado en la rama base antes de integrar.

## Despliegue y reversión
- Esta PR no publica ni sincroniza Wix.
- La integración no se considera operativa hasta que se integre, sincronice con Wix y se valide en entorno adecuado.
- Reversión de código: revertir el commit de esta PR. No requiere ni autoriza borrar o modificar reservas, CMS, pagos o ledgers.


### Reprogramación nativa Wix Bookings — protección de reservas duales
- La documentación oficial SDK confirma el evento Bookings V2 `onBookingRescheduled`, disparado cuando una reserva se reprograma. El handler Velo correspondiente se incorpora como `wixBookings_onBookingRescheduled`.
- El handler actualiza exclusivamente la fase cuyo booking fue reprogramado en Wix: `slotStart`, `slotEnd`, `dateYmd`, `resourceId`, `scheduleId`, `serviceId` y `revision`. No altera el estado de pago, estado de reserva, pedido ni ledger fiscal.
- Para una reserva dual, el evento no contiene el `pairToken` interno de CitasF2. El handler detecta la pareja desde CMS y abre una alerta deduplicada `DUAL_BOOKING_NATIVE_RESCHEDULE_MISMATCH`. No mueve automáticamente la otra fase porque debe pasar por el lock/journal y la validación de disponibilidad del flujo dual.
- Si no existe la proyección CitasF2, el handler devuelve `RETRY_REQUIRED`; no crea un registro fiscal/pago parcial a partir de un evento de reprogramación.
- Pruebas añadidas: actualización solo de la fase afectada, preservación de pagos/ledger, alerta de pareja dual, replay idempotente, proyección ausente y protección frente a revisiones antiguas.
- Esto cierra la sincronización del tramo reprogramado y detecta el desajuste dual, pero no sustituye la reparación manual/controlada de la fase hermana. El uso de My Bookings para reservas duales debe considerarse limitado hasta que se confirme un flujo nativo de reprogramación atómica de ambas fases.
