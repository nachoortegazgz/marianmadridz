# Normalización de CajaActual — sesión abierta y sequenceCounters — 2026-11-17

## Evidencia live

Colección: `CajaActual`, singleton único.

- Estado: `ABIERTA`.
- `openedAt=2026-11-14T06:00:00Z`.
- `closedAt=2026-11-12T23:00:00Z`.
- `lastMovementAt=2026-11-12T23:00:00Z`.
- `lastOperationType=ARQUEO_INICIAL`, estado `CONFIRMADA`, `lastOperationAt=2026-11-14T04:01:04.400Z`.
- Apertura: 300 EUR en efectivo y 0 EUR en los otros métodos.
- Saldo: `cashAmount=300`, `expectedCash=300`, `countedCash=300`, `difference=0`, `salesCount=0`.
- No hay `cashMovementId`.
- `sequenceCounters` se devuelve como texto JSON `"{}"`, aunque el esquema de la colección declara `OBJECT`. El texto parsea como objeto vacío.

No se ha modificado el singleton ni se han insertado movimientos.

## Diagnóstico

1. `cajas.web.js::_hasOpenCashierSession` consideraba abierta una sesión solo cuando `closedAt` era falsy. Un `closedAt` histórico anterior a `openedAt` bloqueaba cobros presenciales aunque `cashRegisterStatus=ABIERTA`.
2. `_readCashierSessionSummary` aplicaba el filtro `recordTimestamp <= closedAt` sin comprobar si el cierre pertenecía a la sesión actual.
3. `_updateCajaActual` hacía spread directo de `sequenceCounters`; si Wix devuelve el JSON string, se convertiría en propiedades numéricas de caracteres.
4. `CajaActual_beforeUpdate` validaba el original combinado y rechazaba `sequenceCounters` como string, impidiendo normalizarlo durante una actualización.

## Corrección en esta rama

Rama: `fix/caja-stale-session-sequence-counters-2026-11-17`.

- Una fecha de cierre solo cierra la sesión actual si es igual o posterior a `openedAt`. Un cierre anterior se trata como metadato de la sesión previa.
- Los resúmenes de sesión y la respuesta de estado aplican el mismo cálculo de cierre efectivo.
- `sequenceCounters` acepta exclusivamente objetos o JSON strings que parseen a objeto plano; arrays, valores primitivos y JSON inválido siguen fallando cerrados.
- Los hooks de `CajaActual` normalizan el JSON string antes de validar y persisten la conversión a objeto en la siguiente actualización.
- Si la caja está ABIERTA y `closedAt < openedAt`, el hook y la proyección limpian `closedAt` a null. No se cambia el estado de caja ni se crea una sesión.

## Pruebas añadidas

- Hook test: JSON string `"{}"` se normaliza a objeto; cierre anterior a apertura se limpia; JSON inválido se rechaza.
- E2E offline: un movimiento presencial con caja ABIERTA, cierre anterior y sequenceCounters JSON string debe completar en mocks, normalizar el contador y mantener la proyección coherente.

## Salvaguardas

- No se ejecuta ninguna operación sobre Wix CMS live.
- No se cierra ni abre la caja.
- No se crean movimientos fiscales, cierres Z ni compensaciones.
- Los writers fiscales/contables siguen deshabilitados.
- No se declara resuelta la conciliación de los dos pedidos y sus transacciones de issue #416.

## Validación y despliegue

CI offline superada: Layer 1, 28 suites/331 tests PASS; Layer 2, 19 suites/257 tests PASS; Secret scanning SUCCESS. Runtime Wix y read-back de código siguen pendientes. El cambio solo permite que una sesión abierta no sea bloqueada por el cierre de una sesión anterior y que un JSON object serializado no corrompa el mapa de secuencias. No sustituye la reconciliación manual de la caja ni la confirmación de si los pedidos POS son fixtures de QA.

**Estado:** NO-GO hasta CI, runtime y conciliación de issue #416.
