# Dossier operativo maestro — Capa Externa

**Proyecto:** Marian Madrid · Wix Classic + Velo  
**Fecha de revisión:** 2026-11-28  
**Estado:** DISEÑO DOCUMENTAL CONSOLIDADO · CONFIGURACIÓN EXTERNA NO VERIFICADA

> Punto de entrada operativo para configurar SharePoint, gestoría, PGC, correspondencia entre capas, informes derivados y herramientas AEAT. No acredita que tenant, biblioteca, gestoría, autorizaciones AEAT o transporte estén conectados.

## 1. Resumen ejecutivo

La Capa Externa recibe datos de Wix, los valida, reconcilia, prepara paquetes documentales y los entrega a destinatarios autorizados. Debe conservar evidencia de qué se envió, cuándo, con qué versión y qué respuesta se recibió.

**Arquitectura recomendada:**
1. Wix Apps + Wix CMS: fuentes autoritativas de hechos operativos, económicos y laborales según el dominio.
2. Capa 3 backend: lectura, normalización, conciliación, agregación, informes y paquetes versionados. No escribe en capas 1 o 2.
3. SharePoint: repositorio documental y evidencia secundaria, con bibliotecas, metadatos, permisos y retención.
4. Gestoría: receptor/revisor de paquetes en formato que su software acepte; las correcciones vuelven como observaciones estructuradas, no como escritura directa en Wix.
5. AEAT: destino normativo para trámites y servicios concretos (SIF/VERI*FACTU, SII y trámites tributarios aplicables). SharePoint no sustituye a AEAT.
6. Power Automate: opcional para avisos, aprobaciones y tareas documentales; no es fuente de verdad ni debe duplicar el transporte sin decisión técnica.

Decisiones recomendadas: un sitio SharePoint administrativo con bibliotecas separadas por sensibilidad; un transporte principal; exportación unidireccional Wix → Capa Externa; entregas idempotentes, no destructivas y verificadas mediante lectura posterior/checksum; informes inferidos claramente etiquetados como borrador.

## 2. Estado real y evidencias

### 2.1 Verificado en repositorio/código
- Existe src/backend/exports/exportContract.js: contrato JSON 1.0.0, serialización determinista, SHA-256, IDs deterministas y minimización.
- Existe src/backend/exports/exportService.web.js: WebMethod Admin, requireAdmin, rate limit y preparación trimestral en memoria.
- Existe src/backend/fiscalAggregator.web.js: agregación trimestral y generación de filas de un libro interno.
- Existe src/backend/accountingLedger.js: primitiva append-only de líneas contables equilibradas, idempotencia, hash-chain y lock. No tiene mapeo automático de eventos a cuentas.
- Existe la colección RegistroIntegracion con campos de evento, origen, correlación, idempotencia, hash, estado, intentos, siguiente intento, entrega y último error.
- Existen LibroAsientosContablesDetalle, MovimientosCaja, CajaActual, HistoricoCierresZ, RegistrosHorariosStaff, CitasF2, ControlOperativo, ServiciosCatalogo, ComplementosCatalogo, MapaStaff y TransaccionesTPV.
- El contrato de exportación prepara un objeto en memoria. No sube a SharePoint, no llama a Graph, no envía correo, no ejecuta Power Automate ni crea jobs.
- No hay evidencia de tenant, site, biblioteca, identidad técnica, permisos, retención, DLP, conector SharePoint o aceptación de gestoría.
- El sitio figura Draft/no publicado en la última evidencia del proyecto; Runtime y producción no están acreditados.

### 2.2 Snapshot Wix y limitaciones

El snapshot físico docs/ESQUEMA_CMS.md se obtuvo con lectura consistente el 27-11-2026: 12 colecciones NATIVE y 29 WIX_APP. Es un corte histórico, no una consulta live. Los recuentos no demuestran que los registros sean operaciones reales; por directriz del proyecto, todo dato anterior al despliegue oficial de producción de 2027 es sintético.

La auditoría operativa del 28-11-2026 detectó divergencias entre algunas proyecciones y fuentes nativas (Bookings/eCommerce), movimientos de caja sintéticos incompletos, ausencia de intención TPV persistida, ausencia de configuración fiscal canónica observada y eventos de integración no enviados. Consultar docs/audits/2026-11-28-operational-persistence-audit.md; no reconstruir ni corregir históricos desde informes.

