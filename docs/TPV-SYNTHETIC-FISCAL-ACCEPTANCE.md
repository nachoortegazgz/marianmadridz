# TPV — aceptación fiscal sintética sobre CMS actual

**Estado:** contrato de aceptación documental; pruebas online de desarrollo autorizadas por el propietario, pendientes de completar el writer único y verificar el destino efectivo de las colecciones.  
**Sitio:** Marian Madrid Peluquería y Estética, estado Draft, Velo habilitado.  
**Regla de ejecución:** un único código, contrato, validaciones, writer, colecciones y flujo antes y después del corte de actividad real. recordTimestamp UTC < productionActivationAt UTC = SYNTHETIC; recordTimestamp UTC >= productionActivationAt UTC = REAL. recordNature es marca persistida derivada en backend, no selecciona un runtime ni altera el comportamiento.

## 1. Límites de seguridad

- Los datos generados antes del hito oficial de puesta en producción son sintéticos por su instante de registro, aunque reproduzcan exactamente el formato y contenido estructural de operaciones reales. Para pruebas fiables deben usar los mismos contratos, campos, cálculos, validaciones y secuencias que se usarán en producción; únicamente incorporan el marcador de clasificación y el instante de registro verificable.
- No llamar a AEAT, VeriFactu, Wix Payments, terminales físicos ni endpoints de reembolso.
- En la fase actual (Site Context Draft; sin actividad económica real declarada), se permite crear, actualizar y borrar registros sintéticos de desarrollo para probar los flujos completos. El propietario declara las colecciones Online y autoriza las pruebas online en el sitio/colecciones actuales. Verificar el destino efectivo antes de la primera escritura. La autorización no se extiende a registros reales tras el corte.
- Antes del despliegue y de iniciar actividad real se ejecutará un reset controlado de los datos de desarrollo, con inventario, backup/exportación de evidencia, criterios de selección y verificación posterior. No se limpiarán registros reales ni se hará un reset indiscriminado.
- Las nuevas entradas de ledger, cuando se autoricen, serán append-only y se insertarán mediante el writer del backend, no mediante escrituras manuales desde la herramienta.
- La proyección de caja es mutable por diseño. En desarrollo puede actualizarse el registro `CajaActual` existente para probar apertura, ventas, movimientos y cierres, siempre que se confirme que pertenece al conjunto de datos de desarrollo y que el sitio continúa sin actividad real. El estado previo debe quedar documentado para poder repetir y verificar las pruebas.
- Prohibido mantener código distinto para desarrollo y producción. El mismo código, contratos, validaciones, writer, secuenciación, hashing, permisos y flujo CMS deben ejecutarse en ambos momentos. No introducir flags de entorno que cambien reglas de negocio o salten validaciones.
- La naturaleza sintética/real es una marca persistida de trazabilidad, no una ruta de ejecución. Un registro generado antes de productionActivationAt se clasifica como SYNTHETIC aunque tenga exactamente el mismo formato, campos, cálculos, secuencias y estructura que un registro real. Desde el corte, los nuevos registros se clasifican como REAL.
- La clasificación debe basarse en recordTimestamp generado por servidor y no manipulable desde navegador, comparado con productionActivationAt UTC único, documentado y verificable. La fecha de operación comercial puede ser anterior o distinta y no debe sustituir silenciosamente al instante técnico de registro. Conservar ambos conceptos separados.
- Persistir recordNature como marcador diferenciador en el campo/metadato canónico que resulte de la auditoría CMS; se pueden reutilizar recordSource/sourceType o el sobre de trazabilidad solo si el contrato lo confirma. No duplicar campos ni alterar el formato funcional/fiscal. Los valores canónicos y el campo exacto deben verificarse en enums, validation.js y el esquema antes de usarlos. No inventar un segundo esquema.
- productionActivationAt debe registrarse una sola vez como instante UTC, con presentación Europe/Madrid y precisión suficiente. No equivale al estado técnico Published/Draft de Wix. No inferirlo del estado Draft/Published solamente ni usar una fecha editable por el cliente. El procedimiento de despliegue debe fijar y auditar ese instante.
- Si el mismo código se ejecuta después del hito con registros históricos de desarrollo, la clasificación histórica no cambia: el criterio es el instante inmutable en que cada registro fue generado/registrado. El reset previo a actividad real sigue siendo obligatorio como limpieza operativa, pero no es el mecanismo que determina la naturaleza de cada registro.

