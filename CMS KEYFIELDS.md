# Diccionario de colecciones CMS — Marian Madrid

**Extracción del esquema vivo:** 25-10-2026. **Sitio:** MarianMadrid.es. **Repositorio de referencia:** nachoortegazgz/marianmadridXXXXX.

> Keyfields, etiquetas visibles, tipos, obligatoriedad, referencias, permisos y revisión proceden de la API oficial Wix CMS en modo lectura. Ejemplos sintéticos; no son datos reales de clientes. Wix no declara opciones para los campos TEXT en el esquema consultado; los enums citados proceden de la matriz documental y deben verificarse en validadores/runtime.

## Resumen

| Colección | Etiqueta de colección Wix | Revisión | Campos (incluye sistema Wix) | Permisos I/U/D/R |
|---|---|---:|---:|---|
| CitasF2 | CITAS_F2 | 19 | 26 | ADMIN/ADMIN/ADMIN/ADMIN |
| ServiciosCatalogo | SERVICIOS_CATALOGO | 193 | 42 | ADMIN/ADMIN/ADMIN/ADMIN |
| ComplementosCatalogo | COMPLEMENTOS_CATALOGO | 137 | 18 | ADMIN/ADMIN/ADMIN/ADMIN |
| CajaActual | CAJA_ACTUAL | 45 | 38 | ADMIN/ADMIN/ADMIN/ADMIN |
| MovimientosCaja | MOVIMIENTOS_CAJA | 60 | 88 | ADMIN/ADMIN/ADMIN/ADMIN |
| DatosFiscales | DATOS FISCALES | 8 | 21 | ADMIN/ADMIN/ADMIN/ADMIN |
| HistoricoCierresZ | HISTORICO_CIERRES_Z | 32 | 62 | ADMIN/ADMIN/ADMIN/ADMIN |
| LibroAsientosContablesDetalle | LIBRO_ASIENTOS_CONTABLES_DETALLE | 24 | 27 | ADMIN/ADMIN/ADMIN/ADMIN |
| InventarioStockVenta | INVENTARIO_STOCK_VENTA | 16 | 26 | ADMIN/ADMIN/ADMIN/ADMIN |
| MovimientosInventario | MOVIMIENTOS_INVENTARIO | 21 | 31 | ADMIN/ADMIN/ADMIN/ADMIN |
| ControlOperativo | CONTROL_OPERATIVO | 15 | 38 | ADMIN/ADMIN/ADMIN/ADMIN |
| RegistrosHorariosStaff | REGISTROS_HORARIOS_STAFF | 9 | 21 | ADMIN/ADMIN/ADMIN/ADMIN |
| MapaStaff | MAPA_STAFF | _ | _ | ADMIN/ADMIN/ADMIN/ADMIN |


## Nomenclatura y directrices

- Usa camelcase para nomenclatura de keyfields y etiquetas visibles de los campos de las colecciones. Sin usar espacios entre terminos.
- Campos nativos del sistema Wix: _id, _createdDate, _updatedDate, _owner. 
- Simplifica usando el mismo Id para el mismo dato con la misma funcion. Evita Ids diferentes para el mismo dato con la misma funcion (ejemplo: memberId no es igual que resourceId;  No intercambiar _id, bookingId, serviceId, resourceId, memberId y catalogId).
- Integración con Wix Apps: usa en los keyfields las IDs nativas usadas en los keyfields de las colecciones nativas de las wix apps: Bookings, Members, Stores, Payments, etc. El valor viene de Wix, pero el keyfield puede ser propio. Completa la etiqueta visible del keyfield con la traduccion al español de cada termino en el mismo orden que estan en keyfield sin añadir preposiciones intermedias (ejemplo: serviceId / servicioId ; movementType /movimientoTipo )
- Si tras buscar el ID nativo equivalente en WIX no existe ninguno que se refiera al dato referido crealo usando la nomenclatura normalizada recomendada por conceptos fiscales españoles, por AEAT y buenas practicas contables( Fiscal/AEAT/Veri*Factu); no asumir que el keyfield es literal de la especificación AEAT sin comprobarla.
- Etiquetas visibles legibles en español, pensadas para comprension del usuario. Añade termino aclaratorio si la etiqueta es generica y puede confundirse con terminos similares. Conserva sin traducir solo anglicismos aceptados (ejemplo: stock)
- Si el ID en Keyfield esta en español usamos el mismo Id en etiquetavisible, añadiendo termino aclaratorio si es necesario para diferenciarlo de terminos similares. 
- Usa mayusculas para siglas y acronimos como: AEAT, NIF...

NOTAS: 
- Mantener amount, totalAmount, taxBase, taxAmount y accountingAmount separados hasta documentar fórmula, impuestos, redondeo y signo.
- hash/hashHuella es canónico en MovimientosCaja; recordHash es canónico en contabilidad. previousRecordHash enlaza con el anterior.
- Validar enums TEXT en backend; el CMS no limita las opciones en el esquema consultado. Rechazar alias al escribir.
- DATE para fecha sin hora; DATETIME para instante; NUMBER para cantidades; BOOLEAN para verdadero/falso; OBJECT para estructuras; ARRAY_STRING para listas; referencias CMS para relaciones.

## CitasF2

