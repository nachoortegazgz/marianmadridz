# Canon de arquitectura

**Vigencia:** 2026-11-28.  
**Estado:** ACTIVE.  
El estado operativo se consulta en [STATE-NOW](STATE-NOW.md); los gates en [RELEASE-READINESS](RELEASE-READINESS.md); el contrato TPV en [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md). La guía consultiva IA está en [AI-ENTRYPOINT](AI-ENTRYPOINT.md).

## Fuentes de verdad y autoridad

- El propietario define objetivos, requisitos funcionales, prioridades, criterios de aceptación y autorizaciones. Sus instrucciones explícitas posteriores prevalecen sobre decisiones anteriores del proyecto.
- La documentación oficial vigente de Wix gobierna los contratos y límites de Wix APIs, SDK, Velo, permisos, eventos y Runtime. La documentación oficial de cada proveedor gobierna sus propias integraciones.
- Wix Apps es autoridad de sus dominios nativos: Bookings, catálogo/inventario, eCommerce, Payments e Invoices según aplicaciones y contratos instalados.
- Wix CMS es SSOT transaccional de las entidades propias del proyecto y sus proyecciones; no sustituye a Wix Apps nativas.
- Git es SSOT del código versionado; no demuestra qué revisión está instalada en Wix.
- SharePoint es custodia documental/evidencia; no gobierna transacciones ni modifica capas operativas.

Ante contradicciones, separar autoridad de negocio, contrato técnico, implementación y comportamiento observado. Registrar evidencia y resolver antes de cambiar código/datos.

## Capas y responsabilidades

- **Capa 0 — fundación transversal:** configuración, seguridad, validación, normalización, errores, acceso a datos, logging, utilidades compartidas y primitivas de persistencia.
- **Capa 1 — reservas:** Wix Bookings V2 gobierna servicios, disponibilidad, reservas, profesionales/recursos y estado nativo. CMS propio conserva correlaciones, datos complementarios y proyecciones reconciliables.
- **Capa 2 — operación económica y laboral:** TPV, checkout, pagos, movimientos de caja, cierres, contabilidad, fiscalidad y jornada laboral.
- **Capa 3 — auditoría y trazabilidad observacional:** auditoría, reconciliación visible, preparación y entrega controlada de evidencias. No gobierna, modifica ni reescribe las capas 1 y 2.

## Invariantes

1. Un único código y contrato de dominio para desarrollo, pruebas y producción. Fixtures y adaptadores simulados sustituyen dependencias externas, no la lógica de negocio.
2. No usar interruptores globales que bloqueen writers por entorno. Cada operación valida sus precondiciones concretas: identidad, permisos, configuración requerida, esquema, importes, secuencias, hashes, idempotencia y concurrencia.
3. Una condición incumplida devuelve error explícito y estable; no se omite validación ni se convierte en éxito parcial silencioso.
4. Wix CMS se escribe mediante DAL, hooks y writers canónicos. Prohibido saltárselos con REST/CMS directo.
5. No se borran registros ni se purga evidencia física. Los controles efímeros solo se retiran lógicamente bajo su contrato y autorización.
6. Los datos operativos/comerciales editables admiten actualización validada. Los ledgers fiscales, contables, laborales, movimientos contabilizados y cierres finalizados conservan evidencia append-only; correcciones mediante nuevos registros/eventos rectificativos trazables.
7. Webhooks, jobs, writers y reintentos son idempotentes y trazables. No asumir transacciones multi-documento de Wix Data; definir recuperación ante fallos parciales.
8. No confiar en identidad, rol, propiedad, precios, impuestos, totales o permisos aportados por navegador.
9. No clasificar negocio por entorno ni por etiquetas cliente-controladas. Los marcadores explícitos de smoke/fixture solo identifican pruebas cuando el contrato lo requiere; no acreditan operaciones reales.
10. No habilitar pagos reales, AEAT, notificaciones ni servicios externos en pruebas; interceptarlos mediante adaptadores simulados.
11. `transactionId` es obligatorio y estable en los writers de transacciones económicas que lo requieren; usarlo para deduplicación y recuperación. No sustituirlo por secuencia, traceId o sessionId.
12. No modificar, reclasificar ni recalcular históricos durante QA. Los datos anteriores al despliegue oficial de producción de 2027 son sintéticos según la regla del proyecto, pero eso no autoriza su borrado ni mutación destructiva.

## TPV y fiscalidad

- `TransaccionesTPV`: intención comercial; no acredita cobro ni movimiento físico.
- Pago verificado: evidencia independiente de Wix Payments/proveedor.
- `MovimientosCaja`: ledger físico canónico.
- `ControlOperativo`: locks, idempotencia técnica y auditoría.
- `CajaActual`: proyección de sesión, no ledger.
- `HistoricoCierresZ` y `LibroAsientosContablesDetalle`: evidencias append-only conforme a su contrato.
- `transactionId` obligatorio en `registrarEventoEconomico()` desde PR #667 y en el writer fiscal manual desde PR #650. La aplicabilidad a cada writer restante se determina mediante la matriz de writers; no imponer una regla ciega a eventos no económicos.
- El hash interno no se denomina hash AEAT. El mapping fiscal requiere contraste con especificación oficial y revisión profesional; no recalcular históricos ni inferir campos normativos.

## Reservas y Capa 3

- Bookings V2 gobierna el estado nativo; `CitasF2` es proyección reconciliable por backend, con trazabilidad e idempotencia.
- En reserva dual F1 + exposición + F2 se utiliza el mismo profesional en ambas fases; durante exposición se libera su agenda conforme al contrato de reserva.
- Capa 3 prepara paquetes minimizados y verificables. El transporte real exige tenant, permisos y aceptación específicos.

## Evidencia

Separar validación estática, unitaria, integración simulada, Wix Preview, Wix Runtime y producción. No extrapolar PASS entre niveles. Cada evidencia identifica commit, entorno, alcance y resultado. Ver [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md).
