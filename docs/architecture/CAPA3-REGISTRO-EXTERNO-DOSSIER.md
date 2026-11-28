# Dossier técnico — registro externo, custodia documental y automatización (Capa 3)

**Proyecto:** Marian Madrid · Wix Classic + Velo  
**Fecha de consolidación:** 2026-11-28  
**Estado global:** DISEÑO CONSOLIDADO / TRANSPORTE EXTERNO PENDIENTE  
**Rama de referencia inspeccionada:** `main` · HEAD documentado `944eb225b63260353cf283c87b0c0b6f07af6caf`  
**Propietario transaccional:** Wix Apps nativas + Wix CMS propio, según dominio  
**Repositorio documental externo previsto:** SharePoint (tenant/biblioteca aún no verificados)

> Este dossier consolida decisiones, contratos y hallazgos encontrados en el repositorio. No constituye dictamen fiscal, aprobación del PGC, certificación SIF/VERI*FACTU, ni evidencia de que SharePoint, Microsoft 365 o Power Automate estén conectados.

> **Documento de detalle:** el punto de entrada y plan de configuración vigente es [CAPA-EXTERNA-MASTER-DOSSIER.md](CAPA-EXTERNA-MASTER-DOSSIER.md). Este documento conserva el detalle técnico de preparación de exportación, transporte, PGC y flujos. Si hay diferencias, prevalece PROJECT-CANON y el dossier maestro para la organización externa; los contratos de código prevalecen para la implementación real.

## 1. Objetivo y alcance

Definir una arquitectura trazable para preparar, entregar, registrar y conservar fuera de Wix la documentación estructurada que corresponda a las obligaciones fiscales, contables, laborales y de auditoría de Marian Madrid.

La Capa 3:
- Lee datos y evidencias de las capas operativas mediante interfaces backend autorizadas.
- Reconcilia origen, ledger/proyección y artefacto exportado.
- Prepara paquetes estructurados, minimizados, versionados y verificables.
- Entrega copias documentales a un repositorio externo aprobado.
- Conserva estado de entrega, identificadores, checksums, intentos y errores.
- No modifica, gobierna ni reescribe Capa 1 ni Capa 2.

**Distinción normativa esencial:** SharePoint es un repositorio de custodia y evidencia documental. No es, por sí mismo, un registro oficial de la AEAT, un sistema de facturación verificable, un libro contable legalizado ni el sistema de registro horario exigido por la legislación laboral. Cuando una norma exige comunicación a un organismo, conservación de registros o disponibilidad documental, el destino, formato, plazo, firma, inalterabilidad y procedimiento deben determinarse para esa obligación concreta. No se debe presentar una subida a SharePoint como cumplimiento de una remisión oficial.

## 2. Fuentes de autoridad y precedencia

1. Normativa española vigente y especificaciones oficiales del organismo competente (BOE, AEAT, normativa laboral y contable aplicable).
2. Documentación oficial Wix y contratos oficiales de Microsoft/otros proveedores.
3. `docs/PROJECT-CANON.md`, `docs/STATE-NOW.md`, `docs/RELEASE-READINESS.md`.
4. Código y tests en el SHA concreto de `main`.
5. Auditorías y ADRs fechados; los documentos de `docs/archive/` son evidencia histórica y requieren revalidación.

Principios:
- Wix CMS es SSOT transaccional de las entidades propias; las aplicaciones Wix gobiernan sus dominios nativos.
- Git es SSOT del código versionado; no acredita el código instalado en Wix.
- SharePoint custodia artefactos; no es SSOT transaccional.
- El frontend solo presenta e inicia acciones. Autorización, validación, agregación y transporte residen en backend.
- Los ledgers fiscales, contables, laborales y de cierres son append-only. Rectificar mediante nuevos registros/eventos enlazados, no sobrescribir ni borrar.
- No confiar en identificadores, importes, impuestos, roles o permisos enviados por navegador.
- No activar pagos, remisiones oficiales, notificaciones ni efectos externos durante QA.

## 3. Mapa de dominios y destino externo

