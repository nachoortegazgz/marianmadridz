# ADR — Arquitectura de remisión VERI*FACTU

- Fecha: 2026-11-09
- Estado: PROPUESTA TÉCNICA — NO APROBADA PARA IMPLEMENTACIÓN
- Alcance: SIF propio de Marian Madrid en Wix Studio / Velo
- Dependencias: auditoría `docs/qa/2026-11-09-verifactu-readiness-audit.md`

## 1. Decisión que se propone

Adoptar VERI*FACTU como modalidad objetivo del SIF propio, con:
- Un único núcleo de generación de registros de facturación.
- Un único encadenamiento por SIF lógico, compartido por todos los módulos interconectados que emitan facturas.
- Persistencia inmutable del registro fiscal antes de cualquier intento de remisión.
- Un componente de remisión desacoplado del ledger, con autenticación del presentador válida ante AEAT.
- Trazabilidad durable de cada intento y respuesta, con reintentos idempotentes.
- Un adaptador de certificado desacoplado de la identidad concreta del custodio/presentador.

Este ADR no autoriza crear colecciones, modificar CMS, alterar writers, instalar proveedores, cargar certificados ni enviar registros.

## 2. Base normativa oficial consultada

Fuentes consultadas el 2026-11-09:
- RD 1007/2023, texto consolidado y modificaciones: https://www.boe.es/eli/es/rd/2023/12/05/1007/con
- RD-ley 15/2025: https://www.boe.es/eli/es/rdl/2025/12/02/15
- AEAT — FAQ VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/sistemas-verifactu.html
- AEAT — FAQ huella/hash: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/huella-hash.html
- AEAT — FAQ colaboración social: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/colaboracion-social.html
- AEAT — WSDL, diseños, XSD, validaciones y pruebas externas: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html

### Reglas que condicionan el diseño

1. VERI*FACTU remite en línea todos los registros de facturación de alta y anulación de las facturas expedidas por ese SIF, de forma automática, consecutiva y fehaciente.
2. Todo registro de facturación, alta o anulación, lleva huella SHA-256 y encadenamiento según las especificaciones correspondientes al tipo de registro.
3. En VERI*FACTU no es obligatorio generar los registros de evento exigidos a los sistemas NO VERI*FACTU, ni firmar electrónicamente cada registro de facturación. La firma individual puede conservarse como control adicional voluntario, pero no sustituye la autenticación del canal de remisión.
4. La opción VERI*FACTU se entiende realizada tácitamente al iniciar sistemáticamente la remisión. Una vez iniciada efectivamente, se mantiene al menos hasta el final del año natural correspondiente, cuando ya resulte aplicable la obligación.
5. El propio obligado o un tercero con representación válida puede remitir los registros. La colaboración social exige acreditación de representación en los modelos/documentos oficiales aplicables.
6. Si hay una incidencia técnica que impide remitir, la facturación no tiene que detenerse por ese solo motivo. Se conserva el registro y se reintenta periódicamente; los envíos de incidencia deben utilizar el indicador de incidencia exigido por la especificación (cabecera con `Incidencia = S` cuando proceda).
7. Si no se recibe respuesta de un envío, se remiten de nuevo los registros hasta obtener respuesta. La recuperación debe reutilizar la misma identidad y contenido del registro; no crear una factura ni un alta nueva por cada reintento.
8. Cada SIF lógico tiene su propio encadenamiento. Módulos interconectados y centralizados en un único sistema comparten cadena; módulos realmente inconexos pueden constituir SIF distintos y deben cumplir individualmente.
9. La remisión VERI*FACTU no elimina otras obligaciones tributarias: libros registro de IVA y modelos informativos siguen siendo obligaciones distintas.
10. Plazos generales tras RD-ley 15/2025: antes del 01-01-2027 para contribuyentes del Impuesto sobre Sociedades; antes del 01-07-2027 para el resto de obligados tributarios del artículo 3.1. El encuadre de Marian Madrid debe confirmarse documentalmente; no inferirlo del nombre comercial.

## 3. Estado del sistema y brechas

### 3.1 Writers conocidos

