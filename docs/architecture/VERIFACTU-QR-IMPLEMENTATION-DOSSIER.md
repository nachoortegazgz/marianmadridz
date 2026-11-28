# Dossier técnico — VERI*FACTU, facturación y QR tributario en tickets

**Proyecto:** Marian Madrid · Wix Classic + Velo  
**Fecha de revisión normativa:** 2026-11-28  
**Estado:** DISEÑO TÉCNICO Y NORMATIVO DOCUMENTADO · IMPLEMENTACIÓN NO ACREDITADA  
**Ámbito:** facturas completas y simplificadas emitidas por el TPV / sistema de facturación del negocio  
**Autoridad:** BOE y especificaciones oficiales AEAT; la asesoría fiscal debe confirmar el encaje tributario concreto.

> Este documento no certifica el sistema ni sustituye un dictamen de asesoría. Distingue normativa vigente, especificaciones técnicas oficiales, propuesta de ingeniería y estado real del proyecto. No se debe declarar VERI*FACTU operativo hasta superar pruebas y acreditar la remisión efectiva a AEAT.

## 1. Resumen ejecutivo y decisión técnica

El proyecto necesita un **único proceso de emisión de facturas** que abarque la venta, el registro fiscal, la representación impresa/digital y, cuando se elija VERI*FACTU, la remisión automática a AEAT. No basta con añadir una imagen QR al ticket.

La recomendación de arquitectura es:

1. Mantener Wix Classic + Velo como interfaz y orquestador del TPV, con lógica y autorización en backend.
2. Designar un único SIF responsable de expedir las facturas, asignar serie/número, generar registros de facturación y mantener su trazabilidad.
3. Preferir la modalidad VERI*FACTU para reducir la carga de controles propios de la modalidad no verificable, siempre que se confirme el encaje legal y se complete la integración técnica con AEAT.
4. Si el backend Velo no puede acreditar el cumplimiento integral y la declaración responsable del SIF, integrar un proveedor de facturación/SIF que sí pueda asumir contractualmente esa función. Wix Invoices, Wix Payments, un TPV o un generador de QR no deben considerarse conformes por su mera disponibilidad.
5. Conservar en Wix CMS las entidades propias y proyecciones necesarias, sin duplicar la autoridad fiscal del SIF elegido. La factura emitida y sus registros no se editan ni eliminan; las correcciones se realizan con documentos/registros rectificativos enlazados.

**No se debe iniciar un desarrollo de QR aislado que luego haya que rehacer.** Primero se define el contrato de factura y del registro AEAT; después se genera el QR a partir de los datos definitivos de esa factura.

## 2. Normativa y calendario vigentes a 28-11-2026

### 2.1 Normas principales

- **Ley 58/2003, General Tributaria**, artículo 29.2.j: requisitos generales de integridad, conservación, accesibilidad, legibilidad, trazabilidad e inalterabilidad de los registros.
- **Real Decreto 1007/2023**, Reglamento de requisitos de los sistemas informáticos de facturación (RRSIF): ámbito, características del SIF, registros de alta/anulación, modalidades VERI*FACTU y no verificable.
- **Real Decreto 1619/2012**, Reglamento de obligaciones de facturación (ROF), especialmente artículos 6.5 y 7.5: QR tributario en las facturas completas y simplificadas emitidas por los SIF afectados y mención VERI*FACTU solo en la modalidad correspondiente.
- **Orden HAC/1177/2024**, de 17 de octubre: especificaciones técnicas, funcionales y de contenido; estructura de registros, remisión, huellas, eventos, QR y declaraciones responsables.
- **Real Decreto 238/2026** y **Orden HAC/1028/2026**: marco de factura electrónica B2B y cómputo de sus plazos.
- **Real Decreto-ley 43/2026**, de 24 de noviembre, publicado el 25-11-2026 y en vigor desde el 26-11-2026: modifica la disposición final cuarta del RD 1007/2023 y desplaza el plazo de adaptación de los obligados del artículo 3.1 al transcurso del plazo del artículo 238/2026, DF 4.1.b.

### 2.2 Fecha límite de adaptación