## 2. Inventario CMS del sitio verificado el 25-11-2026

Consulta read-only de las colecciones CMS del sitio. El usuario declara que las colecciones están configuradas como Online. La API de colecciones devuelve collectionType=NATIVE. Además, Site Data Usage confirma que los registros actuales están en LIVE y que SANDBOX devuelve 0 elementos para las cuatro colecciones: MovimientosCaja LIVE=5/SANDBOX=0; CajaActual 1/0; ControlOperativo 71/0; HistoricoCierresZ 1/0. El sitio suma 227 elementos LIVE y 0 SANDBOX en la lectura realizada. La API de uso no expone el selector de activación Sandbox/Online por colección; el usuario declara que están configuradas como Online. Por tanto, la presencia de los datos en LIVE está verificada, pero el ajuste visual exacto del selector queda pendiente. El Site Context read-back directo de 2026-11-25 17:53 CET identifica el sitio como Draft. El propietario declara que no existe actividad real y que los registros actuales son datos de desarrollo que se resetearán antes de iniciar actividad real.

Según la documentación oficial de Wix, Preview utiliza Sandbox cuando esa base está habilitada; si no lo está, las colecciones nativas pueden operar sobre Live. Las colecciones de Wix Apps solo tienen versión Live, y los cambios en ellas desde Preview afectan al sitio publicado. Las pruebas online pueden ejecutarse en el sitio Draft usando las colecciones Online actuales, conforme a la instrucción del usuario. Antes de cada batería se confirmará el destino efectivo de las operaciones para evitar afectar una futura instancia publicada; el estado Draft no debe confundirse con un entorno Sandbox aislado.

| Colección | Tipo Wix | Registros observados | Estado relevante |
|---|---|---:|---|
| MovimientosCaja | NATIVE | 5 | Cinco filas antiguas; ninguna tiene hash, hash anterior ni secuencia |
| CajaActual | NATIVE | 1 | SINGLE_ITEM_ID, estado ABIERTA, snapshot MOVIMIENTOS_CAJA_RECONCILIADOS |
| ControlOperativo | NATIVE | 71 | Contiene locks y eventos operativos preexistentes |
| HistoricoCierresZ | NATIVE | 1 | Cierre anterior marcado SIMULATED |

Los permisos devueltos para las cuatro colecciones son PRIVILEGED en lectura, inserción, actualización y eliminación. Esto no autoriza al frontend a escribir; la autorización seguirá en backend.

El usuario declara que todos los registros TPV actuales y los que se generen en esta fase son datos sintéticos de prueba. Esa declaración se conserva como contexto de ejecución; no convierte automáticamente cada fila de ControlOperativo en un registro TPV ni acredita el origen de cada fila individual. Los registros existentes pueden modificarse durante esta fase de desarrollo conforme a la instrucción del usuario. La clasificación de cada registro debe seguir basándose en su origen y contenido verificable; no se debe reclasificar como sintético un registro sin evidencia.

En MovimientosCaja se encontraron tres filas con origen TPV_QA_DEVELOPMENT (dos ventas y una devolución) y otras dos filas antiguas con trazas TPV-SIM y TPV-FUNC. No se han tocado. Ninguna puede usarse como ancla de hash ni como factura original.

En MapaStaff hay cinco filas. Tres filas de tipo STAFF contienen resourceId, staffMemberId y memberId; los tres resourceId coinciden con IDs existentes en Bookings/Staff. Las otras dos filas no son asignaciones de personal. El writer debe resolver el ID desde el mapeo autorizado, no aceptar un ID libre del navegador.

No se encontró una colección CMS llamada ConfiguracionFiscal ni otra colección de configuración fiscal en el inventario de 40 colecciones. ConfiguracionFiscal figura además en FORBIDDEN_COLLECTIONS; no debe crearse ni utilizarse. En MapaStaff existe una identidad de empresa verificada, pero no está marcada como identidad emisora primaria. No se puede asumir que sea el emisor fiscal sin confirmar su función.

