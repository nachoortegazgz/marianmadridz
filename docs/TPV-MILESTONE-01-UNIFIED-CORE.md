# HITO TPV-01 — Núcleo único y persistencia canónica

**Estado:** PLANIFICADO · **Prioridad:** P0 · **Release:** NO-GO hasta completar gates externos y Runtime.
**Base:** `main` con PR #611/#612 integradas y la decisión de flujo único incorporada. Esta rama consolida documentación; no modifica código operativo.

## Objetivo

Entregar un único TPV desde la interfaz hasta Wix CMS: un solo controlador, contratos de dominio, WebMethods, motor de validación y repositorio. El mismo código procesa cualquier operación. La naturaleza de cada registro se marca en backend por timestamp del servidor frente a productionActivationAt; esta marca no selecciona un runtime ni altera el flujo. Las pruebas automatizadas usan fixtures y dobles de infraestructura sobre la misma lógica; no existe un runtime de negocio alternativo.

El hito termina con código completo y probado offline, writer canónico implementado pero cerrado por los gates externos que falten, controlador conectado al flujo común y runtime heredado retirado. No implica activar cobros ni facturación en el sitio principal publicado.

## Diagnóstico verificado

1. `src/public/tpvPageController.js` importa `backend/tpv/tpvTestRuntime.web` para sesión, ventas, movimientos, devoluciones, cierres y auditoría.
2. `tpvTestRuntime.web.js`, `tpvTestRuntimeRepository.js` y `tpvTestRuntimeCore.js` forman un runtime separado. Persiste estado/eventos en `ControlOperativo` mediante `TPV_TEST_RUN` y `TPV_TEST_SESSION_LOCK`; no es un mock en memoria.
3. `tpvPermisos.web.js` expone `testRuntimeAvailable` y `testRuntimeMode`, y deriva capacidades de ese runtime.
4. `internalConfig.js` conserva `TPV_HISTORICAL_POLICY`, `TPV_LEGACY_COLLECTIONS`, discriminadores `SANDBOX_LOGICAL_*`/`SIMULATED_TPV_*` y controles `TPV_TEST_*`.
5. `validation.js`, `data.js`, `dataAccessPolicy.js`, `tpvUtils.js` y `tpvRepository.js` contienen clasificadores o compatibilidad histórica del runtime anterior.
6. `tpvRepository.assertTpvOperationalLedgerConfigured()` rechaza todas las escrituras. `insertTpvEvent()` llama a ese guard antes de persistir.
7. `_buildTpvLedgerItem()` no completa el esquema fiscal físico de `MovimientosCaja`: no genera serie/número de factura, tipo de factura, fecha de expedición, tipo impositivo ni periodo fiscal; además inicializa `taxBase` y `taxAmount` a cero, que no sustituyen el cálculo fiscal real.
8. El esquema físico de `MovimientosCaja` exige, entre otros, `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo` y `fiscalPeriod`.
9. `tpvWriteV1Contract.js` admite una tasa fiscal verificable y un solo medio de pago de `EFECTIVO` o `TARJETA`; Bizum no está admitido por el contrato V1. El importe aplicado debe cuadrar con el total recalculado por Wix.
10. `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED` sigue en `false`; la consulta CMS del 2026-11-25 no encontró el singleton `CONFIG_SISTEMA_FISCAL`. La serie, numeración y configuración fiscal no se pueden inventar desde código.
11. La lectura Wix de catálogo/inventario documentada el 2026-11-25 encontró 30 registros con cantidad rastreada en ubicación virtual online y ninguno en la ubicación física del salón. El precio final mostrado al consumidor no está validado.
12. El último Site Context read-back (2026-11-25 17:53 CET) identifica el sitio como Draft, Velo habilitado, Editor, moneda EUR y zona Europe/Madrid. No se ha acreditado sincronización Git-Wix ni ejecución de Preview/Runtime.

## Tareas obligatorias, en orden

### 1. Cerrar contratos y mapa de consumidores
- Inventariar exports/imports del runtime separado y mapear cada acción del bridge a un WebMethod operativo o a una función de dominio pendiente.
- Auditar `src/`, page code, `#htmlTPV.txt`, hooks CMS, `dataAccessPolicy`, tests, runners y automatizaciones.
- Definir DTO canónico de sesión, venta, línea, pago, movimiento manual, devolución, arqueo, cierre X/Z y auditoría.
- Mantener importes en unidades menores enteras y fiscalidad calculada en backend. El navegador no aporta precios, impuestos, totales, rol ni autorización.
- Diferenciar explícitamente venta preparada, pago confirmado y persistencia confirmada.
- Entregable: mapa de dependencias, contratos y matriz de aceptación cubierta por tests.