La Orden HAC/1028/2026 entró en vigor el **06-10-2026**. El RD 238/2026 establece 24 meses desde la entrada en vigor de dicha orden para el resto de empresarios y profesionales (DF 4.1.b). El RDL 43/2026 remite a ese plazo para los obligados tributarios del artículo 3.1 del RD 1007/2023.

**Cómputo resultante: 06-10-2028**, sujeto a que Marian Madrid esté incluida en el ámbito subjetivo y no concurra exclusión o régimen especial. No reutilizar como calendario vigente las fechas históricas 01-01-2027 / 01-07-2027 del texto anterior del RD 1007/2023.

La fecha legal no es una razón para posponer el trabajo: el proyecto prevé su despliegue durante 2027 y debe llegar con el proceso probado antes de emitir facturas reales. Revalidar BOE/AEAT antes del release porque el marco puede volver a modificarse.

### 2.3 Aplicabilidad al negocio: verificación pendiente

La AEAT delimita el ámbito por el uso de un SIF para expedir facturas y contempla exclusiones, entre ellas los obligados incluidos en el SII y determinados supuestos territoriales o de exoneración. La falta de obligación de expedir factura también puede excluir la operación concreta.

Antes de cerrar el diseño fiscal, la asesoría debe confirmar documentalmente:
- Identidad jurídica y NIF del obligado emisor, domicilio fiscal y territorio tributario.
- Régimen de IVA y posible inclusión en SII u otro régimen/exclusión.
- Si Marian Madrid está en territorio común (AEAT) o bajo normativa foral.
- Qué operaciones se documentan mediante factura completa, simplificada o justificante no-factura.
- Si el desarrollo propio de un SIF para uso interno implica obligaciones adicionales como productor del sistema y quién firma la declaración responsable.

No inventar NIF, razón social, domicilio, serie ni régimen fiscal. Configuración fiscal ausente o inválida debe producir error detallado; no rellenarse con valores ficticios.

## 3. Qué documento debe llevar el QR

El reglamento se aplica a los sistemas utilizados para expedir **facturas**, tanto completas como simplificadas. La AEAT aclara que no afecta por ese solo hecho a otros justificantes mercantiles que no sean facturas.

| Documento que sale del TPV | ¿QR tributario RRSIF? | Criterio |
|---|---|---|
| Factura simplificada válida (ticket-factura) emitida por el SIF | Sí, si el emisor/operación está dentro del ámbito | El ticket debe cumplir también el ROF y llevar el QR tributario |
| Factura completa impresa o digital emitida por el SIF | Sí, si está dentro del ámbito | QR según especificación; en factura electrónica puede sustituirse por los datos que representa |
| Justificante de pago / copia de tarjeta / recibo de caja que no sea factura | No por el mero hecho de ser un justificante | No presentarlo como factura ni añadir un QR que aparente verificación tributaria |
| Confirmación de reserva, presupuesto o proforma | No | No es factura expedida; el borrador/proforma no lleva QR |
| Factura rectificativa | Debe seguir su régimen de factura y registro correspondiente | No editar la factura original; emitir el documento y registro rectificativos que procedan |

**Importante para Marian Madrid:** el papel que imprime la Epson debe clasificarse en backend como factura simplificada o como justificante no-factura. El botón «Imprimir ticket» no puede decidir por sí solo la naturaleza fiscal. La posibilidad de expedir factura simplificada y sus menciones obligatorias debe validarse con la asesoría según el servicio, importe y circunstancias concretas.

La factura proforma/borrador no lleva QR. Cuando la factura queda definitivamente expedida, no se puede volver a tratar como borrador ni alterar los datos que forman el registro de alta; cualquier corrección requiere los nuevos registros/documentos previstos en la normativa.

## 4. Modalidades admitidas: VERI*FACTU y no verificable

El RRSIF contempla dos modalidades:

### 4.1 VERI*FACTU

