# Runtime Evidence Checklist

Estado inicial: todas las pruebas están PENDIENTES. Esta plantilla no debe rellenarse hasta que un humano ejecute cada prueba en Wix Preview y adjunte el resultado íntegro.

## P1 — Concurrencia de apertura de CajaActual

**Precondición:** miembro del sitio con rol ADMIN; sitio QA; CajaActual singleton inicializado con política TPV canónica; no existe sesión ABIERTA y `canOpenSession === true`. La prueba abre una sesión TPV sintética y no la elimina.

**Comando exacto en Wix Preview:**

Importar en el runner/página QA:
```js
import { abrirSesionCaja, obtenerEstadoCaja } from "backend/tpv/tpvCaja.web";
```

Ejecutar:
```js
await runCajaConcurrencyPreviewTest({ abrirSesionCaja, obtenerEstadoCaja });
```

**JSON esperado:**
```json
{"countAntes":0,"countDespues":1,"lockLog":[{"status":"SUCCESS"},{"status":"ERROR","errorCode":"TPV_SESSION_IN_PROGRESS"}]}
```
El segundo error también puede ser `TPV_IDEMPOTENCY_CONFLICT`; un replay idéntico también es válido.

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **P1** y la referencia oficial indicada: P1 — concurrencia; contrato Wix Data insert/identificador único y PR #587..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si las dos llamadas concurrentes producen exactamente una sesión abierta y el segundo resultado es conflicto/replay controlado; FAIL en cualquier duplicado o resultado indeterminado.

## P2 — Identidad Bookings por memberId y resourceId

**Precondición:** dos miembros de prueba con perfiles Staff Bookings CONNECTED; disponer de un caso positivo cuyo `associatedWixIdentity.identificationData.memberId` coincide con el miembro autenticado y un caso negativo con `contactId` coincidente pero `memberId` distinto. No modificar perfiles reales.

**Pasos UI en Wix Preview:**
1. Iniciar sesión con el miembro vinculado al Staff Member de prueba.
2. Invocar una operación backend protegida que resuelva el contexto de Staff/TPV y guardar el resultado.
3. Repetir con el segundo miembro, manteniendo CONNECTED y el mismo contactId pero con memberId diferente.
4. Conservar ambos resultados y los traceId; no sustituir la identidad por el estado CONNECTED.

**JSON esperado:**
```json
{"memberIdMatch":true,"resourceId":"<GUID>","authorized":true}
```
Caso de miembro distinto:
```json
{"memberIdMatch":false,"authorized":false,"errorCode":"ACCESS_DENIED"}
```

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **P2** y la referencia oficial indicada: P2 — identidad Bookings; Wix Staff Member Object / Query Staff Members V2 y PR #587..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si el miembro vinculado obtiene autorización y el segundo miembro es rechazado aunque CONNECTED/contactId coincidan; FAIL si CONNECTED basta o se autoriza el memberId distinto.

## P3 — Idempotencia de escritura TPV

**Precondición:** sitio QA aislado; operador autorizado; sesión TPV sintética disponible; venta de prueba sin pago nativo ni efectos externos; misma clave idempotente y mismo payload en ambos intentos.

**Pasos UI en Wix Preview:**
1. Registrar una venta sintética de prueba con una idempotencyKey estable.
2. Repetir exactamente la misma operación con la misma idempotencyKey y payload.
3. Consultar el evento persistido mediante su transactionId determinista.
4. Verificar que no se invoca Wix Payments.

**JSON esperado:**
```json
{"first":{"persisted":true,"replayed":false},"retry":{"persisted":true,"replayed":true},"sameId":true,"recordCount":1}
```
No debe invocarse Wix Payments.

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **P3** y la referencia oficial indicada: P3 — idempotencia; contrato de insert Wix Data y PR #587..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si el primer intento persiste, el segundo se reconoce como replay y existe un único registro con el mismo ID; FAIL si duplica o inicia un pago nativo.

## P4 — Hook beforeInsert: normalización y rechazo de sobre TPV inválido

**Precondición:** sitio QA; acceso autorizado a la colección CajaActual; registro de prueba no operativo y aislado. No alterar la CajaActual real ni ningún ledger.

**Pasos UI en Wix Preview:**
1. Enviar un insert de CajaActual con sourceType/processingMode en minúsculas y metadatos TPV canónicos completos.
2. Verificar la normalización del registro aceptado.
3. Intentar un segundo insert sin siteId.
4. Intentar un tercer insert con externalSideEffects=true.
5. Conservar los resultados de las tres operaciones y confirmar que no se modificó ningún registro real.

**JSON esperado:**
Válido:
```json
{"sourceType":"SYNTHETIC","processingMode":"INTERNAL","reconciliationStatus":"NOT_RECONCILED","inserted":true}
```
Inválido:
```json
{"inserted":false,"errorCode":"SCHEMA_VIOLATION"}
```

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **P4** y la referencia oficial indicada: P4 — hook beforeInsert; https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-insert..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si el sobre válido se normaliza y ambos sobres inválidos son rechazados por el hook; FAIL si se persiste cualquiera de los inválidos.


## F5 — HistoricoCierresZ append-only

**Precondición:** PR #589 fusionada y código actualizado en Wix Preview; disponer del `_id` de un registro Z explícitamente sintético ya existente. No crear, modificar ni borrar registros.