- `cajas.web.js::registerManualTransaction`: TPV/manual y wrapper de venta online; genera registro local, hash y QR, y depende actualmente de un servicio de firma externo.
- `eventLog.js::registrarEventoEconomico`: escritor utilizado por `events.js` para ventas de líneas y rectificativas; genera registro fiscal y cadena.
- Ambos comparten el lock global del ledger fiscal.
- No se ha encontrado cliente de remisión AEAT, serializador SOAP, parser de respuesta AEAT ni proceso de reintentos de remisión.

### 3.2 No confundir tres conceptos

- **Registro de facturación AEAT:** alta/anulación con contenido y hash definidos por la AEAT.
- **Evento de negocio interno:** evento económico, de reserva, cobro o trazabilidad usado por el dominio Marian Madrid.
- **Registro de evento del RRSIF:** registro normativo exigido a NO VERI*FACTU.

La presencia de `eventLog.js` no demuestra que se esté generando el registro normativo de evento. Tampoco se propone eliminar el ledger de eventos de negocio: su utilidad contable/operativa es independiente. En modalidad VERI*FACTU no se exige implementar los registros de evento propios de NO VERI*FACTU.

### 3.3 Firma interna

La firma del servicio externo actual puede mantenerse como garantía interna adicional si su coste, disponibilidad y contrato lo justifican. No debe ser presentada como requisito VERI*FACTU ni confundirse con la autenticación del presentador ante AEAT. Cualquier desacoplamiento exige analizar contratos y consumidores antes de modificar el writer.

### 3.4 Huella

Debe existir un único builder por tipo de registro AEAT, con vectores oficiales y serialización determinista. El algoritmo y campos de entrada son distintos para alta, anulación y evento; no se puede aplicar un único listado de campos a todos los tipos. Los eventos internos no deben reutilizar automáticamente el algoritmo de registros de evento RRSIF.

No recalcular, corregir ni sobrescribir huellas de registros históricos. La transición se diseña para nuevos registros y conserva el histórico anterior.

## 4. Arquitectura lógica propuesta

```text
TPV / ventas / pedidos / rectificativas
                 |
                 v
        Backend fiscal (Wix)
                 |
       Validación de factura
       clasificación F1/F2/R*
       secuencia y lock del SIF
                 |
                 v
      Registro AEAT inmutable
      (MovimientosCaja / SSOT)
                 |
        evento de despacho
                 |
                 v
       Remisión AEAT Gateway
       - serialización XML/XSD
       - SOAP 1.1 / HTTPS
       - identidad y certificado
       - límites / tiempos / control
                 |
                 v
             AEAT
                 |
                 v
        Respuesta y CSV
                 |
                 v
       Evidencia de remisión
       - estado por registro
       - respuesta / códigos
       - timestamp / CSV
       - intentos / siguiente intento
```

### 4.1 Límite Wix CMS / remisión

Wix CMS permanece como SSOT transaccional del negocio y del registro fiscal generado. La remisión es una operación externa; su estado no debe mutar ni sustituir el contenido fiscal original.

La documentación pública de Wix Data describe operaciones de escritura por colección (insert/save/bulk patch/bulk update), revisiones y actualizaciones parciales; la documentación consultada no acredita una transacción ACID multi-colección que permita confirmar atómicamente un append de `MovimientosCaja` y otro append en una colección de outbox.

Por tanto:
- No diseñar suponiendo atomicidad multi-colección.
- No introducir una colección nueva hasta reconciliar el esquema CMS real y aprobar el cambio.
- Diseñar reconciliación recuperable: si el registro fiscal queda persistido pero no su señal de despacho, un proceso de reparación debe detectar el registro elegible sin remisión y reconstruir la tarea con una clave determinista.
- Si se usa `ControlOperativo` para coordinación, sus estados/locks/reintentos son operativos y mutables; no se convierten en evidencia fiscal inmutable.
- La evidencia de cada respuesta AEAT debe conservarse de forma durable y auditable, sin sobrescribir respuestas anteriores. La ubicación exacta (colección append-only existente o nueva) queda pendiente de diseño de esquema y aprobación.

### 4.2 Estados mínimos de remisión

