# Release readiness — 2026-11-28

**Estado global: NO-GO para MVP operativo/comercial.** El sitio permanece Draft/no publicado según el último read-back documentado. La validación offline de Capa 0 está verde para el HEAD correctivo de `main` tras PR #679 (91 suites / 816 tests PASS); no hay aceptación Wix Local Editor/Preview E2E, Wix Runtime ni producción acreditada.

El estado detallado, los SHAs y la evidencia más reciente se mantienen en [STATE-NOW](STATE-NOW.md). Este documento define gates y criterios de aceptación; no duplica el historial de CI.

## Gates por contexto

| Control | Desarrollo / CI | Wix Preview aislado | Producción |
|---|---|---|---|
| Configuración fiscal/serie ausente | No bloquea pruebas de dominio; probar el rechazo específico | No bloquea si efectos externos están interceptados y el fixture es válido | Bloquea la operación fiscal afectada |
| Identidad/permisos inválidos | Bloquea la operación bajo prueba | Bloquea | Bloquea |
| Esquema, importe, secuencia o hash inválido | Bloquea el writer afectado | Bloquea | Bloquea |
| Idempotencia/concurrencia no garantizadas | Las pruebas deben detectar el defecto | Bloquea escritura | Bloquea |
| Pago, AEAT, terminal o notificación externa | Dobles simulados; cero efectos reales | Dobles o tenant de pruebas aislado | Solo con configuración y autorización |
| Persistencia CMS | Repositorio/fixture aislado | Solo writer canónico y fixture aislado inequívoco | Writer autorizado y controles completos |
| Wix Runtime | No requerido para unitarias/contrato | Requerido para aceptación Runtime | Evidencia posterior al despliegue |
| Datos históricos/append-only | No alterar | No alterar; pruebas append-only aisladas | Rectificaciones trazables, nunca sobrescritura destructiva |

## Evidencia vigente conocida

Consultar [STATE-NOW](STATE-NOW.md) para el detalle fechado. A 2026-11-28:

- PR #670 está integrada en `main`; su CI offline reportó 88 suites / 794 tests PASS.
- PR #675 está integrada en `main` mediante squash commit `910ad3faa6e543c23e81b2902726d4d8cd43087f`; su HEAD validado reportó 89 suites / 804 tests PASS.
- PR #679 está integrada (merge `d44501c3c224ac417b283f687718ec9eb7538606`) y su commit correctivo final de `main` es `944eb225b63260353cf283c87b0c0b6f07af6caf`; los workflows post-correction reportaron 91 suites / 816 tests PASS (run `46085827875`) y secret scanning PASS (run `46085827842`).
- La evidencia CI pertenece a los HEAD validados de cada PR; no se debe trasladar automáticamente a commits posteriores.
- Capa 0 continúa EN EJECUCIÓN: quedan propagación de fallos del almacén de secretos, verificación de cobertura de Staff Members v1 para todos los resourceId, conversiones monetarias, configuración de moneda, matriz de writers/idempotencia, deuda/código muerto y validación Runtime.
- El último read-back Wix documentado es 27-11-2026 y es histórico: Draft, una `CajaActual` ABIERTA, movimientos e históricos existentes y divergencias Bookings/CitasF2. No usar esos registros como fixtures ni asumir que los recuentos siguen vigentes.
- No se ha acreditado sincronización entre el SHA de Git y el código instalado en Wix.
- No se han acreditado venta, cobro, movimiento físico, devolución, arqueo, cierre Z ni jornada en Wix Runtime.

## Invariantes de QA

- Un solo código y contrato de dominio para todos los contextos.
- No usar bloqueos globales por entorno ni bloqueos fiscales genéricos para impedir pruebas de dominio.
- No borrar registros ni purgar físicamente. Los ledgers y registros append-only se conservan; las correcciones se realizan con eventos rectificativos.
- No modificar ni reutilizar la caja singleton ABIERTA ni históricos compartidos.
- Las pruebas usan fixtures y adaptadores simulados. Ningún pago, reembolso, remesa AEAT, terminal o notificación real.
- Las escrituras Wix de prueba requieren ámbito aislado inequívoco y writer canónico. Los registros append-only de prueba se conservan y rectifican mediante nuevos eventos.
- Errores específicos, estables y accionables; no exponer mensajes brutos ni secretos.
- CI verde no autoriza publicación ni habilitación productiva.

## Criterios GO

1. Capa 0 cerrada en código y contratos con consumidores inventariados, pruebas pertinentes y sin fallbacks silenciosos que oculten fallos.
2. CI completo PASS en el SHA candidato a release, con revisión final del diff y estrategia de reversión.
3. Bridge TPV y WebMethods aceptados en Wix Preview/Runtime sobre identidad y fixture aislados.
4. Confirmar destino de escritura y sincronización del SHA/fingerprint instalado en Wix.
5. Reservas Bookings V2 y proyección CitasF2 reconciliadas con proceso idempotente y evidencia.
6. Validar TPV: intención comercial, pago verificado simulado, movimiento físico de prueba, proyección, idempotencia, concurrencia, recuperación, devoluciones y cierres, sin efectos económicos reales.
7. Validar jornada laboral y sus permisos/persistencia en Runtime aislado.
8. Configuración fiscal y mapping normativo contrastados con fuentes oficiales y revisión profesional antes de habilitar operaciones fiscales productivas.
9. Validar transporte Capa 3 en tenant SharePoint aislado, con permisos y evidencia.
10. Aprobación expresa del propietario para publicación, pagos reales y cualquier activación productiva.

## Evidencia requerida por aceptación

Cada PASS identifica:
- SHA exacto y rama.
- Entorno: estático, unitario, integración simulada, Preview, Runtime o producción.
- Flujo/método ejecutado y precondiciones.
- Identidad/rol y ámbito de datos cuando aplique.
- Resultado, logs seguros, correlación y read-back.
- Efectos externos: deben ser cero durante QA.

Un smoke HTTP, test estático, mock o CI offline no acredita Runtime E2E. Un read-back de Site Context no acredita sincronización Git-Wix. No extrapolar evidencia entre niveles.