### 2. Unificar API y controlador
- Cambiar `tpvPageController.js` para consumir solo WebMethods operativos neutrales de caja, ventas, movimientos, devoluciones, cierres, auditoría, catálogo y permisos.
- Sustituir métodos con sufijo `Prueba`, estados de runtime de prueba y errores específicos de sesión de prueba por estados de dominio neutrales.
- Eliminar `testRuntimeAvailable` y `testRuntimeMode`; las capacidades UI son informativas, nunca permisos.
- Mantener autorización y resolución de identidad en cada WebMethod. No confiar en valores de identidad/rol del navegador.
- Mantener el contrato del bridge hasta verificar el HTML Component real; editar `#htmlTPV.txt` no demuestra que el embed de Wix esté actualizado.

### 3. Implementar writer físico canónico
- Sustituir el guard absoluto por precondiciones de dominio: configuración fiscal validada, sesión abierta, identidad, pago acreditado, cálculo fiscal completo, idempotencia y lock.
- Construir el item físico con el esquema real de `MovimientosCaja`; no usar placeholders, tasas inventadas ni ceros fiscales por defecto.
- Obtener serie, número, tipo de factura, fecha de expedición, tipo impositivo y periodo fiscal desde configuración fiscal validada y reglas aprobadas.
- Calcular base e impuesto desde el desglose fiscal Wix por línea; rechazar tasas múltiples mientras V1 no las soporte.
- Generar secuencia y hash previo bajo lock CAS, con cadena SHA-256 determinista e idempotencia durable.
- Resolver consistencia entre insert append-only y proyección `CajaActual`: el ledger es fuente de evidencia; la proyección debe ser idempotente, recuperable y reconciliable.
- No asumir transacciones multi-documento en Wix Data. Diseñar recuperación si falla una proyección después del insert.
- No crear `TransaccionesTPV`, otro ledger ni inventario paralelo. `ControlOperativo` se limita a locks/estado técnico; `CajaActual` es proyección de caja/sesión.

### 4. Unificar hooks y políticas
- Alinear `MovimientosCaja_beforeInsert`, `dataAccessPolicy.js` y validadores con el único contrato físico.
- El writer operativo de `MovimientosCaja` inserta registros append-only en todas las fases. Antes de productionActivationAt, el backend puede autorizar mantenimiento update/remove de datos de desarrollo; después del corte se rechaza cualquier mutación o borrado de registros TPV. Rectificaciones operativas/fiscales mediante nuevos registros trazables.
- Retirar excepciones de mutación o clasificación del runtime anterior después de inventariar y cerrar el tratamiento de registros existentes.
- Persistir una marca de naturaleza del registro derivada por backend: recordTimestamp UTC < productionActivationAt UTC = SYNTHETIC; recordTimestamp UTC >= productionActivationAt UTC = REAL. No aceptar la marca del cliente ni usarla para seleccionar lógica alternativa.
- Mantener fail-closed fiscal y autorización backend.

### 5. Migrar pruebas y retirar runtime duplicado
- Reescribir tests de persistencia QA, runtime core, clasificador TPV y widget para cubrir el contrato único.
- Añadir tests del builder fiscal, mapping físico CMS, importes, serie/numeración, hash y secuencia.
- Probar replay idéntico, conflicto por misma clave con payload distinto, concurrencia CAS, permisos, hooks, devoluciones, cierres X/Z y recuperación.
- Cuando no queden consumidores, retirar `tpvTestRuntime.web.js`, `tpvTestRuntimeRepository.js`, `tpvTestRuntimeCore.js`, discriminadores `TPV_TEST_*`, `TPV_LEGACY_COLLECTIONS` y compatibilidad TPV histórica.
- No eliminar helpers genéricos usados por otros dominios sin demostrar que sobran. Buscar todos los consumidores antes de borrar símbolos.

### 6. Limpieza de datos heredados
- Consultar `ControlOperativo` y `MovimientosCaja` de forma consistente para inventariar registros y locks del runtime anterior.
- Entregar IDs, tipos, cantidades y referencias antes de cualquier borrado.
- Distinguir datos técnicos de prueba de movimientos fiscales/contables reales. No tocar registros que no estén probados como datos de prueba.
- Durante desarrollo, los registros del conjunto TPV pueden modificarse/resetearse mediante mantenimiento backend autorizado y auditado; el writer operativo sigue siendo append-only para probar el comportamiento real. Antes de productionActivationAt, inventariar y exportar evidencia, verificar que todo el conjunto es sintético y ejecutar reset controlado de los datos y proyecciones de desarrollo. Tras el corte, no modificar ni borrar registros reales; mantener append-only y rectificar con nuevos registros.
- Verificar y documentar el resultado después de la limpieza.