| Dominio / obligación | Fuente autoritativa | Registro interno / writer | Salida externa prevista | Estado |
|---|---|---|---|---|
| Facturación expedida / SIF | Datos fiscales y hechos de venta conciliados; contrato SIF aplicable | Writers fiscales y ledger conforme a especificación; configuración fiscal canónica | Remisión AEAT cuando corresponda al sistema/modalidad; copia de evidencia en SharePoint | Writers/remisión no habilitados; configuración fiscal no acreditada |
| VERI*FACTU | Registros de facturación de alta/anulación y cadena/hash conforme a AEAT | Registro fiscal estructurado y mecanismo de remisión SIF | AEAT como destino normativo; SharePoint como custodia secundaria | Diseño histórico; validar especificación y modalidad vigente antes de activar |
| Contabilidad / PGC | Documentos fuente, operaciones conciliadas y reglas aprobadas por asesoría | `accountingLedger.js::appendAccountingEntry` → `LibroAsientosContablesDetalle` | Libro/diario y documentación de soporte en SharePoint; exportación al asesor | Writer implementado; mapeo automático PGC no aprobado |
| Facturas recibidas / proveedores | Factura original, justificante, pago bancario y reglas de reconocimiento | `LibroAsientosContablesDetalle` mediante writer contable; sin movimiento de caja física por pago bancario | Original y justificantes en SharePoint; asiento estructurado exportable | Automatización bloqueada por aprobación PGC |
| Cobros, devoluciones y caja | Wix eCommerce/Payments y proveedor; efectivo confirmado en operación presencial | `MovimientosCaja` append-only; `CajaActual` es proyección; `TransaccionesTPV` es intención | Informe de cierre y evidencia conciliada en SharePoint | E2E Runtime y conciliación pendientes |
| Cierre Z | Ledger de movimientos conciliados | `HistoricoCierresZ` append-only | Acta/CSV/PDF y manifest en SharePoint | No declarar operativo hasta E2E |
| Jornada laboral | Eventos reales de entrada/salida, ajustes y aprobaciones | `RegistrosHorariosStaff` append-only | Exportación de registro y evidencias de ajustes a repositorio aprobado | Colección vacía en snapshot 27-11; flujo Runtime pendiente |
| Reservas | Wix Bookings V2 | `CitasF2` como proyección reconciliable | Solo métricas/evidencias necesarias; no exportar PII de reservas sin finalidad y base legal | No duplicar reservas ni usar SharePoint como agenda |
| Auditoría e integraciones | Eventos y resultados de origen | `ControlOperativo`, `RegistroIntegracion` y logs seguros | Manifest, informes de conciliación y evidencia técnica | Colección/contrato disponible; transporte externo no verificado |

No exportar por defecto: datos de tarjeta, tokens, secretos, credenciales, notas libres, datos personales de clientes, información de salud o detalles de reservas no necesarios. Aplicar minimización, control de acceso, retención y protección de datos según finalidad.

## 4. Contrato de exportación ya implementado

La preparación backend se integró mediante PR #641. Fuente primaria: `docs/audits/2026-11-27-capa3-export-preparation.md`.

### 4.1 Componentes

- `src/backend/exports/exportContract.js`: contrato JSON versionado `1.0.0`, serialización determinista, checksum SHA-256, IDs deterministas por periodo/artefacto y minimización de campos.
- `src/backend/exports/exportService.web.js`: WebMethod restringido a Admin, autorización adicional `requireAdmin`, rate limit y preparación trimestral en memoria.
- `src/backend/fiscalAggregator.web.js`: opción interna `requireRealRecords` para rechazar registros que no estén clasificados exactamente como REAL. No altera el comportamiento por defecto del agregador habitual.

### 4.2 Manifest y payload

Manifest documentado:
- `exportId`, `artifactId`, tipo y versión de artefacto.
- Periodo, zona horaria `Europe/Madrid`, `generatedAt`, `traceId`.
- Número de registros, algoritmo y checksum.

Contenido fiscal/contable mínimo:
- NIF del emisor cuando sea necesario para la finalidad.
- Totales agregados y líneas fiscales mínimas.
- Número/fecha/tipo de documento, naturaleza/movimiento y tratamiento fiscal.
- Medio de pago, base/cuota/total en céntimos.
- Tipo impositivo en basis points.
- Referencia rectificativa, timestamp, hash completo y `transactionId` opaco.

No se exportan nombre/NIF/dirección de clientes, notas de reserva, descripción libre, datos de tarjeta, tokens, secretos ni credenciales. Cualquier ampliación requiere finalidad, base jurídica, aprobación y versión contractual.

### 4.3 Garantías demostradas y límites