- El SIF remite a AEAT todos los registros de facturación generados, por medios electrónicos, de forma continuada, segura, correcta, íntegra, automática, consecutiva, instantánea y fehaciente.
- Se debe implementar la comunicación máquina a máquina, gestión de certificados/autenticación, XML, control de flujo, respuestas y códigos de validación.
- El sistema calcula la huella y encadena los registros conforme al diseño AEAT.
- No se exige la firma electrónica de cada registro en la modalidad VERI*FACTU, ni el registro de eventos adicional exigido a la modalidad no verificable, en los términos indicados por AEAT.
- La factura incluye QR y la mención «Factura verificable en la sede electrónica de la AEAT» o «VERI*FACTU».
- La opción por VERI*FACTU se entiende realizada al comenzar sistemáticamente la remisión y se prolonga, como mínimo, hasta el final del año natural en que se produjo el primer envío voluntario efectivo.

### 4.2 Sistema de emisión no verificable

No remite ordinariamente todos los registros a AEAT. Debe conservarlos y cumplir las exigencias adicionales del RRSIF: firma electrónica, registro de eventos, conservación, exportación, comprobación de huellas/encadenamiento y demás controles que resulten aplicables. También requiere QR en las facturas sujetas al reglamento, pero **no** debe imprimir la mención VERI*FACTU.

Esta modalidad tiene mayor carga de implementación y custodia. No se recomienda para este proyecto salvo decisión justificada tras análisis de costes y obligaciones.

### 4.3 Recomendación

Adoptar VERI*FACTU como objetivo funcional, condicionado a:
- confirmación de aplicabilidad por asesoría;
- identificación del SIF único;
- configuración fiscal real y certificado/representación válidos;
- integración contra los contratos oficiales AEAT;
- declaración responsable aplicable;
- pruebas externas y aprobación antes de activar envíos reales.

No seleccionar modalidad ni iniciar remisiones reales automáticamente por tener disponible un endpoint.

## 5. Especificación oficial del QR tributario

Fuente técnica AEAT: «Detalle de las especificaciones técnicas del código QR de la factura y de la URL del servicio de cotejo o remisión de información por parte del receptor», versión 0.5.0 consultada, junto con la página técnica AEAT. Antes de codificar, volver a descargar la versión publicada vigente y contrastarla con la Orden HAC/1177/2024 y sus cambios.

### 5.1 Requisitos gráficos

- Símbolo QR conforme a **ISO/IEC 18004:2015**.
- Tamaño físico entre **30 × 30 mm y 40 × 40 mm**.
- Corrección de errores **nivel M**.
- Contraste suficiente entre módulos oscuros y fondo claro.
- Zona blanca libre alrededor: mínimo **2 mm** en cada lado; recomendado **6 mm**.
- Situación preeminente, normalmente al principio de la factura, separado de otros QR.
- Texto inmediatamente anterior: **«QR tributario:»**.
- Si es factura VERI*FACTU, debajo del QR: **«Factura verificable en la sede electrónica de la AEAT»** o **«VERI*FACTU»**.
- Los textos deben ser legibles y de tamaño igual o superior al resto de los datos de la factura.
- Una factura de varias páginas incluye el QR una sola vez, en la primera página.

No diseñar el QR como elemento decorativo ni sustituirlo por un QR de pago, reseñas, web del salón o cita previa.

### 5.2 Datos y URL

La URL oficial de cotejo contiene cuatro parámetros obligatorios:
1. `nif`: NIF del obligado a expedir la factura.
2. `numserie`: serie + número que identifica la factura.
3. `fecha`: fecha de expedición en formato `DD-MM-AAAA`.
4. `importe`: importe total, punto como separador decimal, dos decimales; no separador de miles.

La serie+número admite hasta 60 caracteres ASCII imprimibles (32–126), según el documento técnico consultado. La URL debe codificarse correctamente con URL encoding y UTF-8. Caracteres como `&`, `#`, espacios y otros reservados no pueden concatenarse sin codificación.

La URL base cambia según modalidad:
- VERI*FACTU: servicio AEAT `ValidarQR`.
- No verificable: servicio AEAT `ValidarQRNoVerifactu`.
- Las URL de pruebas externas y producción son diferentes. Usar las que publique AEAT en la especificación vigente; no copiar ejemplos antiguos ni construir la ruta a mano.

El parámetro opcional `formato=json` es para integraciones del receptor y **no debe incorporarse al QR impreso**. El idioma es opcional y no modifica la identidad fiscal de la factura.

### 5.3 Datos fuente y consistencia

