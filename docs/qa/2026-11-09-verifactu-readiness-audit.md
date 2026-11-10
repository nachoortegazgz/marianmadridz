# Auditoría de preparación VERI*FACTU — 2026-11-09

## 1. Objetivo y alcance

Determinar si el SIF propio de Marian Madrid está preparado para operar en modalidad VERI*FACTU conforme al RD 1007/2023, la Orden HAC/1177/2024 y las especificaciones técnicas vigentes publicadas por la AEAT.

Esta auditoría es estática sobre el código de `main` después de integrar PR #205, #206 y #207. No se han enviado registros a la AEAT, no se han alterado datos CMS, no se han creado facturas ni se han utilizado certificados reales.

## 2. Conclusión ejecutiva

**Estado: NO APTO PARA ACTIVAR VERI*FACTU.**

La modalidad solicitada queda establecida como VERI*FACTU, pero el repositorio no contiene un flujo de remisión SOAP operativo a la AEAT. La presencia de QR, hashes internos y firma externa no acredita por sí sola la modalidad VERI*FACTU.

No se debe activar `verifactuEnabled`, cambiar la URL QR ni emitir la leyenda «VERI*FACTU» hasta superar las fases de implementación y pruebas de conformidad descritas aquí.

## 3. Evidencia verificada en código

### 3.1 Writers fiscales identificados

- `src/backend/cajas.web.js`: `registerManualTransaction` genera secuencia, `previousRecordHash`, `aeatPayload`, hash SHA-256, firma externa y QR; inserta el movimiento en `MovimientosCaja`.
- `src/backend/eventLog.js`: `registrarEventoEconomico` genera secuencia global, cadena/hash y snapshot fiscal; inserta el movimiento en `MovimientosCaja`.
- `src/backend/crons.js` y `src/backend/jobs.config`: hay tareas de mantenimiento, cierre Z y reconciliación, pero no un job de remisión AEAT.
- `src/backend/mmSecrets.js`: hay secretos de firma fiscal externa (`FISCAL_SIGNER_ENDPOINT`, `FISCAL_SIGNER_BEARER`) y clave fiscal; no se identifica configuración de certificado cualificado, almacén PKCS#12 o proveedor de firma TLS para AEAT.

### 3.2 No existe transporte de remisión AEAT

Búsqueda de código en el repositorio para operaciones y estructuras del servicio oficial (`SuministroLRFacturasEmitidas`, `RegistroAlta`, `SuministroLR`) sin resultados. Las únicas referencias de runtime a AEAT localizadas son la construcción del QR y la construcción de payload/hash. La llamada HTTP `fetch()` localizada en `cajas.web.js` corresponde al microservicio de firma externo, no a AEAT.

Por tanto, no hay evidencia de:
- Cliente SOAP 1.1 / HTTPS para remisión voluntaria VERI*FACTU.
- Serialización XML conforme al XSD AEAT.
- Autenticación mediante certificado electrónico cualificado.
- Lectura y persistencia de la respuesta síncrona, CSV, estado global, estado por registro, códigos de error y `TiempoEsperaEnvio`.
- Cola de reintentos de remisión y control de flujo AEAT.

### 3.3 Divergencias en el cálculo de huella

La especificación oficial AEAT para un registro de alta define exactamente estos campos, en este orden:

1. `IDEmisorFactura`
2. `NumSerieFactura`
3. `FechaExpedicionFactura`
4. `TipoFactura`
5. `CuotaTotal`
6. `ImporteTotal`
7. `Huella` (huella del registro anterior)
8. `FechaHoraHusoGenRegistro`

La cadena se concatena como `nombre=valor&...`, codificada en UTF-8, y el resultado SHA-256 se expresa en hexadecimal mayúsculo de 64 caracteres.

