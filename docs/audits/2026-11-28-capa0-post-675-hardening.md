# Capa 0 — hardening posterior a PR #675

**Fecha:** 2026-11-28  
**PR:** [#679 — Fix/capa0 response logging query contracts](https://github.com/nachoortegazgz/marianmadridz/pull/679)  
**Merge commit de PR:** `d44501c3c224ac417b283f687718ec9eb7538606`  
**Corrección posterior integrada en main:** `944eb225b63260353cf283c87b0c0b6f07af6caf`  
**Estado:** integrada; CI offline del HEAD correctivo PASS. Wix Runtime pendiente.

## Objetivo

Cerrar defectos detectados al revalidar contratos de consulta, serialización de metadatos, redacción de logs y valores históricos de `bookingType`, sin introducir un runtime alternativo ni cambiar datos Wix.

## Cambios verificados en el diff

1. **Wix Data sort:** los builders `order.asc/desc` generan `{ fieldName, order }`, alineado con el contrato Wix. `normalizeSort` rechaza tipos, campos, direcciones y entradas inválidas; ya no descarta silenciosamente elementos ni convierte direcciones desconocidas en ASC. La propiedad antigua `direction` se rechaza explícitamente.
2. **Logging/redacción:** amplía la cobertura a bloques de claves privadas, Authorization/Cookie/Set-Cookie, API keys, tokens, HMAC, firmas, claves fiscales y segmentos sensibles de rutas URL. Se añadieron pruebas negativas.
3. **Respuesta pública:** `responseUtils` deja de depender de `_cloneDeep` y clona metadatos de forma acotada/JSON-safe, con manejo explícito de ciclos, Date, BigInt, valores no finitos y propiedades peligrosas.
4. **CitasF2:** los alias históricos explícitos siguen siendo legibles mediante normalización; las nuevas inserciones exigen el valor canónico. No se fuerza una migración destructiva de registros históricos.

## CI y corrección de regresiones

El primer HEAD de PR #679 (`7b53e4bf784ea7744a140995c083ce4e120ccca2`) tuvo:
- Secret scanning: SUCCESS, run `46085515618`.
- Backend offline quality gates: FAILURE, run `46085515643`.

No se trasladó ese fallo al estado final. El commit correctivo integrado en `main` (`944eb225b63260353cf283c87b0c0b6f07af6caf`) ejecutó:
- Backend offline quality gates: SUCCESS, run `46085827875`; resumen de commit: **91 suites / 816 tests PASS**.
- Secret scanning: SUCCESS, run `46085827842`.

## Alcance y límites

- Verificado: diff de PR #679, integración en main y workflows post-correction del SHA indicado.
- No verificado: Wix Local Editor, Preview, WebMethods Runtime, comportamiento en CMS live ni producción.
- No se modificaron colecciones CMS, registros, secretos, permisos Wix, pagos, configuración del sitio ni publicación.
- La corrección de logger no equivale a una auditoría global de secretos en todos los documentos históricos; la limpieza documental de datos personales/identificadores se registra por separado en [la revisión del archivo](../archive/2026-11/ARCHIVE-REVIEW-2026-11-28.md).

## Pendientes Capa 0

Continúan vigentes los pendientes registrados en [STATE-NOW](../STATE-NOW.md): manejo de fallos de secretos, cobertura de Staff Members v1, conversiones monetarias, duplicidad de configuración de moneda, matriz de writers/idempotencia, dead code/dependencias y validación Runtime.