Etiqueta de colección: CITAS_F2. Revisión: 19. Campo de visualización: bookingId. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| slotStart | franjaInicio | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Inicio del intervalo reservado. | Personalizado Marian Madrid | — |
| totalAmount | totalImporte | NUMBER | Sí | — | 42.35 | Importe total; no confundir con base ni impuesto. | Personalizado Marian Madrid | — |
| slotEnd | franjaFin | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Fin del intervalo reservado. | Personalizado Marian Madrid | — |
| bookingId | reservaId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID reserva Wix> | ID oficial de la reserva Wix Bookings. | Integración Wix: ID externo | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| bookingType | reservaTipo | TEXT | Sí | SIMPLE; DUAL_F1; DUAL_F2 | <valor canónico backend> | Tipo de proceso de reserva, simple o fase dual. | Personalizado Marian Madrid | — |
| bookingStatus | reservaEstado | TEXT | Sí | PENDING; CONFIRMED; CANCELED (matriz documental; confirmar runtime) | <valor canónico backend> | Estado del flujo de reserva propio. | Personalizado Marian Madrid | — |
| paymentStatus | pagoEstado | TEXT | Sí | NOT_PAID; PAID; PENDING_PAYMENT; PENDING_LEDGER; REFUNDED; PARTIALLY_REFUNDED (matriz documental; confirmar runtime) | <valor canónico backend> | Estado de pago de la reserva. | Personalizado Marian Madrid | — |
| serviceId | servicioId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID servicio Wix> | ID del servicio Wix Bookings, distinto del catálogo interno. | Integración Wix: ID externo | — |
| resourceId | recursoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | ID del recurso Wix Bookings. | Integración Wix: ID externo | — |
| pairToken | parejaToken | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Agrupa Fase 1 y Fase 2 del proceso dual. | Personalizado Marian Madrid | — |
| dateYmd | fechaYmd | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Fecha operativa normalizada YYYY-MM-DD. | Personalizado Marian Madrid | — |
| scheduleId | calendarioId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID calendario del slot Wix> | ID de calendario devuelto por el slot nativo de Wix Bookings; conservar el valor del slot, no sustituirlo por `MapaStaff.scheduleId` (`eventsSchedule.id`). | Integración Wix: ID externo | — |
| contactDetails | contactoDetalles | OBJECT | No | — | {"email":"cliente@example.test"} | Objeto de contacto mínimo; minimizar datos personales. | Personalizado Marian Madrid | — |
| thirdPartyId | terceraParteId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de third party id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| catalogId | catalogoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID CMS de ServiciosCatalogo> | ID del elemento de ServiciosCatalogo (`_id`), distinto de `serviceId` de Wix Bookings. | Personalizado Marian Madrid | — |
| cashMovementId | movimientoCajonId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID del movimiento de caja asociado. | Personalizado Marian Madrid | — |
| fiscalData | fiscalesDatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de fiscal data; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| invoicingDate | facturacionFecha | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de invoicing date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sourceEventId | origenEventoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | ID del evento origen para trazabilidad/deduplicación. | Personalizado Marian Madrid | — |
| revision | revisionRegistro | NUMBER | No | — | 42.35 | Campo de revision; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| meta | metadatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de meta; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

**Hallazgo y reparación en lectura real (2026-10-26):** inicialmente, 3 de los 4 registros existentes tenían `catalogId === serviceId`, no el `_id` de `ServiciosCatalogo`. Se corrigió el escritor y se actualizaron condicionalmente solo los `catalogId` de las 3 reservas nativas confirmadas; la lectura posterior verificó los 3 enlaces canónicos y confirmó que `serviceId`, `resourceId`, `scheduleId` y `bookingStatus` permanecieron intactos. El registro sintético de pruebas se dejó sin cambios. Los 3 registros con reserva nativa localizada coinciden con el `scheduleId` de `bookedEntity.slot.scheduleId` de Wix Bookings. Ese valor no debe sustituirse por el `eventsSchedule.id` actual del profesional sin comprobar la reserva nativa.

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| bookingId_unique | bookingId ASC | Sí | ACTIVE (25-10-2026) |
| idx_citasf2_resourceId | resourceId ASC | No | ACTIVE (25-10-2026) |
| Índice regular de CitasF2 1 | pairToken ASC | No | ACTIVE (25-10-2026) |

## ServiciosCatalogo

Etiqueta de colección: SERVICIOS_CATALOGO. Revisión: 193. Campo de visualización: slug. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| sessionCount | sesionNumero | NUMBER | No | — | 1 | Campo de session count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| staffMembers | personalMiembros | MULTI_REFERENCE | No | IDs de colección relacionada | <ID CMS relacionado> | Relación CMS con MapaStaff. | Relación CMS | — |
| pricingPlanId | preciosPlanId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de pricing plan id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| catalogEntryType | catalogoEntradaTipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de catalog entry type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| locationId | ubicacionId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de location id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| description | descripcion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de description; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| serviceId | servicioId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID servicio Wix> | ID del servicio Wix Bookings, distinto del catálogo interno. | Integración Wix: ID externo | — |
| title | tituloServicio | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de title; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| slug | slugRutaUrl | TEXT | No | No declaradas en CMS; validar enum backend si aplica | servicio-demo | Campo de slug; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| tagLine | etiquetaLinea | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de tag line; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| categoryId | categoriaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de category id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| itemNature | elementoNaturaleza | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de item nature; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sku | skuServicio | TEXT | No | No declaradas en CMS; validar enum backend si aplica | MM-DEMO-001 | Campo de sku; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| price | precioPVP | NUMBER | No | — | 42.35 | Campo de price; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| currency | moneda | TEXT | No | No declaradas en CMS; validar enum backend si aplica | EUR | Campo de currency; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| taxIncluded | impuestoIncluido | BOOLEAN | No | true / false | true | Campo de tax included; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| tipoImpositivo | tipoImpositivo | NUMBER | No | — | 42.35 | Tipo impositivo según contrato fiscal. | Concepto fiscal/AEAT; key propio | — |
| calificacionOperacion | calificacionFiscalOperacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de calificacion operacion; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| totalDuration | totalDuracionMin | NUMBER | No | — | 1 | Campo de total duration; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| phase1Duration | fase1DuracionMin | NUMBER | No | — | 1 | Campo de phase1 duration; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| phase2Duration | fase2DuracionMin | NUMBER | No | — | 1 | Campo de phase2 duration; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| exposureDuration | exposicionDuracion | NUMBER | No | — | 1 | Campo de exposure duration; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| allowCombine | permitirCombinar | BOOLEAN | No | true / false | true | Campo de allow combine; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| linkedPhases | vinculadasFases | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de linked phases; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| location | ubicacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de location; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| clientHidden | clienteOculto | BOOLEAN | No | true / false | true | Campo de client hidden; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| onlinePayment | onlinePago | BOOLEAN | No | true / false | true | Campo de online payment; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| inPersonPayment | presencialPago | BOOLEAN | No | true / false | true | Campo de in person payment; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| pricingModel | preciosModelo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de pricing model; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| depositType | depositoTipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de deposit type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| depositAmount | depositoCantidad | NUMBER | No | — | 42.35 | Campo de deposit amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| margin | margen | NUMBER | No | — | 42.35 | Campo de margin; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| internalNotes | internasNotas | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de internal notes; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| category | categoria | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de category; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| precioCosteBase | precioCosteBase | NUMBER | No | — | 42.35 | Campo de precio coste base; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| mainMedia | principalMedio | IMAGE | No | — | wix:image://v1/<media-id> | Campo de main media; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |
| recomendaciones | recomendacionesServicio | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de recomendaciones; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| name | nombreComplemento | MULTI_REFERENCE | No | IDs de colección relacionada | <ID CMS relacionado> | Relación CMS con ComplementosCatalogo. | Relación CMS | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |

## ComplementosCatalogo