### 7. Validación offline y Wix
- Ejecutar `npm test`, `npm run test:layer1`, `npm run test:layer2`, `npm run lint` y verificaciones SDK Wix del proyecto.
- CI completa sobre SHA exacto: cero fallos, lint y secret scan PASS.
- Ejecutar las pruebas online autorizadas por el propietario en el sitio y colecciones actuales, usando el mismo código y la misma ruta. Verificar antes el destino efectivo de cada colección (Online/Sandbox); no asumir que Preview aísla CMS o apps nativas. El reset sintético se realiza antes del inicio de actividad real.
- Probar catálogo, sesión, venta, pago manual confirmado, caja, devolución, arqueos, X/Z, auditoría, idempotencia, concurrencia, permisos, hooks y recuperación.
- Usar el mismo commit, WebMethods, sitio y colecciones actuales autorizadas por el propietario; la clasificación temporal del registro diferencia desarrollo y actividad real, no una separación por sitios ni por ramas de negocio.
- Validar el HTML Component real, Epson, cajón y lector si forman parte del alcance; los mocks no acreditan hardware.

### 8. Despliegue controlado
- Confirmar sincronización Git-Wix y SHA desplegado; comparar archivos Velo y el código real del HTML Component.
- Revisar diff, dependencias, contratos CMS, configuración fiscal, permisos y rollback.
- Mantener `LEDGER_WRITES_ENABLED=false` hasta aprobación fiscal y aceptación del flujo de cobro; no cambiarlo para forzar pruebas.
- Desplegar código tras CI y aceptación Runtime. Activar operación comercial solo con autorización y cierre de gates fiscales, pagos, inventario y precio final.
- Ejecutar smoke tests de solo lectura y comprobar logs, estado de caja y ausencia de duplicados.

## Criterios de aceptación
- [ ] Ningún código TPV clasifica operaciones por entorno, origen de prueba o estado de publicación.
- [ ] El controlador usa solo el API de dominio único y el bridge real está validado.
- [ ] Todas las operaciones comparten validación, autorización, idempotencia, locks y repositorio.
- [ ] El writer genera todos los campos obligatorios de `MovimientosCaja` sin placeholders.
- [ ] Secuencia/hash son correctos bajo concurrencia y las proyecciones son recuperables.
- [ ] Hooks y políticas rechazan payloads incompletos y toda mutación de ledgers.
- [ ] Runtime separado y compatibilidad histórica TPV retirados tras verificar consumidores y datos.
- [ ] Tests y CI PASS sobre SHA exacto; diff revisado y rollback preparado.
- [ ] Aceptación Runtime en sitio Wix independiente y sincronización Git-Wix documentadas.
- [ ] Gates legales/comerciales no resueltos siguen bloqueando escrituras y operación comercial.

## Dependencias externas

| Dependencia | Situación | Cierre acreditado por |
|---|---|---|
| Configuración fiscal/SIF | Singleton ausente en consulta CMS 2026-11-25; writers deshabilitados | Propietario + asesoría fiscal |
| Series y numeración | Campos obligatorios sin configuración legal validada | Propietario + asesoría fiscal |
| Pago presencial | Sin integración de terminal; V1 no admite pagos mixtos | Propietario + proveedor/operador de pago |
| Precio final | Configuración Wix consultada excluye impuestos del precio de catálogo; presentación final no verificada | Propietario + QA |
| Inventario físico | 0 registros asignados a ubicación física en consulta 2026-11-25 | Propietario + recuento físico |
| Hardware | Epson/cajón/lector no probados | Propietario + QA |
| Sitio/colecciones de pruebas online | Sitio Draft según Site Context 2026-11-25 17:53 CET; propietario declara colecciones Online; destino efectivo de Preview/Runtime pendiente de verificación | Administrador Wix + QA |

## Decisión

El hito debe entregar el núcleo único y el writer completo, pero no habilitar automáticamente cobros ni facturación. Si falta un dato fiscal o dependencia externa, el backend conserva el rechazo explícito. No se rebaja el contrato para declarar el hito terminado.

**Hito posterior:** aceptación E2E en el sitio Wix independiente y cierre de gates comerciales/fiscales para una activación gradual.
