# Release readiness — 2026-11-27

**NO-GO para MVP operativo/comercial.** Desarrollo y QA offline: PASS. No hay aceptación Wix Runtime ni habilitación productiva.

## Gates por contexto

| Control | Desarrollo / CI | Wix Preview aislado | Producción |
|---|---|---|---|
| Configuración fiscal/serie ausente | No bloquea pruebas de dominio; probar el rechazo concreto | No bloquea si los efectos externos están interceptados | Bloquea la operación fiscal afectada |
| Identidad/permisos inválidos | Bloquea la operación bajo prueba | Bloquea | Bloquea |
| Esquema, importe, secuencia o hash inválido | Bloquea el writer afectado | Bloquea | Bloquea |
| Idempotencia/concurrencia no garantizadas | Las pruebas deben detectar el defecto | Bloquea escritura | Bloquea |
| Pago, AEAT, terminal o notificación externa | Dobles simulados; cero efectos reales | Dobles o tenant de pruebas | Solo con configuración y autorización |
| Persistencia CMS | Repositorio/fixture aislado | Solo writer canónico y fixture aislado | Writer autorizado y controles completos |
| Wix Runtime | No requerido para unitarias/contrato | Requerido para aceptación Runtime | Evidencia posterior al despliegue |

## Estado verificado

- PR #651 integrada en `main` (`abf862c9e7cbdc393c0186f650ed30f57aaeeee6`); código validado con CI PASS: `7771f4c6bb7da61ecf60bd58708b26d5331745dd`.
- Layer 1: 29 suites / 376 tests PASS.
- Layer 2: 16 suites / 249 tests PASS.
- Suite completa: 81 suites / 763 tests PASS.
- Gitleaks, npm audit, contratos SDK Wix y ESLint: PASS.
- No hay evidencia Runtime E2E de venta, pago, movimiento físico, devolución, arqueo o cierre.
- Configuración fiscal productiva y mapping AEAT no acreditados; no conectar el hash interno como hash AEAT.
- Tres recuperaciones fiscales pendientes de correlación según último read-back.
- Seis divergencias Bookings/CitasF2 pendientes de reconciliación.
- Writer de jornada y transporte SharePoint/Graph E2E no validados.
- Sin evidencia de sincronización del SHA Git con el código instalado en Wix.

## Invariantes de QA

- Un solo código y contrato de dominio en todos los contextos.
- No borrar registros ni purgar físicamente. `bulkRemove` está prohibido; cachés, tokens, locks y rate limits autorizados se retiran lógicamente mediante CAS. Evidencia de idempotencia, auditoría y ledgers se conserva.
- No modificar ledgers contabilizados, cierres ni evidencia histórica.
- No reutilizar la caja singleton ABIERTA ni escribir sobre históricos.
- Las pruebas usan fixtures y adaptadores simulados; ningún pago, reembolso, remesa AEAT, terminal o notificación real.
- Los errores son específicos, estables y accionables. El detalle técnico expuesto al frontend se limita al código seguro; no se exponen mensajes brutos ni secretos.
- CI verde no autoriza publicación ni habilitación productiva.

## Criterios GO

1. PR #651 integrada tras revisión final de diff, CI PASS y reversión definida.
2. WebMethods TPV y bridge aceptados en Wix Preview/Runtime sobre identidad y fixture aislados.
3. Confirmar destino de escritura y sincronización del SHA/fingerprint instalado.
4. Configuración fiscal validada por fuente oficial y revisión profesional; mapping AEAT verificado.
5. Correlacionar recuperaciones fiscales pendientes sin alterar registros fuente.
6. Reconciliar Bookings/CitasF2 con proceso idempotente y evidencia.
7. Validar pagos simulados, devoluciones, caja, cierres, conciliación y ausencia de efectos externos.
8. Validar transporte Capa 3 en tenant SharePoint aislado.
9. Superar CI, revisión, seguridad, reversión y aceptación posterior.

## Evidencia

Cada PASS identifica SHA, entorno, prueba y resultado. Niveles: estático/contrato, unitario, integración simulada, Preview, Runtime y producción. No extrapolar.