Etiqueta de colección: COMPLEMENTOS_CATALOGO. Revisión: 137. Campo de visualización: name. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| sku | skuComplemento | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | MM-DEMO-001 | Campo de sku; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| taxIncluded | impuestoIncluido | BOOLEAN | Sí | true / false | true | Campo de tax included; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| durationMinutes | duracionMinutosComplemento | NUMBER | No | — | 1 | Campo de duration minutes; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| tipoImpositivo | tipoImpositivo | NUMBER | No | — | 42.35 | Tipo impositivo según contrato fiscal. | Concepto fiscal/AEAT; key propio | — |
| addonId | complementoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de addon id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| name | nombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| description | descripcionComplemento | RICH_TEXT | No | — | <p>Texto de ejemplo</p> | Campo de description; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |
| price | precio | NUMBER | No | — | 42.35 | Campo de price; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| itemNature | elementoNaturaleza | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de item nature; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| codigoImpuesto | codigoFiscalImpuesto | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de codigo impuesto; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| claveRegimen | claveFiscalRegimen | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Clave del régimen fiscal. | Concepto fiscal/AEAT; key propio | — |
| cuentaContableIngreso | cuentaContableIngreso | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de cuenta contable ingreso; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| ServiciosCatalogo_name | serviciosCatalogoname | MULTI_REFERENCE | No | IDs de colección relacionada | <ID CMS relacionado> | Relación CMS con ServiciosCatalogo. | Relación CMS | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| Índice regular de COMPLEMENTOS_CATALOGO 1 | name ASC, sku ASC | No | ACTIVE (25-10-2026) |
| Índice único COMPLEMENTOS_CATALOGO 1 | addonId ASC | Sí | ACTIVE (25-10-2026) |

## CajaActual

Etiqueta de colección: CAJA_ACTUAL. Revisión: 45. Campo de visualización: singletonKey. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| netAmount | netoImporte | NUMBER | No | — | 42.35 | Campo de net amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sequenceCounters | secuenciaContadores | OBJECT | No | — | {"schemaVersion":"1.0"} | Contadores de secuencia de caja. | Personalizado Marian Madrid | — |
| versionState | versionEstado | NUMBER | No | — | 1 | Campo de version state; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stateHash | estadoHashHuella | TEXT | No | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Huella del estado de caja. | Personalizado Marian Madrid | — |
| lastMovementAt | ultimoMovimiento | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de last movement at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| differenceReason | diferenciaMotivo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de difference reason; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| difference | diferencia | NUMBER | No | — | 42.35 | Diferencia entre efectivo contado y teórico. | Personalizado Marian Madrid | — |
| countedCash | metalicoCajon | NUMBER | No | — | 1 | Efectivo contado físicamente. | Personalizado Marian Madrid | — |
| expectedCash | esperadoCajon | NUMBER | No | — | 42.35 | Efectivo teórico calculado. | Personalizado Marian Madrid | — |
| cashAmount | cajonCantidad | NUMBER | No | — | 42.35 | Campo de cash amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalOutAmount | totalOutImporte | NUMBER | No | — | 42.35 | Campo de total out amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalInAmount | totalInImporte | NUMBER | No | — | 42.35 | Campo de total in amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| paymentAmount | pagoCantidad | NUMBER | No | — | 42.35 | Campo de payment amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| paymentCount | pagoNumero | NUMBER | No | — | 1 | Campo de payment count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| refundAmount | reembolsoCantidad | NUMBER | No | — | 42.35 | Campo de refund amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| refundCount | reembolsoNumero | NUMBER | No | — | 1 | Campo de refund count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| salesAmount | ventasCantidad | NUMBER | No | — | 42.35 | Campo de sales amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| salesCount | ventasNumero | NUMBER | No | — | 1 | Campo de sales count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| otherAmount | otroImporte | NUMBER | No | — | 42.35 | Campo de other amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| voucherAmount | valesCantidad | NUMBER | No | — | 42.35 | Campo de voucher amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| cardAmount | tarjetasCantidad | NUMBER | No | — | 42.35 | Campo de card amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| openedBy | aperturaResponsable | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de opened by; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| openingAmount | openingCantidad | NUMBER | No | — | 42.35 | Fondo inicial de caja. | Personalizado Marian Madrid | — |
| closedAt | cierreEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de closed at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| openedAt | aperturaEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de opened at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| staffResourceId | personalRecursoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | Campo de staff resource id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | CitasF2: resourceId; válido en CajaActual/MovimientosCaja |
| operationDate | operacionFecha | DATE | No | — | 2026-10-25 | Campo de operation date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| cashRegisterStatus | cajonRegistroEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de cash register status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| singletonKey | singletonClave | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de singleton key; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| isOpen | estaAbierta | BOOLEAN | No | true / false | true | Campo de is open; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| id | idCaja | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| currentSequence | actualSecuencia | NUMBER | No | — | 1 | Campo de current sequence; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| fiscalPeriod | fiscalPeriodo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Periodo fiscal, normalmente YYYY-MM. | Concepto fiscal/AEAT; key propio | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| cashRegisterStatus_operationDate | cashRegisterStatus ASC, operationDate DESC | No | ACTIVE (25-10-2026) |

## MovimientosCaja