Hallazgos:
- El builder de `cajas.web.js` usa `BaseImponibleOImporteNoSujeto` y `CuotaRepercutida` en el string de huella en lugar de `CuotaTotal`; no coincide con los ocho campos de entrada oficiales.
- El builder de `eventLog.js` incorpora los ocho campos base, pero añade campos opcionales como NIF/nombre del destinatario, referencia bancaria, retenciones y otros datos al string de huella. La especificación de huella de alta limita la entrada a los ocho campos enumerados; esos extras no deben incorporarse al string.
- Los dos writers no comparten un builder canónico único, por lo que pueden producir huellas distintas para un mismo documento lógico.
- El campo `aeatPayload` se transforma a `payloadFiscal.aeatPayload` en `data.js`; debe reconciliarse con el esquema CMS y la matriz canónica antes de modificar persistencia.

**Acción requerida:** diseñar un único builder puro y testeable que produzca el string oficial exacto y un objeto XML separado. No migrar ni recalcular hashes históricos; cualquier corrección solo afectará a nuevos registros tras una decisión de transición y pruebas de regresión.

### 3.4 Firma local y modalidad VERI*FACTU

`registerManualTransaction` exige la firma de un microservicio externo y devuelve `PARTIAL`/recovery si no está disponible.

La AEAT establece que VERI*FACTU no requiere firma electrónica individual de cada registro. La autenticación del envío se realiza mediante certificado cualificado. La firma externa actual no sustituye esa autenticación y no debe confundirse con ella.

**Acción requerida:** decidir si la firma actual se mantiene como control interno adicional o se desacopla del camino crítico VERI*FACTU. No eliminarla ni cambiar el comportamiento sin revisar consumidores, contratos, idempotencia y pruebas.

### 3.5 Configuración fiscal incompleta en CMS

La consulta de solo lectura realizada el 2026-11-09 identificó:
- Una fila legacy `TERCERO/EMISOR`.
- Ningún singleton `CONFIG_SISTEMA`.
- `taxRegime`, `verifactuEnabled`, `verifactuVersion` y `fechaInicioVerifactu` vacíos/null.

No se consultaron ni se incorporaron NIF ni datos personales en esta auditoría. No se ha escrito nada en CMS.

El fallback legacy de emisor no sustituye la configuración de sistema requerida para generar los datos de identificación del SIF en el XML AEAT.

### 3.6 QR

`_generateVerificationQR` en `cajas.web.js` construye la URL de VERI*FACTU `ValidarQR`. Esto no demuestra que el registro se haya remitido ni aceptado por AEAT. El QR debe generarse con los datos y endpoint coherentes con el modo operativo real y con el diseño AEAT vigente.

No modificar el endpoint hasta validar XML, envío, respuesta y configuración de modalidad.

### 3.7 Consumidores y coexistencia con Wix Invoices

Mapa de consumidores localizado mediante búsqueda del repositorio:
- `src/backend/events.js` llama a `registrarEventoEconomico` para ventas de pedidos (`EVENT_TYPE.VENTA_LINEA`) y devoluciones/rectificativas (`EVENT_TYPE.RECTIFICATIVA`).
- `src/pages/ZONA MARIAN.gn7mx.js` llama a `registerManualTransaction` para operaciones TPV.
- `src/backend/cajas.web.js` contiene además un wrapper que vuelve a llamar a `registerManualTransaction` para movimientos de venta online.
- No se localizó llamada de código a una operación `createInvoice` ni integración runtime con Wix Invoices.

Contexto live de Wix obtenido el 2026-11-09:
- Sitio publicado y Velo habilitado.
- Wix Invoices instalada en versión V1.
- Wix Stores instalada en Catalog V1.

Consecuencia: el SIF propio y Wix Invoices V1 coexisten como sistemas instalados, pero la auditoría no acredita que Wix Invoices emita facturas ni que esté integrada con el ledger propio. Antes de activar VERI*FACTU debe documentarse qué sistema expide legalmente cada factura, qué series utiliza, qué SIF la genera y si las facturas de Wix Invoices se excluyen, se sincronizan o constituyen un SIF independiente. No asumir que la mera instalación de Wix Invoices equivale a emisión efectiva.

## 4. Requisitos técnicos oficiales relevantes

Fuente AEAT: documento «Sistemas Informáticos de Facturación — Remisión voluntaria», versión 1.0.3 (28-07-2025).