### 2.3 Hallazgos de código que bloquean la fiabilidad del paquete actual

**C3-FINDING-001 — población distinta en resumen y detalle (ALTO).** exportService.web.js llama a getQuarterlyTaxSummaryInternal y getLibroRegistroFacturasExpedidasInternal con requireRealRecords=true. En fiscalAggregator.web.js, el resumen acumula fetchResult.items sin aplicar ese filtro por registro; el detalle sí excluye filas cuando recordNature !== REAL. El total del resumen y las filas pueden representar poblaciones distintas. No considerar el paquete conciliado hasta corregir y probar población, conteos y totales.

**C3-FINDING-002 — tipo de factura exportado no fiable (ALTO).** getLibroRegistroFacturasExpedidasInternal asigna R1 a reembolsos y BORRADOR_INTERNO al resto, en vez de leer el tipo real del documento fiscal. exportContract.js serializa ese valor como invoiceType. Las filas no acreditan un libro registro oficial de facturas expedidas ni deben remitirse como tal a AEAT o gestoría. El tipo debe proceder de una factura emitida validada y su registro SIF.

**C3-FINDING-003 — paquete fiscal no equivale a diario PGC (ALTO).** El contrato ACCOUNTING_QUARTERLY contiene líneas fiscales agregadas, importes, medio de pago, tipo de documento, hash y correlación; no contiene un diario completo con líneas Debe/Haber y cuenta contable aprobada por asiento. Son artefactos distintos.

**C3-FINDING-004 — seis dígitos es restricción local, no requisito PGC (MEDIO).** accountingLedger.js valida accountCode con patrón de seis dígitos. El PGC español no impone con carácter general seis dígitos a la numeración/denominación de cuentas. Puede ser convención de subcuenta de proyecto/gestoría, pero debe justificarse y contrastarse con el plan real antes de aprobar mapeos.

Los hallazgos son revisión estática del código consultado en main; no son prueba de fallo runtime ni de pérdida de datos reales.

## 3. Principios y límites
1. Wix sigue siendo SSOT transaccional en dominios propios y nativos.
2. Capa Externa consume información; no es agenda, caja, facturador, contabilidad primaria ni fuente de verdad.
3. SharePoint custodia archivos y evidencias; no certifica por sí solo cumplimiento fiscal, contable o laboral.
4. AEAT recibe trámites y registros concretos por servicios/canales oficiales. Una copia en SharePoint no equivale a presentación.
5. Gestoría revisa y contabiliza en su propio software conforme al contrato de intercambio y criterios profesionales aprobados.
6. Informes inferidos no son hechos transaccionales.
7. Ledgers fiscales, contables, laborales, movimientos contabilizados y cierres finalizados son append-only; corregir mediante nuevos eventos/documentos enlazados.
8. Cero bloqueos silenciosos: dato inválido → error accionable y log correlacionado; fallo externo → estado pendiente/recovery.
9. No asumir atomicidad entre Wix, SharePoint, software gestor y AEAT.
10. Mínimo privilegio y minimización: exportar solo los campos imprescindibles para finalidad y destinatario.

## 4. Arquitectura y flujo E2E

```text
Wix Apps nativas + Wix CMS (SSOT por dominio)
                 ↓
        Readers / DAL backend
                 ↓
   Normalización + validación + conciliación
                 ↓
      Agregadores / informes derivados
                 ↓
   ExportContract + Manifest + SHA-256
                 ↓
       Outbox / Registro de entrega
          ↙                  ↘
 SharePoint                Gestoría
 (custodia)             (revisión/importación)
          ↓
 Power Automate (avisos, aprobaciones, tareas)

AEAT: canal independiente para SIF/VERI*FACTU, SII y trámites tributarios aplicables.
```

Flujo: fijar periodo y zona Europe/Madrid → autorizar → leer fuentes canónicas → normalizar solo representaciones equivalentes → reconciliar fuente nativa/ledger/proyección → generar artefacto específico por finalidad → crear manifest y checksum → entregar sin sobrescribir → read-back y verificación → registrar intento/acuse → notificar → guardar aceptación/rechazo de gestoría como evento separado.

