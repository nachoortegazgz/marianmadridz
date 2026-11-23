# Consolidación de validación fiscal — CONFIG_SISTEMA

**Fecha:** 2026-11-14  
**Sitio:** banco de pruebas aislado actual, sin actividad real  
**Alcance:** centralización de validaciones de escritura para `DatosFiscales`.

## Hallazgo

`assertDatosFiscalesRecord` en `validation.js` ya validaba para `CONFIG_SISTEMA` NIF/VAT, nombre legal, `thirdPartyType`, flags BOOLEAN y `fechaInicioVerifactu` con formato `YYYY-MM-DD`. Sin embargo, `_applyConfigSistemaRules` en `data.js` repetía esas mismas reglas y no invocaba el validador común.

El hook es el único writer CMS de esta frontera y ya importa `assertDatosFiscalesRecord`. Mantener ambas implementaciones creaba riesgo de divergencia entre validación directa y validación efectiva del hook.

## Cambio

- `_applyConfigSistemaRules` conserva exclusivamente reglas propias del hook: lista de campos prohibidos, ID singleton y normalización previa de valores TEXT.
- La validación de identidad fiscal, enums, flags BOOLEAN y fecha se delega a `assertDatosFiscalesRecord`.
- Se mantienen mensajes/errores para los casos ya cubiertos y se añaden pruebas de `active` no BOOLEAN, `recordType` no canónico y fecha compuesta solo por espacios.
- Se eliminan 17 líneas de validación duplicada; no se elimina ninguna regla de negocio.

## Riesgo y control

La centralización hace efectiva también la validación BOOLEAN de `active`, que ya estaba declarada en el validador común pero no se ejecutaba para `CONFIG_SISTEMA`. Se conserva el singleton `CONFIG_SISTEMA_FISCAL` y el rechazo de campos no declarados.

## Validación

CI ejecutada sobre `021d8e9cfc8427ff92e6d4d4ab55becf73d71521`: Layer 1 23 suites/296 tests PASS; Layer 2 19 suites/252 tests PASS; regresión completa 69 suites/631 tests PASS; Wix SDK contracts, eCommerce Order Transactions SDK, Bookings Reader V2, ESLint y secret scanning PASS. No se han modificado CMS, registros, configuración Wix ni despliegues.