- Transporte: HTTPS, Web Service SOAP 1.1, estilo document/literal, XML UTF-8.
- Autenticación: certificado electrónico cualificado reconocido.
- Respuesta: síncrona; debe procesarse tanto el resultado global como el de cada registro.
- Estados globales: `Correcto`, `ParcialmenteCorrecto`, `Incorrecto`.
- Estados por registro: `Correcto`, `AceptadoConErrores`, `Incorrecto`.
- CSV de la presentación y marca temporal de presentación deben conservarse.
- El sistema debe respetar `TiempoEsperaEnvio` recibido de AEAT como control de flujo.
- Si no se recibe respuesta o hay fallo transitorio del servidor/transmisión, debe reintentarse el mismo mensaje; errores de cliente requieren corregir el XML/datos antes de reenviar.
- Límite técnico documentado: hasta 1.000 registros por envío.

La AEAT indica que los registros de alta/anulación deben conservar el encadenamiento y que la anulación no borra el alta anterior.

## 5. Plan de implementación por fases

### Fase A — Contrato fiscal y modelo de datos (bloqueante)
1. Reconciliar esquema CMS real de `MovimientosCaja` y `DatosFiscales` con los campos AEAT.
2. Determinar si el SIF propio genera únicamente facturas F1/F2 o también documentos que no son factura. La norma SIF afecta a facturas expedidas, no a cualquier movimiento económico por defecto.
3. Definir una única identidad de SIF: nombre, NIF productor, identificador, versión, número de instalación, flags de uso, NIF del obligado y versión de esquema.
4. Formalizar series y secuencia global por SIF; revisar si el Wix Invoices V1 o cualquier otro sistema emite facturas en paralelo para el mismo obligado.
5. Aprobar la configuración fiscal (régimen, clave de régimen, clasificación de operación, exenciones y tipos impositivos) con gestoría.

### Fase B — Núcleo de conformidad (código + pruebas)
1. Builder puro del registro de alta y del registro de anulación según XSD vigente.
2. Builder de huella conforme a los ocho campos oficiales, con pruebas de vectores AEAT.
3. XML SOAP 1.1 document/literal con namespaces y orden de elementos validados por XSD.
4. Parser robusto de respuestas SOAP/Fault, CSV, estado global, respuesta por registro, códigos y control de flujo.
5. Estados por registro persistidos sin sobrescribir el contenido fiscal original: pendiente, enviado, aceptado, aceptado con errores, rechazado, reintento pendiente.
6. Outbox transaccional e idempotente: el registro fiscal se conserva aunque el envío falle; cada intento guarda trazabilidad y respuesta, sin duplicar el alta.
7. Reintentos periódicos para fallos de red/servidor; no reintentar ciegamente errores de cliente.
8. Gestión append-only de anulaciones y rectificaciones según la operativa AEAT.

### Fase C — Certificado y seguridad
1. Acordar con el titular/gestoría quién será el presentador: obligado, apoderado o colaborador social.
2. Definir dónde reside el certificado cualificado y cómo se realiza mTLS/autenticación sin exponer claves en Wix ni en frontend.
3. Revisar si el runtime Wix soporta el mecanismo requerido; si no, usar un servicio backend controlado y aprobado, con contrato, cifrado, rotación y auditoría.
4. Probar caducidad, revocación, errores de certificado y recuperación.
5. No almacenar certificados privados ni contraseñas en CMS.

### Fase D — Pruebas y activación
1. Pruebas unitarias con ejemplos y XSD oficiales.
2. Pruebas contractuales contra entorno externo de pruebas AEAT.
3. Pruebas de aceptación/rechazo parcial, duplicado, indisponibilidad, timeout y respuesta perdida.
4. Verificación de continuidad de cadena bajo concurrencia entre ambos writers.
5. E2E de facturación de prueba y cotejo QR en entorno AEAT de pruebas.
6. Validación del titular/gestoría y aprobación de activación.
7. Solo entonces configurar el singleton fiscal y activar VERI*FACTU para nuevos registros. No reescribir históricos.

## 6. Riesgos P0/P1

