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

Pendiente de CI en esta rama: suite de hooks CMS, regresión completa, ESLint y secret scanning. No se han modificado CMS, registros, configuración Wix ni despliegues.
