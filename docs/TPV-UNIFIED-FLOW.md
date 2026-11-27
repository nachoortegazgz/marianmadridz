## GOBIERNO DEL PROYECTO — RESET DE DIRECTRICES HUMANAS (2026-11-27)

**Prevalecen los objetivos funcionales y de negocio del proyecto.** Las decisiones, restricciones, procedimientos, convenciones y documentos redactados anteriormente por personas son material editable, no una autoridad autónoma ni un motivo suficiente para bloquear desarrollo, pruebas o correcciones. Este apartado sustituye cualquier directriz anterior incompatible.

Reglas de trabajo:
- Resolver cada bloqueo según el objetivo que impide alcanzar; retirar la restricción mínima necesaria y documentar el cambio, sin perpetuar bloqueos por decisiones históricas.
- No existe un objetivo independiente de conservar datos de prueba, históricos sintéticos, estructuras, colecciones, documentos o código heredado. Pueden corregirse, migrarse, resetearse o eliminarse cuando sea necesario para cumplir los objetivos y las pruebas, después de comprobar el impacto técnico.
- Los datos sintéticos creados para QA son reutilizables y mutables. Deben poder crearse, actualizarse y eliminarse de forma controlada para repetir escenarios; no se exige conservarlos como evidencia permanente.
- No se impondrá append-only, prohibición de borrado, congelación de datos ni política de retención por una directriz humana aislada. Se aplicarán únicamente cuando una obligación legal vigente, un contrato externo real o una propiedad técnica necesaria para el objetivo lo exija y exista evidencia concreta.
- No se bloquearán pruebas funcionales por la ausencia de una configuración de producción si la prueba puede ejecutarse con fixtures, simuladores o datos sintéticos en la misma ruta de negocio.
- Las pasarelas, terminales, notificaciones, remisiones fiscales y demás efectos externos se simularán en QA. Ninguna prueba debe generar cobros, comunicaciones a clientes o declaraciones reales por accidente.
- Los requisitos legales vigentes y los contratos técnicos de Wix/proveedores son restricciones objetivas del sistema, no directrices humanas arbitrarias. Deben verificarse y aplicarse al flujo real correspondiente, sin extenderlos a pruebas sintéticas cuando no proceda.
- Una restricción temporal debe tener alcance, condición de salida y fecha/criterio de retirada. No se aceptan bloqueos indefinidos del tipo “pendiente humano” si existe una alternativa técnica segura que permita avanzar.
- La evidencia de pruebas es reproducible y regenerable. El estado de validación debe distinguir pruebas unitarias, integración, Wix Preview/Runtime y producción; no se exige preservar registros operativos para declarar una prueba superada.

**Criterio de decisión:** objetivo del proyecto → requisito legal/contrato oficial verificable → comportamiento técnico demostrado → solución mínima. La documentación humana previa, los estados heredados y las decisiones históricas se revisan a la luz de este criterio y pueden ser sustituidos.

---

# TPV — flujo único y clasificación temporal de registros

**Decisión vinculante del propietario: 2026-11-25.** Este documento sustituye directrices anteriores incompatibles sobre runtimes separados, datos sintéticos y mutabilidad durante desarrollo.

## 1. Código y flujo únicos

El TPV utiliza **un único código, un único contrato de dominio, las mismas validaciones y una única ruta de persistencia** en desarrollo y tras la activación de actividad real. No se mantienen versiones funcionales distintas ni motores alternativos por Preview/Published, Sandbox/Online, sintético/real o test-run.

Los registros de prueba deben tener el mismo formato físico y contractual que los registros reales: mismos campos, tipos, cálculos monetarios y fiscales, numeración de prueba, secuencia, hash, idempotencia, locks, hooks y proyecciones. La marca de naturaleza del registro es metadato trazable; no selecciona otro motor ni modifica las reglas de negocio.

El frontend no elige la naturaleza del registro, la fecha de registro, el origen de datos ni las autorizaciones. El backend genera el instante de registro y determina la clasificación.

## 2. Clasificación temporal obligatoria

La naturaleza de cada registro se determina comparando su instante de registro del servidor con el instante oficial de activación de actividad real:

- recordTimestamp < productionActivationAt → SYNTHETIC.
- recordTimestamp >= productionActivationAt → REAL.

Ambos instantes se almacenan/comparan en UTC. La interfaz puede presentar la hora en Europe/Madrid. No se usa la fecha del navegador, la fecha de operación, la fecha de expedición de factura ni el periodo fiscal para clasificar el registro.

### Contrato de datos

- recordTimestamp: instante UTC generado exclusivamente por backend al aceptar la operación.
- productionActivationAt: instante UTC único, persistido en configuración canónica controlada por backend y fijado en el procedimiento formal de activación. Mientras no exista (null), el sistema permanece sin corte de actividad real y los registros válidos se clasifican como SYNTHETIC; no se autoriza actividad real. No equivale al estado técnico Published/Draft de Wix.
- recordNature: marca persistida e inmutable SYNTHETIC o REAL, derivada en backend de la comparación anterior. No se acepta desde el cliente.
- Si recordTimestamp falta/no es válido, o la configuración de corte es inconsistente, el backend rechaza la persistencia y no inventa una clasificación. La marca y el timestamp se conservan en cada registro; no se reclasifican históricos al cambiar la configuración.
- El campo físico definitivo para la marca y la ubicación canónica del corte quedan pendientes de auditoría del esquema CMS y de internalConfig.js. No crear una colección ni un campo duplicado antes de comprobar los existentes.

La clasificación es metadato de trazabilidad. No habilita ni deshabilita por sí sola la ruta de venta, el cálculo, la validación, el writer o los permisos. Los efectos externos (cobro real, terminal, emisión/remisión fiscal, AEAT, automatizaciones) requieren sus propias confirmaciones y gates permanentes. Un registro sintético nunca se remite a AEAT ni se usa para liquidar un pago real.

## 3. Desarrollo online y datos de prueba

Durante la fase de desarrollo, los registros actuales y los nuevos registros anteriores al corte oficial son sintéticos, incluso si reproducen exactamente una operación real. Antes del corte, el backend puede autorizar a un administrador a modificar o eliminar registros del conjunto de desarrollo para preparar, repetir y validar escenarios completos; cada intervención debe quedar auditada y acotada al ámbito TPV. No se permite esta mutación desde el frontend ni se altera el timestamp original de creación. El writer operativo sigue registrando cada operación mediante inserciones trazables para que las pruebas de append-only sean válidas.

Las pruebas online deben usar el sitio, las colecciones y la ruta operativa existentes, sin crear un TPV paralelo ni una colección alternativa. El aislamiento de Wix Sandbox/Online es una propiedad de configuración de Wix, no una bifurcación del código; antes de escribir desde Preview debe comprobarse el destino efectivo de cada colección.

Los casos de prueba deben cubrir apertura/cierre de caja, ventas, movimientos, devoluciones, arqueos, numeración, importes, hash, encadenamiento, idempotencia, concurrencia, permisos, hooks, recuperación y proyecciones. Los datos de prueba deben tener contenido sintético identificable y una marca persistida diferenciadora, manteniendo el mismo esquema que los registros reales.

## 4. Corte y limpieza antes de actividad real

Antes de declarar actividad real se ejecutará un procedimiento de transición controlado:

1. Congelar escrituras de desarrollo y registrar el instante previsto de activación.
2. Inventariar los registros del ámbito TPV, sus relaciones, secuencias, hashes, locks y proyecciones.
3. Verificar que todos los registros que se van a limpiar son SYNTHETIC y anteriores al corte; preservar una exportación de evidencia y el resultado de pruebas.
4. Resetear los datos sintéticos de desarrollo en las colecciones existentes y reconstruir las proyecciones/contadores necesarios, sin conservar secuencias o hashes de prueba como antecedentes de registros reales.
5. Verificar colecciones vacías o en estado inicial aprobado, configuración fiscal real, series/numeración, permisos, pagos, conciliación y aceptación Runtime.
6. Fijar de forma única productionActivationAt, iniciar la actividad real y verificar que los siguientes registros se clasifican como REAL.