El QR se genera exclusivamente desde el registro inmutable de la factura ya expedida:
- NIF emisor configurado y validado.
- Serie/número definitivo asignado por backend.
- Fecha efectiva de expedición.
- Total final exacto, con precisión monetaria canónica.
- Modalidad SIF y endpoint AEAT correspondiente.

No generar el QR desde datos del navegador, un carrito todavía editable, el total mostrado en pantalla, una intención TPV o una proyección no conciliada. No permitir que el ticket impreso tenga un QR de otra factura, otro NIF, otro total o una fecha distinta.

## 6. Registro de facturación y comunicación AEAT

El QR es la representación para cotejo por el receptor. No sustituye el registro de facturación ni su remisión.

### 6.1 Registros y cadena

El SIF debe generar los registros de alta y, cuando proceda, de anulación con la estructura y reglas oficiales. La cadena debe seguir el diseño AEAT, incluyendo los datos de identificación y el encadenamiento del registro anterior. El hash interno actual del TPV no se puede reutilizar ni etiquetar como «hash AEAT» sin demostrar que coincide exactamente con el algoritmo, campos, normalización, orden y codificación oficial.

La integración debe implementar, usando artefactos oficiales vigentes:
- Esquemas XML/XSD y diseños de registro.
- WSDL/servicios web y contratos de autenticación.
- Algoritmo AEAT de cálculo de huella.
- Reglas de encadenamiento y orden temporal.
- Especificación de envío, control de flujo y tamaño de lotes.
- Documento de validaciones y catálogo de errores.
- Reglas de anulación/rectificación y relación con el registro original.
- Certificados y representación/apoderamiento admitidos.

### 6.2 Envío, respuesta y disponibilidad

AEAT indica que el envío VERI*FACTU es inmediato y automatizado. La Orden HAC/1177/2024 establece control de flujo: el intervalo inicial entre envíos es 60 segundos y puede ser actualizado por la respuesta AEAT. El sistema debe procesar íntegramente la respuesta y sus errores; una respuesta positiva de recepción no equivale por sí sola a validación fiscal completa del contenido.

Si existe una incidencia excepcional (corte de energía, fallo informático, conexión o servicio AEAT no disponible):
- no interrumpir automáticamente la facturación por el solo fallo de remisión;
- registrar la incidencia en el campo normativo correspondiente;
- conservar los registros pendientes;
- reintentar periódicamente, en orden temporal, hasta remitirlos;
- si se perdió la respuesta de un envío, repetirlo hasta obtener respuesta;
- nunca descartar un registro ni marcarlo como remitido sin acuse verificable.

Diseñar estados observables, por ejemplo: `CREATED`, `PENDING_SUBMISSION`, `SUBMITTING`, `ACCEPTED`, `ACCEPTED_WITH_WARNINGS`, `REJECTED`, `INCIDENT_PENDING_RETRY`, `RESPONSE_UNKNOWN`, `RECOVERY_REQUIRED`. Los nombres finales deben alinearse con el contrato AEAT y no sustituir sus códigos.

El SIF debe separar «registro generado», «mensaje transmitido», «respuesta recibida», «aceptación técnica» y «verificación/cotejo por QR». No reducirlos a un booleano `sent=true`.

### 6.3 Idempotencia y timeout incierto

- Clave de identidad: obligado emisor + serie + número + tipo de registro, complementada con los identificadores oficiales que defina el esquema.
- `transactionId` del proyecto enlaza la venta, pero no sustituye la identidad fiscal de factura ni los identificadores exigidos por AEAT.
- Antes de repetir una operación con respuesta incierta, recuperar estado y comprobar el resultado con los mecanismos oficiales disponibles. Si AEAT requiere repetir el envío, hacerlo según el protocolo y registrar cada intento.
- El registro fiscal original es append-only. No regenerar otro número de factura por fallo de impresión, QR o timeout de transporte.
- Una reimpresión utiliza el mismo documento y la misma URL QR, salvo que se haya emitido legalmente un nuevo documento rectificativo.
- Conservar XML exacto enviado, respuesta AEAT, timestamps, identificador de lote/correlación, hash y error normalizado, con minimización de PII y secretos.

## 7. Arquitectura propuesta en Marian Madrid