| ID | Hallazgo | Riesgo | Prioridad |
|---|---|---|---|
| VF-01 | No existe envío SOAP AEAT | No se acredita modalidad VERI*FACTU | P0 |
| VF-02 | Huella divergente entre writers y especificación | Rechazo AEAT / cadena no conforme | P0 |
| VF-03 | No hay certificado cualificado ni autenticación de remisión configurada | Imposibilidad de remitir | P0 |
| VF-04 | Singleton CONFIG_SISTEMA ausente | XML SIF incompleto/no fiable | P0 |
| VF-05 | Firma externa es requisito del writer aunque VERI*FACTU no la exige | Bloqueo operativo por dependencia no normativa | P1 |
| VF-06 | Sin estados/CSV/respuesta AEAT persistidos | Falta de prueba de presentación y recuperación | P0 |
| VF-07 | Alcance factura vs movimiento económico no formalizado | Envíos indebidos o facturas omitidas | P0 |
| VF-08 | Identidad/series de Wix Invoices V1 vs ledger propio sin reconciliación probada | Doble SIF o series/cadenas incoherentes | P0 |

## 7. Criterios de aceptación

No declarar VERI*FACTU operativo hasta que:
- Cada factura expedida por este SIF produzca un registro de alta válido conforme al XSD.
- La huella coincida con los vectores oficiales AEAT.
- El registro se remita con certificado cualificado y se procese la respuesta.
- Se conserve CSV, timestamp, estado por registro y trazabilidad del intento.
- Los reintentos no dupliquen registros ni bifurquen la cadena.
- Las anulaciones/rectificaciones sigan la operativa AEAT y sean append-only.
- El QR y leyenda de factura correspondan a la modalidad efectiva.
- Gestoría/titular aprueben configuración fiscal y pruebas.

## 8. Fuentes oficiales

- AEAT — Información técnica SIF/VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html
- AEAT — Remisión voluntaria, versión 1.0.3: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica/especificaciones-servicios-remision-voluntaria-registros-validaciones.html
- PDF técnico AEAT — Sistemas Informáticos de Facturación, versión 1.0.3: https://sede.agenciatributaria.gob.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
- AEAT — Especificación de huella/hash: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica/algoritmo-calculo-codificacion-huella-hash.html
- PDF AEAT — Especificaciones de huella: https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf
- AEAT — FAQ Sistemas VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/sistemas-verifactu.html

## 9. Estado de validación y limitaciones

- **Verificado:** búsqueda estática del repositorio y lectura de los writers, configuración, secretos y jobs.
- **Verificado:** PR #205 integrada en `main`; las auditorías documentales #206 y #207 también integradas.
- **Pendiente:** CI de esta auditoría documental.
- **Pendiente:** validación XSD y entorno de pruebas AEAT.
- **Pendiente:** acceso/configuración de certificado cualificado y definición de presentador.
- **Pendiente:** revalidación live de CMS y aprobación de configuración fiscal.
- **No realizado:** escrituras CMS, remisiones AEAT, emisión de facturas reales, cobros, cambios de endpoint QR o despliegue.

Esta auditoría no constituye certificación legal del software ni sustituye la validación de la gestoría o del responsable del SIF.

## 10. Aclaraciones normativas verificadas el 2026-11-09

La revisión de la FAQ oficial AEAT actualizada en octubre de 2026 precisa los siguientes puntos, que condicionan el diseño:

- En VERI*FACTU deben calcularse huellas SHA-256 para todos los registros de facturación de alta y anulación. Los registros de evento normativos son exigibles a NO VERI*FACTU, no a VERI*FACTU. Los eventos económicos internos del dominio Marian Madrid no deben confundirse con esos registros normativos.
- VERI*FACTU no exige firma electrónica individual de los registros de facturación. La firma actual del proveedor externo puede mantenerse voluntariamente como control interno, pero no es sustituto de la autenticación del presentador/remisión.
- En una incidencia técnica que impida remitir, la AEAT indica que no debe detenerse la facturación por ese solo motivo: se conserva el registro, se reintenta periódicamente y se utiliza el indicador de incidencia exigido (campo `Incidencia` con valor `S` cuando corresponda).
- Si no se recibe respuesta a un envío, deben remitirse de nuevo los registros hasta obtenerla. El reintento debe conservar la identidad del registro y no generar una factura nueva.
- Un SIF VERI*FACTU remite todos los registros de facturación de las facturas que expide. Si módulos están interconectados y centralizados, comparten encadenamiento único; módulos realmente inconexos pueden ser SIF diferentes y deben cumplir individualmente.
- La opción VERI*FACTU se entiende realizada tácitamente al iniciar sistemáticamente la remisión. Una vez iniciado el envío efectivo, existe permanencia mínima hasta el fin del año natural en los términos del artículo 16.5 RRSIF.
- La representación puede recaer en el obligado tributario o en un tercero con representación válida. La colaboración social requiere la documentación normalizada aplicable; la mera relación contractual con una gestoría o proveedor no basta por sí sola.
- RD-ley 15/2025 modificó la fecha de aplicación obligatoria: antes del 01-01-2027 para contribuyentes del Impuesto sobre Sociedades y antes del 01-07-2027 para el resto de obligados del artículo 3.1. Debe confirmarse qué fecha corresponde al obligado concreto; no inferirlo del nombre comercial.

Fuentes oficiales:
- AEAT FAQ VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/sistemas-verifactu.html
- AEAT FAQ huella/hash: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/huella-hash.html
- AEAT FAQ colaboración social: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/colaboracion-social.html
- BOE RD-ley 15/2025: https://www.boe.es/eli/es/rdl/2025/12/02/15

## 11. Estado de validación actualizado

- **Verificado:** auditoría estática de los writers y consumidores; consulta live de Wix site context; revisión de documentación AEAT actualizada; revisión de Wix Data API.
- **Verificado:** el repositorio sigue sin cliente AEAT de remisión; PR #208 incorpora auditoría y ADR de arquitectura.
- **Inferido/recomendado:** separar persistencia fiscal y estado de transporte; reconciliación recuperable por ausencia de transacción multi-colección documentada; gateway desacoplado del custodio.
- **Pendiente:** CI de PR #208; spike de autenticación TLS/certificado en Wix; esquema CMS exacto y diseño de persistencia; forma jurídica/tributación del obligado; representante y certificado; matriz fiscal; declaración responsable y E2E AEAT.
- **No realizado:** escrituras CMS, remisiones AEAT, facturas reales, cobros, carga de certificados, modificación funcional o despliegue.


## 12. Actualización de separación de contratos — 2026-11-10

PR #250 incorpora `src/backend/aeatHash.js`, un builder puro AEAT v0.1.2 con vectores oficiales para `RegistroAlta` y `RegistroAnulacion`. La suite `aeatHash.contract.test.mjs` valida cinco casos. **Este helper continúa deliberadamente sin consumidores runtime**: no se ha conectado a los writers ni se han recalculado registros históricos.

La revisión de los dos writers confirma que sus funciones locales construyen un payload de cadena fiscal interna y lo pasan a `securityEngine.hashChain()`:

- `cajas.web.js`: `_buildInternalFiscalChainPayload` + `_computeInternalFiscalChainHash`; su contenido incluye campos no pertenecientes a la entrada oficial AEAT de alta.
- `eventLog.js`: `_buildInternalFiscalChainPayload`; contiene los ocho campos base, pero también campos de dominio adicionales que no pertenecen a la entrada oficial de huella.
- Ambos siguen usando la cadena interna del proyecto; ninguno invoca `computeAeatAltaHash` ni `computeAeatAnulacionHash`.

La propiedad persistida `aeatPayload` se conserva por compatibilidad con el hook de `data.js`, que la mueve a `payloadFiscal.aeatPayload`. Su nombre histórico no acredita que el contenido sea el input oficial AEAT. La nueva nomenclatura de las funciones privadas evita confundir la cadena interna con la huella de conformidad.

El cambio de nomenclatura no modifica el orden, contenido ni serialización del payload, el algoritmo `hashChain`, las firmas, los hashes almacenados ni los registros CMS. No se han hecho escrituras ni remisiones AEAT.

**Decisión vigente:** no conectar el helper oficial hasta resolver SIF emisor, series y transición de cadena, mapa de campos de cada writer, XML/XSD y aprobación legal. La huella AEAT correcta en un vector unitario no certifica el sistema completo.
