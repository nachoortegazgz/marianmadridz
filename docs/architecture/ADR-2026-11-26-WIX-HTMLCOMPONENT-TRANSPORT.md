# ADR — HtmlComponent Wix como frontera de transporte del bridge TPV

**Fecha:** 2026-11-26  
**Estado:** decisión integrada en el bridge compartido; validación Wix Preview/Runtime pendiente.  
**Ámbito:** consumidor TPV de `createWidgetBridge`.

## Contexto

El contrato Wix de `HtmlComponent.onMessage()` entrega el mensaje mediante `event.data`; no documenta `event.origin` como autenticador. El iframe sandboxed puede producir `origin === "null"`. La política estricta de origen bloqueaba el handshake del componente Wix.

## Decisión

El consumidor TPV declara explícitamente `transport: "wix-html-component"`. La frontera de transporte es la suscripción al componente Wix concreto mediante `widgetElement.onMessage()`; no se usa `event.origin` como control de seguridad.

El bridge valida estructura y tamaño del mensaje, complejidad máxima del payload, allowlist de tipos, versión de protocolo e identificadores/correlación. Autorización y reglas de negocio permanecen en WebMethods backend.

Los demás consumidores conservan el modo estricto de origen. No se habilita `allowOpaqueOrigin` para TPV ni se reutiliza este modo para listeners globales de `window`, iframes externos o mensajes fuera del componente Wix.

## Seguridad

Esta decisión delimita el canal de transporte, no autentica al usuario ni concede permisos. No se usa `postMessage("*")`. Las operaciones sensibles requieren autorización backend independiente.

## Aceptación pendiente

- Wix Preview: handshake `MM_READY → MM_CONTEXT`, catálogo cargado y ausencia de errores de origen/timeout.
- Rechazo de tipos no permitidos.
- Confirmar que el handshake no dispara escrituras.
- Registrar fingerprint del código probado y comparar con el commit Git.

## Fuente oficial

- [Wix HtmlComponent.onMessage](https://dev.wix.com/docs/velo/velo-only-apis/$w/html-component/on-message).
- [Wix messaging between site page and HTML iframe](https://dev.wix.com/docs/velo/velo-only-apis/$w/html-component/messaging-between-a-site-page-and-an-html-element).