### 7.1 Separación de responsabilidades

| Componente | Responsabilidad | No debe hacer |
|---|---|---|
| Frontend TPV | Capturar interacción y mostrar resultado | Calcular impuestos definitivos, emitir factura o construir QR fiscal |
| Backend de ventas | Validar catálogo/precio/pago y consolidar hecho de venta | Declarar cobro sin evidencia del proveedor |
| Servicio de facturación/SIF | Asignar serie/número, expedir factura y generar registro de alta/anulación | Alterar facturas ya expedidas |
| Adaptador AEAT VERI*FACTU | Serializar XML, autenticar, remitir, procesar respuesta y reintentar | Cambiar el hecho económico original |
| Generador QR | Crear URL exacta y símbolo gráfico a partir de la factura final | Crear identidad fiscal, total o número |
| Renderizador de ticket | Componer factura/ticket y enviar a impresora | Modificar los datos fiscales del documento |
| Wix CMS / DAL | Guardar entidades propias, referencias y proyecciones reconciliables | Sustituir al SIF elegido o convertirse en un segundo emisor |
| Capa 3 | Observar, conciliar y exportar evidencias | Modificar factura, ledger o estado de AEAT |

### 7.2 Flujo de emisión propuesto

1. Backend recibe la orden de finalizar venta con `transactionId` obligatorio.
2. Recalcula precios, descuentos, bases, tipos/cuotas IVA y total desde fuentes autorizadas; valida el estado de pago conforme al contrato TPV.
3. Determina si corresponde factura completa, simplificada o justificante no-factura según reglas aprobadas.
4. El SIF asigna serie/número y fecha de expedición definitivos.
5. Genera registro de alta, calcula huella AEAT y encadena el registro anterior.
6. En modalidad VERI*FACTU, envía el registro a AEAT y procesa la respuesta según el contrato y el control de flujo. Las incidencias no eliminan la obligación de conservar y reintentar.
7. Construye URL QR usando exactamente NIF, serie+número, fecha y total del registro definitivo.
8. Genera QR nivel M y lo inserta en el documento con dimensiones, quiet zone, etiqueta y leyenda exigidas.
9. Renderiza/imprime el documento; guarda la referencia exacta del artefacto emitido y su estado.
10. Registra correlaciones entre venta, pago, factura, registro AEAT y ticket impreso. Capa 3 puede observar y conciliar después.

La secuencia concreta entre persistencia local, remisión y entrega debe cerrarse contra la Orden HAC/1177/2024 y el proveedor SIF elegido. No simular atomicidad entre Wix y AEAT.

### 7.3 Modelo de datos lógico

No crear colecciones antes de inspeccionar los esquemas, writers y consumidores existentes. El modelo lógico mínimo debe poder representar:

**Factura emitida**
- ID interno inmutable, emisor, serie, número, fecha, tipo de factura.
- Líneas, conceptos, cantidades, precios, descuentos, bases, tipos/cuotas, total y moneda.
- Referencia a venta/pedido/pago y `transactionId`.
- Estado documental, fecha de emisión y referencia a rectificativa/anulación.
- Snapshot fiscal exacto usado para emitir; no reconstruirlo desde el catálogo actual.

**Registro de facturación AEAT**
- Identificador y tipo de registro, timestamp de generación, datos estructurados normativos.
- Huella propia AEAT, huella anterior, versión de esquema/algoritmo.
- XML exacto, estado de remisión, intento, respuesta, códigos AEAT y correlación.
- Indicador de incidencia y recuperación cuando corresponda.

**Representación / impresión**
- URL QR exacta y modalidad de endpoint.
- Versión de especificación QR, nivel M, tamaño físico, checksum del artefacto.
- Estado de renderizado e impresión, número de reimpresiones y relación con la misma factura.
- No guardar datos personales extra ni el contenido completo del ticket en logs.

**Relaciones**
- `transactionId` enlaza TPV y operación económica.
- `invoiceId` identifica el documento emitido.
- Los identificadores oficiales AEAT identifican el registro/remisión.
- `traceId` solo aporta correlación técnica; no sustituye identificadores fiscales.