Etiqueta de colección: MOVIMIENTOS_CAJA. Revisión: 60. Campo de visualización: numSerieFactura. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| resourceId | recursoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | ID del recurso Wix Bookings. | Integración Wix: ID externo | — |
| baseImponibleOImporteNoSujeto | baseImponibleOImporteNoSujeto | NUMBER | No | — | 42.35 | Campo de base imponible oimporte no sujeto; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| signatureAlgorithm | firmaAlgoritmo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de signature algorithm; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| hashAlgorithm | hashHuellaAlgoritmo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Campo de hash algorithm; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| verificationQR | verificacionQR | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de verification qr; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| payloadAEAT | payloadAEAT | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de AEAT payload; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| digitalSignature | digitalFirma | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de digital signature; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| generationTimestamp | generacionTimestamp | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de generation timestamp; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| serviceIdRedeemed | servicioIdCanjeado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID servicio Wix> | Campo de service id redeemed; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| giftCardOperation | regaloTarjetaOperacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de gift card operation; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| giftCardId | regaloTarjetaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de gift card id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| accountingSign | contabilidadSigno | NUMBER | No | — | 1 | Campo de accounting sign; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| lineItems | lineaElementos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de line items; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| recordSource | origenRegistro | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de record source; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| desgloseDetallado | desgloseDetallado | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de desglose detallado; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| bankReconciliationReference | bancoConciliacionReferencia | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de bank reconciliation reference; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| vatAccrualStatus | vatDevengoEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de vat accrual status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| linkedAdvanceId | vinculadoAvanceId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de linked advance id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| article20Exempt | articulo20Exento | BOOLEAN | No | true / false | true | Campo de article20 exempt; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| cashBasisRegime | cajonBaseRegimen | BOOLEAN | No | true / false | true | Campo de cash basis regime; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| nonSubjectReason | sinSujetoMotivo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de non subject reason; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| issuerThirdPartyTaxId | emisorTercerParteImpuestoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | X1234567A | Campo de issuer third party tax id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| thirdPartyLegalName | terceraParteLegalNombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de third party legal name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| issuedByThirdPartyOrRecipient | emitidoPorTerceraParteODestinatario | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de issued by third party or recipient; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| isB2B | esB2B | BOOLEAN | No | true / false | true | Campo de is b2 b; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| issuerLegalName | emisorLegalNombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de issuer legal name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| correctionAmount | rectificacionCantidad | NUMBER | No | — | 42.35 | Campo de correction amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| issuerInvoiceNumber | emisorFacturaNumero | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de issuer invoice number; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| previousInvoiceIssueDate | anteriorFacturaIssueFecha | DATE | No | — | 2026-10-25 | Campo de previous invoice issue date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| previousInvoiceNumber | anteriorFacturaNumero | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de previous invoice number; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| correctionReason | rectificacionMotivo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de correction reason; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| withholdingBase | retencionBase | NUMBER | No | — | 42.35 | Campo de withholding base; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| IRPFWithholdingRate | IRPFRetencionTipo | NUMBER | No | — | 42.35 | Campo de IRPF withholding rate; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| surchargeRate | recargoTipo | NUMBER | No | — | 42.35 | Campo de surcharge rate; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| linkedBookingIds | idsReservasVinculadas | ARRAY_STRING | No | — | ["id_demo_001"] | Campo de linked booking ids; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| bookingId | reservaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reserva Wix> | ID oficial de la reserva Wix Bookings. | Integración Wix: ID externo | — |
| hash | hashRegistro | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Huella del registro fiscal en caja. | Personalizado Marian Madrid | — |
| amount | cantidad | NUMBER | Sí | — | 42.35 | Importe de movimiento según contrato de caja. | Personalizado Marian Madrid | — |
| taxAmount | impuestoCantidad | NUMBER | No | — | 42.35 | Cuota de impuesto. | Concepto fiscal/AEAT; key propio | — |
| taxBase | ImpuestoBaseImponible | NUMBER | No | — | 42.35 | Base imponible. | Concepto fiscal/AEAT; key propio | — |
| numSerieFactura | numeroSerieFactura | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Número/serie de factura o ticket. | Concepto fiscal/AEAT; key propio | — |
| sequenceNumber | secuenciaNumero | NUMBER | Sí | — | 1 | Secuencia del movimiento fiscal. | Personalizado Marian Madrid | — |
| transactionId | transaccionId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID estable/idempotente de transacción; índice único en MovimientosCaja. | Personalizado Marian Madrid | — |
| previousRecordHash | anteriorRegistroHashHuella | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Huella del registro anterior. | Personalizado Marian Madrid | — |
| recordTimestamp | registroMarcaTemporal | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Campo de record timestamp; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| schemaVersion | esquemaVersion | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de schema version; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| movementType | movimientoTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Tipo de movimiento; enum separado por dominio. | Personalizado Marian Madrid | — |
| totalAmount | totalCantidad | NUMBER | Sí | — | 42.35 | Importe total; no confundir con base ni impuesto. | Personalizado Marian Madrid | — |
| paymentMethod | pagoMetodo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de payment method; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| channelType | canalTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de channel type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| operationDescription | descripcionOperacion | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de operation description; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| staffResourceId | personalRecursoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | Campo de staff resource id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | CitasF2: resourceId; válido en CajaActual/MovimientosCaja |
| tipoFactura | tipoFactura | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de tipo factura; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| fechaExpedicionFactura | fechaExpedicionFactura | DATE | Sí | — | 2026-10-25 | Fecha de expedición de factura. | Concepto fiscal/AEAT; key propio | — |
| fechaOperacion | fechaOperacionFiscal | DATE | No | — | 2026-10-25 | Fecha fiscal de operación. | Personalizado Marian Madrid | — |
| tipoImpositivo | tipoImpositivo | NUMBER | Sí | — | 42.35 | Tipo impositivo según contrato fiscal. | Concepto fiscal/AEAT; key propio | — |
| NIFEmisor | identificadorFiscalEmisorNIF | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | X1234567A | Identificador fiscal del emisor. | Concepto fiscal/AEAT; key propio | — |
| NIFDestinatario | identificadorFiscalDestinatarioNIF | TEXT | No | No declaradas en CMS; validar enum backend si aplica | X1234567A | Identificador fiscal del destinatario. | Concepto fiscal/AEAT; key propio | — |
| recipientLegalName | destinatarioLegalNombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de recipient legal name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| recipientAddress | destinatarioDireccion | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de recipient address; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| payloadFiscal | pagoFiscalDatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Instantánea estructurada de datos fiscales. | Concepto fiscal/AEAT; key propio | — |
| sistemaInformatico | sistemaInformaticoFiscal | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de sistema informatico; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| estadoEnvioAEAT | estadoEnvioAEAT | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Estado de envío/comunicación fiscal a AEAT. | Concepto fiscal/AEAT; key propio | — |
| csvAEAT | csvAEAT | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de csv AEAT; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| fechaEnvioAEAT | fechaEnvioAEAT | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de fecha envio AEAT; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| tipoRectificativa | tipoRectificacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de tipo rectificativa; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| previousInvoiceId | anteriorFacturaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de previous invoice id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| claveRegimen | claveFiscalRegimen | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Clave del régimen fiscal. | Concepto fiscal/AEAT; key propio | — |
| calificacionOperacion | calificacionOperacionFiscal | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de calificacion operacion; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| operacionExenta | operacionExentaFiscal | BOOLEAN | No | true / false | true | Campo de operacion exenta; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| inversionSujetoPasivo | inversionSujetoPasivoFiscal | BOOLEAN | No | true / false | true | Campo de inversion sujeto pasivo; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| IRPFWithholdingAmount | IRPFRetencionCantidad | NUMBER | No | — | 42.35 | Campo de IRPF withholding amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| surchargeAmount | recargoCantidad | NUMBER | No | — | 42.35 | Campo de surcharge amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| fiscalRole | fiscalRol | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de fiscal role; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| eventType | eventoTipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de event type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| thirdPartyId | terceraParteId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de third party id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| catalogId | catalogoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID del elemento del catálogo propio. | Personalizado Marian Madrid | — |
| pairToken | parejaToken | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Agrupa Fase 1 y Fase 2 del proceso dual. | Personalizado Marian Madrid | — |
| orderId | pedidoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID pedido Wix> | Campo de order id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| refundId | reembolsoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reembolso Wix> | Campo de refund id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| fiscalPeriod | fiscalPeriodo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Periodo fiscal, normalmente YYYY-MM. | Concepto fiscal/AEAT; key propio | — |
| accountingAmount | contableImporte | NUMBER | No | — | 1 | Campo de accounting amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| projectionStatus | proyeccionEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de projection status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| idx_fechaExpedicion_sequenceNumber | fechaExpedicionFactura ASC, sequenceNumber ASC | No | ACTIVE (25-10-2026) |
| idx_recordTimestamp | recordTimestamp ASC | No | ACTIVE (25-10-2026) |
| idx_sequenceNumber | sequenceNumber ASC | No | ACTIVE (25-10-2026) |
| transactionId_unique | transactionId ASC | Sí | ACTIVE (25-10-2026) |

