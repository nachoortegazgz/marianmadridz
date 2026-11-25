# TPV — aceptación fiscal sintética sobre CMS actual

**Estado:** diseño verificado; escrituras online bloqueadas hasta resolver la proyección de caja existente.  
**Sitio:** Marian Madrid Peluquería y Estética, estado Draft, Velo habilitado.  
**Regla de ejecución:** todas las pruebas usan el mismo controlador, WebMethods, repositorio y colecciones CMS. No se crea otra colección, runtime de pruebas ni persistencia paralela.

## 1. Límites de seguridad

- Los datos de prueba deben ser inequívocamente sintéticos y no representar operaciones comerciales reales.
- No llamar a AEAT, VeriFactu, Wix Payments, terminales físicos ni endpoints de reembolso.
- No modificar, sobrescribir ni borrar ninguno de los registros que ya existen.
- Las nuevas entradas de ledger, cuando se autoricen, serán append-only y se insertarán mediante el writer del backend, no mediante escrituras manuales desde la herramienta.
- La proyección de caja es mutable por diseño, pero no se puede actualizar el registro existente de CajaActual bajo la instrucción actual. No se inicia una prueba que pueda tocarlo.
- El modo de prueba no debe convertirse en un segundo runtime: la naturaleza sintética es metadato de los datos, no una rama de lógica ni un selector de entorno.

## 2. Inventario CMS del sitio verificado el 25-11-2026

Consulta read-only de las colecciones CMS del sitio. El usuario declara que las colecciones están configuradas como Online. La API de colecciones devuelve collectionType=NATIVE. Además, Site Data Usage confirma que los registros actuales están en LIVE y que SANDBOX devuelve 0 elementos para las cuatro colecciones: MovimientosCaja LIVE=5/SANDBOX=0; CajaActual 1/0; ControlOperativo 71/0; HistoricoCierresZ 1/0. El sitio suma 227 elementos LIVE y 0 SANDBOX en la lectura realizada. La API de uso no expone el selector de activación Sandbox/Online por colección; el usuario declara que están configuradas como Online. Por tanto, la presencia de los datos en LIVE está verificada, pero el ajuste visual exacto del selector queda pendiente.

Según la documentación oficial de Wix, Preview utiliza Sandbox cuando esa base está habilitada; si no lo está, las colecciones nativas pueden operar sobre Live. Las colecciones de Wix Apps solo tienen versión Live, y los cambios en ellas desde Preview afectan al sitio publicado. No se harán escrituras de prueba desde Preview hasta confirmar la configuración de cada colección y el destino efectivo de la operación.

| Colección | Tipo Wix | Registros observados | Estado relevante |
|---|---|---:|---|
| MovimientosCaja | NATIVE | 5 | Cinco filas antiguas; ninguna tiene hash, hash anterior ni secuencia |
| CajaActual | NATIVE | 1 | SINGLE_ITEM_ID, estado ABIERTA, snapshot MOVIMIENTOS_CAJA_RECONCILIADOS |
| ControlOperativo | NATIVE | 71 | Contiene locks y eventos operativos preexistentes |
| HistoricoCierresZ | NATIVE | 1 | Cierre anterior marcado SIMULATED |

Los permisos devueltos para las cuatro colecciones son PRIVILEGED en lectura, inserción, actualización y eliminación. Esto no autoriza al frontend a escribir; la autorización seguirá en backend.

El usuario declara que todos los registros TPV actuales y los que se generen en esta fase son datos sintéticos de prueba. Esa declaración se conserva como contexto de ejecución; no convierte automáticamente cada fila de ControlOperativo en un registro TPV ni acredita el origen de cada fila individual. No se modifica ningún registro para reclasificarlo.

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
- Estado de envío: NO_ENVIADO_TEST; sin CSV, sin fecha de envío y sin llamada externa.
- Naturaleza/origen de prueba: marcarla explícitamente en recordSource y en el sobre payloadFiscal; no reutilizar TPV_LEDGER como si fuera una factura real.
- La serie interna SIM-INT-2026 es para eventos no facturables (movimientos de efectivo y controles). NO_FISCAL sería un valor interno, no una clave AEAT, y nunca debe transmitirse como tipo de factura.

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