No utilizar `MovimientosCaja`, `CajaActual`, `HistoricoCierresZ`, `TransaccionesTPV` ni `ControlOperativo` como si fueran, por sí solos, el registro oficial de factura. Tampoco reutilizar `RegistroIntegracion` como ledger fiscal sin revisar su contrato.

### 7.4 Tratamiento de fallos: cero bloqueos silenciosos

- Datos fiscales obligatorios ausentes: error estable, causa, condición y corrección; no inventar NIF/serie/fecha.
- URL/QR inválido: no imprimir una factura como conforme sin QR; conservar la factura ya expedida y marcar `QR_RENDER_PENDING` para recuperación de la representación, sin crear otra factura.
- Impresora desconectada o papel agotado: mantener factura y registro; reimpresión del mismo documento.
- AEAT no disponible: registrar incidencia, conservar pendientes y reintentar en orden; no descartar ni declarar remitido.
- Timeout después del envío: estado `RESPONSE_UNKNOWN`; reconciliar/reintentar conforme a AEAT.
- Rechazo AEAT: persistir código/respuesta, clasificar corregible o terminal y generar tarea accionable. No modificar el registro original para hacerlo pasar.
- Persistencia local parcial: resultado `PARTIAL` / `RECOVERY_REQUIRED`, con log correlacionado; no devolver éxito completo.
- Log redactado: no incluir certificados, claves, tokens, NIF de cliente, emails, teléfonos ni payload fiscal completo.

La normalización solo puede transformar representaciones equivalentes permitidas por el contrato. No puede corregir importes, NIF, fechas, tipo impositivo o identidad fiscal por conjetura.

## 8. Impresión térmica Epson y diseño del ticket

La impresora Epson del proyecto debe verificarse por modelo exacto, ancho real de papel, ancho imprimible, resolución/DPI, driver y lenguaje de impresión. No se presupone que cualquier impresora térmica soporte una imagen QR con tamaño correcto.

Criterios:
- Reservar un área real de 30–40 mm para el QR, más la zona blanca periférica.
- El QR debe mantener cuadrícula nítida; evitar reescalado fraccional, compresión JPEG, suavizado o impresión en modo borrador.
- Usar negro sobre blanco, sin logotipo dentro del símbolo, sin inversión de colores y sin reducir quiet zone.
- Mantener «QR tributario:» antes del QR y, si procede, la mención VERI*FACTU debajo.
- Validar el QR en papel real, no solo en vista previa o PDF.
- Comprobar lectura con varios móviles y aplicaciones QR, con luz normal, ticket curvado, papel térmico y degradación razonable.
- Confirmar que el QR no queda cortado por el margen inferior ni por el corte automático.

**Riesgo de 58 mm:** el mínimo legal de 30 mm puede ser difícil de integrar con quiet zone y resto del ticket en impresoras estrechas. No reducirlo por diseño; medir el área imprimible y validar con el modelo real. En 80 mm suele haber más margen, pero debe probarse físicamente.

La impresora y el cajón portamonedas son periféricos de salida/caja. No son el SIF ni acreditan la expedición fiscal.

## 9. Pruebas y criterios de aceptación

### 9.1 Unitarias / contractuales

- Validación NIF emisor, serie+número, fecha y total.
- URL QR exacta para modalidad y endpoint de pruebas; URL encoding UTF-8 con caracteres reservados.
- Importe decimal con punto y dos decimales, sin separadores de miles.
- Límite de longitud de serie+número y caracteres permitidos.
- Golden tests de XML/XSD, orden/campos, huella AEAT y encadenamiento usando los vectores oficiales.
- Validaciones AEAT y mapeo de cada error a error estable interno.
- QR nivel M, dimensiones y zona blanca verificadas desde imagen generada.
- Factura proforma/borrador no genera QR ni registro de alta.
- Reimpresión conserva exactamente número, URL, QR y contenido de factura.
- Rectificación/anulación genera nuevos registros enlazados, sin editar el original.

### 9.2 Integración simulada