## DatosFiscales

Etiqueta de colección: DATOS FISCALES. Revisión: 8. Campo de visualización: taxId. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| taxId | impuestoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | X1234567A | Campo de tax id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| recordType | registroTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de record type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| thirdPartyType | terceraParteTipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de third party type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| legalName | nombreLegal | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de legal name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| commercialName | nombreComercial | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de commercial name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| address | direccion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de address; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| postalCode | codigoPostal | TEXT | No | No declaradas en CMS; validar enum backend si aplica | X1234567A | Campo de postal code; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| province | provincia | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de province; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| country | pais | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de country; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| email | correoElectronico | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cliente@example.test | Campo de email; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| phone | telefono | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de phone; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| taxRegime | impuestoRegimenFiscal | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de tax regime; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| verifactuEnabled | verifactuHabilitado | BOOLEAN | No | true / false | true | Campo de verifactu enabled; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| verifactuVersion | verifactuVersion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de verifactu version; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| tipoUsoPosibleMultiOT | tipoUsoPosibleMultiOt | BOOLEAN | No | true / false | true | Campo de tipo uso posible multi ot; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| indicadorMultiplesOT | indicadorMultiplesOt | BOOLEAN | No | true / false | true | Campo de indicador multiples ot; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| fechaInicioVerifactu | fechaInicioFiscalVerifactu | DATE | No | — | 2026-10-25 | Campo de fecha inicio verifactu; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| idx_recordType | recordType ASC | No | ACTIVE (25-10-2026) |
| idx_thirdPartyType | thirdPartyType ASC | No | ACTIVE (25-10-2026) |
| taxId_unique | taxId ASC | Sí | ACTIVE (25-10-2026) |

## HistoricoCierresZ

Etiqueta de colección: HISTORICO_CIERRES_Z. Revisión: 32. Campo de visualización: recordDomain. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| totalTips | totalPropinas | NUMBER | No | — | 42.35 | Campo de total tips; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closedAt | cierreEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de closed at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| timeZone | zonaHoraria | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de time zone; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingSchemaVersion | cierreEsquemaVersion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de closing schema version; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingSource | cierreOrigen | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de closing source; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| auditedRecordsCount | auditadoRecordsNumero | NUMBER | No | — | 1 | Campo de audited records count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| taxTypeBreakdown | impuestoTipoDesglose | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de tax type breakdown; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| movementTypeBreakdown | movimientoTipoDesglose | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de movement type breakdown; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| endTicketNumber | finTicketNumero | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de end ticket number; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| startTicketNumber | inicioTicketNumero | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de start ticket number; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalOperations | totalOperaciones | NUMBER | No | — | 42.35 | Campo de total operations; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalAdjustments | totalAjustes | NUMBER | No | — | 42.35 | Campo de total adjustments; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closeDate | cierreFecha | DATE | Sí | — | 2026-10-25 | Campo de close date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalRefunds | totalReembolsos | NUMBER | No | — | 42.35 | Campo de total refunds; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| snapshotJSON | instantaneaJSON | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de snapshot JSON; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| fiscalPeriod | fiscalPeriodo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Periodo fiscal, normalmente YYYY-MM. | Concepto fiscal/AEAT; key propio | — |
| totalTaxAmount | totalImpuestoImporte | NUMBER | Sí | — | 42.35 | Campo de total tax amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| totalTaxBase | totalImpuestoBase | NUMBER | Sí | — | 42.35 | Campo de total tax base; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| totalOnline | totalOnlinePagos | NUMBER | Sí | — | 42.35 | Campo de total online; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalBizum | totalBizumPagos | NUMBER | Sí | — | 42.35 | Campo de total bizum; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalCard | totalTarjetaPagos | NUMBER | Sí | — | 42.35 | Campo de total card; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalCash | totalCajonPagos | NUMBER | Sí | — | 42.35 | Campo de total cash; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closedBy | cierreResponsable | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de closed by; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| recordDomain | registroDominio | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de record domain; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingStatus | cierreEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de closing status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| operationDate | operacionFecha | DATE | Sí | — | 2026-10-25 | Campo de operation date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| consolidatedTotalAmount | consolidadoTotalImporte | NUMBER | No | — | 42.35 | Campo de consolidated total amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| grossSalesTotal | brutoVentasTotal | NUMBER | No | — | 42.35 | Campo de gross sales total; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| netTaxableAmount | netoImponibleCantidad | NUMBER | No | — | 42.35 | Campo de net taxable amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| netTaxAmount | netoImpuestoCantidad | NUMBER | No | — | 42.35 | Campo de net tax amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| totalesMedioPago | totalesPorMedioPago | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de totales medio pago; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| startSequence | inicioSecuencia | NUMBER | No | — | 1 | Campo de start sequence; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| endSequence | finSecuencia | NUMBER | No | — | 1 | Campo de end sequence; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| startRecordHash | inicioRegistroHash | TEXT | No | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Campo de start record hash; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| endRecordHash | finRegistroHash | TEXT | No | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Campo de end record hash; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| isIntegrityVerified | integridadVerificada | BOOLEAN | No | true / false | true | Campo de is integrity verified; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingHash | cierreHashHuella | TEXT | No | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Campo de closing hash; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingSignature | cierreFirma | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de closing signature; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| closingSignatureStatus | cierreFirmaEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de closing signature status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| verifiedAt | verificadoEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de verified at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| approverUser | usuarioAprobador | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de approver user; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| estadoEnvioAEAT | estadoEnvioAEAT | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Estado de envío/comunicación fiscal a AEAT. | Concepto fiscal/AEAT; key propio | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| inventoryClosingId | inventarioCierreId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de inventory closing id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| fiscalYear | fiscalAno | NUMBER | No | — | 1 | Campo de fiscal year; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| closingType | cierreTipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de closing type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sku | skuProducto | TEXT | No | No declaradas en CMS; validar enum backend si aplica | MM-DEMO-001 | Campo de sku; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| wixProductId | wixProductoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de wix product id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| stockQuantity | stockCantidad | NUMBER | No | — | 1 | Campo de stock quantity; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| unitCost | unidadCoste | NUMBER | No | — | 42.35 | Campo de unit cost; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stockValue | stockValor | NUMBER | No | — | 1 | Campo de stock value; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| cuentaContable | cuentaFiscalContable | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de cuenta contable; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| summaryData | resumenDatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de summary data; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| invoiceData | facturaDatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de invoice data; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| packageStatus | paqueteEstado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de package status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| packageVersion | paqueteVersion | NUMBER | No | — | 1 | Campo de package version; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sentTo | enviadoA | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de sent to; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sentAt | enviadoEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de sent at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |

## LibroAsientosContablesDetalle

Etiqueta de colección: LIBRO_ASIENTOS_CONTABLES_DETALLE. Revisión: 24. Campo de visualización: origenTipo. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| desgloseDetallado | desgloseDetallado | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de desglose detallado; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| entryId | asientoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de entry id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| recordTimestamp | registroMarcaTemporal | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Campo de record timestamp; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| cashMovementId | movimientoCajonId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID del movimiento de caja asociado. | Personalizado Marian Madrid | — |
| concept | concepto | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de concept; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| lineNumber | lineaNumero | NUMBER | Sí | — | 1 | Campo de line number; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| origenTipo | origenTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de origen tipo; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| origenRegistro | origenRegistro | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de origen registro; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sourceMovementId | origenMovimientoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de source movement id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| entryDate | asientoFecha | DATE | Sí | — | 2026-10-25 | Campo de entry date; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| fiscalPeriod | fiscalPeriodo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Periodo fiscal, normalmente YYYY-MM. | Concepto fiscal/AEAT; key propio | — |
| accountCode | cuentaCodigo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Código de cuenta contable. | Personalizado Marian Madrid | — |
| debitAmount | importeDebe | NUMBER | Sí | — | 42.35 | Importe al debe. | Personalizado Marian Madrid | — |
| creditAmount | importeHaber | NUMBER | Sí | — | 42.35 | Importe al haber. | Personalizado Marian Madrid | — |
| accountingAmount | importeContable | NUMBER | No | — | 1 | Campo de accounting amount; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| payloadFiscal | datosFiscalesPayload | OBJECT | No | — | {"schemaVersion":"1.0"} | Instantánea estructurada de datos fiscales. | Concepto fiscal/AEAT; key propio | — |
| recordHash | registroHash | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Huella de línea/asiento contable. | Personalizado Marian Madrid | MovimientosCaja: hash; contabilidad conserva recordHash |
| previousRecordHash | anteriorRegistroHashHuella | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | sha256:abc123… | Huella del registro anterior. | Personalizado Marian Madrid | — |
| idSistemaInformatico | identificadorSistemaInformatico | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de id sistema informatico; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| bookingId | reservaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reserva Wix> | ID oficial de la reserva Wix Bookings. | Integración Wix: ID externo | — |
| orderId | idPedido | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID pedido Wix> | Campo de order id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| resourceId | recursoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | ID del recurso Wix Bookings. | Integración Wix: ID externo | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |

## InventarioStockVenta

Etiqueta de colección: INVENTARIO_STOCK_VENTA. Revisión: 16. Campo de visualización: sku. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| name | nombre | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| lastInventoryMovementId | ultimoInventarioMovimientoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de last inventory movement id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| lastInventoryMovementAt | ultimoInventarioMovimientoEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de last inventory movement at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| location | ubicacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de location; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| tipoImpositivo | tipoImpositivo | NUMBER | Sí | — | 42.35 | Tipo impositivo según contrato fiscal. | Concepto fiscal/AEAT; key propio | — |
| taxIncluded | impuestoIncluido | BOOLEAN | Sí | true / false | true | Campo de tax included; confirmar significado exacto con consumidores del backend antes de modificarlo. | Concepto fiscal/AEAT; key propio | — |
| price | precio | NUMBER | Sí | — | 42.35 | Campo de price; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sku | skuProducto | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | MM-DEMO-001 | Campo de sku; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stockOnHand | stockFisico | NUMBER | Sí | — | 1 | Unidades físicas existentes. | Personalizado Marian Madrid | — |
| stockReserved | stockReservado | NUMBER | Sí | — | 1 | Unidades reservadas. | Personalizado Marian Madrid | — |
| stockAvailable | stockDisponible | NUMBER | Sí | — | 1 | Unidades disponibles; validar stockOnHand menos stockReserved. | Personalizado Marian Madrid | — |
| wixProductId | wixProductoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de wix product id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| wixVariantId | varianteWixId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de wix variant id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| stockId | stockId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de stock id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| productId | productoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de product id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| variantId | varianteId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de variant id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stockMinimo | stockMinimoNivel | NUMBER | No | — | 1 | Campo de stock minimo; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| reorderPoint | reposicionPunto | NUMBER | No | — | 42.35 | Campo de reorder point; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| reorderQuantity | reposicionCantidad | NUMBER | No | — | 1 | Campo de reorder quantity; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| needsWixReconciliation | necesitaWixConciliacion | BOOLEAN | No | true / false | true | Campo de needs wix reconciliation; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| lastSyncAt | ultimoSincronizacionEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de last sync at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |

## MovimientosInventario