**Implementado/documentado:**
- Lectura desde agregadores Wix CMS; el servicio de preparación no inserta ni actualiza CMS.
- Contrato determinista, checksum y pruebas de periodo, importes en céntimos, exclusión de datos personales/concepto, rechazo de registros sintéticos y validación de hash/fecha.
- WebMethod Admin, autorización y rate limit.

**No implementado/no demostrado:**
- Llamadas a Microsoft Graph.
- Subida o lectura de archivos en SharePoint.
- Flujos Power Automate PA-01…PA-07.
- Cron/job de exportación automática.
- Tenant, biblioteca, identidad de aplicación/conexión, scopes, permisos, DLP, retención y versionado M365.
- Confirmación externa E2E ni aceptación de gestoría.
- Configuración fiscal canónica online: el read-back documentado del 27-11 no encontró registro CONFIG_SISTEMA en MapaStaff; no se deben inventar datos del emisor.

## 5. Arquitectura tecnológica objetivo

### 5.1 Stack confirmado o recomendado

| Componente | Tecnología | Función | Situación |
|---|---|---|---|
| Sistema operativo transaccional | Wix Classic + Velo backend + Wix CMS | SSOT y writers canónicos | Existente |
| Orquestación de exportación | WebMethod backend `exportService.web.js` | Autorizar, preparar, validar y generar artefacto | Implementado para preparación |
| Formato de intercambio | JSON versionado y determinista | Interoperabilidad y validación | Contrato 1.0.0 implementado |
| Integridad | SHA-256 + checksum del artefacto | Detectar alteraciones | Implementado en contrato de exportación |
| Transporte externo preferente a evaluar | Microsoft Graph API (app-only o identidad de servicio aprobada) | Crear archivo y metadatos en SharePoint | Recomendación pendiente de ADR y verificación de tenant/permisos |
| Automatización de procesos | Power Automate | Programación, aprobaciones, alertas y tareas documentales | No verificado; PA-01…PA-07 no acreditados |
| Repositorio | SharePoint document library | Custodia versionada de artefactos y documentos originales | Destino previsto; no conectado/verificado |
| Seguimiento | `RegistroIntegracion` / ledger técnico separado | Idempotencia, intentos, estado y correlación de entrega | Esquema existe; writer/transporte Capa 3 no acreditado |
| Observabilidad | Logs backend redactados + IDs de correlación | Diagnóstico sin exponer PII/secrets | Primitivas existentes; E2E externo pendiente |

**Elección técnica provisional:** mantener Wix backend como productor del paquete y evaluar Microsoft Graph como transporte directo a SharePoint. Power Automate puede encargarse de disparadores, aprobaciones y avisos, pero no debe convertirse en una segunda fuente de verdad ni modificar los ledgers Wix. No introducir Resend/Outlook como ruta paralela hasta resolver mediante ADR la contradicción documental histórica y aprobar el proveedor/canal.

### 5.2 Separación de responsabilidades

1. Wix genera el hecho transaccional y conserva el ledger.
2. Agregador backend consulta fuentes autorizadas y reconcilia el periodo.
3. Export service construye JSON determinista y manifest.
4. Adaptador de transporte envía el artefacto al destino SharePoint aprobado.
5. SharePoint devuelve identificador, ruta, versión y metadatos de archivo.
6. Verificador vuelve a leer el archivo o su contenido/propiedades y compara checksum.
7. Registro de entrega guarda resultado, timestamps, intentos y error normalizado.
8. Power Automate (si se aprueba) gestiona aprobaciones/avisos posteriores, sin reescritura de Wix.
9. El asesor/gestoría revisa y acepta el paquete conforme a procedimiento acordado.

No se presume atomicidad entre Wix y Microsoft 365. Un timeout tras la creación del archivo puede dejar resultado incierto; se debe consultar por `exportId`/checksum antes de reintentar.

## 6. Flujo de automatización propuesto

### 6.1 Flujo de exportación trimestral

