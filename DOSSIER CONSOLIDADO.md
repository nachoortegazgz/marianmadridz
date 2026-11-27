# DOSSIER CONSOLIDADO — MARIAN MADRID

**Documento ejecutivo de entrada.** Vigencia: 27-11-2026. No es una fuente paralela de contratos ni de estado: remite a la documentación especializada vigente. El historial anterior permanece disponible en Git.

## 1. Identificación

- Sitio: Marian Madrid Peluquería y Estética.
- Site ID canónico: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor: Wix Editor clásico; Velo habilitado.
- Estado conocido: Draft / no publicado. Publicación y activación productiva requieren autorización expresa.
- Región: España; idioma: español; moneda: EUR; zona horaria: `Europe/Madrid`.
- Repositorio: https://github.com/nachoortegazgz/marianmadridz (rama `main`).

**Seguridad:** no guardar ni publicar API keys, tokens, secretos ni instrucciones que los expongan. El Site ID identifica el sitio; no es una credencial. Resolver secretos exclusivamente desde el almacén seguro y confirmar el contexto Wix antes de operar.

## 2. Objetivo del MVP

Completar un ecosistema funcional y verificable para peluquería y estética: reservas simples y duales, catálogo y venta, TPV, pagos, caja, devoluciones, cierres, contabilidad/fiscalidad, jornada laboral, auditoría e integración documental.

Prioridad: preservar el sistema existente y corregir causas raíz con cambios mínimos. No reconstruir módulos funcionales por preferencia técnica ni introducir runtimes paralelos.

## 3. Arquitectura y autoridad

- **Wix Apps:** autoridad de sus dominios nativos. Bookings V2 gobierna servicios, disponibilidad, reservas, profesionales y recursos; Stores Catalog V3 gobierna productos, variantes, precios e inventario; eCommerce/Payments gobiernan pedidos y pagos según sus contratos; Invoices V1 gobierna las facturas nativas instaladas.
- **Wix CMS:** SSOT transaccional de las entidades propias del proyecto. No sustituye a las apps nativas.
- **Git:** fuente del código versionado; no demuestra qué revisión está instalada en Wix.
- **SharePoint:** custodia de documentos y evidencias; no gobierna transacciones ni modifica Capa 1.
- **Frontend:** presentación e interacción. **Backend/WebMethods:** identidad, autorización, validación, reglas, cálculos, persistencia, idempotencia y recuperación.
- **Capa 3:** observación, preparación y entrega de evidencias; no gobierna ni reescribe Capa 1 o 2.
- Las escrituras CMS pasan por DAL, hooks y writers canónicos. No eludirlos mediante escrituras directas.

## 4. Invariantes de integridad y seguridad

1. Un único código y contrato de dominio para desarrollo, pruebas y producción. Fixtures y adaptadores simulados sustituyen dependencias externas, no el runtime de negocio.
2. Sin bloqueos globales por entorno ni bloqueos fiscales preventivos genéricos. Cada operación valida sus requisitos reales; un fallo bloquea únicamente la operación afectada.
3. En pruebas: cero cobros, reembolsos, movimientos económicos, envíos AEAT, notificaciones o efectos externos reales. Usar adaptadores simulados y persistencia aislada inequívoca.
4. No borrar registros ni purgar físicamente datos. No modificar hechos históricos append-only: ledgers fiscales, contables, laborales y cierres contabilizados. Corregir mediante nuevos eventos/registros rectificativos trazables.
5. Datos anteriores al despliegue oficial de producción de 2027 se consideran sintéticos por la regla del proyecto. Esto **no autoriza su borrado** ni su reclasificación destructiva. No clasificar operaciones de negocio mediante etiquetas genéricas `REAL`, `SYNTHETIC`, `SIMULATION`, `sourceType` o `synthetic=true`; usar marcadores explícitos de smoke/fixture solo cuando el contrato lo requiera.
6. No confiar en identidad, rol, precios, impuestos, totales o permisos aportados por el navegador. Secretos solo en almacén seguro.
7. No declarar reservas, pagos, reembolsos, facturas ni cierres confirmados sin evidencia de la autoridad correspondiente.
8. Webhooks, jobs, reintentos y writers deben ser idempotentes y trazables. No repetir automáticamente operaciones de resultado incierto.
9. Errores explícitos, estables y accionables; nunca ocultar persistencia parcial ni sustituir silenciosamente valores inválidos por defaults.

## 5. Contratos y responsabilidades críticas

### Reservas

Bookings V2 es la autoridad de la reserva. El CMS conserva correlaciones, datos complementarios, proyecciones y reconciliación. En reserva dual F1 + exposición + F2 se utiliza **el mismo profesional en ambas fases**; durante la exposición se libera su agenda. No implementar dos profesionales/recursos como regla funcional. Las divergencias entre Bookings y `CitasF2` requieren reconciliación backend idempotente.