**Pasos en Wix Preview:**
1. Ejecutar una llamada de solo prueba desde el backend Preview que intente actualizar únicamente el registro sintético existente usando `wixData.update` sobre `HistoricoCierresZ`.
2. Conservar el error completo y confirmar mediante lectura strong que el registro permanece idéntico.
3. No ejecutar sobre cierres reales.

**JSON esperado:**
```json
{"attempted":true,"updated":false,"rejected":true,"errorMessageContains":"append-only","recordUnchanged":true}
```

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **F5** y la referencia oficial indicada: F5 — hook beforeUpdate; https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si el hook rechaza cualquier update y la lectura strong confirma que el registro sintético no cambió; FAIL si una actualización persiste.

## F1 — Contrato de CONFIG_SISTEMA_FISCAL

| Campo | Tipo | Formato/validación | Obligatorio | Fuente en código |
|---|---|---|---|---|
| `_id` | string | Valor exacto `CONFIG_SISTEMA_FISCAL`; singleton | Sí | `src/backend/data.js:908-910`; `src/backend/eventLog.js:167-169` |
| `recordType` | string/enum | Valor exacto `CONFIG_SISTEMA` | Sí | `src/backend/data.js:871-873`; `src/backend/validation.js:294-295` |
| `schemaVersion` | integer | Exactamente `1` | Sí | `src/backend/validation.js:316-321` |
| `traceId` | string | No vacío tras trim | Sí | `src/backend/validation.js:320-322` |
| `taxId` | string | NIF/NIE/CIF válido con control; VAT-UE validado por formato (sin consulta VIES); normalizado a mayúsculas | Sí | `src/backend/validation.js:355-363,709-713`; `src/backend/eventLog.js:172-193`; `src/backend/fiscalAggregator.web.js:473-485` |
| `legalName` | string | Razón social no vacía tras trim | Sí | `src/backend/validation.js:356-365`; `src/backend/eventLog.js:181-190` |
| `thirdPartyType` | null | Debe ser null o vacío; CONFIG_SISTEMA no es TERCERO | Sí | `src/backend/validation.js:367-369` |
| `sistemaInformaticoNombre` | string | No vacío tras trim | Sí | `src/backend/eventLog.js:172-190` |
| `idSistemaInformatico` | string | No vacío tras trim | Sí | `src/backend/eventLog.js:173-190` |
| `verifactuVersion` | string | No vacío tras trim; se expone como `version` | Sí | `src/backend/eventLog.js:175-190` |
| `numeroInstalacion` | string | No vacío tras trim | Sí | `src/backend/eventLog.js:176-190` |
| `tipoUsoPosibleSoloVerifactu` | boolean|string|number | boolean o representación `S, SI, TRUE, 1, N, NO, FALSE, 0`; normalizado a S/N | Sí | `src/backend/eventLog.js:147-153,177-190` |
| `tipoUsoPosibleMultiOT` | boolean|string|number | boolean o representación `S, SI, TRUE, 1, N, NO, FALSE, 0`; normalizado a S/N | Sí | `src/backend/eventLog.js:147-153,178-190` |
| `indicadorMultiplesOT` | boolean|string|number | boolean o representación `S, SI, TRUE, 1, N, NO, FALSE, 0`; normalizado a S/N | Sí | `src/backend/eventLog.js:147-153,179-190` |
| `fechaInicioVerifactu` | string | Fecha real en formato `YYYY-MM-DD`; se rechazan fechas imposibles | Sí | `src/backend/eventLog.js:155-164,182-190` |

**Alta del registro:** el humano debe dar de alta este singleton en **Wix CMS → MapaStaff** con datos legales VERIFICADOS. El código falla cerrado si falta, está duplicado o incompleto. No introducir valores de ejemplo ni ficticios. Los flags de escritura fiscal/contable deben permanecer deshabilitados.

**Verificación read-only esperada tras el alta:**
```json
{"count":1,"_id":"CONFIG_SISTEMA_FISCAL","recordType":"CONFIG_SISTEMA","requiredFieldsPresent":true,"taxIdChecksumValid":true}
```

### Si FAIL
1. Captura el JSON real en el bloque PEGAR_RESULTADO_AQUI.
2. Abre un issue con la etiqueta `runtime-fail` y adjunta el JSON íntegro.
3. El issue debe citar **F1** y la referencia oficial indicada: F1 — contrato fiscal de eventLog.js/validation.js y documentación técnica AEAT SIF/VERI*FACTU aplicable..
4. No reintentes sin fusionar un fix; repetir el mismo test sin cambio de código no aporta evidencia nueva.

### Si PASS
1. Pega el JSON íntegro y anota fecha + ejecutor en la tabla resumen.
2. Actualiza `docs/RELEASE-READINESS.md` a PASS y enlaza este bloque de evidencia.
3. Si era el último P0 pendiente, registra la decisión GO.

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si existe exactamente un singleton, todos los campos obligatorios están completos y el NIF/NIE/CIF/VAT-UE supera la validación con checksum; FAIL en cualquier otra situación.

## Resumen de ejecución

| Patrón | Estado (PENDIENTE/PASS/FAIL) | Fecha ejecución | Ejecutor |
|---|---|---|---|
| P1 | PENDIENTE | — | — |
| P2 | PENDIENTE | — | — |
| P3 | PENDIENTE | — | — |
| P4 | PENDIENTE | — | — |
| F5 | PENDIENTE | — | — |
| F1 | PENDIENTE | — | — |