1. **Trigger:** solicitud Admin manual o job programado aprobado. No activar cron hasta validar la zona horaria, el periodo y las precondiciones.
2. **Autorización:** verificar identidad/rol en backend y permiso mínimo.
3. **Corte:** fijar periodo cerrado, fecha de corte y zona `Europe/Madrid`.
4. **Lectura:** consultar Wix Apps/CMS mediante readers y agregadores autorizados; no usar acceso directo que evite DAL/hooks.
5. **Conciliación:** contrastar origen nativo ↔ ledger ↔ proyección; rechazar datos ambiguos o incompletos.
6. **Validación:** esquema, emisor, factura, fechas, importes, IVA, secuencia, `transactionId`, hash y referencias rectificativas.
7. **Generación:** JSON versionado, serialización determinista, IDs y checksum.
8. **Transporte:** crear artefacto no destructivo en biblioteca SharePoint aprobada, con metadatos y ACL mínimos.
9. **Read-back:** volver a obtener el archivo y comparar checksum, tamaño, versión y metadatos.
10. **Registro de entrega:** persistir evento de integración idempotente y resultado; no modificar los ledgers de origen.
11. **Aviso/aprobación:** Power Automate notifica al asesor o responsable cuando se apruebe el proceso.
12. **Cierre:** marcar entregado solo después del read-back verificado; si hay fallo, mantener estado recuperable y visible.

### 6.2 Estados recomendados de entrega

`PREPARED` → `PENDING_DELIVERY` → `DELIVERING` → `DELIVERED_VERIFIED`

Estados alternativos: `RETRYABLE_ERROR`, `TERMINAL_ERROR`, `RECONCILIATION_REQUIRED`, `CANCELLED_BY_ADMIN`.

No marcar `DELIVERED` por el mero hecho de recibir HTTP 2xx. Exigir confirmación de existencia, versión y checksum del objeto remoto.

### 6.3 Idempotencia, reintentos y recuperación

- Clave de negocio: `exportId` determinista por entidad/periodo/tipo/versión.
- Integridad: checksum SHA-256 del contenido exacto serializado.
- Restricción: un mismo `exportId` y checksum debe resolver al mismo artefacto lógico; un checksum diferente para un exportId ya cerrado exige nueva versión o revisión explícita.
- Antes de reintentar una operación de resultado incierto, buscar el objeto remoto por metadatos `exportId` y comprobar checksum.
- Reintentos limitados con backoff exponencial y jitter; no reintentar errores terminales de permisos, esquema o configuración.
- No sobrescribir ni eliminar artefactos entregados; correcciones como nueva versión/artefacto con relación `supersedesArtifactId`.
- Registrar intento, fecha, destino lógico, status HTTP normalizado, código de error seguro, correlación y respuesta mínima; nunca tokens ni payloads sensibles.
- Separar ledger de entrega del ledger fiscal/contable/laboral.

## 7. SharePoint: diseño documental previsto

**No existe todavía un sitio, tenant ni biblioteca verificados en la evidencia consultada.** La estructura siguiente es propuesta, no una ruta ya creada.

Biblioteca recomendada: `MarianMadrid-Evidencias`.

Estructura lógica:
- `/Fiscal/AAAA/Trimestre/`
- `/Contabilidad/AAAA/Periodo/`
- `/Proveedores/AAAA/`
- `/CierresZ/AAAA/MM/`
- `/Jornada/AAAA/MM/`
- `/Auditoria/AAAA/`

Metadatos mínimos de documento:
- `artifactId`, `exportId`, `artifactType`, `schemaVersion`.
- `periodStart`, `periodEnd`, `generatedAt`, `timeZone`.
- `sourceSystem`, `sourceRecordCount`, `contentChecksum`, `hashAlgorithm`.
- `deliveryStatus`, `deliveredAt`, `supersedesArtifactId` cuando proceda.
- `retentionClass` y clasificación de confidencialidad, definidos con asesoría/privacidad.

ACL sugerida: cuenta técnica solo escritura/lectura del ámbito de destino; asesoría lectura y descarga; administrador controlado; sin enlaces anónimos. La retención, versionado, auditoría, residencia y DLP deben verificarse en el tenant real antes de cargar datos.

Conservar documentos originales (facturas recibidas, justificantes bancarios y laborales) como archivos separados del asiento/registro estructurado. El vínculo entre documento y asiento debe ser un identificador/hash, no una copia innecesaria de datos personales.

## 8. Matriz de correspondencia técnica