Separar estados: generación (PREPARED, VALIDATION_FAILED, RECONCILIATION_REQUIRED); transporte (PENDING_DELIVERY, DELIVERING, DELIVERED_VERIFIED, RETRYABLE_ERROR, TERMINAL_ERROR, RESPONSE_UNKNOWN); revisión gestoría (NOT_SUBMITTED, SUBMITTED_FOR_REVIEW, ACCEPTED, REJECTED, CORRECTION_REQUESTED). HTTP 2xx no acredita read-back ni aceptación.

## 5. Correspondencia de colecciones y capas

| Capa | Fuente/colección | Naturaleza | Uso externo | Regla |
|---|---|---|---|---|
| 0 | internalConfig.js, validation.js, DAL, security.js, logger | Configuración, seguridad y servicios transversales | Versión/configuración no sensible, logs redactados | No exportar secretos; backend autoriza |
| 1 | Wix Bookings V2: Bookings/Schedule/Services/Staff | SSOT reservas, disponibilidad, servicios y recursos nativos | Métricas agregadas y conciliación | No duplicar agenda ni exportar PII por defecto |
| 1 | CitasF2 | Proyección de reservas duales | Conciliar por bookingId con Bookings V2 | No es autoridad del estado nativo |
| 1/2 | ServiciosCatalogo | Catálogo/configuración comercial y relación staff | Analítica y snapshot histórico | No reconstruir precios históricos desde catálogo actual |
| 1/2 | MapaStaff | Identidad staff, mapeo Wix y configuración fiscal/legal | Solo configuración validada y datos de personal necesarios | Separar tipos de registro; no tratar todo como staff/configuración |
| 2 | Wix Stores Catalog V3 / Inventory | Catálogo e inventario nativo | Ventas/productos/stock si procede | No usar colecciones legacy como SSOT |
| 2 | Wix eCommerce Orders + Payments/Transactions/Refunds | Pedido, cobro y reembolso nativos | Evidencia y conciliación | Pedido y pago son fuentes distintas |
| 2 | TransaccionesTPV | Intención/solicitud de venta | Diagnóstico y correlación | No acredita pago ni movimiento de caja |
| 2 | MovimientosCaja | Ledger de movimientos económicos/físicos conforme al writer | Cierre, caja, conciliación y soporte fiscal según contrato | Append-only; no todo movimiento es factura |
| 2 | CajaActual | Proyección/snapshot de caja abierta | Conciliación de saldo actual | Nunca sustituye ledger |
| 2 | HistoricoCierresZ | Registro de cierre Z y resumen | Acta de cierre | No sustituye factura ni diario PGC |
| 2 | LibroAsientosContablesDetalle | Ledger de líneas contables | Diario PGC solo con asiento aprobado | Append-only; Debe=Haber y plan aprobado |
| 2 | RegistrosHorariosStaff | Registro laboral de jornada | Export laboral controlado | Segregar biblioteca y permisos |
| 2 | ComplementosCatalogo | Catálogo de complementos | Analítica/costes si procede | No es registro de venta |
| 0/3 | ControlOperativo | Locks, dedupe, claims, rate limit | Diagnóstico técnico mínimo | No es ledger de negocio ni registro de entrega |
| 3 | RegistroIntegracion | Eventos/intentos de integración | Entregas, intentos, acuses y errores | No mezclar con ledger económico/fiscal |
| 3 | SharePoint | Copias, manifests, informes y evidencias | Custodia y acceso gestoría | No modificar origen Wix ni sustituir AEAT |

IDs de correlación: bookingId; orderId; paymentId/refundId; transactionId; cashMovementId o _id; invoiceId + serie/número + fecha; journalEntryId; recordId/laborRecordId; exportId/artifactId; traceId/correlationId. traceId no sustituye ID de negocio. No crear referencias CMS tipadas si el esquema solo declara TEXT.

## 6. Estructura documental SharePoint

**Sitio lógico propuesto:** MarianMadrid-Administracion. No se ha verificado su creación.

| Biblioteca | Contenido | Acceso propuesto |
|---|---|---|
| 01-Fiscal | Facturas expedidas/recibidas, registros SIF, respuestas AEAT, modelos y justificantes | Propietario + asesoría fiscal |
| 02-Contabilidad | Diario, mayores, balance, cierres contables, exportación gestor, conciliaciones | Propietario + asesoría contable |
| 03-Caja-TPV | Cierres Z, arqueos, conciliación de pagos, devoluciones y caja | Propietario + responsables autorizados |
| 04-Laboral-Restringido | Fichajes, ajustes, incidencias, autorizaciones y documentos laborales | Solo propietario/asesoría laboral/autorizados |
| 05-Auditoria-Sistema | Manifests, informes de calidad, logs redactados, contratos y evidencias técnicas | Administradores técnicos; gestoría solo lo necesario |

