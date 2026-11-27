# Copilot instructions — Marian Madrid

## Contexto y fuentes obligatorias

Repositorio Wix Editor Classic / Velo JavaScript. Wix CMS es la SSOT transaccional de las entidades propias; las apps nativas Wix gobiernan sus dominios. SharePoint es solo repositorio de evidencia.

Antes de cambios operativos, lee:
- `docs/INDEX.md` (mapa de fuentes vigentes).
- `docs/STATE-NOW.md` y `docs/RELEASE-READINESS.md` (estado y gates).
- `docs/PROJECT-CANON.md` (arquitectura e invariantes).
- `docs/TPV-UNIFIED-FLOW.md` y `src/backend/tpv/README.md` (TPV).
- `src/backend/README.md` (contratos backend).

Estado conocido: sitio Wix Draft; MVP NO-GO; Runtime TPV no aceptado. No habilitar ni implicar cobros reales, remisión fiscal, escrituras de inventario/contabilidad ni persistencia TPV de producción. CI offline no prueba Preview ni Runtime.

## Desarrollo y validación

- Runtime/CI Node: 24.22.1.
- Instalar dependencias con `npm ci`; desarrollo Wix con `npm run dev`.
- Comandos habituales: `npm run lint`, `npm test`, `npm run test:layer1`, `npm run test:layer2`.
- Suite individual: `node --no-warnings --loader ./src/backend/tests/loader.mjs ./src/backend/tests/<suite>.test.mjs`.
- Verificadores SDK: `npm run verify:wix-ecom-cart-v2`, `npm run verify:wix-ecom-order-transactions`, `npm run verify:wix-tpv-native-sdk`.
- Los tests nuevos se ubican en `src/backend/tests/` y se incorporan al runner/gate apropiado. No crear runners que eviten el loader canónico.
- CI incluye sincronización package/lock, auditoría de dependencias, verificadores SDK y ESLint; no sustituye pruebas Wix.

## Arquitectura

- `src/backend/*.js`: módulos compartidos, hooks CMS, eventos y jobs.
- `src/backend/*.web.js`: API Velo; cada export usa `webMethod(Permissions...)` y autorización/propiedad se comprueban en backend.
- `src/pages/`: código de página Wix; no renombrar archivos.
- `src/public/`: código browser compartido y bridges HTML; importar con alias Velo `public/<module>`.
- `src/backend/tpv/`: dominio TPV, preparación de venta, repositorios y WebMethods. Un único flujo/código; no introducir runtime paralelo.
- `tests/runtime/`: plan de aceptación Preview/Runtime; no ejecuta APIs Wix ni limpia datos automáticamente.

La lógica de negocio, permisos, validación, catálogo, importes, impuestos e idempotencia reside en backend. Frontend solo presenta y orquesta.

## Invariantes

- Wix CMS es SSOT transaccional; SharePoint no gobierna Capa 1.
- `MovimientosCaja` es ledger físico; `TransaccionesTPV` contiene intenciones comerciales pendientes/no contables.
- Los ledgers físicos, fiscales, contables, laborales y cierres append-only no se borran ni sobrescriben. Las rectificaciones son nuevos registros trazables.
- `recordTimestamp` y `recordNature` los genera/deriva backend usando el único corte UTC `MapaStaff/CONFIG_SISTEMA.productionActivationAt`. La naturaleza es metadato, no selector de runtime.
- El backend nunca confía en precio, impuesto, total, permiso o naturaleza enviados por el navegador.
- Webhooks/jobs son al menos una vez: mantener idempotencia, CAS, locks, leases y recuperación.
- No usar colecciones legacy prohibidas ni REST/CMS directo para saltarse DAL, hooks o writers.
- No modificar pagos, reservas, caja, configuración fiscal, automatizaciones, secretos reales o servicios externos durante validación sin alcance y autorización expresos.
- No actualizar el código de página para introducir pruebas temporales. Usar runners/fixtures versionados.
- Mantener errores accionables y comportamiento fail-closed; no eliminar gates para facilitar pruebas.

## Contratos técnicos que no deben perderse

- Los hooks CMS son invariantes server-side: beforeInsert valida/normaliza; beforeUpdate y beforeRemove protegen inmutabilidad y transiciones. Si la regla depende del estado persistido, leerlo antes de decidir.
- Webhooks son al menos una vez: mantener claims idempotentes, claves deterministas, comparación de fingerprint/payload y CAS/leases/recovery. Replay idéntico no duplica efectos; payload conflictivo falla.
- No intercambiar silenciosamente `resourceId` del dominio/CMS con `resource._id` del SDK o `resource.id` REST; adaptar explícitamente cada contrato.
- Importes TPV en céntimos enteros o helpers decimales canónicos; nunca usar importes del navegador como autoridad. Cantidades positivas enteras.
- Métodos de pago V1 admitidos: `EFECTIVO` y `TARJETA`; Bizum, split tender, bonos y tarjetas regalo siguen bloqueados.
- Una intención sintética `TransaccionesTPV` solo puede corregirse/eliminarse si cumple simultáneamente `sourceType=SYNTHETIC`, `status=PENDING_PAYMENT`, `orderId=null`, `requiresReconciliation=true` y todos los pagos siguen sin confirmar. Cualquier otro caso requiere su contrato de inmutabilidad/rectificación; nunca limpiar por lote.
- Los ledgers físicos, fiscales, contables, laborales y cierres append-only no se sobrescriben ni borran, aunque sean sintéticos.

## Documentación

Mantener solo las fuentes activas enlazadas desde `docs/INDEX.md`. Actualizar STATE-NOW/RELEASE-READINESS cuando cambie el estado; PROJECT-CANON/TPV-UNIFIED-FLOW solo cuando cambien decisiones o contratos. La evidencia histórica se archiva y no se presenta como estado actual.