## 3. Contrato físico de MovimientosCaja

Campos obligatorios confirmados por el esquema Wix:

- Identidad y trazabilidad: hash, sequenceNumber, transactionId, previousRecordHash, recordTimestamp, schemaVersion, traceId.
- Clasificación: movementType, channelType, operationDescription, paymentMethod, staffResourceId.
- Importes: amount, totalAmount.
- Facturación: numSerieFactura, tipoFactura, fechaExpedicionFactura, tipoImpositivo, fiscalPeriod.

Campos fiscales existentes, opcionales en CMS pero que deben completarse cuando el evento sea fiscal:

- Emisor/destinatario: NIFEmisor, issuerLegalName, NIFDestinatario, recipientLegalName, recipientAddress.
- IVA: taxBase, taxAmount, baseImponibleOImporteNoSujeto, payloadFiscal, payloadAEAT.
- Operación: fechaOperacion, claveRegimen, calificacionOperacion, operacionExenta, inversionSujetoPasivo, surchargeRate, surchargeAmount.
- Rectificación: tipoRectificativa, previousInvoiceId, previousInvoiceNumber, previousInvoiceIssueDate, correctionReason, correctionAmount, refundId.
- Envío y evidencia técnica: estadoEnvioAEAT, payloadAEAT, csvAEAT, fechaEnvioAEAT, verificationQR, digitalSignature, hashAlgorithm, signatureAlgorithm, sistemaInformatico.
- Numeración y relación documental: issuerInvoiceNumber, documentType, previousInvoiceId, previousInvoiceNumber, previousInvoiceIssueDate, refundId.
- Fiscalidad especial (solo si aplica y está configurada): claveRegimen, calificacionOperacion, operacionExenta, inversionSujetoPasivo, article20Exempt, cashBasisRegime, nonSubjectReason, IRPFWithholdingRate, IRPFWithholdingAmount, surchargeRate, surchargeAmount, withholdingBase, vatAccrualStatus.
- No existe un campo independiente llamado respuestaAEAT en el esquema leído. La respuesta simulada debe quedar dentro de payloadAEAT con un marcador explícito de simulación/no envío; estadoEnvioAEAT debe seguir indicando NO_ENVIADO_TEST, sin CSV, fecha de envío, QR ni firma.

No añadir campos ni colecciones hasta comprobar que el contrato existente no puede representar el dato necesario.

## 4. Modelo de datos sintéticos

Los fixtures deben usar datos manifiestamente ficticios, por ejemplo:

- Emisor: EMISOR SINTÉTICO TPV.
- Identificador fiscal: TEST-NIF-NO-VALIDO (no apto para facturar ni enviar).
- Series exclusivas de prueba: SIM-F1-2026, SIM-F2-2026, SIM-R5-2026 y SIM-INT-2026.
- Estado de envío candidato: NO_ENVIADO_TEST; sin CSV, sin fecha de envío y sin llamada externa. Debe validarse contra las reglas actuales de validation.js antes de persistirlo.
- Naturaleza/origen: se determina por el instante de registro frente al hito oficial de producción y se refleja mediante el marcador diferenciador disponible en metadatos (recordSource/sourceType o sobre de trazabilidad). TPV_SYNTHETIC_TEST es solo un valor candidato: antes de persistirlo hay que comprobar enums, hooks y dataAccessPolicy; no se ha declarado todavía como valor canónico. El marcador no debe cambiar el esquema fiscal funcional ni alterar los cálculos.
- La serie interna SIM-INT-2026 es para eventos no facturables (movimientos de efectivo y controles). NO_FISCAL sería un valor interno, no una clave AEAT, y nunca debe transmitirse como tipo de factura; tanto el valor como su tratamiento requieren validación contra los enums y hooks actuales.

Los importes se expresan en céntimos enteros durante el cálculo y se serializan a euros solo al persistir. Base, cuota, tipo y total deben reconciliarse: base + cuota + recargos - descuentos = total, con reglas de redondeo documentadas y coherentes con el cálculo fiscal del catálogo Wix. No usar ceros como sustituto de una configuración desconocida.

## 5. Matriz de escenarios