Carpetas: máximo dos niveles bajo biblioteca, por año y periodo. Ejemplos: 01-Fiscal/2027/2027-Q1; 02-Contabilidad/2027/2027-01; 03-Caja-TPV/2027/2027-01; 04-Laboral-Restringido/2027/2027-01; 05-Auditoria-Sistema/2027/2027-Q1. Microsoft recomienda metadatos y tipos de contenido como base de búsqueda; evitar árboles profundos.

Metadatos comunes: ArtifactId (único), ExportId (indexado), ArtifactType, Domain, PeriodStart, PeriodEnd, GeneratedAt, TimeZone, SourceSystem, SourceCollections, SourceRecordCount, SchemaVersion, ContentChecksum, HashAlgorithm, DeliveryStatus, ReviewStatus, Confidentiality, RetentionClass, SupersedesArtifactId, ExternalReference.

Nomenclatura: MM_{DOMINIO}_{TIPO}_{AAAA-MM o AAAA-Qn}_{ID-CORTO}_v{NN}.{ext}. Ejemplos sintéticos: MM_FISCAL_FACTURAS-EXPEDIDAS_2027-Q1_EXP-7F3A_v01.json; MM_CONTABLE_DIARIO_2027-01_ACC-91C2_v01.csv; MM_CAJA_CIERRE-Z_2027-01-31_Z-0042_v01.pdf; MM_LABORAL_JORNADA_2027-01_LAB-3A10_v01.csv.

Reglas: no PII en nombres; fechas ISO; ID opaco; no usar FINAL como control de versión; no sobrescribir artefactos entregados; correcciones como nuevo artefacto con SupersedesArtifactId; extensión acorde al contenido real.

Seguridad: habilitar versionado, auditoría, MFA, DLP y etiquetas de retención según licencia/tenant; retención definida por tipo documental con asesoría/privacidad, no un plazo único; invitados identificados, sin enlaces anónimos; biblioteca laboral segregada; identidad técnica de mínimo privilegio; secretos/certificados fuera de SharePoint/Git/Wix frontend; read-back y checksum después de carga.

## 7. PGC español: estructura, códigos y contrato

Normativa de referencia: RD 1514/2007 (PGC), RD 1515/2007 (PGC PYMES) e ICAC. Confirmar con asesoría si aplica PGC general o PGC PYMES y si concurren exclusiones. PGC PYMES es opcional para entidades elegibles y no se debe mezclar parcialmente con PGC general fuera de supuestos permitidos.

El marco PGC es obligatorio, pero el cuadro de cuentas no impone con carácter general una longitud fija ni numeración literal para cada cuenta: el BOE declara no vinculantes los aspectos de numeración y denominación de la cuarta parte, salvo aspectos con criterios de registro/valoración. La gestoría puede utilizar subcuentas propias. Seis dígitos no es un requisito legal general.

| Grupo | Denominación |
|---:|---|
| 1 | Financiación básica |
| 2 | Activo no corriente |
| 3 | Existencias |
| 4 | Acreedores y deudores por operaciones comerciales |
| 5 | Cuentas financieras |
| 6 | Compras y gastos |
| 7 | Ventas e ingresos |
| 8 | Gastos imputados al patrimonio neto |
| 9 | Ingresos imputados al patrimonio neto |

Cuentas de referencia potenciales para peluquería/estética, NO mapping aprobado: 430 Clientes; 400 Proveedores; 410 Acreedores por prestaciones de servicios; 472 IVA soportado; 477 IVA repercutido; 570 Caja; 572 Bancos; 600 Compras de mercaderías; 602 Otros aprovisionamientos; 705 Prestaciones de servicios (referencia natural para servicios, sujeta al criterio de reconocimiento y plan de la asesoría); 621 Arrendamientos; 622 Reparaciones; 623 Profesionales independientes; 625 Seguros; 626 Servicios bancarios; 627 Publicidad; 628 Suministros; 629 Otros servicios; 640 Sueldos; 642 Seguridad Social empresa; 465 Remuneraciones pendientes; 4751 Retenciones; 476 Seguridad Social acreedora.