- Alta de factura simplificada y completa.
- Duplicado de solicitud con el mismo `transactionId`.
- Timeout antes de enviar, después de enviar y después de recibir respuesta.
- Respuesta AEAT perdida; reenvío ordenado según el contrato.
- Indisponibilidad temporal AEAT con marca de incidencia y cola durable.
- Respuesta aceptada, aceptada con avisos y rechazada.
- Fallo de QR/renderizado después de expedir factura.
- Fallo de impresora después de expedir y registrar factura.
- Reintentos concurrentes y dos cajas/usuarios emitiendo facturas simultáneamente.
- Persistencia parcial entre factura, registro, remisión y artefacto.

### 9.3 Pruebas externas AEAT y Runtime

1. Usar exclusivamente Portal de Pruebas Externas y datos sintéticos.
2. Validar XML, certificados de prueba y respuestas con los contratos publicados por AEAT.
3. Comprobar cotejo del QR en endpoint de pruebas.
4. Imprimir en la Epson real y escanear el ticket físico.
5. Ejecutar Wix Preview/Runtime con pagos y servicios externos interceptados; no realizar cobros reales.
6. La producción requiere configuración fiscal real, certificados/representación, aprobación de asesoría y autorización del propietario.
7. Registrar SHA, versión de esquemas, versión QR, entorno, evidencia, resultado y defectos.

**Criterio de aceptación:** ningún documento fiscal se declara emitido si faltan sus datos obligatorios; ningún QR se considera válido por el mero hecho de existir una imagen; ningún registro se declara remitido sin respuesta acreditada; todos los fallos quedan visibles y recuperables; las facturas emitidas permanecen inmutables.

## 10. Evaluación del estado actual del proyecto

**VERIFICADO / DOCUMENTADO**
- El sitio está en Wix Classic + Velo y continúa en Draft/no publicado según el estado del proyecto.
- Existe TPV propio y flujo de caja en evolución.
- Existe `eventLog.js::registrarEventoEconomico()` y ledger `MovimientosCaja`, pero el hash interno no se considera hash AEAT.
- El snapshot fiscal anterior no encontró configuración `CONFIG_SISTEMA_FISCAL` en la colección consultada.
- El dossier Capa 3 ya separa remisión AEAT de exportación documental a SharePoint.
- La AEAT publica diseños de registro, WSDL, esquemas, validaciones/errores, algoritmo hash, firma y especificación QR.

**NO VERIFICADO / PENDIENTE**
- SIF responsable y modalidad fiscal realmente elegida.
- Aplicabilidad tributaria exacta de Marian Madrid y posibles exclusiones.
- NIF/razón social/serie/domicilio fiscal canónicos y aprobados.
- Declaración responsable del sistema y responsabilidad del productor.
- Integración XML/WSDL/AEAT y credenciales.
- Registro fiscal de factura con estructura oficial AEAT.
- Cálculo de huella y encadenamiento AEAT.
- Generación del QR oficial en ticket.
- Impresión física QR legible en la Epson exacta.
- Remisión real a AEAT, respuesta, recuperación y cotejo.
- Aceptación profesional por asesoría.

**Conclusión:** no hay evidencia para afirmar que el TPV actual emita facturas VERI*FACTU o tickets con QR tributario conforme. La existencia de ledger interno, cierre Z, pago confirmado o ticket impreso no demuestra ese cumplimiento.

## 11. Plan de implementación por hitos

| Hito | Entrega | Criterio de salida | Estado |
|---|---|---|---|
| VQ-01 | Dictamen de aplicabilidad y modalidad | Asesoría confirma emisor, territorio, régimen, SII/exclusiones y modalidad | PENDIENTE |
| VQ-02 | Decisión de SIF único | Determinar si Velo será productor/SIF o se integra proveedor externo | PENDIENTE |
| VQ-03 | Contrato de factura | Series, numeración, tipos, datos fiscales, impuestos, rectificación y snapshot | PENDIENTE |
| VQ-04 | Contrato AEAT | XSD/WSDL, certificados, hash, cadena, control de flujo, errores y recuperación | PENDIENTE |
| VQ-05 | Writer fiscal y outbox durable | Append-only, idempotencia, secuencias, timeout incierto y recuperación | PENDIENTE |
| VQ-06 | Generador URL/QR | URL oficial, encoding, nivel M, medidas y textos | PENDIENTE |
| VQ-07 | Ticket Epson | Prueba física con el modelo y papel reales | PENDIENTE |
| VQ-08 | Integración AEAT pruebas | Alta/anulación, respuesta, errores, incidencia y cotejo QR | PENDIENTE |
| VQ-09 | Wix Runtime E2E | Venta sintética → factura de prueba → QR → impresión → conciliación | PENDIENTE |
| VQ-10 | Revisión profesional y GO | Asesoría aprueba, declaración responsable/contratos y autorización de activación | PENDIENTE |