Etiqueta de colección: MOVIMIENTOS_INVENTARIO. Revisión: 21. Campo de visualización: movementToken. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| orderId | idPedido | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID pedido Wix> | Campo de order id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| magnitude | magnitud | NUMBER | No | — | 42.35 | Campo de magnitude; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| nativeCommercialMovement | nativoComercialMovimiento | BOOLEAN | No | true / false | true | Campo de native commercial movement; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| requiresWixReconciliation | requiereWixConciliacion | BOOLEAN | No | true / false | true | Campo de requires wix reconciliation; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| actorMemberId | actorMiembroId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID miembro Wix> | Campo de actor member id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| actorEmail | actorEmail | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cliente@example.test | Campo de actor email; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| referenceId | referenciaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de reference id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| refundId | reembolsoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reembolso Wix> | Campo de refund id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| recordTimestamp | registroMarcaTemporal | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Campo de record timestamp; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| catalogId | catalogoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID del elemento del catálogo propio. | Personalizado Marian Madrid | — |
| productName | productoNombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de product name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| reason | motivo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de reason; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| movementToken | movimientoToken | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Clave idempotente del movimiento de inventario. | Personalizado Marian Madrid | — |
| movementType | movimientoTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Tipo de movimiento; enum separado por dominio. | Personalizado Marian Madrid | — |
| sku | skuProducto | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | MM-DEMO-001 | Campo de sku; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| quantityDelta | cantidadVariacion | NUMBER | Sí | — | 1 | Campo de quantity delta; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| direction | direccion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de direction; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| quantity | cantidad | NUMBER | No | — | 1 | Campo de quantity; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stockBefore | stockAnterior | NUMBER | No | — | 1 | Campo de stock before; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| stockAfter | stockPosterior | NUMBER | No | — | 1 | Campo de stock after; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| operationDescription | descripcionOperacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de operation description; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| sourceEventId | origenEventoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | ID del evento origen para trazabilidad/deduplicación. | Personalizado Marian Madrid | — |
| thirdPartyId | terceraParteId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de third party id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| wixProductId | wixProductoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de wix product id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| wixVariantId | varianteWixId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de wix variant id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| movementId | movimientoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de movement id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| movementToken_unique | movementToken ASC | Sí | ACTIVE (25-10-2026) |
| movementType_createdDate | movementType ASC, _createdDate ASC | No | ACTIVE (25-10-2026) |
| sku_sourceEventId | sku ASC, sourceEventId ASC | No | ACTIVE (25-10-2026) |

## ControlOperativo

Etiqueta de colección: CONTROL_OPERATIVO. Revisión: 15. Campo de visualización: controlType. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| controlType | controlTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Clase de control operativo. | Personalizado Marian Madrid | — |
| dedupeKey | deduplicacionClave | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Clave determinista de deduplicación. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| status | estado | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de status; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| eventId | eventoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de event id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| expiresAt | expiraEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Caducidad de bloqueo/control. | Personalizado Marian Madrid | — |
| bookingId | reservaId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reserva Wix> | ID oficial de la reserva Wix Bookings. | Integración Wix: ID externo | — |
| pairToken | parejaToken | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Agrupa Fase 1 y Fase 2 del proceso dual. | Personalizado Marian Madrid | — |
| resourceId | recursoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | ID del recurso Wix Bookings. | Integración Wix: ID externo | — |
| serviceId | servicioId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID servicio Wix> | ID del servicio Wix Bookings, distinto del catálogo interno. | Integración Wix: ID externo | — |
| slotStart | franjaInicio | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Inicio del intervalo reservado. | Personalizado Marian Madrid | — |
| slotEnd | franjaFin | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fin del intervalo reservado. | Personalizado Marian Madrid | — |
| dateYmd | fechaYmd | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Fecha operativa normalizada YYYY-MM-DD. | Personalizado Marian Madrid | — |
| transactionId | transaccionId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | ID estable/idempotente de transacción; índice único en MovimientosCaja. | Personalizado Marian Madrid | — |
| orderId | pedidoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID pedido Wix> | Campo de order id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| refundId | reembolsoId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID reembolso Wix> | Campo de refund id; confirmar significado exacto con consumidores del backend antes de modificarlo. | Integración Wix: ID externo | — |
| kind | tipo | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de kind; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| attempts | intentos | NUMBER | No | — | 1 | Campo de attempts; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| maxAttempts | maximoIntentos | NUMBER | No | — | 1 | Campo de max attempts; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| nextRetryAt | proximoReintentoEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Próxima fecha/hora de reintento. | Personalizado Marian Madrid | — |
| lastError | ultimoError | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de last error; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| totalAmount | totalImporte | NUMBER | No | — | 42.35 | Importe total; no confundir con base ni impuesto. | Personalizado Marian Madrid | — |
| operationDescription | descripcionOperacion | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de operation description; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| severity | severidad | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de severity; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| alertType | tipoAlerta | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de alert type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| message | mensaje | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de message; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| surface | superficie | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de surface; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| requesterKey | claveSolicitante | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de requester key; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| requestCount | numeroSolicitudes | NUMBER | No | — | 1 | Campo de request count; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| windowStart | inicioVentana | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de window start; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| retryAfter | reintentarDespues | NUMBER | No | — | 42.35 | Campo de retry after; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| payload | payloadControl | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de payload; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| version | versionControl | NUMBER | No | — | 1 | Campo de version; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| processedAt | procesadoEn | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Campo de processed at; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| idxcontrolexpires | controlType ASC, expiresAt ASC | No | ACTIVE (25-10-2026) |
| idxcontrolretry | controlType ASC, nextRetryAt ASC | No | ACTIVE (25-10-2026) |
| idxcontrolstatus | controlType ASC, status ASC | No | ACTIVE (25-10-2026) |

## RegistrosHorariosStaff

Etiqueta de colección: REGISTROS_HORARIOS_STAFF. Revisión: 9. Campo de visualización: resourceId. Permisos: insert=ADMIN, update=ADMIN, remove=ADMIN, read=ADMIN.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| resourceId | recursoId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID recurso Wix> | ID del recurso Wix Bookings. | Integración Wix: ID externo | — |
| notes | notas | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de notes; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| memberId | miembroId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <ID miembro Wix> | ID del miembro Wix Members; distinto de resourceId. | Integración Wix: ID externo | — |
| recordedAt | registradoEn | DATETIME | Sí | — | 2026-10-25T10:30:00.000Z | Marca temporal del registro de jornada. | Personalizado Marian Madrid | — |
| clockEventType | fichajeEventoTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Tipo de evento de fichaje; enum backend. | Personalizado Marian Madrid | — |
| recordType | registroTipo | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de record type; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| traceId | trazabilidadId | TEXT | Sí | No declaradas en CMS; validar enum backend si aplica | trace_demo_001 | ID de correlación end-to-end. | Personalizado Marian Madrid | — |
| adjustmentReason | motivoAjuste | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de adjustment reason; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| signature | firma | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor canónico backend> | Campo de signature; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| recordedTime | registradaHora | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de recorded time; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| dayKey | diaClave | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de day key; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| monthKey | mesClave | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de month key; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| staffName | personalNombre | TEXT | No | No declaradas en CMS; validar enum backend si aplica | Texto de ejemplo | Campo de staff name; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| registeredBy | registradoPor | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Campo de registered by; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| registeredByMemberId | registradoPorMiembroId | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <ID miembro Wix> | ID de Wix Members de quien registra el fichaje. | Personalizado Marian Madrid | — |
| deviceIpAddress | dispositivoDireccionIP | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | IP del dispositivo; dato personal y de seguridad. | Personalizado Marian Madrid | — |
| meta | metadatos | OBJECT | No | — | {"schemaVersion":"1.0"} | Campo de meta; confirmar significado exacto con consumidores del backend antes de modificarlo. | Personalizado Marian Madrid | — |
| _id | ID | TEXT | No | No declaradas en CMS; validar enum backend si aplica | cms_demo_001 | ID único del registro CMS; no equivale a un ID externo. | Wix nativo | — |
| _createdDate | Created Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de creación gestionada por Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No | — | 2026-10-25T10:30:00.000Z | Fecha de actualización gestionada por Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No | No declaradas en CMS; validar enum backend si aplica | <valor de ejemplo> | Propietario del registro según Wix. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| System index 1 | _createdDate DESC | No | ACTIVE (25-10-2026) |
| System index 2 | _id ASC | No | ACTIVE (25-10-2026) |
| idxresourceday | resourceId ASC, dayKey ASC | No | ACTIVE (25-10-2026) |
| idxtypetimestamp | clockEventType ASC, recordedAt ASC | No | ACTIVE (25-10-2026) |
| idx_monthKey | monthKey ASC | No | ACTIVE (25-10-2026) |

