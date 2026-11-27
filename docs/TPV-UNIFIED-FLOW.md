# TPV — flujo único y contrato operativo vigente

**Estado:** núcleo de clasificación/gates integrado; TPV funcional Runtime pendiente.  
**Última consolidación:** 2026-11-27.  
**Autoridad:** este documento define el flujo TPV; el estado medible está en [STATE-NOW](STATE-NOW.md) y los gates en [RELEASE-READINESS](RELEASE-READINESS.md).

## 1. Arquitectura obligatoria

Un único código, contrato de dominio, validación, autorización, WebMethods y writer para desarrollo y producción. No existe un runtime TPV alternativo por Sandbox/Live, sintético/real, Preview/Published o test-run. Los tests usan fixtures y dobles de infraestructura, pero ejercitan las mismas funciones de dominio.

Frontend: presentación y orquestación; solo envía identificadores y datos de interacción mínimos. Backend: identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y clasificación.

## 2. Clasificación temporal implementada

PR #640 integra `src/backend/tpv/tpvRecordNature.js`.

- `recordTimestamp`: instante UTC generado en backend.
- `productionActivationAt`: corte UTC único leído de la configuración existente `MapaStaff` con `recordType=CONFIG_SISTEMA`.
- `recordNature`: metadato persistido derivado; anterior al corte = `SYNTHETIC`, igual o posterior = `REAL`.
- El navegador no suministra ni puede elegir timestamp, corte o naturaleza.
- Ausencia de singleton/corte: se mantiene `SYNTHETIC`.
- Configuración duplicada, fecha inválida o timestamp inválido: rechazo fail-closed.
- La clasificación no cambia motor, permisos, esquema, validaciones, writer ni efectos externos. No reclasifica registros históricos.

El read-back CMS del 2026-11-27 encontró cinco registros MapaStaff, pero ninguno `CONFIG_SISTEMA` y ninguno con `productionActivationAt`. Por ello no se ha fijado el corte real y los nuevos registros continúan clasificados como sintéticos.

## 3. Contratos de persistencia

| Colección | Responsabilidad |
|---|---|
| `TransaccionesTPV` | Intenciones comerciales pendientes/no contables; no prueba cobro ni movimiento físico. |
| `MovimientosCaja` | Ledger físico canónico, append-only. |
| `ControlOperativo` | Locks, idempotencia técnica y auditoría; no ledger comercial/físico. |
| `CajaActual` | Proyección de la sesión de caja; no sustituye al ledger. |
| `HistoricoCierresZ` | Registro de cierre sujeto a su contrato de inmutabilidad. |

No duplicar ledgers ni trasladar intenciones comerciales a movimientos físicos. No usar REST/CMS directo para saltarse writers, hooks o validaciones.

## 4. Preparación y registro de venta

- `validarVentaBorrador()` resuelve catálogo/impuestos en backend y devuelve `saleReadinessBlockers`.
- `registrarVenta()` vuelve a resolver catálogo e impuestos y aplica los mismos bloqueos antes de crear una intención nueva.
- Si existen bloqueos, devuelve `TPV_SALE_NOT_READY`, `persisted=false` y no crea intención nueva.
- El replay idempotente de una intención existente se resuelve antes del gate para no duplicar efectos.
- Draft Orders, Wix Payments, capturas, reembolsos y terminales externos no se invocan en QA.
- `saleReady=false` sigue siendo el estado actual del widget; la corrección del gate no habilita ventas.

## 5. Contrato V1 de preparación

- Cantidades enteras positivas e importes en unidades menores.
- Catálogo y precio resueltos por backend con Wix Catalog V3/Bookings.
- Impuestos calculados en backend con APIs Wix; no aceptar importes del cliente.
- V1 admite una única tasa fiscal verificable y un solo medio físico: EFECTIVO o TARJETA.
- Bizum, split tender, bonos, tarjetas regalo y descuentos no configurados permanecen fuera del contrato V1.
- `writeContractV1.eligible=true` no equivale a `saleReady=true`, pago verificado o persistencia.

## 6. Gates aún abiertos

1. Configuración fiscal canónica/legal, serie, numeración y reglas aprobadas.
2. Presentación del precio final al consumidor y política de inventario físico.
3. Evidencia de pago simulado fiable, con proveedor/terminal simulado y sin cobros reales.
4. Contrato físico completo de MovimientosCaja, cadena hash/sequence, idempotencia y recuperación.
5. Sesión de caja sintética aislada; no reutilizar `CajaActual` ABIERTA ni históricos existentes.
6. Wix Preview/Runtime del bridge y WebMethods, permisos, concurrencia, idempotencia y recuperación.
7. Read-back que confirme persistencia y proyección sin divergencias.

No retirar gates ni activar writers por configuración ficticia. Las pruebas deben usar el mismo flujo de dominio y un adaptador simulado sin efectos externos.

## 7. Pruebas y estado

- PR #640 integrada; CI offline: 81 suites / 764 tests / 0 fallos.
- Tests de clasificación UTC: sin corte, antes, igualdad, después y fechas inválidas.
- Tests contractuales del gate `registrarVenta` y de ausencia de efectos eCommerce externos.
- No se ha ejecutado Wix Preview/Runtime E2E, ni una venta real/sintética persistida, ni pago, ni movimiento físico, ni cierre.
- El estado de aceptación vigente se mantiene en [RELEASE-READINESS](RELEASE-READINESS.md).

## 8. Seguridad e integridad

Los ledgers físicos, fiscales, contables, laborales y cierres append-only no se sobrescriben ni eliminan, incluso si contienen registros sintéticos. Las rectificaciones se realizan mediante nuevos registros trazables. No alterar la sesión `CajaActual` existente ni los históricos para preparar QA.