| Proceso origen | Fuente/ID | Writer / ledger | Campos de enlace mínimos | Artefacto externo |
|---|---|---|---|---|
| Venta TPV | `TransaccionesTPV` (intención) + pedido/pago confirmado | `MovimientosCaja` (hecho físico/fiscal) | `transactionId`, `orderId`, `traceId`, `documentId` | Línea de venta conciliada + evidencia de pago permitida |
| Cobro tarjeta | Wix Payments/proveedor + pedido | `MovimientosCaja` tras estado de pago confirmado | `transactionId`, referencia proveedor opaca, `orderId` | Conciliación de cobros |
| Efectivo | operación presencial confirmada | `MovimientosCaja` | `transactionId`, `sequenceNumber`, `previousRecordHash` | Libro de caja / cierre |
| Devolución | reembolso confirmado en proveedor y política aplicable | evento/ledger de devolución enlazado | `refundId`, `transactionId`, referencia a operación original | Línea de rectificación/devolución |
| Factura expedida | documento fiscal emitido | registro fiscal / SIF según modalidad | `numSerieFactura`, fecha, tipo, hash, hash anterior, `transactionId` | Registro de facturación y remisión oficial cuando corresponda |
| Factura recibida | factura original + evidencia de pago | `appendAccountingEntry` | `documentId`, `journalEntryId`, `thirdPartyId`, `traceId` | Documento + asiento PGC |
| Cierre Z | movimientos de caja conciliados | `HistoricoCierresZ` | periodo, secuencias, hashes inicio/fin, `traceId` | Acta y resumen de cierre |
| Jornada | fichaje/ajuste aprobado | `RegistrosHorariosStaff` | `recordId`, `laborRecordId`, `memberId`, `recordHash`, `previousRecordHash`, `traceId` | Registro horario/export laboral |
| Reserva | Wix Bookings V2 | `CitasF2` como proyección | `bookingId`, `serviceId`, `resourceId` | Métricas o evidencia mínima, si procede |
| Entrega externa | artefacto generado | `RegistroIntegracion` / writer técnico de entrega | `eventId`, `idempotencyKey`, `exportId`, `payloadHash`, `correlationId` | Confirmación remota y metadatos SharePoint |

La matriz no autoriza exportar todos los campos enumerados del CMS: solo los estrictamente necesarios para cada finalidad. Los identificadores personales se pseudonimizan o excluyen cuando no sean imprescindibles.

## 9. PGC: nomenclatura y modelo de asiento

### 9.1 Regla de nomenclatura

- Identidad del asiento: `journalEntryId`.
- Orden de línea: `sequenceNumber`.
- Cuenta: `accountCode` como código PGC, validado contra el plan contable aprobado.
- Importes separados: `debitAmount` y `creditAmount`; no representar ambos sentidos mediante un signo ambiguo.
- Tercero: `thirdPartyId`; conservar NIF/datos fiscales solo donde la finalidad y permisos lo requieran.
- Documento soporte: `documentId`; operación económica: `transactionId`; trazabilidad técnica: `traceId`.
- Periodo: `fiscalPeriod`; fecha contable/operación según contrato aprobado.
- Cada asiento agrupa dos o más líneas y cumple partida doble: suma Debe = suma Haber, con precisión monetaria definida.
- El ledger conserva cada línea append-only y encadena hashes conforme al contrato interno.

### 9.2 Estado del writer

`src/backend/accountingLedger.js::appendAccountingEntry` existe como primitiva interna. La auditoría indica validación de partida doble, hash-chain, idempotencia y persistencia append-only. No se habilita un mapeo automático PGC por defecto: el comentario del propio módulo y las auditorías exigen aprobación formal de las reglas.

### 9.3 Matriz PGC pendiente de aprobación

| Hecho económico | Cuenta Debe | Cuenta Haber | Evidencia necesaria | Estado |
|---|---|---|---|---|
| Venta de servicios | Pendiente asesoría | Pendiente asesoría | Factura, desglose IVA, cobro/cliente | NO APROBADO |
| IVA repercutido | Pendiente asesoría | Pendiente asesoría | Tipo y régimen fiscal aplicable | NO APROBADO |
| Cobro en efectivo | Pendiente asesoría | Pendiente asesoría | Movimiento físico confirmado | NO APROBADO |
| Cobro por banco/tarjeta | Pendiente asesoría | Pendiente asesoría | Liquidación bancaria/proveedor | NO APROBADO |
| Factura proveedor | Pendiente asesoría | Pendiente asesoría | Factura original, devengo, tercero | NO APROBADO |
| Pago proveedor por banco | Pendiente asesoría | Pendiente asesoría | Extracto/justificante y deuda asociada | NO APROBADO |
| Devolución/abono | Pendiente asesoría | Pendiente asesoría | Factura rectificativa y operación original | NO APROBADO |
| Retenciones/IRPF | Pendiente asesoría | Pendiente asesoría | Tipo de retención y obligación | NO APROBADO |

