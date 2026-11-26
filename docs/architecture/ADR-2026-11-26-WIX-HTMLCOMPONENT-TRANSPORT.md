# ADR — Wix HtmlComponent como frontera de transporte del bridge TPV

Fecha: 2026-11-26
Estado: Propuesta implementada en PR #622; pendiente de CI y validación en Wix Preview.

## Contexto

El bridge compartido se conectaba mediante `$w("#htmlTPV").onMessage()`. El contrato oficial de Wix para `HtmlComponent.onMessage()` documenta el mensaje recibido en `event.data`; no define `event.origin` como propiedad autenticadora del evento. El HTML Component se ejecuta además en un iframe sandboxed. En Preview/Editor el evento observado produjo `origin === "null"`, por lo que la política de origen del bridge rechazaba el handshake antes de validar el protocolo.

El Dossier Técnico Consolidado indica evitar `allowOpaqueOrigin: true`. Esta decisión se mantiene: TPV no activa esa excepción.

## Decisión

Para el consumidor TPV, `createWidgetBridge` declara explícitamente `transport: "wix-html-component"`. En ese modo, la identidad de transporte se delimita por la suscripción al componente Wix concreto mediante `widgetElement.onMessage()`; no se usa `event.origin` como control de seguridad porque no forma parte del contrato documentado de Wix.

El bridge sigue validando, antes de despachar:
- objeto de mensaje y tamaño máximo;
- complejidad máxima del payload;
- allowlist de tipos;
- versión del protocolo;
- identificadores/correlación cuando proceda.

La autorización y validación de negocio permanecen en cada WebMethod backend. El frontend no obtiene permisos por el mero hecho de completar el handshake.

Los demás consumidores conservan el modo estricto de origen por defecto. `allowOpaqueOrigin` no se habilita en TPV.

## Seguridad

Esta decisión confía en la frontera de mensajería del HtmlComponent Wix concreto, no en un origen declarado por el iframe. No se usa `postMessage("*")`. El HTML Component continúa enviando al target origin calculado por su propio código. Las operaciones sensibles siguen protegidas por autorización backend independiente.

No se debe reutilizar el modo `wix-html-component` para listeners globales de `window`, iframes externos o mensajes recibidos fuera del `onMessage()` del componente Wix.

## Validación requerida

1. CI del PR #622: pruebas contractuales del bridge y suite offline.
2. Wix Preview/Editor: comprobar `MM_READY` → `MM_CONTEXT`, carga de catálogo y ausencia de `WIDGET_ORIGIN_OPAQUE_REJECTED` / `WIDGET_HANDSHAKE_TIMEOUT`.
3. Confirmar que un tipo no permitido sigue rechazándose.
4. Confirmar que no se ejecuta ninguna escritura TPV durante la prueba de handshake.

## Fuente oficial

- Wix Velo, Html Component `onMessage()`: https://dev.wix.com/docs/velo/velo-only-apis/$w/html-component/on-message
- Wix Velo, Messaging Between a Site Page and an HTML iFrame Element: https://dev.wix.com/docs/velo/velo-only-apis/$w/html-component/messaging-between-a-site-page-and-an-html-element