- recordTimestamp: instante real de generación con precisión y zona horaria controladas; almacenar como fecha/hora consistente con Europe/Madrid.
- fechaExpedicionFactura: fecha de expedición, no sustituirla automáticamente por la fecha de operación.
- fechaOperacion: fecha real de prestación/entrega cuando difiera de expedición.
- fiscalPeriod: periodo derivado de la fecha de devengo/operación conforme a la política fiscal aplicable, no de la fecha de inserción.
- numSerieFactura: serie y número únicos por tipo de documento; las rectificativas deben conservar la relación con la factura original.
- sequenceNumber: secuencia del ledger; no es el número de factura.
- transactionId: identificador estable derivado de la clave idempotente y el tipo de evento.
- previousRecordHash: hash del último registro válido de la cadena; el primer registro de una nueva cadena sintética necesita un ancla genesis explícita y documentada. Las cinco filas preexistentes no pueden ser el antecedente porque carecen de hash y secuencia.
- hash: cubrir el contenido canónico completo del registro fiscal, las fechas, la secuencia, la huella anterior y la identificación del sistema. El SHA-256 interno actual sobre stableSerialize no acredita por sí solo conformidad VeriFactu; debe contrastarse con el algoritmo y serialización oficial de la Orden HAC/1177/2024 antes de cualquier uso real.

## 7. Bloqueos de ejecución online

No iniciar pruebas que escriban hasta resolver todos estos puntos:

1. CajaActual tiene una única proyección preexistente en estado ABIERTA y el repositorio la consulta por singletonKey; los flujos de apertura, venta y cierre pueden actualizarla.
2. El repositorio TPV llama a assertTpvOperationalLedgerConfigured(), que falla cerrado; FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED está en false.
3. registrarVenta valida catálogo e impuestos, pero devuelve TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED; no persiste.
4. registrarDevolucion valida ahora el DTO y devuelve TPV_REFUND_PROVIDER_NOT_CONFIGURED; no persiste ni llama a un proveedor.
5. La preparación de venta mantiene bloqueos por configuración fiscal, verificación de pago y presentación del precio final con impuestos incluidos.
6. La identidad emisora no está designada inequívocamente; no se debe copiar el NIF de una fila TERCERO sin confirmar su función.
7. La política de serie, tipos documentales, IVA y redondeo debe ser aprobada y fijada en backend.

8. El runtime heredado tpvTestRuntime.web.js y sus módulos de repositorio/core siguen presentes. El controlador de la página ya no los importa, pero validation.js todavía consume funciones del core para validar payloads históricos y varias suites los cubren. No se eliminan en esta intervención: primero hay que separar la validación de compatibilidad histórica del runtime de escritura y demostrar que no quedan consumidores activos.

Para cumplir “no modificar registros existentes”, la siguiente decisión arquitectónica es aislar la proyección de una nueva sesión dentro de la misma colección CajaActual sin tocar SINGLE_ITEM_ID, o limitar la aceptación online a inserciones append-only que no requieran actualizar esa proyección. No crear otra colección ni habilitar un bypass de la proyección.

## 8. Validación y criterios de aceptación

- Unit tests: normalización DTO, cálculo fiscal en céntimos, tipos de factura, rectificaciones, numeración, hash, genesis, idempotencia.
- Integration tests: mismo repositorio y WebMethods que el TPV; mocks únicamente para probar fallos, no un runtime alternativo.
- Online tests: solo en el sitio Draft actual y con inserciones nuevas, identificadas como sintéticas. Ninguna actualización/borrado de registros existentes.
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
