# Marian Madrid — Estado actual y guía operativa del proyecto

**Fecha de corte:** 2026-11-11  
**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Sitio:** [www.marianmadrid.es](https://www.marianmadrid.es/)  
**Ámbito:** guía de continuidad técnica, decisiones vigentes, estado de validación y plan de trabajo. No es una certificación de que el sitio publicado coincida con el repositorio.

> **Regla de lectura:** distinguir siempre (1) declarado por negocio, (2) verificado en código/repositorio, (3) verificado mediante lectura live, (4) probado en CI offline, (5) probado en Wix runtime/E2E y (6) publicado. Ningún nivel implica automáticamente el siguiente.

## 1. Resumen ejecutivo

El proyecto utiliza Wix Editor con Velo y Wix Apps nativas. El repositorio GitHub contiene backend, frontend, pruebas y documentación. La prioridad es preservar la integridad del sistema existente, reducir riesgos y completar validaciones reales antes de activar funciones sensibles.

**Estado global:** el código dispone de una base amplia de pruebas offline, pero no existe evidencia suficiente para declarar operativos todos los flujos críticos en Wix runtime ni para afirmar que el HEAD actual de GitHub está publicado. La publicación exacta del código Velo no se puede vincular de forma fiable a un SHA con la evidencia disponible.

### Situación de cambios recientes

- PR #280 y #281: integradas según el historial de trabajo; incorporan proyección de creación de reserva y protección de carrera para preservar el estado CONFIRMED frente a eventos BOOKING_CREATED tardíos. CI final: 53 suites / 530 tests, 0 fallos.
- PR #284: **abierta, draft y no desplegada**. Primera corrección de la proyección de caja física; CI final verde (53 suites / 530 tests). No representa la solución completa de todos los tipos de efectivo.
- Esta actualización documental se realiza en una rama separada y no cambia código funcional, CMS, Wix ni datos de producción.

## 2. Arquitectura y fuentes de verdad

| Dominio | Autoridad / SSOT | Límite de responsabilidad |
|---|---|---|
| Identidad y miembros | Wix Members + correlación backend MapaStaff | No confiar en IDs/nombres enviados por frontend |
| Servicios, complementos y staff elegible | ServiciosCatalogo (declarado por el propietario) | Sincronización hacia Wix Bookings pendiente de verificación técnica |
| Reservas, horarios y disponibilidad | Wix Bookings | CMS propio puede mantener proyecciones de dominio, no sustituir la reserva nativa |
| Catálogo y stock | Wix Stores Catalog V3 | No reintroducir inventario custom paralelo |
| Caja fiscal / registro de operaciones | MovimientosCaja, según contrato existente | Registro fiscal de operaciones, no equivale a efectivo físico disponible |
| Efectivo físico | CajaActual | Proyección mutable solo de entradas/salidas reales del cajón |
| Contabilidad | LibroAsientosContablesDetalle | Consolidación económica; mapeos automáticos PGC requieren aprobación |
| Jornada | Backend Velo + ledger laboral append-only | No sustituir fichajes por eventos de calendario Bookings |
| Documentación | SharePoint (objetivo Capa 3) | Repositorio de evidencia; nunca gobierna ni modifica Capa 1 |

**Invariantes:** ledgers fiscales, contables y laborales append-only; rectificaciones mediante nuevos registros trazables. Wix CMS es la fuente transaccional propia cuando aplica. Frontend sin lógica de negocio. Autorización en backend. Secretos fuera del frontend. Webhooks y procesos asíncronos idempotentes. Las colecciones legacy prohibidas no se reutilizan.

## 3. Decisiones de negocio/técnicas vigentes

### 3.1 Caja física: tres capas diferentes

La regla confirmada por el propietario el 2026-11-11 es que CajaActual solo refleja dinero físico que entra o sale del cajón del establecimiento:

- **Afecta a CajaActual:** cobro presencial en efectivo, devolución en efectivo, aportación física de cambio, retirada física, pago en efectivo a proveedor local y ajuste físico justificado.
- **No afecta a CajaActual:** tarjeta (aunque se cobre en el local), Bizum, pago online, transferencia, gasto pagado desde banco u otros medios que no mueven billetes/monedas del cajón.
- **MovimientosCaja:** mantiene su rol actual de registro fiscal de operaciones. No se deben borrar o excluir movimientos no monetarios por el hecho de que no afecten al cajón.
- **LibroAsientosContablesDetalle:** consolida las operaciones económicas conforme a reglas contables aprobadas. Una operación física puede tener proyección de caja y asiento contable.

La PR #284 solo aplica por ahora el filtro EFECTIVO + PRESENCIAL. Todavía no existe un contrato completo IN/OUT/NONE ni soporte de APORTACION, RETIRO, PAGO_PROVEEDOR o dirección de AJUSTE. No asumir que todos los casos de la lista anterior están implementados.

La apertura live en estado SIMULACION con 300 EUR atribuida a Marian es una proyección sintética de QA, no un evento real ni un saldo conciliado. No abrir ni cerrar caja real, ni reescribir o borrar la fila por inferencia.

### 3.2 ServiciosCatalogo y Wix Bookings

El propietario ha definido ServiciosCatalogo como SSOT de configuración que se sincroniza con Wix Bookings:
- name está vinculado a Complementos catálogo y representa complementos ofrecidos por el servicio.
- staffMembers identifica qué staff es elegible para prestar ese servicio.
- La elegibilidad de staff no equivale a disponibilidad temporal: Bookings combina horario de trabajo, bloqueos/eventos y reservas existentes.

Este contrato está **declarado**, no auditado todavía en código/esquema/sincronización. No editar Bookings directamente ni implementar sincronización hasta inspeccionar esquemas live, referencias/IDs, consumidores, triggers y contratos oficiales. La sincronización debe ser idempotente; retirar un staff de un servicio no elimina el perfil del staff, su horario general ni reservas históricas.

### 3.3 Reservas: integridad de proyecciones

PR #280/#281 añaden el handler wixBookingsV2_onBookingCreated y protegen una carrera en la que un evento de creación tardío podía degradar una proyección ya confirmada. La lógica está cubierta por CI offline, pero el runtime Wix sigue sin certificación.

Una reserva sintética autorizada creada el 2026-11-11 quedó CONFIRMED en Wix Bookings, pero no apareció en CitasF2 ni generó marcador WEBHOOK_EVENT tras dos lecturas. La causa está sin determinar (código publicado divergente, evento no entregado o fallo de handler/persistencia). Se conserva la reserva y su anotación QA. **No cancelar, backfill, reparar ni crear otra reserva de prueba** hasta resolver la causa y definir un procedimiento seguro.

### 3.4 Fiscalidad, caja Z y datos fiscales

- El contrato puro AEAT/hash no equivale a certificación Veri*Factu ni habilita remisión.
- No inventar series, mapeos PGC, facturas, rectificaciones o registros fiscales.
- Se ha detectado discrepancia entre el esquema CMS de DatosFiscales (campo active) y los contratos/validadores de código. Resolver con evidencia de esquema y consumidores antes de cambiarlo.
- La colección DatosFiscales tiene permisos PRIVILEGED verificados por lectura posterior a escritura de permisos.
- El cierre Z y los ledgers requieren reconciliación de contratos/esquemas y pruebas runtime antes de activación.

## 4. Estado por dominio

| Dominio | Estado a fecha de corte | Próximo gate |
|---|---|---|
| CI backend offline | 53 suites / 530 tests verdes en el checkpoint documentado | Repetir sobre el HEAD final de cada PR antes de merge |
| Reservas Bookings ↔ CitasF2 | Código de eventos y tests; incidente live de proyección sin causa | Diagnóstico del evento/handler y prueba aislada; no más escrituras hasta entonces |
| ServiciosCatalogo → Bookings | Contrato de negocio declarado | Auditoría de esquema, IDs, consumidores, trigger, idempotencia y reconciliación |
| Caja física | PR #284 abierta; filtro parcial EFECTIVO/PRESENCIAL | Revisar/merge autorizado, después completar tipos IN/OUT y contratos fiscales/contables |
| Caja sesión/apertura/cierre | ADR en propuesta; SIMULACION bloquea operación | Contrato de sesión, cierre físico vs fiscal, permisos, locks y Z |
| Fichajes | Lectores read-only con validación de integridad; writers bloqueados | Idempotencia, locks persistentes, transiciones, concurrencia y runtime QA |
| Stock | Wix Stores Catalog V3 como autoridad; inventario custom retirado en el trabajo previo | Regresión runtime nativa de pedidos/cancelaciones/devoluciones; no reintroducir ledger stock paralelo |
| Veri*Factu | No apto para remisión | Completar SIF, series, XML/XSD, transporte, respuesta, rectificación y revisión legal |
| Wix Invoices | V1 activa; API V2 no disponible en el último test documentado | Seguir rollout oficial; no forzar adapter/paquete no habilitado |
| Paquetes gestoría | Snapshot trimestral implementado en código/PR previa; envío deshabilitado | Verificar CMS/runtime, formato, hash, permisos y aceptación del asesor |
| M365 / SharePoint / Power Automate | Diseño Capa 3; implantación no demostrada | Auditar tenant/licencias/DLP/permisos y aprobar ADR de transporte |
| Toolchain | Node mínimo Wix CLI for Sites documentado como >=24.22.1; entorno anterior observado con Node 22.16.0 | Preparar entorno Node soportado; manifiesto Wix generado por CLI; resolver ESLint/peer dependencies sin forzar |

## 5. Bloqueos y riesgos principales

1. **P0 fiscal:** no activar Veri*Factu ni anticipos/depositos hasta cerrar tratamiento fiscal, factura, series, rectificación y validación legal.
2. **P1 reservas:** reserva nativa sin proyección CitasF2; no crear más pruebas ni backfill hasta diagnosticar.
3. **P1 caja:** PR #284 parcial; la caja live sigue en SIMULACION; contratos de apertura/cierre, aportaciones/retiradas/proveedor/ajustes y Z incompletos.
4. **P1 catálogo:** SSOT ServiciosCatalogo declarado, pero no se ha demostrado el mecanismo de sincronización con Bookings.
5. **P1 runtime:** CI offline no sustituye Wix Local Editor, Preview ni E2E publicado. No se dispone de navegador runtime de este entorno.
6. **P2 Capa 3:** no hay evidencia de flujo real Wix → M365 → SharePoint.
7. **P2 toolchain:** Node del entorno observado no alcanza el mínimo del Wix CLI for Sites; no ejecutar CLI de Sites hasta disponer de Node compatible.

## 6. Plan de acción priorizado

### P0 — Integridad fiscal y datos

- Mantener desactivada la remisión Veri*Factu y cualquier activación de anticipos que requiera facturación/IVA no resuelta.
- Reconciliar contratos DatosFiscales, MovimientosCaja, HistoricoCierresZ y LibroAsientosContablesDetalle contra esquemas CMS live y consumidores.
- No recalcular ni sobrescribir históricos; rectificar mediante nuevos registros trazables.

### P1 — Reservas y Bookings

- Obtener evidencia del evento real: revisar configuración del handler Velo, logs runtime disponibles, publicación y suscripción efectiva.
- Comparar el código de events.js, booking/bookingCore.js, booking/bookingSaga.js, citasManager.web.js, reservas.web.js y crons.js con la versión efectivamente publicada, sin asumir que coinciden.
- Determinar si falló entrega, handler o persistencia; añadir observabilidad sin duplicar eventos.
- Diseñar reconciliación idempotente y compensación antes de cualquier backfill.
- Auditar ServiciosCatalogo, Complementos catálogo, staffMembers, IDs nativos y mecanismo de sincronización; probar adiciones, retirada de staff, duplicados y eventos tardíos en entorno aislado.

### P1 — Caja física y sesión

- Revisar la PR #284 como cambio independiente; no fusionar ni desplegar sin autorización explícita.
- Completar contrato de clasificación backend IN/OUT/NONE, enums, validación, CMS, tratamiento fiscal/contable y pruebas para aportación, retirada, proveedor y ajuste.
- Resolver sesión de caja: apertura sin creación implícita, permisos específicos, locks, idempotencia, responsable autenticado y precedencia entre cierre manual y cron.
- Separar cierre fiscal Z de arqueo físico y definir evidencia append-only para ambos.
- No tocar el singleton SIMULACION ni los registros QA/ledgers históricos.

### P1 — Jornada y fiabilidad runtime

- Mantener writers de fichaje bloqueados hasta implementar lock persistente, idempotencia, transiciones válidas y concurrencia.
- Ejecutar pruebas negativas de permisos, replay, fallos parciales y recuperación en Wix QA aislado.
- No activar flags de frontend antes de los guards backend y E2E correspondientes.

### P2 — Capa 3 y mantenimiento

- Auditar tenant M365, SharePoint, Power Automate, licencias, DLP, identidades y permisos.
- Aprobar ADR de transporte y contrato de exportación/minimización antes de implementar jobs.
- Resolver toolchain Wix CLI/Node/ESLint sin editar artefactos generados manualmente.
- Retirar deuda solo con búsqueda de consumidores, contratos externos, tests y revisión de diff; no hacer limpieza cosmética.

## 7. Flujo obligatorio de cambio

1. Confirmar baseline, rama y SHA.
2. Identificar módulo, consumidores, contratos y esquema CMS.
3. Consultar documentación oficial vigente de Wix/integración.
4. Definir aceptación y pruebas proporcionales al riesgo.
5. Implementar el cambio mínimo en rama separada.
6. Ejecutar pruebas y registrar comandos/resultados exactos.
7. Revisar diff, permisos, idempotencia, concurrencia y rollback.
8. Abrir PR; no fusionar ni desplegar sin autorización.
9. Validar Wix Local Editor/Preview/E2E con entorno y datos aislados.
10. Publicar solo con aprobación explícita y verificación posterior.

## 8. Límites del entorno y validación

- No hay checkout local del repositorio ni Wix CLI operativo en el entorno anterior observado; no hay navegador/Computer Use para E2E visual.
- Node observado anteriormente: v22.16.0; Wix CLI for Sites requiere >=24.22.1.
- No se ha confirmado staging/clone aislado.
- No es posible verificar desde aquí el SHA exacto de Velo publicado.
- Las consultas live descritas son lecturas o cambios administrativos concretos documentados; no implican validación funcional completa.
- No se han autorizado mutaciones fiscales, pagos reales, comunicaciones a clientes, backfills ni despliegues como parte de esta actualización documental.

## 9. Documentación canónica y jerarquía

1. [README](README.md): punto de entrada e índice.
2. [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.txt): reglas obligatorias de ingeniería y QA.
3. [Dossier técnico consolidado](DOSSIER%20TÉCNICO%20CONSOLIDADO.md): contratos y arquitectura técnica detallada.
4. [Dossier flujos Capa 1 → Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md): arquitectura documental y límites de Capa 3.
5. [Estado detallado del proyecto](docs/PROJECT-STATUS.md): auditorías y evidencia histórica por dominio.
6. [Registro de decisiones](docs/DECISION-LOG.md): decisiones de negocio y arquitectura.
7. [ADR de sesión de caja](docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md): diseño y bloqueos de apertura/cierre.

Si dos documentos discrepan, no borrar la historia: registrar qué afirmación queda superada, por qué, desde qué fecha y con qué evidencia. La configuración live y contratos oficiales prevalecen sobre hipótesis documentales.

---

**Estado de esta guía:** consolidación documental. No declara el sitio listo para producción, no certifica fiscalidad y no acredita publicación de los últimos commits.
