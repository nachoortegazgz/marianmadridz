> ## Addendum de consolidación — 2026-11-23
>
> Esta nota se redactó originalmente para la rama `feat/tpv-neutral-contract-block1-v2-20261123` / PR #537. PR #537 sigue abierta. La rama consolidada que se está validando ahora es `feat/tpv-payment-exports-after-p0-20261123` / PR #541, también abierta y basada en el mismo `main` (`995c085aa2ef45fea6d57f95f86d4c75c7cf7f7d`).
>
> **Solapamiento PR:** #537 cambia 16 archivos; los 16 también aparecen en #541. #541 añade otros 24 archivos. El grafo de commits está divergido (comparación #537…#541: 113 commits ahead y 28 behind). No fusionar ambas PR automáticamente ni cerrar #537 sin revisar sus commits exclusivos.
>
> **Revisión funcional del contenido exclusivo de #537:** la rama #541 conserva las atribuciones opcionales de profesional en venta, movimiento y devolución; los contratos de hash/eventHash y envelope versionado; la lectura de registros legacy mediante constantes centralizadas; y los estados neutros de Ticket X/Z. En #541 se amplía además la compatibilidad de CajaActual para formatos V1/V2 y legacy, y se centralizan los marcadores legacy en `TPV_RUNTIME_POLICY`. Esta revisión de código no sustituye la comparación commit a commit antes de integrar.
>
> **Estado vigente de CI:** el HEAD de código validado de PR #541 es `1d7e99d66fcc14165bf2482885e583176c2b06ef`: Backend offline quality gates SUCCESS (run 45100967570), Layer 1 364/364, Layer 2 255/255, offline completo 732/732; npm audit 0 vulnerabilidades; Wix SDK/eCommerce/TPV contracts y ESLint SUCCESS. Secret scanning SUCCESS (run 45100967567). Los commits posteriores de la rama son únicamente documentación.
>
> **Wix:** Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`, estado Draft, Velo Enabled. No se ha probado sincronización del SHA con Wix Editor ni flujo E2E en Preview. **NO-GO para producción.**
>
> Los apartados originales de esta nota describen el snapshot de PR #537 y sus límites en ese momento. Las referencias a “sin CI” y al último commit `de532108...` son históricas, no el estado actual de PR #541.

---

# Validación de auditoría Wix — TPV (23-11-2026)

## Alcance y referencia

Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `feat/tpv-neutral-contract-block1-v2-20261123`  
PR: #537 (abierta; no fusionada)  
Alcance: inspección estática de los contratos de venta, apertura de caja, cierre Z, persistencia lógica y nomenclatura de estados.

Esta validación no equivale a una ejecución Wix Runtime ni a una prueba E2E en Preview.

## Resultado por hallazgo

| Hallazgo de la auditoría | Resultado | Evidencia / decisión |
|---|---|---|
| 1. `SALE_REGISTER`: `lines/payments` frente a `lineas/pagos` | No reproducido en la rama revisada | El widget envía `lineItems/payments`; `tpvPageController.js` transforma cada línea a `lineas` con `tipoLinea`, `itemId`, `varianteId`, `concepto`, `cantidad`, `precioUnitario`, `descuentoImporte`, `impuestosImporte`, `profesionalId` y `stockAfectado`. Los pagos se convierten a `pagos` con `medioPago`, `importe` e `importeCambio`. `tpvVentas.web.js` pasa esos campos a `validateSaleDraft`; el validador exige exactamente `lineas/pagos`. |
| 2. Apertura `abrirCaja` frente a `abrirSesionCaja` | No reproducido | El controlador importa `abrirSesionCaja` desde `tpvCaja.web`, lo llama en `SESSION_OPEN`; el módulo exporta `abrirSesionCaja`. |
| 3. Unidad de `countedCash` en Z | Verificado correcto | El controlador transmite euros como `countedCash`. `generarCierreZ` convierte con `toMinorUnits(input.countedCash, "COUNTED_CASH")` y persiste `countedCashMinor`. |
| 4. Colecciones lógicas con prefijo SANDBOX | Corregido previamente | `TPV_COLLECTIONS` utiliza `TPV_LOGICAL_*`; `TPV_LEGACY_COLLECTIONS` conserva los discriminadores anteriores para compatibilidad. Son discriminadores lógicos, no IDs de colecciones CMS. |
| 5. `_ensureCajaActualForSandbox` | Ya neutralizado | El helper activo es `_ensureCajaActual`. No se requiere renombrado adicional. |
| 5. `LEGACY_TPV_LEDGER_SOURCE` | Mantener temporalmente | Se usa para reconocer registros históricos. También existe una ruta de continuidad/proyección de una sesión histórica; retirarla sin migrar/cerrar sesiones podría bloquear el TPV. No eliminar hasta disponer de migración compatible y pruebas de transición. |
| 6. Estados `GENERADO_SINTETICO` y `CERRADO_SINTETICO` | Corregido en esta intervención | Ticket X usa `status: GENERADO`; Ticket Z usa `status: CERRADO`; ambos incluyen `sourceType: SYNTHETIC` como campo separado. Los estados de venta/pago conservan su contrato existente y no se renombraron sin revisar todos sus consumidores. |

## Cambios aplicados

- `src/backend/tpv/tpvCierres.web.js`: neutralizados los estados de los eventos Ticket X y Ticket Z; se incorpora `sourceType` explícito en cada registro.
- `src/backend/internalConfig.js`: comentario de política actualizado para describir los controles explícitos source/site/version/session/hash y el carácter histórico del marcador legacy.
- `src/backend/tests/tpv.qa.persistence.policy.test.mjs`: fixtures de integridad y locks actualizados para metadata neutral, conservando una prueba explícita de compatibilidad histórica.
- `src/backend/tests/tpv.web-modules.contract.test.mjs`: aserciones actualizadas y prueba estática para estados neutrales X/Z y conversión de importe de Z.

## Riesgos y límites

1. La persistencia de Ticket X/Z sigue siendo sintética; `sourceType: SYNTHETIC` no significa conciliación nativa ni escritura en Wix Payments, Wix Invoices o un proveedor.
2. La compatibilidad de sesiones históricas no debe retirarse hasta definir y probar la transición de `CajaActual`.
3. El cambio de estados de Ticket X/Z puede afectar consumidores externos no presentes en el repositorio; se requiere validación en Preview y revisión de integraciones antes de publicar.
4. La auditoría estática no acredita permisos Wix efectivos, comportamiento del CMS, locks distribuidos en runtime ni ausencia de carreras.

## Validación ejecutada

- Inspección de los archivos y contratos citados en la tabla.
- Comprobación de que la apertura importa una exportación existente.
- Comprobación del mapeo DTO completo entre widget, controlador y validador.
- Comprobación de la conversión euros → céntimos en Ticket Z.
- Comprobación de los discriminadores lógicos neutrales y del helper neutral.
- No se ejecutaron tests locales ni CI en esta intervención: la integración no devolvió ejecuciones ni checks asociados al último commit consultado.
- No se ejecutaron escrituras CMS, pagos, devoluciones, cambios en LIVE ni publicación.

## Estado

**Parcial — no apto para declarar E2E validado.** La lista concreta de la auditoría queda atendida en sus correcciones válidas de código y tests estáticos, pero el gate de aceptación sigue pendiente de CI verificable y pruebas Wix Preview apertura → venta → Ticket X/Z, incluyendo reintento y conciliación.


## Seguimiento de rama y release gate

Último commit de esta actualización: `de5321083be16d2a4bfd9d501bcf1b212050da6a`.

- PR #537 continúa abierta y sin merge.
- Comparación contra `main`: 26 commits por delante y 4 por detrás; GitHub reporta `diverged` y `mergeable=false`.
- La consulta de checks y ejecuciones asociadas al último commit no devolvió ejecuciones ni estados.
- El entorno de trabajo no permitió clonar el repositorio para ejecutar Vitest/Node localmente.
- Por tanto, los tests actualizados son cambios de código, no pruebas ejecutadas. No se declara CI ni suite local en verde.

**Gate mantenido: NO-GO para merge/despliegue** hasta resolver divergencia, ejecutar CI, revisar el diff completo y validar el flujo en Wix Preview.
