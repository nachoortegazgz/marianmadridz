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

**PEGAR_RESULTADO_AQUI**
```json
```

**Criterio:** PASS si el sobre válido se normaliza y ambos sobres inválidos son rechazados por el hook; FAIL si se persiste cualquiera de los inválidos.

## Resumen de ejecución

| Patrón | Estado (PENDIENTE/PASS/FAIL) | Fecha ejecución | Ejecutor |
|---|---|---|---|
| P1 | PENDIENTE | — | — |
| P2 | PENDIENTE | — | — |
| P3 | PENDIENTE | — | — |
| P4 | PENDIENTE | — | — |
