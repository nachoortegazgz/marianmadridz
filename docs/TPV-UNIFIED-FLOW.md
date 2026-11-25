# TPV — criterio canónico de flujo único

**Decisión del propietario: 2026-11-25.** Este documento sustituye cualquier directriz anterior que exija separar la lógica TPV por etiquetas de entorno, por condición de datos de prueba o por nombres como Sandbox/Live.

## Decisión vinculante

El TPV tendrá **un solo flujo de código, un solo contrato de dominio y un solo conjunto de reglas de negocio** para cualquier dato que procese. El mismo backend prepara, valida, autoriza, registra, concilia y proyecta operaciones. No existirán ramas funcionales que cambien el comportamiento por detectar Preview/Published, Sandbox/Live, sintético/real, test-run o un flag equivalente.

El carácter de una operación se determina por su contenido y por su estado verificable en el dominio (por ejemplo, pago confirmado, venta autorizada, referencia fiscal válida); nunca por una etiqueta declarada por el navegador ni por una variable de entorno que seleccione otro motor.

## Consecuencias de implementación

1. Eliminar progresivamente del runtime operativo los nombres, flags, enums, IDs, prefijos, ramas, guards y contratos que codifiquen SANDBOX, LIVE, SYNTHETIC, SIMULATED, TEST_ONLY o equivalentes.
2. No mantener un runtime de pruebas paralelo ni duplicar repositorios, writers, validadores, modelos, WebMethods o controladores para pruebas.
3. No añadir marcadores de entorno o procedencia de prueba como condición para aceptar o rechazar una operación. Se permite `sourceType: TPV` como procedencia neutral del dominio cuando lo requiera el contrato canónico; nunca como selector de modo.
4. No permitir que el frontend seleccione el tipo de entorno, la fuente de datos o el nivel de autorización.
5. Mantener una única API de dominio en backend y una única ruta de persistencia. Las pruebas ejercitan esa misma ruta con fixtures y dobles de test en la suite automatizada, sin crear un segundo flujo de producción.
6. Los datos históricos creados por runtimes anteriores quedan fuera del flujo operativo nuevo. Su tratamiento será lectura/migración/retirada controlada, sin contaminar el contrato nuevo ni alterar ledgers inmutables.
7. La separación que Wix aplique internamente entre sus almacenes no se modela en el dominio TPV ni justifica bifurcaciones de código. No asumir que una función de Wix aísla colecciones de aplicaciones nativas o proveedores externos.
8. La ausencia de una etiqueta de entorno no es autorización. Permisos, validaciones, límites de operación y controles de integridad se aplican siempre en backend.

## Invariantes que permanecen

- Wix CMS continúa siendo la fuente de verdad transaccional propia.
- MovimientosCaja es el ledger físico canónico; no crear TransaccionesTPV ni un ledger alternativo.
- Los ledgers fiscales, contables, laborales y cierres conservan append-only e inmutabilidad; las correcciones se representan mediante nuevos registros trazables.
- Idempotencia durable, fingerprint de petición, secuencia, hash, locks CAS, control de concurrencia y recuperación forman parte del único flujo.
- Autorización backend en cada WebMethod; no confiar en UI, modo de vista, etiquetas de cliente ni secretos presentes.
- El contrato fiscal y los campos obligatorios de CMS deben satisfacerse íntegramente antes de persistir.
- No activar pagos externos, emisión fiscal, comunicaciones o hardware hasta disponer de sus contratos, configuración y pruebas específicas. Esto es un control de capacidad real, no un segundo flujo TPV.

## Migración segura

1. Identificar todos los imports, llamadas, bindings Wix, hooks, tests, automatizaciones y consumidores externos.
2. Implementar y probar el contrato único completo sobre tpvRepository.js y el writer canónico de MovimientosCaja.
3. Migrar el controlador de página al API único y verificar los bindings de Wix.
4. Retirar tpvTestRuntime.web.js, tpvTestRuntimeRepository.js, tpvTestRuntimeCore.js y contratos/constantes de clasificación anterior únicamente cuando no tengan consumidores y la ruta única supere las pruebas.
5. Retirar compatibilidad histórica solo después de demostrar que no quedan registros/consumidores que la necesiten. No borrar ni sobrescribir ledgers.
6. Ejecutar CI, pruebas de contrato, integración, concurrencia, idempotencia, seguridad y Wix Runtime; revisar diff y estrategia de reversión.

## Estado verificado a 2026-11-25

- La rama de trabajo existe, pero antes de esta actualización era idéntica a main.
- tpvPageController.js todavía importa tpvTestRuntime.web.js; por tanto, el flujo único no está implementado.
- tpvRepository.js contiene un guard que rechaza toda escritura operativa TPV.
- El builder de movimientos aún no completa el contrato físico obligatorio de MovimientosCaja; desbloquear el guard no sería seguro.
- internalConfig.js mantiene constantes y discriminadores históricos relacionados con la clasificación anterior.
- No se han ejecutado pruebas Wix Preview/Runtime en esta intervención ni se han cambiado datos o configuración Wix.

**Estado:** decisión arquitectónica consolidada; implementación pendiente. **Release: NO-GO** hasta completar writer, contrato fiscal, permisos, idempotencia, concurrencia, hooks y pruebas Runtime. Esta decisión sustituye las instrucciones anteriores de crear, marcar, persistir o autorizar un runtime TPV separado por entorno o por tipo de dato.