1. Venta simplificada sin identificación del destinatario: tipo de factura F2; una tasa fiscal verificable; una forma de pago admitida; importe total reconciliado.
2. Venta completa con destinatario identificado: tipo F1; datos del destinatario y dirección según proceda.
3. Venta con producto y servicio: recalcular precios e impuestos desde catálogo Wix; rechazar combinaciones fiscales no soportadas por el contrato V1.
4. Devolución de una factura simplificada: generar el evento rectificativo vinculado al original y evaluar tipo R5; no tratar una salida de caja como rectificación fiscal automática.
5. Devolución de factura completa: tipo R1/R2/R3/R4 según causa legal; incluir tipo de rectificación, factura original y motivo. El tipo no se deduce solo del botón “devolver”.
6. Entrada/salida de efectivo: evento interno no facturable, serie interna, sin cuota ni envío fiscal; no asignar una clave AEAT ficticia.
7. Ticket X: control agregado de sesión, sin convertirlo en factura.
8. Ticket Z: cierre con conciliación de movimientos, numeración, totales por forma de pago, impuestos y extremos de hash.
9. Idempotencia: repetir una misma petición devuelve el mismo registro; reutilizar la clave con otro payload produce conflicto.
10. Concurrencia: dos escrituras simultáneas no pueden reservar la misma secuencia ni el mismo número de serie.

## 6. Fechas, numeración y encadenamiento

- recordTimestamp: instante UTC generado por backend al aceptar la operación; Europe/Madrid es solo formato de presentación.
- fechaExpedicionFactura: fecha de expedición, no sustituirla automáticamente por la fecha de operación.
- fechaOperacion: fecha real de prestación/entrega cuando difiera de expedición.
- fiscalPeriod: periodo derivado de la fecha de devengo/operación conforme a la política fiscal aplicable, no de la fecha de inserción.
- numSerieFactura: serie y número únicos por tipo de documento; las rectificativas deben conservar la relación con la factura original.
- sequenceNumber: secuencia del ledger; no es el número de factura.
- transactionId: identificador estable derivado de la clave idempotente y el tipo de evento.
- previousRecordHash: hash del último registro válido de la cadena; el primer registro de una nueva cadena sintética necesita un ancla genesis explícita y documentada. Las cinco filas preexistentes no pueden ser el antecedente porque carecen de hash y secuencia.
- hash: cubrir el contenido canónico completo del registro fiscal, las fechas, la secuencia, la huella anterior y la identificación del sistema. El SHA-256 interno actual sobre stableSerialize no acredita por sí solo conformidad VeriFactu; debe contrastarse con el algoritmo y serialización oficial de la Orden HAC/1177/2024 antes de cualquier uso real.

## 7. Preparación y gates de ejecución online

La existencia de registros previos no bloquea por sí sola las pruebas de desarrollo: el usuario autoriza su modificación durante esta fase. Antes de ejecutar una batería de escritura, confirmar el Site Context, que no hay actividad económica real y que los registros objetivo pertenecen al conjunto de desarrollo. El estado Draft/Published no determina la clasificación temporal. Registrar el estado inicial y el resultado esperado para poder verificar cada flujo.

1. `CajaActual` tiene una única proyección preexistente en estado ABIERTA y el repositorio la consulta por `singletonKey`. En desarrollo se puede actualizar para validar el ciclo completo; incluir lectura previa, mutación controlada y read-back de apertura/venta/cierre.
2. El repositorio TPV llama a assertTpvOperationalLedgerConfigured(), que falla cerrado; FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED está en false.
3. registrarVenta valida catálogo e impuestos, pero devuelve TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED; no persiste.
4. registrarDevolucion valida ahora el DTO y devuelve TPV_REFUND_PROVIDER_NOT_CONFIGURED; no persiste ni llama a un proveedor.
5. La preparación de venta mantiene bloqueos por configuración fiscal, verificación de pago y presentación del precio final con impuestos incluidos.
6. La identidad emisora no está designada inequívocamente; no se debe copiar el NIF de una fila TERCERO sin confirmar su función.
7. La política de serie, tipos documentales, IVA y redondeo debe ser aprobada y fijada en backend.

