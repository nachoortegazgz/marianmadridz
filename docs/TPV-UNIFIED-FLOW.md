# TPV — flujo único y contrato operativo vigente

**Estado:** núcleo de clasificación/gates integrado; TPV funcional Runtime pendiente.  
**Última consolidación:** 2026-11-27.  
**Autoridad:** este documento define el flujo TPV; el estado medible está en [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md).

## 1. Arquitectura y pruebas

Un único código y reglas de dominio para desarrollo, pruebas y producción. Los tests usan fixtures y adaptadores de infraestructura simulados para aislar CMS, pagos, terminales, fiscalidad y notificaciones; deben invocar las mismas funciones de dominio y contratos. No crear un runtime de negocio paralelo.

Frontend: presentación y orquestación. Backend: identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y clasificación.

**Regla anti-bloqueo:** la falta de configuración fiscal real, serie productiva, corte de activación o datos comerciales reales no puede impedir probar el código mediante tests unitarios, contractuales o integración simulada. Cada test declara su fixture sintético y simula los puertos externos. No se deben falsear ni insertar configuraciones productivas para conseguir un PASS.

## 2. Clasificación temporal

- `recordTimestamp`: instante UTC generado en backend.
- `recordNature`: metadato de trazabilidad derivado en backend; no es selector de flujo ni de runtime.
- Los fixtures de test se marcan explícitamente como sintéticos desde el contexto de test confiable, nunca mediante un campo controlado por navegador.
- La ausencia de configuración de activación no bloquea tests de dominio: los tests inyectan reloj/configuración de fixture o prueban expresamente el comportamiento sin configuración.
- En operaciones reales, sin configuración única y válida no se permite atribuir naturaleza REAL ni activar efectos productivos. Configuración ambigua o fechas inválidas deben seguir produciendo rechazo donde el contrato lo exija.
- No reclasificar registros históricos.

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
- `registrarVenta()` vuelve a resolver catálogo e impuestos y aplica los mismos bloqueos antes de aceptar una operación real.
- Si existen bloqueos de negocio/producción, la operación real devuelve `TPV_SALE_NOT_READY` y no crea intención nueva.
- El replay idempotente se resuelve antes del gate para no duplicar efectos.
- Los tests deben cubrir dos comportamientos diferenciados: (a) gates reales activos y rechazo correcto; (b) recorrido de dominio con fixtures sintéticos y adaptadores simulados, sin cobro ni efecto externo. No se desactiva el gate de producción para conseguir el segundo caso.
- Draft Orders, Wix Payments, capturas, reembolsos y terminales externos se sustituyen por dobles simulados durante QA.

## 5. Contrato V1 de preparación

- Cantidades enteras positivas e importes en unidades menores.
- Catálogo y precio resueltos por backend o fixture controlado de test.
- Impuestos calculados por backend o por fixture fiscal explícito; nunca aceptar importes del navegador como autoridad.
- V1 admite una única tasa fiscal verificable y un solo medio físico: EFECTIVO o TARJETA.
- Bizum, split tender, bonos, tarjetas regalo y descuentos no configurados permanecen fuera del contrato V1. Sus tests de rechazo no deben bloquear pruebas de los medios admitidos.
- `writeContractV1.eligible=true` no equivale a `saleReady=true`, pago verificado o persistencia.

## 6. Gates por contexto

| Contexto | Qué debe bloquear | Qué no debe bloquear |
|---|---|---|
| Unitario/contractual | Contratos inválidos y entradas fuera de esquema | Configuración fiscal/serie real, CMS real, pagos reales |
| Integración simulada | Inconsistencias del dominio y del repositorio simulado | Credenciales, terminal, AEAT, notificaciones o SharePoint real |
| Wix Preview/Runtime aislado | Permisos incorrectos, persistencia no aislada y efectos externos no interceptados | Datos comerciales reales, caja productiva, cobros o remesas reales |
| Producción | Configuración legal incompleta, permisos, pagos no verificados y controles de integridad | Ningún gate obligatorio de producción se elimina |

La falta de datos fiscales reales no es un defecto de un test de lógica. Es una condición de datos/configuración que debe expresarse como error accionable de la operación afectada, no como interruptor global del writer. Las suites con fixtures ejecutan el mismo código de dominio y sus validaciones.

## 7. Integridad

Los ledgers físicos, fiscales, contables, laborales y cierres append-only no se sobrescriben ni eliminan, incluso si contienen registros sintéticos. Las rectificaciones se realizan mediante nuevos registros trazables. Los tests persistentes deben usar un tenant/colección de pruebas aislado y writer canónico; nunca reutilizar la sesión `CajaActual` existente ni históricos compartidos.

## 8. Estado de pruebas

CI offline acredita únicamente las suites ejecutadas. Wix Preview/Runtime, persistencia online, concurrencia online y sincronización Git-Wix requieren evidencia específica del entorno. Los tests simulados no se etiquetan como Runtime E2E.