## MapaStaff

Etiqueta de colección: `MAPA_STAFF`. Revisión: `11`. Campo de visualización: no declarado en la consulta remitida. Permisos: insert=`ADMIN`, update=`ADMIN`, remove=`ADMIN`, read=`ADMIN`.

> Etiquetas visibles normalizadas a camelCase español conforme a las directrices de nomenclatura. No se han inventado valores de enums ni obligatoriedad no declarada en el esquema consultado.

| Keyfield / ID | Etiqueta visible actual | Tipo | Obligatorio | Opciones / valores | Ejemplo sintético | Función del campo | Origen nomenclatura | Alias / legacy |
|---|---|---|---|---|---|---|---|---|
| displayName | nombreVisiblePersonal | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Nombre visible de la ficha. | Personalizado Marian Madrid | — |
| staffMemberId | personalMiembroId | TEXT | No declarado en el esquema consultado | No declaradas en CMS; no inventar valores | No remitido | ID del perfil de personal en Wix Bookings; distinto de resourceId (recurso) y memberId (usuario Wix Members). | Integración Wix: ID externo | Canónico según el esquema vivo y docs/CMS_STAFF_MAP.md; no confundir con memberId. |
| scheduleId | calendarioId | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Identificador de horario. | Integración Wix: ID externo | Alineado con `CitasF2.scheduleId` → `calendarioId`. |
| thirdPartyId | terceraParteId | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Referencia al tercero fiscal. | Personalizado Marian Madrid / Fiscal | Según SSOT, permanece vacío hasta vincular `DatosFiscales`; prohibido rellenar por inferencia. |
| staffName | personalNombreCanonico | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Nombre canónico de la persona. | Personalizado Marian Madrid | — |
| rolWebsite | rolWebNegocio | TEXT | No declarado en el esquema consultado | No declaradas en el esquema consultado; no inventar valores. La SSOT cita `ADMIN`, `GESTION`, `ESTILISTA`, pendiente de verificación runtime. | No remitido | Rol de autorización en la web. | Personalizado Marian Madrid | Enum no limitado por CMS; validar con `assertValidEnum()` en backend. |
| rolBookings | rolReservasNativo | TEXT | No declarado en el esquema consultado | No declaradas en el esquema consultado; no inventar valores. La SSOT cita `STAFF`, pendiente de verificación runtime. | No remitido | Rol en el dominio de reservas. | Integración Wix: Bookings | Enum no limitado por CMS; validar en backend. |
| memberId | miembroId | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Identificador de Wix Members. | Integración Wix: ID externo | Canónico Members; no confundir con `resourceId`. |
| resourceId | recursoId | TEXT | No declarado en el esquema consultado | No declaradas en CMS; validar en backend si aplica | No remitido | Identificador del recurso de Bookings. | Integración Wix: ID externo | Canónico Bookings; no confundir con `personalMiembroId`, `wixPersonalMiembroId` ni `miembroId`. |
| active | personalActivo | BOOLEAN | No declarado en el esquema consultado | true / false | No remitido | Indica si la ficha está activa. | Personalizado Marian Madrid | La SSOT exige ausencia del campo `active` como estado operacional; revisar ADR/migración. |
| sortOrder | ordenPersonal | NUMBER | No declarado en el esquema consultado | — | No remitido | Orden de presentación. | Personalizado Marian Madrid | — |
| sourceSystem | origenSistemaMaestro | TEXT | No declarado en el esquema consultado | No declaradas en el esquema consultado; no inventar valores. | No remitido | Sistema de origen o autoridad. | Personalizado Marian Madrid | Enum no limitado por CMS; validar en backend. |
| schemaVersion | esquemaVersion | NUMBER | No declarado en el esquema consultado | — | No remitido | Versión del esquema del registro. | Personalizado Marian Madrid | — |
| ServiciosCatalogo_staffMembers | serviciosCatalogoPersonalMiembros | MULTI_REFERENCE | No declarado en el esquema consultado | IDs de colección relacionada | No remitido | Relación con registros de servicios. | Relación CMS | El esquema confirma el tipo de relación; no confirma que los vínculos actuales estén completos. |
| _id | ID | TEXT | No aplica / gestionado por Wix | No declaradas en CMS; validar en backend si aplica | No remitido | Identificador interno del registro CMS. | Wix nativo | No equivale a un ID externo. |
| _createdDate | Created Date | DATETIME | No aplica / gestionado por Wix | — | No remitido | Fecha de creación en Wix. | Wix nativo | — |
| _updatedDate | Updated Date | DATETIME | No aplica / gestionado por Wix | — | No remitido | Fecha de última actualización en Wix. | Wix nativo | — |
| _owner | Owner | TEXT | No aplica / gestionado por Wix | No declaradas en CMS; validar en backend si aplica | No remitido | Propietario Wix del registro. | Wix nativo | — |

### Índices activos observados

| Índice | Campos y orden | Único | Estado |
|---|---|---:|---|
| No remitido | — | — | Pendiente de verificación en Wix CMS antes de documentar como contrato definitivo |

### Notas de contraste SSOT

- `MapaStaff` debe figurar como **colección NATIVE número 13** en el inventario CMS.
- El esquema vivo contiene `staffMemberId` y `active`. `staffMemberId` es el ID del perfil de personal Bookings y no es alias de `memberId` (Wix Members). `wixStaffMemberId` es el duplicado histórico que el runtime no debe consultar. `active` es el indicador operativo real y el resolver exige `active === true`.
- No se han inventado valores para `rolWebsite`, `rolBookings` ni `sourceSystem`; el CMS no limita las opciones TEXT en el esquema consultado.