No insertar códigos de cuenta ni reglas de reconocimiento por intuición. La aprobación debe incluir cuentas, subcuentas, tratamiento de IVA/retenciones, criterio de devengo/cobro, redondeo, periodificación, rectificaciones y ejemplos firmados por asesoría. El PGC aplicable y sus adaptaciones deben confirmarse según forma jurídica y actividad.

## 10. Facturación y normativa SIF / VERI*FACTU

La facturación y remisión VERI*FACTU constituyen un flujo normativo separado de la exportación documental Capa 3. AEAT es el destino oficial de la remisión; SharePoint solo custodia copias y evidencias.

La fuente activa de diseño es el [Dossier VERI*FACTU y QR tributario](VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md), que actualiza la normativa y especificaciones a 28-11-2026, incluido el RDL 43/2026, y documenta:
- ámbito y exclusiones, modalidad VERI*FACTU/no verificable y distinción entre factura simplificada y justificante no-factura;
- QR tributario, URL, parámetros, dimensiones, nivel de corrección, quiet zone y textos;
- registros de alta/anulación, XML/XSD/WSDL, huella y encadenamiento AEAT;
- remisión, control de flujo, respuesta, incidencias, reintentos, idempotencia y recuperación;
- arquitectura Wix/Velo, impresión Epson, pruebas e hitos VQ-01…VQ-10.

**Estado:** DISEÑO DOCUMENTADO; SIF, modalidad, declaración responsable, integración, QR impreso y remisión real NO ACREDITADOS. No activar transporte AEAT ni tratar el ledger TPV, el cierre Z o SharePoint como sustitutos del SIF. Revalidar aplicabilidad y emisor con asesoría antes de implementación productiva.

## 11. Registro horario y documentación laboral

La colección `RegistrosHorariosStaff` está definida en el snapshot físico CMS del 27-11-2026 y figura con cero items en ese corte. El esquema incluye, entre otros, `recordId`, `clockEventType`, `recordedAt`, `workDate`, `timeZone`, `memberId`, `recordHash`, `previousRecordHash`, `schemaVersion` y `traceId`.

La exportación laboral deberá conservar los datos exigibles, identidad del trabajador, fecha/hora real, ajustes y su justificación, autor/aprobador y evidencias de integridad; el formato y disponibilidad se validarán contra la normativa laboral vigente y asesoría. No inferir fichajes ausentes, reconstruir horas ni convertir snapshots en registros oficiales. SharePoint sería custodia complementaria, no sustituto del registro original ni del acceso legalmente exigido.

## 12. Matriz de estado y decisiones pendientes

