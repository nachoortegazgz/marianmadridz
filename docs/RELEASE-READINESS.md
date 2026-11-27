# Release readiness — 2026-11-27

**NO-GO para MVP operativo/comercial.** No impide desarrollo, unitarias, contratos ni integración simulada con fixtures.

## Bloqueos por contexto

| Control | Desarrollo / CI | Wix Preview aislado | Producción |
|---|---|---|---|
| Configuración fiscal/serie ausente | No bloquea pruebas de dominio; probar también el rechazo concreto | No bloquea si efectos externos están interceptados | Bloquea la operación fiscal afectada |
| Identidad/permisos inválidos | Bloquea la operación bajo prueba | Bloquea | Bloquea |
| Esquema, importe, secuencia o hash inválido | Bloquea el writer afectado | Bloquea | Bloquea |
| Idempotencia/concurrencia no garantizadas | Las pruebas deben detectar el defecto | Bloquea escritura | Bloquea |
| Pago, AEAT, terminal o notificación externa | Dobles simulados; cero efectos reales | Dobles o tenant de pruebas | Solo con configuración y autorización |
| Persistencia CMS | Repositorio/fixture aislado | Solo writer canónico y fixture aislado | Writer autorizado y controles completos |
| Wix Runtime | No requerido para unitarias/contrato | Requerido para aceptación Runtime | Evidencia posterior al despliegue |

## Bloqueos actuales conocidos

- CI final de PR #651 pendiente en el HEAD consultado; PR no integrada.
- No hay evidencia Runtime E2E de venta, pago, movimiento físico, devolución, arqueo o cierre.
- Configuración fiscal productiva y mapping AEAT no acreditados; no conectar el hash interno como hash AEAT.
- Tres recuperaciones fiscales pendientes de correlación según último read-back.
- Seis divergencias Bookings/CitasF2 pendientes de reconciliación.
- Writer de jornada y transporte SharePoint/Graph E2E no validados.
- Sin evidencia de sincronización del SHA Git con el código instalado en Wix.

## Invariantes de QA

- Un solo código y contrato de dominio en todos los contextos.
- No borrar registros ni purgar físicamente. No modificar ledgers contabilizados, cierres ni evidencia histórica.
- No reutilizar la caja singleton ABIERTA ni escribir sobre históricos.
- Las pruebas usan fixtures y adaptadores simulados; ningún pago, reembolso, remesa AEAT, terminal o notificación real.
- Los errores deben ser específicos, estables y accionables; no reemplazar fallos concretos por bloqueos globales o mensajes genéricos.
- CI verde no autoriza publicación ni habilitación productiva.

## Criterios GO

1. PR #651 revisada, CI PASS sobre HEAD final, diff y seguridad revisados, reversión definida y merge autorizado.
2. WebMethods TPV y bridge aceptados en Wix Preview/Runtime sobre identidad y fixture aislados.
3. Confirmar destino de escritura y sincronización del SHA/fingerprint instalado.
4. Configuración fiscal validada por fuente oficial y revisión profesional; mapping AEAT verificado.
5. Correlacionar y resolver las recuperaciones fiscales pendientes sin alterar registros fuente.
6. Reconciliar Bookings/CitasF2 con proceso idempotente y evidencia.
7. Validar pagos simulados, devoluciones, caja, cierres, conciliación y ausencia de efectos externos.
8. Validar transporte Capa 3 en tenant SharePoint aislado.
9. Superar CI, revisión, seguridad, reversión y aceptación posterior.

## Evidencia

Cada PASS identifica SHA, entorno, prueba y resultado. Niveles: estático/contrato, unitario, integración simulada, Preview, Runtime y producción. No extrapolar.