No implementar VQ-05 antes de cerrar VQ-01 a VQ-04. No habilitar producción hasta completar VQ-10.

## 12. Fuentes oficiales y referencias profesionales

### BOE — normativa vinculante

1. RD 1007/2023, texto consolidado: https://www.boe.es/eli/es/rd/2023/12/05/1007/con
2. RDL 43/2026, de 24 de noviembre (modifica plazo RRSIF): https://www.boe.es/eli/es/rdl/2026/11/24/43
3. RD 238/2026, de 25 de marzo (facturación electrónica B2B y cómputo de plazos): https://www.boe.es/eli/es/rd/2026/03/25/238/con
4. Orden HAC/1028/2026, entrada en vigor 06-10-2026: https://www.boe.es/eli/es/o/2026/10/02/hac1028
5. Orden HAC/1177/2024, especificaciones del SIF: https://www.boe.es/eli/es/o/2024/10/17/hac1177

### AEAT — interpretación y especificaciones técnicas

1. Portal oficial VERI*FACTU e información técnica (diseños, WSDL, XSD, errores, hash, firma y QR): https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html
2. Especificación técnica QR (documento AEAT, versión 0.5.0 consultada): https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf
3. FAQ conceptos y documentos afectados: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-conceptos-definiciones.html
4. FAQ modalidades VERI*FACTU/no verificable, remisión, incidencias y QR: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/sistemas-verifactu.html
5. FAQ ámbito de aplicación: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html
6. Portal de pruebas externas AEAT, accesible desde la página de información técnica.

### Referencia profesional y criterio de uso

Fuentes profesionales complementarias (no sustituyen BOE ni especificaciones AEAT):

- **REAF — Registro de Economistas Asesores Fiscales, Consejo General de Economistas:** ficha normativa del RDL 43/2026, publicada el 25-11-2026. Útil como seguimiento profesional de la modificación; para el efecto jurídico prevalece el texto BOE: https://reaf.economistas.es/normativaestatal/real-decreto-ley-43-2026-de-24-de-noviembre/
- **AECE — Asociación Profesional de Expertos Contables y Tributarios de España:** programa formativo sobre VERI*FACTU que estructura el trabajo profesional en análisis del sistema actual, planificación/diseño, implementación, pruebas/corrección y puesta en marcha/seguimiento. Se usa como checklist metodológico, no como especificación normativa: https://www.aece.es/agenda-aece_202.html
- **AECE — previsión de calendario de 05-10-2026:** se conserva solo como ejemplo de información profesional provisional. Fue publicada antes del RDL 43/2026 y sus fechas no deben utilizarse como calendario vigente: https://www.aece.es/noticias/prevision-nuevo-calendario-para-implantar-verifactu_3649

Criterio profesional de aplicación:
- La asesoría/gestoría de Marian Madrid debe validar régimen, obligación de facturar, series, impuestos, rectificaciones, titularidad del SIF y declaración responsable antes de producción.
- La implementación debe revisarse por un profesional de fiscalidad y por un ingeniero de software con experiencia en sistemas de facturación: los contratos oficiales son normativos, el código demuestra implementación y las pruebas demuestran comportamiento; ninguno sustituye a los otros.
- No se ha usado una guía comercial de proveedor como autoridad normativa. Si se selecciona un proveedor SIF, exigir contrato, declaración responsable, documentación API, SLA, política de incidencias, portabilidad/exportación de registros y evidencias de pruebas.

**Mantenimiento:** revisar esta sección ante cualquier actualización de BOE, AEAT, Orden HAC/1177/2024, esquemas, WSDL, catálogo de errores o especificación QR. La versión de QR y el contrato de envío deben quedar fijados en las pruebas y artefactos emitidos.