No aprobar cuentas por intuición. El asiento depende de devengo, cobro, liquidación tarjeta, comisiones, anticipos, descuentos, devoluciones, régimen IVA, retenciones y forma jurídica. Cobro con tarjeta puede requerir cuenta transitoria de adquirente antes de banco; no contabilizar contra 572 sin conocer liquidación y extracto.

Contrato contable propuesto: accountingPlan (PGC/PGC_PYMES), accountingPlanVersion, accountCode, accountName, journalEntryId, entryDate, fiscalPeriod, sequenceNumber, documentId, documentDate, documentType, thirdPartyId, debitMinor, creditMinor, currency, taxBaseMinor, taxRateBasisPoints, taxAmountMinor, taxCode, sourceCollection, sourceRecordId, sourceEventId, transactionId, reversalOfJournalEntryId, traceId, schemaVersion, approvalStatus.

Un asiento contiene dos o más líneas, Debe=Haber, precisión acordada, un único sentido por línea. El plan se versiona; cambios de mapping no recalculan históricos. El contrato actual accountingLedger.js exige seis dígitos: tratarlo como restricción local/subcuenta y contrastarlo con el plan de gestoría antes de cerrar interoperabilidad.

## 8. Conexión con gestoría

No existe un estándar universal ni evidencia de software/API de gestoría identificado. No asumir que aceptará el JSON del proyecto.

Orden de preferencia: API oficial del software gestor si está documentada; SFTP administrado si la gestoría confirma formato/cifrado/acuse; SharePoint compartido con invitado identificado si trabaja por revisión documental; portal seguro con carga manual como fase inicial. Correo ordinario solo para avisos sin adjuntos sensibles.

Datos que debe proporcionar gestoría: software y versión; alcance del servicio (contabilidad, fiscal, SII, VERI*FACTU, nóminas); PGC/PGC PYMES y plan de cuentas real; formatos admitidos y especificación de columnas, codificación, separadores, decimales y fechas; catálogo de IVA/retenciones; terceros; series y tipos documentales; política de duplicados, rectificativas y reversos; acuse, errores y SLA; canal seguro, usuarios, MFA y retención.

Protocolo: Wix/Capa Externa entrega manifest + checksum; gestoría devuelve externalReceiptId, fecha y resultado de validación. Estados: RECEIVED, VALIDATED, IMPORTED, REJECTED, CORRECTION_REQUESTED. Errores deben identificar fila/campo/código. El mapping corregido vuelve como propuesta versionada; no actualiza la fuente Wix. Aceptación de gestoría no equivale a presentación/aceptación AEAT.

## 9. Informes derivados e inferidos

| Informe | Fuentes | Naturaleza |
|---|---|---|
| Conciliación ventas-cobros | Orders, Payments/Transactions, Refunds, TransaccionesTPV, MovimientosCaja | Reconciliación |
| Cierre diario/Z | MovimientosCaja, CajaActual, HistoricoCierresZ | Informe de cierre |
| Ingresos por servicio/producto | Pedidos, líneas y snapshot catálogo | Analítica |
| Resumen IVA | Facturas y registros fiscales válidos | Borrador fiscal, no modelo 303/390 |
| Diario PGC/mayor | LibroAsientosContablesDetalle con asientos aprobados | Extracto contable |
| Rentabilidad | Ventas, coste histórico, horas y costes asignados | Inferido |
| Ocupación/productividad | Bookings V2 y recursos | Analítica agregada |
| Jornada | RegistrosHorariosStaff y ajustes aprobados | Registro/export laboral; nunca estimar fichajes ausentes |
| Calidad/trazabilidad | Fuentes autorizadas y RegistroIntegracion | Auditoría observacional |
| Previsión | Históricos conciliados | Estimación, nunca contabilidad |

Cada informe debe llevar reportId, reportType/version, schemaVersion, periodo, zona, generatedAt, snapshotAt, SHA/commit del generador, versión de reglas, colecciones fuente, filtros, recuentos recibidos/esperados/incluidos/excluidos/rechazados/pendientes, conciliaciones, diferencias, fórmulas, supuestos, redondeo, clasificación FACTUAL_AGGREGATE/RECONCILIATION/INFERRED/FORECAST/PROFESSIONAL_DRAFT, estado DRAFT/REVIEW_REQUIRED/REVIEWED/APPROVED/SUPERSEDED y limitaciones.