8. El runtime heredado tpvTestRuntime.web.js y sus módulos de repositorio/core siguen presentes. En main, el controlador aún importa el runtime heredado; la migración del bridge al API operativo único está pendiente de integrar y validar. validation.js todavía consume funciones del core para validar payloads históricos y varias suites los cubren. No se eliminan en esta intervención: primero hay que separar la validación de compatibilidad histórica del runtime de escritura y demostrar que no quedan consumidores activos.

No hace falta crear una proyección paralela ni evitar `SINGLE_ITEM_ID` por el mero hecho de existir. Debe probarse el flujo operativo real de la proyección existente. La inmutabilidad append-only sigue siendo obligatoria para los registros que constituyan el ledger fiscal/contable; no debe confundirse con las proyecciones operativas mutables como `CajaActual`.

### Gate de transición a producción

Antes de fijar productionActivationAt e iniciar actividad real: detener escritores y automatizaciones TPV; exportar evidencia y snapshot del estado de desarrollo; identificar registros/colecciones y dependencias; fijar y registrar el instante oficial de corte; ejecutar el reset aprobado únicamente sobre datos de desarrollo; verificar que los ledgers/proyecciones quedan en estado inicial coherente; inicializar series/secuencias/anchors de producción conforme al contrato fiscal; ejecutar pruebas de humo controladas; y documentar el resultado. No ejecutar un borrado global basado únicamente en nombres o etiquetas de QA. El reset limpia datos, pero no cambia el código ni redefine retrospectivamente la clasificación temporal de los registros.

## 8. Validación y criterios de aceptación

- Unit tests: normalización DTO, cálculo fiscal en céntimos, tipos de factura, rectificaciones, numeración, hash, genesis, idempotencia.
- Integration tests: mismo repositorio y WebMethods que el TPV; mocks únicamente para probar fallos, no un runtime alternativo.
- Online tests: en el sitio y colecciones actuales (el propietario declara Online), usando exactamente el mismo código, writer y flujo operativo que quedará desplegado. Confirmar destino efectivo de cada colección antes de la primera escritura. Se permiten altas, actualizaciones y borrados de datos de desarrollo cuando el escenario lo requiera; deben quedar acotados y verificados.
- No se aceptan mocks o runtimes alternativos como sustituto de la ruta principal para la aceptación end-to-end. Los mocks pueden probar fallos unitarios aislados, pero la prueba online debe atravesar frontend, WebMethods, validaciones, writer y CMS reales.
- La aceptación debe comprobar que recordTimestamp anterior a productionActivationAt genera recordNature=SYNTHETIC, y que desde el corte genera recordNature=REAL sin cambiar una sola línea del código de negocio.
- Las pruebas de ledger fiscal deben conservar la semántica append-only dentro de cada ejecución: para corregir un evento fiscal simulado, crear su rectificación/compensación en vez de sobrescribir el propio evento. El reset global de datos de desarrollo es una operación de transición preproducción, no una corrección de un ledger fiscal activo.
- Confirmar el reset preproducción y su read-back antes de habilitar actividad real.
- Verificar después de cada inserción el read-back por transactionId, el hash, la secuencia y la relación con el anterior.
- Cierre: recalcular desde movimientos, no desde valores enviados por el frontend.
- AEAT/VeriFactu: cero llamadas externas; estado NO_ENVIADO_TEST.
- Pagos: cero capturas, cobros o reembolsos reales.

## 9. Referencias normativas oficiales

- RD 1007/2023, artículos 8, 9 y 12: integridad, inalterabilidad, trazabilidad, encadenamiento y huella: https://www.boe.es/eli/es/rd/2023/12/05/1007
- Orden HAC/1177/2024: especificaciones técnicas y funcionales de los registros de facturación: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
- AEAT, FAQ de procedimientos de facturación (actualizada 21-10-2026): tipos F1/F2/F3 y R1-R5, y reglas de rectificación: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/procedimientos-facturacion.html?faqId=bdbd20022fe06910VgnVCM100000dc381e0aRCRD

- Wix, comportamiento de colecciones en Preview y diferencias LIVE/SANDBOX: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/testing-monitoring/testing-troubleshooting/about-testing-your-code-in-preview-mode
- Wix, Site Data Usage API y métricas separadas LIVE/SANDBOX: https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/get-site-data-usage
