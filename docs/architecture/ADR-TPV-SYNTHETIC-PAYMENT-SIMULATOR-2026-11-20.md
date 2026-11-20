# Decisión técnica — pruebas sintéticas TPV y simulador de proveedor

**Fecha:** 2026-11-20  
**Sitio:** Marian Madrid — `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio base:** `main` en `86ffa103b6b52ff2c514174f70180f020d786a1b`  
**Alcance:** código, fixtures y documentación. No se escriben datos en Wix CMS y no se publica.

## Decisiones adoptadas

1. Se conserva el sitio actual. No se crea un segundo sitio y no se publica el principal.
2. Los clientes y profesionales TPV sintéticos no se crean como cuentas Wix Members ni como contactos CRM. Se representan exclusivamente mediante registros sintéticos en la colección propia `TpvSandboxIdentities`.
3. El fixture de seis identidades se versiona en `docs/qa/fixtures/tpv-sandbox-identities.json`. Solo puede importarse manualmente desde el panel CMS con el contexto Sandbox comprobado visualmente. No se permite usar la Management API REST para intentar seleccionar Sandbox ni sincronizar las filas a Online.
4. Las colecciones de Wix Apps (Members, Bookings, Stores, Payments, Gift Cards) no se consideran aisladas por el Sandbox CMS. El TPV no debe crear ni modificar sus registros en las pruebas sintéticas.
5. Se implementa un simulador de contrato local para pagos y reembolsos. No se presenta como el modo Sandbox oficial de Wix Payments ni como una integración real del proveedor.
6. Los WebMethods de simulación requieren miembro y rol cajero validados en backend. El simulador es puro y no persiste, no crea Orders/Payments y no invoca proveedor alguno.
7. No se cambia el gate de las operaciones TPV persistentes ni se habilita bootstrap automático de CajaActual/identidades. La presemilla de CMS y la prueba runtime siguen bloqueadas hasta acreditar el aislamiento efectivo del contexto Preview.

## Implementación

- `src/backend/tpv/tpvPaymentSimulator.js`: simulación determinista de autorización, captura, rechazo, acción adicional, pendiente y reembolso.
- `src/backend/tpv/tpvPagos.web.js`: expone `simularPasarelaPago` y `simularReembolsoPasarela` con autorización backend.
- `src/backend/tests/tpv.payment-provider-simulator.test.mjs`: pruebas unitarias de escenarios, importes, divisa, huella y reembolso.
- `src/backend/tests/tpv.web-modules.contract.test.mjs`: verifica los límites de los WebMethods y ausencia de llamadas de pago externas.
- `docs/qa/fixtures/tpv-sandbox-identities.json`: tres clientes y tres profesionales sintéticos con correo `@example.test`, validados por `assertTpvSandboxIdentity`.

## Contrato de simulación

| Operación | Escenario | Estado simulado |
|---|---|---|
| Pago | APPROVED + capture | CAPTURED |
| Pago | APPROVED + no capture | AUTHORIZED |
| Pago | DECLINED | DECLINED |
| Pago | REQUIRES_ACTION | REQUIRES_ACTION |
| Pago | PENDING | PENDING |
| Reembolso | APPROVED | REFUNDED |
| Reembolso | DECLINED | DECLINED |
| Reembolso | PENDING | PENDING |

Las cantidades se procesan como céntimos enteros y la divisa está limitada a EUR. Las referencias derivan de una clave idempotente normalizada. Se devuelve un fingerprint SHA-256 para detectar que una clave se haya reutilizado con otro payload.

**Límite de idempotencia:** como no hay persistencia, el simulador solo produce referencias deterministas y fingerprint. No garantiza deduplicación durable entre solicitudes ni acumulación de reembolsos. El repositorio que eventualmente persista estos eventos debe aplicar unicidad/CAS, reconciliación de reintentos y límite acumulado de reembolso.

Todas las respuestas incluyen explícitamente `providerCalled=false`, `realPayment=false`, `persisted=false` y `externalSideEffects=false`.

## Riesgos y controles

- **Riesgo:** confundir la simulación con Wix Payments Sandbox. **Control:** nombres, documentación y payload indican SIMULATOR; no se invocan APIs externas.
- **Riesgo:** introducir datos sintéticos en Online. **Control:** fixture no ejecutable, importación manual exclusivamente en CMS Sandbox y prohibición de Management API para este fin.
- **Riesgo:** convertir identidades sintéticas en identidades Wix. **Control:** no generar memberId/contactId/resourceId ni invitar correos.
- **Riesgo:** afirmar aislamiento solo por una constante. **Control:** la política estática no prueba el data plane; se exige lectura y prueba negativa en runtime antes de activar escritores persistentes.
- **Riesgo:** reembolso acumulado por encima del pago. **Control:** simulador valida cada reembolso contra el importe original; la validación acumulada queda en el consumidor append-only, pendiente antes de cualquier persistencia.

## Validación y release

Las pruebas unitarias nuevas se integran en el runner canónico `npm test`. La validación CI debe ejecutarse sobre la rama/PR. No se declara PASS antes de ver el resultado real del workflow.

No se han ejecutado escrituras CMS, creación de miembros, pedidos, reservas, pagos, reembolsos, webhooks, notificaciones, hardware, publicación ni despliegue.

**Estado:** código y fixture preparados; ejecución CI pendiente; importación Sandbox pendiente; Preview y E2E runtime pendientes. **NO-GO para publicación y para transacciones reales.**