Reglas: separar hechos y cálculos; no imputar ausencias como cero; no inferir cobros de pedidos sin pago verificado; no facturación desde reservas; no fichajes desde horarios previstos; no coste real desde precio actual de catálogo; no sumar caja y pagos nativos sin deduplicar; no calcular IVA bruto sin reglas y snapshot fiscal aprobados. Cada diferencia debe exponerse como excepción.

Limitación actual: fiscalAggregator.web.js marca borrador IVA como REVISION_PROFESIONAL_REQUERIDA y aclara que no es Modelo 303; el borrador de ingresos tampoco es Modelo 130. Por FINDING-001/002, no usar resultados actuales como declaración, libro fiscal oficial o export de gestoría hasta corregir y probar.

## 10. Herramientas y servicios oficiales AEAT

Aplicabilidad depende de forma jurídica, territorio, régimen IVA/IRPF/IS, SII, retenciones y operaciones; confirmar con asesoría.

**SIF/VERI*FACTU:** portal general; Informador VERI*FACTU; aplicación gratuita AEAT; consulta de registros; información técnica con Portal de Pruebas Externas, diseños de registro, WSDL, XSD, validaciones/errores, especificación remisión, algoritmo hash, firma, QR y ejemplos de declaración responsable. Las pruebas deben usar entorno externo de pruebas. Remisión SIF se dirige directamente al servicio AEAT; SharePoint no la sustituye.

**IVA/SII:** Asistente virtual IVA, Asistente virtual SII, localizadores de entregas/prestaciones, calculadoras de plazos de rectificativas/prorrata/sectores diferenciados, ayuda modelos 303/390 y portal SII para altas de facturas expedidas/recibidas y cliente web service. SII y VERI*FACTU son sistemas diferentes. Confirmar si el negocio está obligado o se adhiere voluntariamente al SII; no presumirlo.

**Censos/representación:** Asistente/Informador Censal; trámites de alta/baja/modificación, NIF, IAE, NIF-IVA y certificados; Registro electrónico de apoderamientos para que la gestoría actúe en nombre del obligado en trámites autorizados; certificados electrónicos de persona física/representante; Mis expedientes para consultar expedientes y descargar justificantes; CSV para verificar documentos.

No compartir certificado privado del titular con gestoría ni almacenar PFX/P12 o contraseñas en SharePoint/Git/Wix frontend. Preferir apoderamiento electrónico para trámites acordados. Los certificados de integración deben custodiarse en almacén seguro, con acceso mínimo y rotación. La AEAT no emite el certificado FNMT: actúa, entre otras funciones, como oficina de acreditación.

Modelos tributarios aplicables dependen del sujeto y obligaciones. La Capa Externa prepara datos conciliados y evidencias; no presenta un informe inferido como modelo tributario cumplimentado ni envía autoliquidaciones sin revisión y autorización.

## 11. Transporte, seguridad y recuperación

Microsoft Graph permite cargar archivos a un drive/site y devuelve un recurso driveItem; el método simple de carga documentado admite hasta 250 MB por petición; para tamaños superiores se usa upload session. Los permisos dependen del método; elegir el mínimo privilegio compatible y no conceder Sites.ReadWrite.All por comodidad.

Configurar site/library/drive IDs; crear archivo nuevo con ruta determinista; añadir metadatos; leer de nuevo contenido y metadatos; verificar checksum/tamaño/versión; guardar remoteItemId, eTag/version y URL interna. No reemplazar documentos finales entregados: crear nuevo artefacto lógico.

Timeout tras upload: RESPONSE_UNKNOWN; buscar ExportId y comparar checksum antes de reintentar. Archivo existente con hash distinto: conflicto, no sobrescribir. SharePoint caído: conservar paquete y marcar pendiente. Rechazo gestoría: guardar respuesta y generar versión corregida. No marcar entregado sin read-back.

Privacidad: no exportar PAN/CVV, tokens, contraseñas, secretos, cookies ni credenciales. Pseudonimizar clientes si no se necesita identidad. Separar laboral y fiscal. Aplicar finalidad, minimización, conservación limitada y acceso controlado. No incluir PII en nombres, ExportId, traceId o logs.