Separar el estado de factura/registro del estado de transporte:
- `PENDING`: registro elegible, todavía sin respuesta.
- `IN_FLIGHT`: intento enviado, esperando resultado.
- `ACKNOWLEDGED`: AEAT ha devuelto respuesta correlacionable.
- `ACCEPTED`: resultado de registro aceptado.
- `ACCEPTED_WITH_ERRORS`: aceptado con errores/avisos que requieren tratamiento.
- `REJECTED`: rechazo que requiere corregir el origen mediante el procedimiento fiscal que corresponda; nunca editar el registro original.
- `RETRY_PENDING`: incidencia de transporte/servidor sin respuesta concluyente.
- `MANUAL_REVIEW`: estado ambiguo o error no clasificado; bloquea reintentos automáticos no seguros.

La respuesta global del envío y el resultado individual de cada registro se almacenan por separado. Un resultado global parcialmente correcto no convierte todos los registros en aceptados.

### 4.3 Idempotencia y reintentos

- Identidad de envío derivada de SIF + identificador estable del registro + hash de contenido; no usar timestamp de intento como clave.
- Reintentar el mismo registro y payload ante timeout/ausencia de respuesta, conservando el mismo ID/huella y evitando emitir una segunda factura.
- Registrar cada intento como evidencia separada.
- Respetar el tiempo de espera/control de flujo comunicado por AEAT.
- Error de validación del XML/datos: no reintentar en bucle; clasificar, corregir el defecto del generador y aplicar el procedimiento permitido sin mutar el registro original.
- Incidencia técnica excepcional: seguir facturando si el resto del sistema está disponible, conservar los registros y remitir periódicamente con el indicador de incidencia correspondiente.

## 5. Decisiones técnicas aún no aprobadas

| ID | Decisión | Recomendación | Bloqueo |
|---|---|---|---|
| ADR-VF-01 | Presentador | Titular o gestoría con representación válida; no acoplar al software | Identidad/representación real |
| ADR-VF-02 | Custodia certificado | Custodio designado por titular; certificado cualificado vigente y autorización acreditada | No hay certificado ni custodio confirmado |
| ADR-VF-03 | Gateway de remisión | Servicio backend aislado si Wix no permite custodiar/usar el certificado de forma segura | Spike de capacidades Wix y revisión de seguridad |
| ADR-VF-04 | Persistencia de respuesta | Evidencia append-only, separada del ledger fiscal | Reconciliación esquema/colecciones CMS |
| ADR-VF-05 | Alcance SIF | Un único SIF interconectado para TPV/online si todos generan lógica fiscal centralizada | Mapa completo de emisores y series |
| ADR-VF-06 | Wix Invoices V1 | No utilizar como emisor paralelo hasta aclarar su uso efectivo y su conformidad | Confirmar si emite facturas actualmente |
| ADR-VF-07 | Calendario obligatorio | 01-01-2027 si contribuyente IS; 01-07-2027 en otro caso del art. 3.1 | Confirmar forma jurídica/tributación |

## 6. Plan de ejecución

### Sprint 0 — Cierre de requisitos (sin escrituras)
1. Confirmar el sujeto obligado y fecha legal aplicable.
2. Identificar todas las facturas emitidas y su SIF de origen.
3. Confirmar si Wix Invoices V1 se usa para emitir facturas o solo está instalada.
4. Obtener matriz fiscal aprobada por gestoría: régimen, operación, IVA/exención, series, tipos F1/F2/R*, rectificativas y destinatarios.
5. Obtener identificación oficial del productor, nombre/versionado del SIF, instalación y declaración responsable correspondiente.
6. Definir presentador, representación y custodia del certificado.

### Sprint 1 — Núcleo puro y pruebas offline
1. Obtener y versionar los WSDL, XSD, diseños de registro, validaciones y ejemplos oficiales actuales.
2. Implementar builders puros separados para alta y anulación.
3. Implementar el cálculo de huella exacto por tipo de registro.
4. Generar XML y validarlo contra XSD antes de cualquier red.
5. Añadir pruebas con vectores AEAT, campos opcionales, zona horaria Europe/Madrid, redondeos, series, anulaciones y concurrencia.
6. No cambiar los writers de producción hasta que los builders nuevos pasen y se haya aprobado la estrategia de transición.

