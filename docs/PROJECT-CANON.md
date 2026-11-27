# Canon de arquitectura

**Vigencia:** 2026-11-27. El estado se consulta en [STATE-NOW](STATE-NOW.md); los gates en [RELEASE-READINESS](RELEASE-READINESS.md); el contrato TPV en [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md).

## Fuentes de verdad

- Documentación oficial vigente de Wix y de las integraciones: contratos de plataforma.
- Wix Apps: fuente de verdad de sus dominios nativos.
- Wix CMS: SSOT transaccional de las entidades propias.
- Git: SSOT del código versionado; no prueba qué código está instalado en Wix.
- SharePoint: custodia documental/evidencia; no modifica ni gobierna Capa 1.

## Capas y responsabilidades

- Capa 1: operación Wix Apps, CMS, Velo/WebMethods, eventos y jobs.
- Capa 2: validación, conciliación, ledgers y proyecciones.
- Capa 3: preparación y entrega controlada de evidencia; nunca reescribe Capa 1.
- Frontend: presentación y orquestación. Backend: negocio, autorización, validación y acceso a datos.
- Secretos solo en almacén seguro; nunca en frontend ni repositorio.

## Invariantes

1. Un único código y contrato de dominio en todos los entornos. Fixtures y adaptadores simulados sustituyen dependencias externas, no el runtime de negocio.
2. No usar interruptores globales que bloqueen writers por entorno. La operación concreta valida configuración, identidad, permisos, esquema, importes, secuencias, hashes, idempotencia y concurrencia que le correspondan.
3. Una condición incumplida devuelve error explícito y estable; no se omite validación ni se convierte en éxito parcial silencioso.
4. Wix CMS se escribe mediante DAL, hooks y writers canónicos. Prohibido saltárselos con REST/CMS directo.
5. No se borra ningún registro, individual ni masivamente. Los crons de retención no pueden ejecutar purgas físicas.
6. Los datos operativos/comerciales editables admiten actualización validada. Los ledgers fiscales, contables, laborales y cierres contabilizados conservan evidencia inmutable; correcciones mediante nuevos registros/eventos rectificativos trazables.
7. Webhooks, jobs, writers y reintentos son idempotentes y trazables. No asumir transacciones multi-documento de Wix Data; definir recuperación.
8. No confiar en identidad, rol, precios, impuestos, totales o permisos aportados por navegador.
9. No clasificar negocio por entorno ni por etiquetas cliente-controladas. `recordTimestamp` es metadato UTC generado en backend. Los marcadores explícitos de smoke/simulación, si existen, solo identifican fixtures de prueba y nunca acreditan operaciones reales.
10. No habilitar pagos, AEAT, notificaciones ni servicios externos en pruebas; interceptarlos mediante adaptadores simulados.

## TPV y fiscalidad

- `TransaccionesTPV`: intención comercial; no acredita cobro ni movimiento físico.
- `MovimientosCaja`: ledger físico canónico.
- `ControlOperativo`: locks, idempotencia técnica y auditoría.
- `CajaActual`: proyección de sesión.
- Pago verificado, movimiento físico y registro fiscal son etapas distintas.
- `transactionId` es obligatorio en el writer fiscal manual cubierto por PR #650. No asumir obligatoriedad global hasta auditar `eventLog.js` y todos sus consumidores.
- El hash interno no se denomina hash AEAT. No conectar ni recalcular históricos sin mapping oficial y contrato de datos confirmado.

## Reservas y Capa 3

- Bookings V2 gobierna el estado nativo; `CitasF2` es proyección reconciliable por backend, con trazabilidad e idempotencia.
- Capa 3 prepara paquetes minimizados y verificables. El transporte real exige tenant, permisos y aceptación específicos.

## Evidencia

Separar pruebas estáticas, unitarias, integración simulada, Wix Preview, Wix Runtime y producción. No extrapolar PASS entre niveles. La evidencia debe identificar commit, entorno, alcance y resultado.