| ID | Elemento | Estado | Criterio para cerrar |
|---|---|---|---|
| C3-01 | Contrato JSON 1.0.0 | IMPLEMENTADO (PR #641) | Mantener tests y versionado |
| C3-02 | Agregación fiscal y minimización | IMPLEMENTADA parcialmente | Configuración fiscal válida y conciliación demostrada |
| C3-03 | Mapeo PGC automático | PENDIENTE | Aprobación escrita de asesoría y casos de prueba |
| C3-04 | ADR de transporte | PENDIENTE | Comparar Graph directo vs Power Automate como transporte; seleccionar uno |
| C3-05 | Tenant/biblioteca SharePoint | PENDIENTE | Read-back de tenant, site, library, permisos, versionado y retención |
| C3-06 | Identidad técnica y permisos | PENDIENTE | Identidad aprobada, mínimo privilegio, secretos en almacén seguro |
| C3-07 | Adaptador Graph/SharePoint | NO IMPLEMENTADO | Contrato, idempotencia, read-back y tests |
| C3-08 | Registro de intentos/entrega | PARCIAL | Writer técnico independiente, append-only donde corresponda y recuperación |
| C3-09 | Power Automate PA-01…PA-07 | NO VERIFICADO | Inventario real del tenant, triggers/actions, conexiones, historial y DLP |
| C3-10 | Automatización programada | NO IMPLEMENTADA para export | Job/cron aprobado y probado en tenant aislado |
| C3-11 | Aceptación asesoría | PENDIENTE | Formato, nomenclatura, periodos, controles y recepción aprobados |
| C3-12 | E2E Wix → SharePoint → read-back | PENDIENTE | Artefacto sintético en tenant aislado, checksum coincidente, ACL correcta |
| C3-13 | Remisión normativa AEAT | NO HABILITADA | SIF/modalidad, datos legales, certificados, especificación y autorización validados |
| C3-14 | Exportación laboral | PENDIENTE | Contrato laboral, datos, permisos, retención y E2E verificados |

## 13. Plan de ejecución recomendado

1. **Cerrar el análisis normativo y funcional:** separar obligaciones AEAT/SIF, contabilidad PGC, custodia documental y registro horario. Obtener aprobación de asesoría.
2. **Aprobar ADR de transporte:** comparar Graph directo y Power Automate; definir qué componente crea archivos y cuál solo orquesta/avisa. No introducir varios transportes equivalentes.
3. **Verificar Microsoft 365:** tenant, SharePoint site/library, identidad, permisos, DLP, versionado, retención, auditoría y residencia.
4. **Aprobar mapping PGC:** matriz completa de cuentas, reglas y ejemplos. Mantener el writer sin mapeo automático hasta entonces.
5. **Cerrar contratos de artefactos por dominio:** fiscal, contable, laboral y cierre; evitar un único payload universal.
6. **Implementar adaptador de entrega:** idempotencia, búsqueda antes de reintento, read-back, checksum y errores accionables.
7. **Implementar ledger técnico de entrega:** separado de ledgers económicos, con correlación y estado durable.
8. **Pruebas offline e integración simulada:** duplicados, timeout pre/post creación, conflicto de versión, checksum incorrecto, permisos denegados, retry y recuperación.
9. **E2E con tenant aislado:** datos sintéticos, cero remisiones AEAT reales, cero pagos, sin notificaciones externas no autorizadas.
10. **Aprobación y activación controlada:** solo después de evidencia de runtime, revisión profesional y autorización del propietario.

## 14. Evidencias y documentos fuente localizados

### Fuentes activas
- `docs/PROJECT-CANON.md`: autoridad, capas e invariantes.
- `docs/STATE-NOW.md`: HEAD, estado del sitio, configuración y pendientes.
- `docs/RELEASE-READINESS.md`: gates y requisitos para E2E/producción.
- `docs/ESQUEMA_CMS.md`: snapshot físico CMS 27-11-2026.
- `docs/audits/2026-11-27-capa3-export-preparation.md`: implementación de preparación de exportación PR #641.
- `src/backend/exports/exportContract.js`, `src/backend/exports/exportService.web.js`, `src/backend/fiscalAggregator.web.js`: implementación actual a inspeccionar por SHA.
- `src/backend/accountingLedger.js`: writer contable.
- `docs/AI-INDEX.md`: índice consultivo.

### Fuentes históricas que requieren revalidación
- `docs/archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md`: diseño de flujos y custodia documental; snapshots históricos.
- `docs/archive/2026-11/architecture/ADR-VERIFACTU-REMISSION.md`: propuesta de remisión, no aprobada.
- `docs/archive/2026-11/qa/2026-11-09-verifactu-readiness-audit.md`: auditoría fiscal histórica.
- `docs/archive/2026-11/qa/2026-11-09-data-registration-gap-execution.md`: brechas de registro y automatización.
- `docs/archive/2026-11/qa/2026-11-09-process-registration-coverage.md`: matriz de cobertura histórica.
- `docs/archive/2026-11/audits/2026-11-14-accounting-fiscal-document-flow-audit.md`: writer/flujo contable y fiscal histórico.
- `docs/archive/2026-11/reference/DICCIONARIO_DATOS_CMS.md`: nomenclatura y esquema histórico; el esquema físico rector es `docs/ESQUEMA_CMS.md`.

## 15. Conclusión ejecutiva

La Capa 3 ya dispone de una base backend real para preparar un paquete JSON contable/fiscal minimizado, determinista y verificable. No existe evidencia de transporte externo operativo. SharePoint, Power Automate, tenant, biblioteca, permisos, retención, DLP y recepción por asesoría siguen pendientes. El mapeo PGC automático no está aprobado. La remisión AEAT/SIF es un flujo normativo separado y no debe confundirse con el archivo documental. El registro laboral requiere su propio contrato y controles.

**Estado final:** preparación de exportación IMPLEMENTADA; automatización y transporte externo PENDIENTES; registro normativo oficial NO HABILITADO; aceptación E2E NO ACREDITADA.
