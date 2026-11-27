# Copilot instructions — Marian Madrid

## Contexto y fuentes

Repositorio Wix Editor Classic / Velo JavaScript. Wix CMS es SSOT transaccional de entidades propias; las apps nativas Wix gobiernan sus dominios. SharePoint es repositorio de evidencia.

Consultar según el cambio: `docs/INDEX.md`, `docs/STATE-NOW.md`, `docs/RELEASE-READINESS.md`, `docs/PROJECT-CANON.md`, `docs/TPV-UNIFIED-FLOW.md` y los README del módulo afectado. No es necesario releer toda la documentación para un cambio local y acotado.

Estado conocido en la última auditoría: sitio Wix Draft; MVP operativo/comercial no aceptado; Runtime TPV no acreditado. CI offline no prueba Preview ni Runtime.

## Desarrollo y validación

- Runtime/CI Node: 24.22.1.
- Instalar dependencias con `npm ci`; desarrollo Wix con `npm run dev`.
- Comandos habituales: `npm run lint`, `npm test`, `npm run test:layer1`, `npm run test:layer2`.
- Suite individual: `node --no-warnings --loader ./src/backend/tests/loader.mjs ./src/backend/tests/<suite>.test.mjs`.
- Verificadores SDK: `npm run verify:wix-ecom-cart-v2`, `npm run verify:wix-ecom-order-transactions`, `npm run verify:wix-tpv-native-sdk`.
- Los tests se ubican en `src/backend/tests/` y se incorporan al runner/gate apropiado.
- Ejecutar las pruebas proporcionales al cambio. No exigir Preview/Runtime para cambios de lógica cubiertos por unitarias/contrato; no etiquetar esas pruebas como Runtime.
- La configuración productiva ausente no debe bloquear pruebas con fixtures. Usar inyección de dependencias/adaptadores simulados en los límites de infraestructura y ejercitar las mismas funciones de dominio.
- No crear un runtime de negocio alternativo ni un bypass de seguridad para pruebas.

## Arquitectura

- `src/backend/*.js`: módulos compartidos, hooks CMS, eventos y jobs.
- `src/backend/*.web.js`: API Velo; cada export usa `webMethod(Permissions...)` y autorización/propiedad se comprueban en backend.
- `src/pages/`: código de página Wix; no renombrar archivos.
- `src/public/`: código browser compartido y bridges HTML; importar con alias Velo `public/<module>`.
- `src/backend/tpv/`: dominio TPV, preparación de venta, repositorios y WebMethods.
- `tests/runtime/`: procedimientos de Preview/Runtime; no ejecutan APIs Wix ni limpian datos automáticamente.

La lógica de negocio, permisos, validación, catálogo, importes, impuestos e idempotencia reside en backend. Frontend solo presenta y orquesta.

## Invariantes

- Wix CMS es SSOT transaccional; SharePoint no gobierna Capa 1.
- `MovimientosCaja` es ledger físico; `TransaccionesTPV` contiene intenciones comerciales pendientes/no contables.
- No se borra ningún registro, ni individual ni masivamente. Los datos operativos/comerciales editables admiten actualización validada. Los ledgers fiscales/contables contabilizados, jornada y cierres se rectifican con nuevos registros trazables.
- `recordTimestamp` lo genera backend. No se usan `recordNature`, `REAL`, `SYNTHETIC`, `SIMULATION` ni etiquetas equivalentes en runtime.
- El backend nunca confía en precio, impuesto, total, permiso o naturaleza enviados por el navegador.
- Webhooks/jobs son al menos una vez: mantener idempotencia, CAS, locks, leases y recuperación.
- No usar colecciones legacy prohibidas ni REST/CMS directo para saltarse DAL, hooks o writers.
- No invocar pagos, remesas fiscales, notificaciones ni servicios externos reales en QA.
- Los fixtures sintéticos no necesitan datos fiscales reales. La ausencia de configuración productiva se prueba como un caso de rechazo, no como bloqueo de toda la suite.
- Mantener errores accionables y fail-closed para efectos productivos; no extender ese bloqueo a tests aislados que simulan sus dependencias.

## Contratos técnicos

- Hooks CMS server-side: beforeInsert/beforeUpdate validan contratos; beforeRemove deniega todo borrado. La mutabilidad de cada registro depende de su contrato legal y de negocio.
- Webhooks son al menos una vez: mantener claims idempotentes, claves deterministas, comparación de fingerprint/payload y CAS/leases/recovery.
- No intercambiar silenciosamente `resourceId` del dominio/CMS con `resource._id` del SDK o `resource.id` REST.
- Importes TPV en céntimos enteros o helpers decimales canónicos; nunca usar importes del navegador como autoridad. Cantidades positivas enteras.
- Métodos de pago V1 admitidos: `EFECTIVO` y `TARJETA`; los demás siguen fuera del contrato hasta que exista decisión de producto.
- Las intenciones sintéticas solo se corrigen según su contrato de estado y reconciliación. Nunca limpiar por lote.
- Los registros nunca se borran. Los ledgers contabilizados se rectifican sin sobrescribir evidencia legal.

## Documentación

Mantener las fuentes activas enlazadas desde `docs/INDEX.md`. Actualizar STATE-NOW/RELEASE-READINESS cuando cambie el estado; PROJECT-CANON/TPV-UNIFIED-FLOW solo cuando cambien decisiones o contratos. No copiar gates productivos a instrucciones de pruebas unitarias.