La limpieza preproducción es una operación administrativa excepcional sobre todos los registros del ámbito de desarrollo previamente verificados como sintéticos; no se limita a una etiqueta ni afecta a datos ajenos al TPV. Una vez fijado productionActivationAt y declarada actividad real, queda prohibido modificar o eliminar cualquier registro TPV, incluidos posibles registros sintéticos residuales. Los ledgers reales son append-only e inmutables; las correcciones se realizan mediante nuevos registros rectificativos trazables.

## 5. Invariantes del flujo único

- Wix CMS es la fuente de verdad transaccional; `MovimientosCaja` es el ledger físico canónico. `TransaccionesTPV` es una proyección/intención comercial pendiente de pago, no un ledger fiscal ni físico; solo los registros sintéticos no pagados pueden modificarse/eliminarse durante QA.
- Los registros de prueba y reales comparten el mismo esquema y el mismo writer.
- La clasificación temporal se genera y valida en backend; no se confía en valores enviados por el navegador.
- Idempotencia durable con fingerprint; replay idéntico devuelve el resultado previo y payload distinto con la misma clave es conflicto.
- Secuencia, hash, previous hash, locks CAS, concurrencia y recuperación se ejecutan en la misma ruta.
- Autorización backend en cada WebMethod; el frontend solo presenta y orquesta.
- El contrato fiscal físico se satisface íntegramente antes de persistir; no usar placeholders ni tasas inventadas.
- Antes del corte, las mutaciones administrativas de datos de desarrollo se autorizan exclusivamente en backend y quedan auditadas; después del corte, update/remove de cualquier registro TPV se rechaza. El writer de operaciones sigue siendo append-only en todas las fases.
- SharePoint es repositorio de evidencia, nunca autoridad transaccional.
- No activar pagos, hardware, comunicaciones externas o remisión fiscal por el mero hecho de que el registro sea REAL.

## 6. Migración de implementación

1. Inventariar todos los imports, llamadas, bindings Wix, hooks, tests, automatizaciones y consumidores externos.
2. Implementar y probar el contrato único completo sobre tpvRepository.js y el writer canónico de MovimientosCaja.
3. Conectar el controlador al API único y verificar el HTML Component real y sus orígenes.
4. Implementar la clasificación temporal y persistencia de recordNature una vez auditados los campos CMS y la ubicación de productionActivationAt.
5. Retirar tpvTestRuntime.web.js, tpvTestRuntimeRepository.js, tpvTestRuntimeCore.js y clasificadores históricos solo cuando no tengan consumidores y la ruta única supere pruebas.
6. Ejecutar CI, pruebas de contrato, integración, concurrencia, idempotencia, seguridad y aceptación Wix Runtime con el mismo código y las colecciones existentes.
7. Preparar y ensayar el reset de datos sintéticos antes de producción; revisar diff y estrategia de reversión.

## 7. Estado verificado — 2026-11-25

- El Site Context read-back actual identifica el sitio Marian Madrid como Draft, Velo habilitado, Wix Editor, EUR y zona Europe/Madrid; Wix Stores Catalog V3, Bookings, Payments e Invoices V1 están instalados.
- El estado Published que aparece en documentación/PR anteriores queda supersedido por este read-back más reciente. El estado técnico Published/Draft no determina productionActivationAt.
- El usuario declara que las colecciones actuales están configuradas Online y que los registros actuales son de desarrollo/sintéticos. La lectura técnica anterior encontró datos en LIVE y cero en SANDBOX; no se ha podido verificar por API el selector Online/Sandbox individual de cada colección.
- El propietario autoriza pruebas online completas sobre el sitio y colecciones actuales durante desarrollo, con reseteo controlado de los registros sintéticos antes del inicio de actividad real.
- El runtime heredado sigue presente en main; el controlador y el writer único no están completamente migrados.
- El writer fiscal permanece cerrado; no se ha ejecutado aceptación Wix Preview/Runtime en esta intervención. No se han realizado escrituras CMS ni efectos externos.

**Estado:** decisión de código único y clasificación temporal consolidada; implementación y aceptación online pendientes. **Release comercial: NO-GO** hasta completar los gates fiscales, pagos, inventario, precio final, writer, pruebas y transición preproducción.