## 12. Matriz de configuración y puesta en marcha

| ID | Entrega | Responsable | Evidencia | Estado |
|---|---|---|---|---|
| EXT-01 | Identificar tenant M365/dominio | Propietario/IT | Tenant ID y dominio verificados | PENDIENTE |
| EXT-02 | Crear sitio y cinco bibliotecas | Admin M365 | URLs, IDs site/library/drive, ACL | PENDIENTE |
| EXT-03 | Columnas, content types y vistas | Admin M365 | Diccionario y read-back | PENDIENTE |
| EXT-04 | Versionado, retención, DLP, auditoría, MFA | Admin M365 + asesoría | Configuración real aprobada | PENDIENTE |
| EXT-05 | Identidad técnica/permisos mínimos | IT | App/identidad, scopes, vault | PENDIENTE |
| EXT-06 | Requisitos software gestor | Gestoría | Formato, plan, muestras y acuse | PENDIENTE |
| EXT-07 | Aprobar PGC/PGC PYMES y mapping | Asesoría | Plan y asientos ejemplo aprobados | PENDIENTE |
| EXT-08 | Corregir FINDING-001/002 y pruebas | Desarrollo | Igualdad población, totales y tipos | PENDIENTE |
| EXT-09 | Separar paquete fiscal y diario PGC | Desarrollo | Contratos versionados independientes | PENDIENTE |
| EXT-10 | Implementar transporte Graph | Desarrollo | Upload + metadatos + read-back | PENDIENTE |
| EXT-11 | Ledger de entrega idempotente | Desarrollo | Duplicados, timeout, retry, recovery | PENDIENTE |
| EXT-12 | E2E Wix→SharePoint→gestoría | Desarrollo + gestoría | Paquete sintético recibido y acuse | PENDIENTE |
| EXT-13 | Confirmar obligaciones/accesos AEAT | Asesoría | Censo, régimen, SII/SIF, poderes | PENDIENTE |
| EXT-14 | E2E AEAT pruebas externas | Desarrollo + asesoría | Respuestas de prueba y QR cotejado | PENDIENTE |
| EXT-15 | GO productivo | Propietario + asesoría | Runtime y checklist legal aprobados | PENDIENTE |

## 13. Estructura documental del repositorio

```text
docs/
  architecture/
    CAPA-EXTERNA-MASTER-DOSSIER.md
    CAPA3-REGISTRO-EXTERNO-DOSSIER.md
    VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md
    ADR-C3-TRANSPORT.md (cuando se apruebe)
    ADR-GESTOR-CONNECTION.md (cuando se conozca el software)
    ADR-PGC-ACCOUNT-MAPPING.md (tras aprobación asesoría)
  contracts/external/
    export-manifest.schema.json
    accounting-journal.schema.json
    fiscal-registry.schema.json
    cash-closing.schema.json
    labor-record.schema.json
    reconciliation-report.schema.json
  mappings/
    collection-layer-map.md
    pgc-account-mapping.csv
    gestor-import-contract.md
  audits/
    capa3-export-preparation.md
    operational-persistence-audit.md
    capa3-external-delivery-e2e.md
```

Los contratos futuros no deben crearse como placeholders vacíos. Crear solo tras decidir esquema y versión. El mapa de colecciones puede permanecer dentro de este dossier hasta que cambie el esquema CMS.

## 14. Documentos revisados y jerarquía

| Documento | Función | Tratamiento |
|---|---|---|
| docs/architecture/CAPA3-REGISTRO-EXTERNO-DOSSIER.md | Detalle de export, SharePoint, PGC, jornada y pendientes | Mantener como detalle técnico complementario |
| docs/audits/2026-11-27-capa3-export-preparation.md | Evidencia de preparación export PR #641 | Histórico de ese SHA; no acredita transporte |
| docs/architecture/VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md | Normativa y diseño SIF/VERI*FACTU/QR | Fuente especializada AEAT |
| docs/ESQUEMA_CMS.md | Snapshot físico Wix 27-11-2026 | Esquema para ese corte; no live |
| docs/audits/2026-11-28-operational-persistence-audit.md | Conciliación y brechas 28-11-2026 | Evidencia fechada; no reparar históricos desde informe |
| docs/PROJECT-CANON.md | Arquitectura e invariantes | Documento rector |
| docs/STATE-NOW.md | Estado/evidencia más reciente | Actualizar con hitos y SHA |
| docs/INDEX.md / docs/AI-INDEX.md | Navegación documental | Enlazar este maestro |