### TPV, caja y fiscalidad

- `TransaccionesTPV`: intención comercial; no acredita cobro ni movimiento físico.
- Pago verificado: evidencia independiente de la pasarela/Wix Payments.
- `MovimientosCaja`: ledger físico canónico.
- `CajaActual`: proyección de la sesión, no ledger.
- `ControlOperativo`: locks, idempotencia técnica y auditoría.
- `HistoricoCierresZ` y `LibroAsientosContablesDetalle`: evidencias append-only.
- `RegistroIntegracion`: evidencia de entrega externa; no es origen de la transacción.

`transactionId` es obligatorio en los writers de movimientos que lo requieren. PR #650 lo aplica al writer fiscal manual. **La obligatoriedad global en `eventLog.js` y todos sus consumidores sigue pendiente de auditoría**; no asumir que ya está cerrada ni sustituirla por `sessionId`, secuencia o fingerprint.

El hash interno no equivale al hash AEAT. El mapping fiscal y cualquier conexión normativa deben contrastarse con especificación oficial y revisión profesional; no recalcular históricos ni inferir campos normativos.

### Errores

El normalizador común TPV es `src/backend/tpv/tpvError.js`. Respuesta pública con `status`, `data`, `error` y `traceId`; error con código estable, mensaje seguro y remediation accionable. Incluir metadatos de persistencia/recuperación/auditoría cuando apliquen. No exponer secretos, stack traces ni mensajes brutos de proveedores. Ver contrato completo en `docs/TPV-UNIFIED-FLOW.md`.

## 6. Pruebas y autorización

- Distinguir estático/contrato, unitario, integración simulada, Wix Preview, Wix Runtime E2E y producción.
- CI PASS no acredita Wix Runtime ni sincronización Git-Wix.
- Ejecutar de forma autónoma cambios técnicos reversibles y de bajo riesgo. Solicitar autorización para operaciones irreversibles, sensibles, económicas o productivas.
- No publicar, activar pagos reales ni conectar servicios externos productivos sin autorización expresa.
- Toda evidencia debe identificar commit, entorno, alcance, prueba/flujo y resultado. No declarar pruebas no ejecutadas.

## 7. Estado operativo y prioridades

**Estado de salida conocido: NO-GO para MVP operativo/comercial.** El último estado documentado indica CI offline PASS para el HEAD indicado en `STATE-NOW.md`, pero no acredita Wix Runtime E2E, publicación ni sincronización Git-Wix. Consultar siempre ese documento para el estado vigente; no copiar estados aquí.

Prioridades pendientes registradas:
1. Auditar `eventLog.js` y consumidores; eliminar el fallback `TX_${sequenceNumber}` donde corresponda y cerrar el contrato obligatorio de `transactionId`.
2. Resolver mapping AEAT con fuentes oficiales; no confundir hash interno y hash AEAT.
3. Ejecutar Wix Preview/Runtime E2E con fixture y sesión aislados, sin reutilizar la singleton `CajaActual` ABIERTA ni activar pagos/remesas reales.
4. Reconciliar las seis divergencias Bookings/`CitasF2` con proceso idempotente.
5. Validar transporte Capa 3 en tenant SharePoint aislado.
6. Confirmar SHA/fingerprint instalado en Wix.

El estado y la evidencia fechada pueden cambiar; actualizar `docs/STATE-NOW.md` y `docs/RELEASE-READINESS.md`, no duplicarlos en este resumen.

## 8. Fuentes canónicas del proyecto

- [Índice documental](docs/INDEX.md)
- [Canon de arquitectura — decisiones e invariantes](docs/PROJECT-CANON.md)
- [Estado actual — evidencia y pendientes](docs/STATE-NOW.md)
- [Contrato TPV — flujo, bloqueos y errores](docs/TPV-UNIFIED-FLOW.md)
- [Release readiness — gates y criterios GO](docs/RELEASE-READINESS.md)
- [Esquema CMS — esquema físico y auditoría read-only Wix](docs/ESQUEMA_CMS.md)
- [Archivo histórico y documentos sustituidos](docs/ARCHIVE-MANIFEST.md)

Fuentes oficiales de plataforma: https://dev.wix.com/docs/api-reference y https://dev.wix.com/docs/velo. Para cada método concreto, consultar la documentación y el esquema vigentes antes de implementarlo. La documentación acredita contratos; el código acredita implementación; las pruebas acreditan comportamiento: no son intercambiables.

---

**Regla de precedencia:** documentación oficial aplicable para contratos de plataforma; `PROJECT-CANON` para decisiones arquitectónicas; `TPV-UNIFIED-FLOW` para contrato TPV; `ESQUEMA_CMS` para esquema físico observado; `STATE-NOW` y `RELEASE-READINESS` para estado/evidencias. Código y tests deben contrastarse con esas fuentes. Los documentos históricos no son instrucciones vigentes.
