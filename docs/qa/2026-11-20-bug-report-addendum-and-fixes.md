# Addendum de auditoría y correcciones — 2026-11-20

**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline de main:** `1f6e73a6f5384f401fc7cf35a0d1ed08245072bc` (integración PR #474)  
**Integración del addendum/corrección:** PR #475, merge SHA `7332a42f9d3f7ab2e8fc59b58fded339269270d7`  
**Rama de corrección:** `fix/bug-audit-2026-11-20-followup`  
**Alcance:** contraste del informe aportado con `src/backend/`, pruebas offline y documentación de arquitectura.  
**Naturaleza:** auditoría estática y contractual, con lectura de estado de automatizaciones en Wix; no acredita publicación de código ni Wix Runtime. **Site Context Wix (20/11/2026): estado Draft, Editor clásico, Velo habilitado.**

## 1. Resultado ejecutivo

Se ha integrado BUG-14 en main tras CI verde. En esta rama se corrige BUG-NEW-07 mediante lectura fuerte del registro persistido y prueba de regresión. También se corrige el comentario contradictorio de `BOOKING_FIELDS` (BUG-NEW-08), sin retirar campos que sí tienen consumidores activos.

No se habilitan escritores fiscales/contables, fichajes, pagos ni cierres. No se modifica CMS, CajaActual LIVE, reservas, automatizaciones ni registros históricos.

### Snapshot CMS read-only (20/11/2026)

Consulta directa Wix Data API, sin mutaciones:
- `CajaActual`: 1 fila. Estado `ABIERTA`; `openedAt=2026-11-14T06:00:00Z`; `closedAt=2026-11-12T23:00:00Z` (anterior a la apertura); `cashAmount=300`, `expectedCash=300`, `difference=0`; `sequenceCounters` llega como texto JSON aunque el esquema CMS declara `OBJECT`.
- `CitasF2`: 6 filas (no 60); el esquema físico confirma `cashMovementId TEXT` y `orderId TEXT`.
- `HistoricoCierresZ`: 0 filas.
- `MovimientosCaja`: 0 filas; el esquema declara `recordTimestamp DATETIME required`. No hay movimientos históricos que permitan probar ausencia del campo; el riesgo de BUG-NEW-03 queda limitado a productores/filas futuras y no se puede afirmar que exista una fila defectuosa.
- `HistoricoCierresZ`: el esquema declara `recordDomain TEXT required` y `closedBy TEXT required`; no hay filas para comprobar valores históricos.
- Contexto Wix del sitio: estado `Draft`; no se acredita publicación del código actual.


## 2. Correcciones implementadas

### BUG-14 — consulta `contains(linkedBookingIds)`
**Estado: CERRADO EN MAIN.**

PR #474 integrada mediante squash. Merge commit: `1f6e73a6f5384f401fc7cf35a0d1ed08245072bc`. Se eliminó `contains()` para el campo `ARRAY_STRING`; permanecen `hasSome()` y `eq()` como lectura exacta de compatibilidad. La prueba contractual impide reintroducir el operador incompatible. Ambos checks de CI del head de la PR terminaron en SUCCESS (Gitleaks y QA offline/regresión/SDK/lint). Wix Runtime no ejecutado.

### BUG-NEW-07 — `HistoricoCierresZ_beforeUpdate` dependía de `context.previous/original`
**Estado: CORREGIDO E INTEGRADO EN MAIN (PR #475).**

Archivo: `src/backend/data.js`.

El hook ahora:
1. Exige un `_id` válido.
2. Recupera el registro existente de `HistoricoCierresZ` con `getItem(..., CONSISTENCY.STRONG)`.
3. Falla cerrado si el estado previo no está disponible.
4. Compara los campos mediante `stableSerialize`.
5. Permite únicamente cambios reales en los campos de firma/verificación de `ALLOWED_Z_UPDATE_FIELDS`.

Se amplió `src/backend/tests/data.hooks.test.mjs` para cubrir recuperación permitida, mutación económica rechazada y ausencia del registro previo. CI pre-merge de GitHub terminó SUCCESS en QA offline/regresión/SDK/lint y Gitleaks. No se ejecutó Wix Runtime.

### BUG-NEW-08 — comentario contradictorio de `BOOKING_FIELDS`
**Estado: COMENTARIO CORREGIDO EN ESTA RAMA; esquema físico verificado.**

No se deben eliminar `CASH_MOVEMENT_ID` ni `ORDER_ID`: existen consumidores activos en `bookingCore.js` y `citasManager.web.js`, y writers de eventos. Se sustituyó el comentario que afirmaba erradicación por otro que refleja su uso actual. La lectura del esquema físico Wix confirma ambos campos como TEXT en CitasF2. No se alteraron los nombres ni los payloads.

## 3. Revisión crítica de los nuevos hallazgos del informe

| ID | Resultado de contraste | Decisión |
|---|---|---|
| BUG-NEW-01 `recordDomain=""` | El defecto lógico existe: la ruta pública asigna cadena vacía y la validación exige valor. Pero documentación y contrato CMS confirman que no hay valor canónico aprobado; el bloqueo es deliberado. Además, `LEDGER_WRITES_ENABLED=false` detiene la ruta antes de llegar a esa validación. | No sustituir por `SDK_CONFIG.LOCATION_ID` ni inventar un dominio. Mantener NO-GO hasta aprobar semántica, origen y valor de `recordDomain`. No clasificar como regresión accidental. |
| BUG-NEW-02 sesión presencial | No se encontró `openCashierSession` ni `closeCashierSession` como WebMethods en `cajas.web.js`. El ADR de sesión sigue como propuesta pendiente; identifica capacidades de apertura/cierre y autorización aún no implementadas. | Brecha funcional P1 confirmada. No crear métodos sin aprobar el contrato de roles, transición, concurrencia, arqueo y E2E. |
| BUG-NEW-03 `recordTimestamp` | Writer fiscal asigna `generatedAt`; hook normaliza/valida. La consulta CMS actual devuelve 0 filas en MovimientosCaja, por lo que no existen históricos que inspeccionar en esta colección. | No usar `_createdDate` como sustituto. Sin filas no se reproduce un fallo; revisar cualquier nuevo productor antes de habilitar escritores. |
| BUG-NEW-04 allowlist de `MovimientosCaja` | La política DAL permite update/remove de la colección para la excepción TPV QA. Los hooks recuperan el estado previo fuerte y rechazan filas que no sean sintéticas del test-run activo. La cobertura offline no prueba el hook físico publicado ni comportamiento con `suppressHooks=false` en Wix. | Mantener el alcance mínimo actual; no ampliar. Pendiente prueba Wix Sandbox de rechazo de fila real y aceptación exclusiva de fila sintética autorizada. |
| BUG-NEW-05 `DATOS_FISCALES` eliminado | El estado actual de `internalConfig.js` no declara `BUSINESS_COLLECTIONS.DATOS_FISCALES`; tampoco hay referencias activas a `DATOS_FISCALES`/ `DatosFiscales` en los módulos backend examinados. La prueba `operational-writers.fail-closed.contract.test.mjs` exige su ausencia y comprueba hooks/configuración en `MapaStaff`. | Hallazgo del informe obsoleto/no reproducido en HEAD actual. No restaurar el alias ni la colección. La configuración SIF real sigue sin estar certificada. |
| BUG-NEW-06 regex `closedBy` | El patrón acepta UUID con versiones 1–8 y variantes RFC 8/9/a/b. El ejemplo del informe con versión 1 y variante 9 sí cumple el patrón. No se aportó un `resourceId` real rechazado. | No hay fallo reproducible. Mantener pendiente solo si aparece un ID real no aceptado; no cambiar validación a ciegas. |
| BUG-NEW-08 campos de booking | El comentario decía que los campos estaban erradicados, pero los módulos activos sí los leen/escriben. | Comentario corregido; esquema físico pendiente de verificación. |

## 4. Revisión de bugs anteriores

- **BUG-01 y BUG-04:** flags fiscales y de fichajes deshabilitados. Son controles fail-closed deliberados, no cambios a realizar en esta fase.
- **BUG-02:** CitasF2 contiene 6 filas según lectura CMS actual; la proyección y las alertas de recuperación siguen sin E2E acreditado. No se puede atribuir causa raíz solo con el informe.
- **BUG-03:** lectura CMS actual confirma singleton ABIERTA, no SIMULACION, pero con `closedAt` anterior a `openedAt` y `sequenceCounters` como string aunque el esquema exige OBJECT. Mantener P0/H-01 abierto; no resetear ni cerrar la caja desde código.
- **BUG-05/06:** remitente Resend no se cambia sin verificar dominio y remitente autorizados; envío a gestoría permanece deshabilitado.
- **BUG-08:** sincronización ServiciosCatalogo/Bookings nativo no acreditada.
- **BUG-09:** consulta Wix API solo lectura el 20/11/2026: 158 automatizaciones distintas; 7 ACTIVE y 151 INACTIVE. Las 7 activas son PREINSTALLED y sus triggers son guardado de tarjeta, notificación de agente, asistente, confirmación/reset de miembros, confirmación de suscripción y aviso de límite CMS; ninguna de las 7 usa un trigger de Wix Bookings. El dato de 9 activas del informe no coincide con la lectura actual. No se inspeccionó ni alteró destinatario/contenido de emails; no desactivar automatizaciones sin identificar impacto.
- **BUG-12:** mantener rechazo de datos fiscales incompletos; no inferir base/cuota de fianzas.
- **BUG-13:** la lectura de aliases en cierre Z deduplica por `_id` mediante `seenIds`; no se ha demostrado duplicación efectiva. Mantener compatibilidad histórica hasta reconciliar los campos CMS.
- **BUG-15:** no purgar `LEDGER_IDEMPOTENCY`; la retención protege contra repetición de operaciones económicas.
- **BUG-17:** no modificar semántica de `previousRecordHash` sin pruebas de cadena.
- **BUG-19:** retirar limpieza DUAL_CACHE solo tras comprobar cero filas y ausencia de writers/consumidores externos.
- **BUG-20:** CI usa Node 24.22.1; el `package.json` actual no declara `engines`. La versión local del usuario no está verificada.
- **BUG-13c:** el verificador selecciona payload online por `channelType === ONLINE`; requiere fixtures de movimientos históricos de ambos formatos antes de cambiar el selector.

## 5. Riesgos y bloqueos de release

1. Contrato de cierre Z sin valor aprobado para `recordDomain`, y necesidad de reconciliar writers/contrato físico de `HistoricoCierresZ`.
2. H-01: CajaActual requiere conciliación, transiciones, autorización y control de concurrencia; no tocar LIVE.
3. No existe apertura/cierre de sesión presencial certificada para los operadores previstos.
4. Hooks de MovimientosCaja y proyección de caja no tienen certificación Wix Runtime.
5. Bookings/CitasF2, alertas y compensaciones requieren E2E.
6. Publicación Wix no está acreditada contra el SHA de GitHub.

**Release: NO-GO.** No activar flags, no ejecutar cierre Z, no hacer cobros presenciales reales, no alterar ledgers ni CajaActual.

## 6. Validación de esta rama

- Inspección estática de los módulos y consumidores: realizada.
- Prueba añadida para BUG-NEW-07: CI pre-merge SUCCESS.
- Corrección de comentario BUG-NEW-08: incluida en PR #475, CI pre-merge SUCCESS.
- Wix Runtime y CMS Sandbox: no ejecutados. Site Context informa estado Draft; no se ejecutó Published E2E ni se acredita código desplegado en sitio.
- PR #475 integrada en `main`; SHA final de integración: `7332a42f9d3f7ab2e8fc59b58fded339269270d7`.
- Cambios de datos Wix: ninguno.

## 7. Reversión y documentación

La reversión de esta rama consiste en revertir sus commits de código y prueba; no requiere ni autoriza cambios en CMS. El documento se incorpora como addendum auditable. No se debe revertir la integración independiente de BUG-14 salvo que aparezca una regresión demostrada.