Históricos relevantes: docs/archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md; docs/archive/2026-11/architecture/ADR-VERIFACTU-REMISSION.md; docs/archive/2026-11/qa/2026-11-09-verifactu-readiness-audit.md; docs/archive/2026-11/qa/2026-11-09-data-registration-gap-execution.md; docs/archive/2026-11/qa/2026-11-09-process-registration-coverage.md; docs/archive/2026-11/audits/2026-11-14-accounting-fiscal-document-flow-audit.md. Son material histórico: revalidar antes de reutilizar decisiones.

## 15. Fuentes oficiales verificadas

**BOE / ICAC**
- RD 1514/2007, PGC: https://www.boe.es/eli/es/rd/2007/11/16/1514/con
- RD 1515/2007, PGC PYMES: https://www.boe.es/eli/es/rd/2007/11/16/1515/con
- ICAC, normativa nacional PGC/PGC PYMES, resoluciones y consultas: https://www.icac.gob.es/contabilidad/normativas/nacionales
- RD 1619/2012, obligaciones de facturación: https://www.boe.es/eli/es/rd/2012/11/30/1619/con

**AEAT**
- SIF/VERI*FACTU, herramientas, aplicación gratuita, consulta de registros y asistencia: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html
- Información técnica SIF: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html
- Portal SII: https://sede.agenciatributaria.gob.es/Sede/iva/suministro-inmediato-informacion.html
- Asistencia virtual IVA: https://sede.agenciatributaria.gob.es/Sede/ayuda/herramientas-asistencia-virtual/herramientas-asistencia-virtual-iva.html
- Censos, certificados y apoderamientos: https://sede.agenciatributaria.gob.es/Sede/empresarios-individuales-profesionales/tramites-censales-que-afectan-empresarios-profesionales.html
- Registro de apoderamientos: https://sede.agenciatributaria.gob.es/Sede/procedimientos/ZP01.shtml
- Certificados electrónicos de representante: https://sede.agenciatributaria.gob.es/Sede/procedimientos/ZZ38.shtml
- Mis expedientes: https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/otros-servicios-ayuda-tecnica/expedientes.html

**Microsoft**
- Arquitectura de información SharePoint: https://learn.microsoft.com/en-us/sharepoint/information-architecture-modern-experience
- Microsoft Graph, cargar archivo: https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
- Microsoft Graph, recurso driveItem: https://learn.microsoft.com/en-us/graph/api/resources/driveitem

BOE/AEAT prevalecen para fiscalidad; ICAC/PGC para contabilidad; Microsoft Learn acredita capacidades técnicas, no configuración del tenant. Código acredita implementación; pruebas acreditan comportamiento; ninguno sustituye revisión profesional.

## 16. Dictamen y prioridad

**Dictamen:** existe preparación de exportación implementada parcialmente, pero no transporte SharePoint, tenant, recepción de gestoría ni integración AEAT demostrados. Se han identificado dos defectos de consistencia del export fiscal y una separación insuficiente entre paquete fiscal y diario PGC.

Orden óptimo: (1) corregir y probar FINDING-001/002; (2) obtener software, plan de cuentas, formato y canal de gestoría; (3) confirmar PGC/PGC PYMES, régimen tributario, SII/VERI*FACTU y poderes AEAT; (4) configurar SharePoint; (5) aprobar ADR de transporte y gestoría; (6) implementar Graph, ledger de entrega y read-back; (7) construir informes derivados trazables; (8) E2E sintético Wix→SharePoint→gestoría y pruebas AEAT externas si aplican; (9) GO solo con Runtime validado, revisión profesional y autorización del propietario.

**Estado global:** DISEÑO DOCUMENTAL CONSOLIDADO · CONFIGURACIÓN EXTERNA PENDIENTE · EXPORT FISCAL NO APTO PARA USO LEGAL HASTA CORREGIR HALLAZGOS · PGC AUTOMÁTICO NO APROBADO · E2E EXTERNO NO VERIFICADO.