### Sprint 2 — Persistencia y outbox recuperable
1. Diseñar los registros de envío/intent/respuesta sin mutar el ledger.
2. Probar fallo entre append fiscal y creación de señal de despacho.
3. Crear reconciliador que descubra registros persistidos pendientes de envío.
4. Garantizar deduplicación por registro fiscal y reintentos sin nueva factura.
5. Pruebas de carrera entre `cajas.web.js` y `eventLog.js`.

### Sprint 3 — Gateway y entorno externo AEAT
1. Validar en un spike si el backend Wix soporta el transporte y autenticación requeridos de forma segura.
2. Si no, elegir un gateway controlado por el titular con custodia de certificado en almacén de claves adecuado; no se elige proveedor en este ADR.
3. Implementar SOAP conforme al WSDL y procesar Fault, estados globales, estados individuales, CSV y control de flujo.
4. Ejecutar pruebas en el portal externo de AEAT; nunca usar datos de clientes reales en pruebas.
5. Probar pérdida de respuesta, timeout, indisponibilidad, respuesta parcial, duplicado, certificado expirado/revocado y recuperación.

### Sprint 4 — Activación controlada
1. Revisión legal/gestoría y declaración responsable del sistema/versión.
2. Aprobación escrita del titular para iniciar remisiones reales.
3. Configuración fiscal CMS validada y respaldada.
4. Canary de facturas de prueba únicamente en el entorno de pruebas AEAT; producción solo con autorización.
5. Conciliación diaria de facturas expedidas frente a registros remitidos y aceptados.
6. Procedimiento de incidencia, soporte y continuidad.
7. Activación productiva en ventana aprobada y monitorización posterior.

## 7. Criterios de aceptación P0

- No hay factura expedida por el SIF objetivo sin registro de alta correspondiente.
- Todos los registros de alta/anulación cumplen XSD y huella oficial.
- Todos los registros del SIF se remiten conforme a la modalidad VERI*FACTU.
- Las respuestas se correlacionan con el registro exacto y se conservan.
- El reintento de un envío sin respuesta no crea un segundo registro ni factura.
- La incidencia técnica usa el indicador y cadencia establecidos por AEAT.
- La cadena se mantiene bajo concurrencia entre todos los módulos del SIF.
- No se mutan ni eliminan registros fiscales previos.
- El QR y leyenda se generan según la modalidad y el estado exigido por la especificación aplicable; no se considera enviado/aceptado por el mero hecho de generar el QR.
- La declaración responsable y la identificación del SIF/versión están disponibles.
- Titular y asesoría fiscal aprueban el resultado y la fecha de activación.

## 8. Validación de esta ADR

- **Verificado:** código y consumidores de los dos writers; contexto live de Wix (Invoices V1, Stores Catalog V1); ausencia de cliente de remisión AEAT en el repositorio auditado.
- **Verificado documentalmente:** modalidad VERI*FACTU no exige firma individual de registros ni registro de eventos NO VERI*FACTU; requiere remisión de registros de facturación; hash SHA-256 para altas/anulaciones; incidencias y reintentos; representación de terceros y plazos generales.
- **Inferido / recomendación:** gateway aislado, persistencia separada de respuesta y patrón de reconciliación por falta de atomicidad documentada.
- **Pendiente:** prueba técnica de capacidades TLS/certificado de Wix, esquema CMS exacto, declaración responsable, certificado, representación, clasificación fiscal, tipo de contribuyente y E2E AEAT.
- **No realizado:** cambios de código funcional, escrituras CMS, envío AEAT, emisión de facturas reales, adquisición/carga de certificados o despliegue.

## 9. Fuentes Wix consultadas

- Wix Data API — introducción: https://dev.wix.com/docs/api-reference/business-solutions/cms/introduction
- Wix Data Items — Bulk Save: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-save-data-items
- Wix Data Items — Bulk Patch: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items
- Wix Data Items — Bulk Update: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-update-data-items

La documentación consultada describe operaciones de datos por colección y no se ha identificado una garantía de transacción atómica entre `MovimientosCaja` y otra colección. La ausencia de esa garantía en esta consulta no prueba que no exista ninguna capacidad alternativa; debe verificarse antes de cerrar el diseño.
